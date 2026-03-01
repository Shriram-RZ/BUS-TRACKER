import math

import pytest

from bustracker_backend import utils


def test_haversine_zero_distance():
    # same point should result in 0 km
    assert utils.haversine(0.0, 0.0, 0.0, 0.0) == pytest.approx(0.0, abs=1e-9)


def test_haversine_known_distance():
    # roughly the distance between Paris (48.8566,2.3522) and London (51.5074,-0.1278)
    d = utils.haversine(48.8566, 2.3522, 51.5074, -0.1278)
    assert d == pytest.approx(343.5, rel=0.01)  # ~343 km


def test_calculate_eta():
    # 100 km at 50 km/h should take 120 minutes
    assert utils.calculate_eta(100, 50) == pytest.approx(120.0)


def test_calculate_eta_zero_speed():
    # guard against division by zero
    assert utils.calculate_eta(100, 0) == 0.0
    assert utils.calculate_eta(100, -5) == 0.0
