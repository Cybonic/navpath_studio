# NavPath Studio PoC Execution Plan

Use this plan to generate a quick but Nav2-compatible proof of concept for a
web application that lets users draw predefined trajectories on Nav2 occupancy
maps and export them as ROS 2 navigation artifacts.

The PoC should stay minimal, but it must respect the map, frame, and path
contracts expected by Nav2.

## Role

You are an expert full-stack robotics software engineer specializing in ROS 2,
Nav2, map-based navigation, and web-based robotics tools.

## Product Goal

Build a quick proof of concept called **NavPath Studio** that allows users to:

1. Upload a Nav2-compatible occupancy map.
2. Display it with correct world scaling and coordinate transforms.
3. Draw simple trajectory primitives on top of the map.
4. Generate waypoints in the `map` frame.
5. Export a valid ROS 2 `nav_msgs/Path` representation.

The application is a planning/design tool. It does not command a robot directly
in this PoC.

## Core Functional Requirements

Must-have features:

1. Upload a map image file, usually `.pgm` or `.png`.
2. Upload the matching Nav2 map YAML metadata file.
3. Parse these map YAML fields:
   - `image`
   - `mode`
   - `resolution`
   - `origin`
   - `negate`
   - `occupied_thresh`
   - `free_thresh`
4. Display the map with proper world scaling using `resolution` and `origin`.
5. Provide map zoom controls:
   - zoom in
   - zoom out
   - reset zoom
   - mouse wheel zoom over the map canvas
   - keep the map centered while zooming unless the user intentionally pans it
6. Provide map pan controls:
   - move map up
   - move map down
   - move map left
   - move map right
   - reset pan
   - drag the map with the mouse
7. Preserve Nav2/ROS map-frame convention: generated poses are expressed in
   `frame_id: "map"` unless the YAML or user explicitly chooses another frame.
8. Provide three drawing tools:
   - Line tool: click start and end.
   - Circle/arc tool: support center + radius or three-point arc.
   - Action node placement tool: click to place semantic/action markers.
9. Generate waypoints along lines and arcs with configurable spacing.
   - Default waypoint spacing: `0.1` meters.
   - The spacing is in world meters, not pixels.
10. Compute pose orientation for path waypoints.
   - For line segments, yaw follows the segment direction.
   - For arcs, yaw follows the tangent direction.
   - Store orientation as a quaternion.
11. Export the trajectory as `nav_msgs/Path`-compatible data in both JSON and
   YAML.
12. Include a simple properties sidebar showing selected element info:
    - primitive type
    - world coordinates
    - length/radius
    - waypoint count
    - spacing
    - associated action node metadata if applicable

## Nav2 Compliance Requirements

The PoC must follow these implementation contracts from the local Nav2
engineering knowledge base:

### Map Contract

The uploaded map represents a static Nav2 occupancy map normally consumed by
`nav2_map_server` and published as `/map`.

Use the YAML metadata as the source of truth:

```yaml
image: floor1.pgm
mode: trinary
resolution: 0.05
origin: [-12.4, -8.7, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
```

Implementation rules:

- Treat `resolution` as meters per pixel/cell.
- Treat `origin` as the world pose of the map image origin in the `map` frame.
- Preserve `origin[2]` yaw in coordinate conversion.
- Do not assume the map origin is `[0, 0, 0]`.
- Do not assume the image Y axis matches the ROS map Y axis.
- Support at least `trinary` mode for the PoC.
- Parse and preserve `scale` and `raw` modes if present, even if advanced
  behavior is left as a documented extension.
- Surface invalid map YAML errors clearly.

### Coordinate Transform Contract

Implement explicit conversion utilities:

```text
pixel_to_world(px, py, map_metadata) -> {x, y}
world_to_pixel(x, y, map_metadata) -> {px, py}
```

The conversion must account for:

- map resolution
- map origin translation
- map origin yaw
- image height and Y-axis inversion

Add unit tests for:

- zero-origin map
- nonzero-origin map
- nonzero resolution
- round-trip pixel -> world -> pixel
- at least one map with `origin` yaw equal to `0`

If origin yaw support is implemented but not exhaustively tested, document the
limitation explicitly. Do not silently ignore yaw.

### Path Export Contract

Export JSON/YAML using a ROS-compatible structure:

```yaml
header:
  frame_id: map
poses:
  - header:
      frame_id: map
    pose:
      position:
        x: 1.0
        y: 2.0
        z: 0.0
      orientation:
        x: 0.0
        y: 0.0
        z: 0.0
        w: 1.0
```

Implementation rules:

- Use `nav_msgs/Path` semantics.
- Every `PoseStamped` must use the same frame as the path header.
- Default frame is `map`.
- Set `z: 0.0` for 2D paths.
- Convert yaw to quaternion with roll = 0 and pitch = 0.
- Preserve waypoint ordering.
- Use meters for exported positions.
- Do not export pixel coordinates as path positions.

Timestamps may be omitted or set to a documented placeholder in the PoC, but the
structure should be easy to adapt to real ROS 2 messages later.

### Occupancy Awareness Contract

Collision checking is out of scope for the first PoC, but the architecture must
not block it later.

For the PoC:

- Display occupied, free, and unknown regions distinctly enough for visual
  inspection.
- Keep parsed occupancy metadata available to frontend tools.
- Add an extension point for future static-map collision checking against
  generated waypoints.
