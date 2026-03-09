from __future__ import annotations

import heapq
from typing import Dict, List, Tuple, Optional

from sqlalchemy.orm import Session

from ..models import Stop
from ..utils.geo_utils import haversine


Graph = Dict[int, List[Tuple[int, float]]]

_GRAPH_CACHE: Dict[int, Graph] = {}


def build_graph(stops: List[Stop]) -> Graph:
    """
    Build an undirected graph where each stop is a node and edges connect
    consecutive stops along a route, weighted by geographic distance.
    """
    graph: Graph = {}

    # Group stops by route to respect ordering
    stops_by_route: Dict[int, List[Stop]] = {}
    for stop in stops:
        stops_by_route.setdefault(stop.route_id, []).append(stop)

    for route_stops in stops_by_route.values():
        ordered = sorted(route_stops, key=lambda s: s.stop_order)
        for a, b in zip(ordered, ordered[1:]):
            dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude)
            graph.setdefault(a.id, []).append((b.id, dist))
            graph.setdefault(b.id, []).append((a.id, dist))

    return graph


def shortest_path(
    graph: Graph,
    start_id: int,
    end_id: int,
) -> Tuple[List[int], float]:
    """
    Compute the shortest path between two stop ids using Dijkstra.

    Returns (path_stop_ids, total_distance_km).
    """
    if start_id == end_id:
        return [start_id], 0.0

    dist: Dict[int, float] = {start_id: 0.0}
    prev: Dict[int, Optional[int]] = {start_id: None}
    heap: List[Tuple[float, int]] = [(0.0, start_id)]

    while heap:
        d, node = heapq.heappop(heap)
        if node == end_id:
            break
        if d > dist.get(node, float("inf")):
            continue
        for neighbor, weight in graph.get(node, []):
            nd = d + weight
            if nd < dist.get(neighbor, float("inf")):
                dist[neighbor] = nd
                prev[neighbor] = node
                heapq.heappush(heap, (nd, neighbor))

    if end_id not in dist:
        return [], float("inf")

    # Reconstruct path
    path: List[int] = []
    cur: Optional[int] = end_id
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()

    return path, dist[end_id]


def build_graph_for_city(db: Session, city_id: int) -> Graph:
    """
    Build (or retrieve cached) graph for all stops in a given city.
    """
    if city_id in _GRAPH_CACHE:
        return _GRAPH_CACHE[city_id]

    stops = db.query(Stop).filter(Stop.city_id == city_id).all()
    graph = build_graph(stops)
    _GRAPH_CACHE[city_id] = graph
    return graph


def invalidate_city_graph(city_id: int) -> None:
    """
    Invalidate cached graph when routes/stops in a city change.
    """
    _GRAPH_CACHE.pop(city_id, None)

