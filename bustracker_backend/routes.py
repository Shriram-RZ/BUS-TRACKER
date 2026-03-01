import re 
import logging 
from typing import List 

from fastapi import APIRouter ,Depends ,HTTPException 
from sqlalchemy .orm import Session 

from database import get_db 
from models import Route ,Stop ,Bus ,BusLocation 
from schemas import (
RouteCreate ,RouteOut ,
StopCreate ,StopOut ,
BusCreate ,BusOut ,
BusLocationOut ,
SearchRouteRequest ,SearchRouteResponse ,
)
from utils import haversine ,calculate_eta 

logger =logging .getLogger ("routes")

router =APIRouter ()






@router .get ("/routes",response_model =List [RouteOut ],tags =["Public"])
def get_routes (db :Session =Depends (get_db )):
    
    return db .query (Route ).all ()


@router .get ("/buses",response_model =List [BusOut ],tags =["Public"])
def get_buses (db :Session =Depends (get_db )):

    return db .query (Bus ).all ()


@router .get ("/bus-locations",response_model =List [BusLocationOut ],tags =["Public"])
def get_bus_locations (
user_lat :float |None =None ,
user_lng :float |None =None ,
db :Session =Depends (get_db )
):
    
    buses =db .query (Bus ).all ()
    results :list [dict ]=[]

    for bus in buses :
        location :BusLocation |None =(
        db .query (BusLocation ).filter (BusLocation .bus_id ==bus .id ).first ()
        )

        if not location :
            continue 

        stops =(
        db .query (Stop )
        .filter (Stop .route_id ==bus .route_id )
        .order_by (Stop .stop_order )
        .all ()
        )

        eta_minutes :float =0.0 
        if stops :
            if user_lat is not None and user_lng is not None :

                min_user_dist =float ("inf")
                target_stop :Stop |None =None 
                for stop in stops :
                    dist =haversine (user_lat ,user_lng ,stop .latitude ,stop .longitude )
                    if dist <min_user_dist :
                        min_user_dist =dist 
                        target_stop =stop 


                if target_stop :
                    bus_to_stop_dist =haversine (
                    location .latitude ,location .longitude ,
                    target_stop .latitude ,target_stop .longitude 
                    )
                    eta_minutes =round (calculate_eta (bus_to_stop_dist ,bus .average_speed_kmph ),1 )

            else :

                min_dist =float ("inf")
                for stop in stops :
                    dist =haversine (
                    location .latitude ,location .longitude ,
                    stop .latitude ,stop .longitude ,
                    )
                    if dist <min_dist :
                        min_dist =dist 

                eta_minutes =round (calculate_eta (min_dist ,bus .average_speed_kmph ),1 )

        results .append (
        {
        "bus_id":bus .id ,
        "bus_number":bus .bus_number ,
        "lat":round (location .latitude ,6 ),
        "lng":round (location .longitude ,6 ),
        "eta_minutes":eta_minutes ,
        }
        )

    return results 






@router .post ("/search-route",response_model =SearchRouteResponse ,tags =["Voice"])
def search_route (payload :SearchRouteRequest ,db :Session =Depends (get_db )):
    
    query =payload .query .strip ().lower ()





    match =re .search (r"from\s+(.+?)\s+to\s+(.+)",query )
    if not match :
        match =re .search (r"(.+?)\s+to\s+(.+)",query )

    if not match :
        raise HTTPException (
        status_code =400 ,
        detail ="Could not parse origin and destination from query. "
        "Try: 'Bus from <start> to <end>'.",
        )

    start_raw =match .group (1 ).strip ()
    end_raw =match .group (2 ).strip ()


    for prefix in ("bus","a bus","the bus"):
        if start_raw .startswith (prefix ):
            start_raw =start_raw [len (prefix ):].strip ()


    route =(
    db .query (Route )
    .filter (
    Route .start_location .ilike (f"%{start_raw }%"),
    Route .end_location .ilike (f"%{end_raw }%"),
    )
    .first ()
    )

    if not route :
        return SearchRouteResponse (
        message =f"No route found from {start_raw .title ()} to {end_raw .title ()}."
        )


    bus =(
    db .query (Bus )
    .filter (Bus .route_id ==route .id )
    .first ()
    )

    if not bus :
        return SearchRouteResponse (
        message =f"No buses currently assigned to {route .start_location } → {route .end_location }."
        )

    location =db .query (BusLocation ).filter (BusLocation .bus_id ==bus .id ).first ()
    if not location :
        return SearchRouteResponse (
        message =f"Bus {bus .bus_number } is assigned but has no location data yet."
        )


    stops =(
    db .query (Stop )
    .filter (Stop .route_id ==route .id )
    .order_by (Stop .stop_order )
    .all ()
    )

    eta_minutes :float =0.0 
    if stops :
        distances =[
        haversine (location .latitude ,location .longitude ,s .latitude ,s .longitude )
        for s in stops 
        ]
        min_dist =min (distances )
        eta_minutes =round (calculate_eta (min_dist ,bus .average_speed_kmph ),1 )

    return SearchRouteResponse (
    message =f"Bus {bus .bus_number } is arriving in {eta_minutes } minutes."
    )






