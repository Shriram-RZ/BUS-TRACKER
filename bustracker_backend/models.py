from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    country = Column(String(255), nullable=False, default="India")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    routes = relationship("Route", back_populates="city", cascade="all, delete-orphan")
    stops = relationship("Stop", back_populates="city", cascade="all, delete-orphan")
    buses = relationship("Bus", back_populates="city", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<City {self.id}: {self.name}, {self.country}>"


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    start_location = Column(
        String(255),
        nullable=False,
        comment="Origin city/stop name",
    )
    end_location = Column(
        String(255),
        nullable=False,
        comment="Destination city/stop name",
    )
    city_id = Column(Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=True)

    city = relationship("City", back_populates="routes")
    stops = relationship(
        "Stop",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="Stop.stop_order",
    )
    buses = relationship(
        "Bus",
        back_populates="route",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Route {self.id}: {self.start_location} → {self.end_location}>"


class Stop(Base):
    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    route_id = Column(
        Integer,
        ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
    )
    city_id = Column(
        Integer,
        ForeignKey("cities.id", ondelete="CASCADE"),
        nullable=True,
    )
    stop_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    stop_order = Column(
        Integer,
        nullable=False,
        comment="1-based ordering along the route",
    )

    route = relationship("Route", back_populates="stops")
    city = relationship("City", back_populates="stops")

    def __repr__(self) -> str:
        return f"<Stop {self.id}: {self.stop_name} (order={self.stop_order})>"


class Bus(Base):
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    bus_number = Column(
        String(50),
        nullable=False,
        unique=True,
        comment="e.g. 21A",
    )
    route_id = Column(
        Integer,
        ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
    )
    city_id = Column(
        Integer,
        ForeignKey("cities.id", ondelete="CASCADE"),
        nullable=True,
    )
    average_speed_kmph = Column(Float, nullable=False, default=40.0)

    route = relationship("Route", back_populates="buses")
    city = relationship("City", back_populates="buses")
    location = relationship(
        "BusLocation",
        back_populates="bus",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Bus {self.id}: {self.bus_number}>"


class BusLocation(Base):
    __tablename__ = "bus_locations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    bus_id = Column(
        Integer,
        ForeignKey("buses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    bus = relationship("Bus", back_populates="location")

    def __repr__(self) -> str:
        return f"<BusLocation bus_id={self.bus_id}: ({self.latitude}, {self.longitude})>"

