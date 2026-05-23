import math

import pytest

from app.services.map_loader import pixel_to_world, world_to_pixel


def test_zero_origin_round_trip():
    metadata = {"resolution": 0.05, "origin": [0.0, 0.0, 0.0], "height": 100}

    world = pixel_to_world(20, 30, metadata)
    pixel = world_to_pixel(world["x"], world["y"], metadata)

    assert pixel["px"] == pytest.approx(20)
    assert pixel["py"] == pytest.approx(30)


def test_nonzero_origin_and_resolution():
    metadata = {"resolution": 0.1, "origin": [-12.4, -8.7, 0.0], "height": 150}

    world = pixel_to_world(10, 20, metadata)

    assert world["x"] == pytest.approx(-11.4)
    assert world["y"] == pytest.approx(4.3)


def test_nonzero_origin_yaw_round_trip():
    metadata = {"resolution": 0.2, "origin": [2.0, -3.0, math.pi / 6], "height": 80}

    world = pixel_to_world(12.5, 42.25, metadata)
    pixel = world_to_pixel(world["x"], world["y"], metadata)

    assert pixel["px"] == pytest.approx(12.5)
    assert pixel["py"] == pytest.approx(42.25)
