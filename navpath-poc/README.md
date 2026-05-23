# NavPath Studio PoC

NavPath Studio is a small proof of concept for drawing design-time trajectories
on Nav2 occupancy maps and exporting them as `nav_msgs/Path`-compatible JSON or
YAML.

This app does not command a robot. It does not replace `map_server`, AMCL,
global/local costmaps, planner/controller servers, behavior trees, or lifecycle
management. It creates path artifacts in the `map` frame that can be adapted for
later Nav2 integration.

## Features

- Upload a Nav2 map YAML and matching `.pgm` or `.png` image.
- Parse `resolution`, `origin`, `negate`, thresholds, and map mode.
- Convert between image pixels and ROS map-frame meters.
- Full-screen workspace map canvas.
- Map stays centered by default, including while zooming.
- Zoom and pan the map canvas with buttons, wheel zoom, and mouse dragging.
- Draw lines, half-arcs, and action nodes.
- Generate waypoints at configurable meter spacing.
- Export `nav_msgs/Path`-compatible JSON and YAML.
- Run the full app from one Docker container.

## Run With Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:8000
```

The API is served from the same container under:

```text
http://localhost:8000/api
```

If you access the frontend from another computer over VPN or LAN, open it with
the host machine address, for example:

```text
http://<host-ip>:8000
```

Because the frontend and API are served from the same FastAPI process, browser
uploads use the same origin:

```text
http://<host-ip>:8000/api/maps/upload
```

Make sure port `8000` is reachable through the VPN/firewall.

## Try The Included Floor4 Map

From the repository root, use this existing sample pair:

```text
data/Floor4/floor4_map_nav2_v1_100_150cm.yaml
data/Floor4/floor4_map_nav2_v1_100_150cm.pgm
```

The sample metadata is Nav2-style:

```yaml
mode: trinary
resolution: 0.05
origin: [-10, -10, 0]
negate: 0
occupied_thresh: 0.75
free_thresh: 0.15
```

After loading it in the UI, draw a line or arc and confirm the exported path
uses `frame_id: map` and meter coordinates.

## Backend Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

## Frontend Development

```bash
cd frontend
npm install
npm run dev
npm run test
```

During frontend development, Vite runs on `5173` and calls the backend on
`8000`. In Docker, the production frontend is built and served by FastAPI on
`8000`.

## Nav2 Notes

The exported path uses ROS 2 `nav_msgs/Path` semantics:

- `header.frame_id` defaults to `map`.
- Every pose uses the same frame.
- Positions are in meters, not pixels.
- `z` is set to `0.0`.
- Orientation is a planar yaw quaternion.

The app intentionally avoids collision checking in this PoC. A path that exports
successfully is not automatically safe for a real robot. Production use still
requires localization, costmaps, footprint/inflation validation, controller
tracking, and recovery behavior.

## Known Limitations

- Arc tool creates a simple half-arc from center and edge click.
- No project save/load.
- No undo/redo.
- No direct Nav2 action client integration.
- No real collision checking against occupied cells yet.
