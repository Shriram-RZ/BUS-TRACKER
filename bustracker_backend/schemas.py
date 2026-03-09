from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class CityCreate(BaseModel):
    name: str = Field(..., min_length=1, examples=["Coimbatore"])
    country: str = Field(default="India", examples=["India"])
    lat: float = Field(..., examples=[11.0168])
    lng: float = Field(..., examples=[76.9558])


class CityOut(BaseModel):
    id: int
    name: str
    country: str
    lat: float
    lng: float

    model_config = {"from_attributes": True}


class StopCreate(BaseModel):
    route_id: int
    stop_name: str = Field(..., min_length=1, examples=["Kinathukadavu"])
    latitude: float = Field(..., examples=[10.65])
    longitude: float = Field(..., examples=[77.01])
    stop_order: int = Field(..., ge=1)
    city_id: Optional[int] = Field(
        default=None,
        description="Optional explicit city id; if omitted, will be inferred from the route.",
    )


class StopOut(BaseModel):
    id: int
    route_id: int
    stop_name: str
    latitude: float
    longitude: float
    stop_order: int
    city_id: Optional[int] = None

    model_config = {"from_attributes": True}


class RouteCreate(BaseModel):
    start_location: str = Field(..., min_length=1, examples=["Pollachi"])
    end_location: str = Field(..., min_length=1, examples=["Coimbatore"])
    city_id: Optional[int] = Field(
        default=None,
        description="City id for this route; required in multi-city deployments.",
    )


class RouteOut(BaseModel):
    id: int
    start_location: str
    end_location: str
    city_id: Optional[int] = None
    stops: List[StopOut] = []

    model_config = {"from_attributes": True}


class BusCreate(BaseModel):
    bus_number: str = Field(..., min_length=1, examples=["21A"])
    route_id: int
    average_speed_kmph: float = Field(default=40.0, gt=0)
    city_id: Optional[int] = Field(
        default=None,
        description="Optional explicit city id; if omitted, will be inferred from the route.",
    )


class BusOut(BaseModel):
    id: int
    bus_number: str
    route_id: int
    average_speed_kmph: float
    city_id: Optional[int] = None

    model_config = {"from_attributes": True}


class BusLocationOut(BaseModel):
    bus_id: int
    bus_number: str
    lat: float
    lng: float
    eta_minutes: float
    city_id: Optional[int] = None
    last_updated: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SearchRouteRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        examples=["Bus from Pollachi to Coimbatore"],
    )
    city_id: Optional[int] = None


class SearchRouteResponse(BaseModel):
    message: str


class VoiceQueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        examples=[
            "Where is bus 21A?",
            "Next bus to Gandhipuram?",
        ],
    )
    city_id: Optional[int] = Field(
        default=None,
        description="City context for the query.",
    )
    user_lat: Optional[float] = Field(
        default=None,
        description="User latitude, used for nearest_stop / next_bus queries.",
    )
    user_lng: Optional[float] = Field(
        default=None,
        description="User longitude, used for nearest_stop / next_bus queries.",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for conversational context tracking.",
    )


class VoiceQueryResponse(BaseModel):
    intent: Optional[str] = None
    entities: Optional[dict] = None
    message: str

