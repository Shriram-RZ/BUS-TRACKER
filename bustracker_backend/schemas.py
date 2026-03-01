from datetime import datetime 
from typing import Optional ,List 

from pydantic import BaseModel ,Field 






class StopCreate (BaseModel ):
    
    route_id :int 
    stop_name :str =Field (...,min_length =1 ,examples =["Kinathukadavu"])
    latitude :float =Field (...,examples =[10.65 ])
    longitude :float =Field (...,examples =[77.01 ])
    stop_order :int =Field (...,ge =1 )


class StopOut (BaseModel ):
    
    id :int 
    route_id :int 
    stop_name :str 
    latitude :float 
    longitude :float 
    stop_order :int 

    model_config ={"from_attributes":True }






class RouteCreate (BaseModel ):
   
    start_location :str =Field (...,min_length =1 ,examples =["Pollachi"])
    end_location :str =Field (...,min_length =1 ,examples =["Coimbatore"])


class RouteOut (BaseModel ):
   
    id :int 
    start_location :str 
    end_location :str 
    stops :List [StopOut ]=[]

    model_config ={"from_attributes":True }






class BusCreate (BaseModel ):
  
    bus_number :str =Field (...,min_length =1 ,examples =["21A"])
    route_id :int 
    average_speed_kmph :float =Field (default =40.0 ,gt =0 )


class BusOut (BaseModel ):
   
    id :int 
    bus_number :str 
    route_id :int 
    average_speed_kmph :float 

    model_config ={"from_attributes":True }






class BusLocationOut (BaseModel ):
   
    bus_id :int 
    bus_number :str 
    lat :float 
    lng :float 
    eta_minutes :float 

    model_config ={"from_attributes":True }






class SearchRouteRequest (BaseModel ):
    
    query :str =Field (...,min_length =1 ,examples =["Bus from Pollachi to Coimbatore"])


class SearchRouteResponse (BaseModel ):
    
    message :str 
