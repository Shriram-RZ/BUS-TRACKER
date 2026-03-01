import math 


def haversine (lat1 :float ,lon1 :float ,lat2 :float ,lon2 :float )->float :
    R =6371.0 


    φ1 ,φ2 =math .radians (lat1 ),math .radians (lat2 )
    Δφ =math .radians (lat2 -lat1 )
    Δλ =math .radians (lon2 -lon1 )


    a =math .sin (Δφ /2 )**2 +math .cos (φ1 )*math .cos (φ2 )*math .sin (Δλ /2 )**2 
    c =2 *math .atan2 (math .sqrt (a ),math .sqrt (1 -a ))

    return R *c 


def calculate_eta (distance_km :float ,speed_kmph :float )->float :

    if speed_kmph <=0 :
        return 0.0 
    return (distance_km /speed_kmph )*60.0 
