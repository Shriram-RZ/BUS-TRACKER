

import os 

from dotenv import load_dotenv 
from sqlalchemy import create_engine 
from sqlalchemy .orm import sessionmaker ,declarative_base 




load_dotenv ()

DATABASE_URL :str =os .getenv ("DATABASE_URL","mysql+pymysql://root:1234@localhost/busdb")








engine =create_engine (
DATABASE_URL ,
pool_pre_ping =True ,
pool_size =10 ,
max_overflow =20 ,
echo =False ,
)




SessionLocal =sessionmaker (autocommit =False ,autoflush =False ,bind =engine )




Base =declarative_base ()


def get_db ():
   
    db =SessionLocal ()
    try :
        yield db 
    finally :
        db .close ()