@router .post ("/admin/add-route",response_model =RouteOut ,status_code =201 ,tags =["Admin"])
def add_route (data :RouteCreate ,db :Session =Depends (get_db )):
   
    route =Route (start_location =data .start_location ,end_location =data .end_location )
    db .add (route )
    db .commit ()
    db .refresh (route )
    logger .info ("✅ Created Route #%d: %s → %s",route .id ,route .start_location ,route .end_location )
    return route 


@router .post ("/admin/add-stop",response_model =StopOut ,status_code =201 ,tags =["Admin"])
def add_stop (data :StopCreate ,db :Session =Depends (get_db )):
    

    route =db .query (Route ).filter (Route .id ==data .route_id ).first ()
    if not route :
        raise HTTPException (status_code =404 ,detail =f"Route {data .route_id } not found.")

    stop =Stop (
    route_id =data .route_id ,
    stop_name =data .stop_name ,
    latitude =data .latitude ,
    longitude =data .longitude ,
    stop_order =data .stop_order ,
    )
    db .add (stop )
    db .commit ()
    db .refresh (stop )
    logger .info ("✅ Added Stop '%s' (order=%d) to Route #%d",stop .stop_name ,stop .stop_order ,stop .route_id )
    return stop 


@router .post ("/admin/add-bus",response_model =BusOut ,status_code =201 ,tags =["Admin"])
def add_bus (data :BusCreate ,db :Session =Depends (get_db )):
    

    route =db .query (Route ).filter (Route .id ==data .route_id ).first ()
    if not route :
        raise HTTPException (status_code =404 ,detail =f"Route {data .route_id } not found.")

    bus =Bus (
    bus_number =data .bus_number ,
    route_id =data .route_id ,
    average_speed_kmph =data .average_speed_kmph ,
    )
    db .add (bus )
    db .commit ()
    db .refresh (bus )


    first_stop =(
    db .query (Stop )
    .filter (Stop .route_id ==data .route_id )
    .order_by (Stop .stop_order )
    .first ()
    )
    if first_stop :
        loc =BusLocation (
        bus_id =bus .id ,
        latitude =first_stop .latitude ,
        longitude =first_stop .longitude ,
        )
        db .add (loc )
        db .commit ()

    logger .info ("✅ Registered Bus %s on Route #%d",bus .bus_number ,bus .route_id )
    return bus 

@router .delete ("/admin/delete-bus/{bus_id}",status_code =200 ,tags =["Admin"])
def delete_bus (bus_id :int ,db :Session =Depends (get_db )):
    
    bus =db .query (Bus ).filter (Bus .id ==bus_id ).first ()
    if not bus :
        raise HTTPException (status_code =404 ,detail =f"Bus {bus_id } not found.")


    db .query (BusLocation ).filter (BusLocation .bus_id ==bus_id ).delete ()

    bus_number =bus .bus_number 
    db .delete (bus )
    db .commit ()

    logger .info ("✅ Deleted Bus %s",bus_number )
    return {"message":f"Bus {bus_number } deleted successfully"}


@router .delete ("/admin/delete-route/{route_id}",status_code =200 ,tags =["Admin"])
def delete_route (route_id :int ,db :Session =Depends (get_db )):
    
    route =db .query (Route ).filter (Route .id ==route_id ).first ()
    if not route :
        raise HTTPException (status_code =404 ,detail =f"Route {route_id } not found.")

    route_name =f"{route .start_location } → {route .end_location }"


    buses =db .query (Bus ).filter (Bus .route_id ==route_id ).all ()
    for bus in buses :
        db .query (BusLocation ).filter (BusLocation .bus_id ==bus .id ).delete ()
    db .query (Bus ).filter (Bus .route_id ==route_id ).delete ()


    db .query (Stop ).filter (Stop .route_id ==route_id ).delete ()


    db .delete (route )
    db .commit ()

    logger .info ("✅ Deleted Route: %s",route_name )
    return {"message":f"Route {route_name } and its fleet deleted successfully"}