- Do not claim a path is Nav2-safe just because it exports as `nav_msgs/Path`.

### Integration Boundary

The app exports artifacts for Nav2. It does not replace:

- `map_server`
- AMCL/localization
- global/local costmaps
- planner server
- controller server
- behavior trees
- lifecycle manager

Generated paths are design-time artifacts. A real robot still needs localization,
costmaps, controller tracking, recovery behavior, and lifecycle-managed bringup.

## Out Of Scope For PoC

Keep these out of the initial implementation:

- Robot connection or live `cmd_vel`
- Direct Nav2 action client integration
- Real collision checking
- Dynamic obstacle handling
- AMCL/localization UI
- Lifecycle control
- Advanced editing
- Multi-floor routing
- Multi-robot namespacing
- Save/load project database
- Undo/redo
- Graph optimization

Do not remove extension points for these features.

## Tech Stack

Use this stack:

- Frontend: React 18 + Vite + TypeScript
- Canvas: Konva.js / react-konva
- State management: Zustand
- Backend: FastAPI
- Map parsing: Pillow + PyYAML
- Geometry: numpy; shapely only if it simplifies geometry cleanly
- Export: JSON and YAML
- Packaging: Docker Compose

## Required Project Structure

```text
navpath-poc/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapCanvas.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── PropertiesSidebar.tsx
│   │   │   └── ExportPanel.tsx
│   │   ├── tools/
│   │   │   ├── lineTool.ts
│   │   │   ├── arcTool.ts
│   │   │   └── actionNodeTool.ts
│   │   ├── store/
│   │   │   └── useStudioStore.ts
│   │   ├── utils/
│   │   │   ├── coordinates.ts
│   │   │   ├── quaternions.ts
│   │   │   ├── pathExport.ts
│   │   │   └── waypointGeneration.ts
│   │   ├── types.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── maps.py
│   │   │   └── export.py
│   │   ├── services/
│   │   │   ├── map_loader.py
│   │   │   └── path_generator.py
│   │   └── models/
│   │       ├── map.py
│   │       └── path.py
│   ├── tests/
│   │   ├── test_coordinates.py
│   │   └── test_path_export.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## Implementation Requirements

Backend:

- Validate uploaded YAML and image pair.
- Return normalized map metadata to the frontend.
- Return a displayable map image or image URL.
- Provide path export helpers if export is backend-owned.
- Include tests for coordinate transform and path export behavior.
- Use clear error messages for missing YAML fields, invalid origin, invalid
  resolution, unsupported image file, and image/YAML mismatch.

Frontend:

- Render the uploaded map in a stable canvas coordinate system.
- Expand the map canvas to fill the available workspace viewport.
- Support zooming without changing exported world-frame coordinates.
- Support panning without changing exported world-frame coordinates.
- Keep all internal geometry in world coordinates where practical.
- Convert to pixels only for drawing.
- Show cursor world coordinate while hovering over the map.
- Draw line, arc, and action-node primitives.
- Generate preview waypoints.
- Show selected element metadata in the sidebar.
- Export JSON/YAML from world-frame waypoints.

Geometry:

- Generate line waypoints at uniform world-meter spacing.
- Generate arc waypoints at uniform approximate arc-length spacing.
- Include start and end points.
- Avoid duplicate adjacent waypoints.
- Compute tangent yaw for each waypoint.

Types:

- Define TypeScript types for map metadata, drawing primitives, action nodes,
  waypoints, quaternions, and exported path.
- Keep Python Pydantic models aligned with frontend types.

## Acceptance Criteria

The PoC is acceptable when:

1. A Nav2-style `.yaml` + `.pgm` map pair can be uploaded.
2. The map displays with correct scale and origin-aware coordinate conversion.
3. The map can be zoomed in, zoomed out, and reset without changing world-frame
   coordinates.
4. The map can be panned up, down, left, and right while zoomed in.
5. The map canvas expands to the available screen workspace.
6. The map is centered in the canvas by default and remains centered while
   zooming.
7. The mouse can drag the map to pan it without corrupting drawn waypoints.
8. Hovering or clicking reports world coordinates in meters.
9. A line can be drawn and converted into waypoints at `0.1 m` spacing.
10. An arc can be drawn and converted into tangent-oriented waypoints.
11. An action node can be placed and shown in the properties sidebar.
12. Exported path positions are in the `map` frame, not pixels.
13. Exported path orientation is a quaternion derived from waypoint yaw.
14. JSON and YAML exports follow `nav_msgs/Path` structure.
15. Coordinate conversion and path export tests pass.
16. README explains how this PoC relates to Nav2 and what it does not replace.

## Commands To Provide In Final Output

The generated project should include exact commands:

```bash
docker compose up --build
```

Backend-only development:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

Frontend-only development:

```bash
cd frontend
npm install
npm run dev
npm run test
```

## Generation Instructions

When using this execution plan with an LLM or coding agent:

1. First output the complete folder structure.
2. Then create the backend files.
3. Then create backend tests.
4. Then create frontend files.
5. Then create frontend utility tests if the chosen setup supports them.
6. Then create Docker Compose and README.
7. Keep code modular and easy to extend.
8. Prioritize coordinate correctness over UI polish.
9. Do not introduce real robot control in the PoC.
10. Document limitations honestly.
