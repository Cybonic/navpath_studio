from PIL import Image

from app.services.map_loader import _occupancy_grid


def test_occupancy_grid_classifies_free_occupied_and_unknown_cells():
    image = Image.new("L", (3, 1))
    image.putdata([255, 0, 127])
    metadata = {
        "mode": "trinary",
        "negate": 0,
        "occupied_thresh": 0.65,
        "free_thresh": 0.25,
    }

    grid = _occupancy_grid(image, metadata)

    assert grid.width == 3
    assert grid.height == 1
    assert grid.cells == [0, 100, -1]
