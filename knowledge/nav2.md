# Nav2 Engineering Knowledge Base

This note accumulates implementation knowledge for building, debugging, and
operating map-based robot navigation stacks with ROS 2 Navigation2, usually
called Nav2.

The emphasis is engineering practice, not academic comparison. Prefer official
Nav2 documentation, ROS message/API documentation, package READMEs, and
reproducible commands over papers or broad claims.

## Scope

This document focuses on robots navigating against a known map using the Nav2
software stack:

```text
robot description + TF + odometry + sensors
        |
        v
map_server + localization
        |
        v
global/local costmaps
        |
        v
planner_server -> controller_server -> cmd_vel
        |
        v
bt_navigator + recoveries + lifecycle management
```

Common assumptions:

- ROS 2 and Nav2 are installed from packages or a known source checkout.
- The robot has a working base controller that accepts `cmd_vel`.
- The robot publishes odometry and sensor data with usable timestamps.
- The robot has a valid TF tree from `map` to sensor frames during navigation.
- Static map navigation uses `map_server` and a localization source such as
  AMCL or SLAM Toolbox localization mode.

## Senior Engineering Rules

1. Fix TF before tuning navigation.
2. Fix odometry before tuning localization.
3. Fix localization before tuning planners.
4. Fix costmaps before tuning controllers.
5. Treat the static map as production data, not a screenshot.
6. Keep mapping mode and navigation mode separate unless you intentionally want
   online SLAM.
7. Version maps, parameter files, BT XML, and RViz configs together.
8. Do not let multiple nodes publish the same global transform.
9. Verify every topic, frame, and lifecycle state from the command line.
10. Tune one layer at a time; otherwise every failure looks like a planner bug.

## Engineering Sources

| Source | Purpose |
|---|---|
| [Nav2 First-Time Robot Setup Guide](https://docs.nav2.org/setup_guides/index.html) | End-to-end setup sequence |
| [Setting Up Transformations](https://docs.nav2.org/setup_guides/transformation/setup_transforms.html) | Required frame tree and TF ownership |
| [Mapping and Localization](https://docs.nav2.org/setup_guides/sensors/mapping_localization.html) | Map, SLAM, AMCL, and costmap setup |
| [Map Server](https://docs.nav2.org/configuration/packages/map_server/configuring-map-server.html) | Loading and publishing occupancy maps |
| [Map Saver](https://docs.nav2.org/configuration/packages/map_server/configuring-map-saver.html) | Saving maps from `/map` |
| [AMCL Configuration](https://docs.nav2.org/configuration/packages/configuring-amcl.html) | Static-map localization parameters |
| [Costmap 2D Configuration](https://docs.nav2.org/configuration/packages/configuring-costmaps.html) | Global and local costmap setup |
| [Static Layer Parameters](https://docs.nav2.org/configuration/packages/costmap-plugins/static.html) | Static map costmap layer behavior |
| [Inflation Layer Parameters](https://docs.nav2.org/configuration/packages/costmap-plugins/inflation.html) | Obstacle inflation and potential fields |
| [Robot Footprint Setup](https://docs.nav2.org/setup_guides/footprint/setup_footprint.html) | `footprint` vs `robot_radius` |
| [Navigation Plugin Selection](https://docs.nav2.org/setup_guides/algorithm/select_algorithm.html) | Planner/controller selection |
| [Nav2 Behavior Trees](https://docs.nav2.org/behavior_trees/) | Navigation task logic and recovery trees |
| [Lifecycle Manager](https://docs.nav2.org/configuration/packages/configuring-lifecycle.html) | Lifecycle bringup and shutdown |
| [nav2_bringup README](https://github.com/ros-planning/navigation2/blob/main/nav2_bringup/README.md) | Example bringup structure |
| [REP-105 Coordinate Frames](https://ros.org/reps/rep-0105.html) | ROS mobile robot frame conventions |

Access date for sources in this note: 2026-05-23.

## Recommended Package Layout

Do not operate a real robot directly from `nav2_bringup` forever. Treat
`nav2_bringup` as a working reference and create a robot-specific bringup
package.

```text
my_robot_nav/
  launch/
    bringup.launch.py
    localization.launch.py
    navigation.launch.py
    slam.launch.py
  config/
    nav2_params.yaml
    amcl.yaml
    costmaps.yaml
    planners.yaml
    controllers.yaml
  maps/
    floor1_v2026_05_23.yaml
    floor1_v2026_05_23.pgm
  behavior_trees/
    navigate_w_replanning_and_recovery.xml
  rviz/
    nav2_debug.rviz
  README.md
```

Keep map files, parameter files, behavior trees, and RViz configs in the same
repository so a tested navigation configuration can be reproduced exactly.

## System Pipeline

The minimum production pipeline is:

```text
URDF / robot_state_publisher
  publishes static and dynamic robot link transforms

base driver / odometry / robot_localization
  publishes odom -> base_link or odom -> base_footprint

lidar / depth / perception
  publishes obstacle observations in a sensor frame

map_server
  publishes /map and /map_metadata

AMCL or localization source
  consumes /map + sensor data + odometry
  publishes map -> odom

global_costmap
  consumes static map + dynamic observations
  provides planning grid in map frame

local_costmap
  consumes live observations
  provides local obstacle grid around robot

planner_server
  computes global path

controller_server
  tracks path and publishes velocity commands

bt_navigator
  owns task-level navigation flow, replanning, and recovery behavior
```

## TF And State Estimation Contract

Nav2 expects a connected TF chain:

```text
map -> odom -> base_link -> sensor_frames
```

Typical ownership:

| Transform | Owner |
|---|---|
| `map -> odom` | AMCL, SLAM Toolbox localization, or another global localization source |
| `odom -> base_link` | wheel odometry, fused odometry, visual odometry, or base driver |
| `base_link -> lidar` | URDF through `robot_state_publisher` or static transform |
| `base_link -> camera` | URDF through `robot_state_publisher` or static transform |

Frame semantics:

- `map` is globally stable but may jump when localization corrects pose.
- `odom` is locally continuous but may drift.
- `base_link` is the robot body frame.
- `base_footprint` is often used for a planar projection of the base.

Do not publish a fake static `map -> odom` transform in production navigation.
That hides localization problems and causes hard-to-debug map alignment errors.

Validation commands:

```bash
ros2 run tf2_tools view_frames
ros2 run tf2_ros tf2_echo map odom
ros2 run tf2_ros tf2_echo odom base_link
ros2 run tf2_ros tf2_echo map base_link
ros2 topic echo /tf --once
ros2 topic echo /tf_static --once
```

## Map-Based Navigation Architecture

Map-based navigation uses a fixed global environment representation. The map is
loaded by `map_server`, used by localization to estimate robot pose, and used by
the global costmap to constrain planning.

```text
map.yaml + map image
        |
        v
nav2_map_server
        |
        +--> /map: nav_msgs/OccupancyGrid
        +--> /map_metadata: nav_msgs/MapMetaData
        |
        +--> AMCL
        |       consumes map + scan + odom TF
        |       publishes map -> odom
        |
        +--> global_costmap static_layer
                builds static obstacle layer
                planner_server plans over this grid
```

Mapping mode and navigation mode should be explicit:

```text
Mapping mode:
  sensors + odom + SLAM -> /map -> map_saver_cli -> map.yaml + image

Navigation mode:
  map_server -> /map
  AMCL/localization -> map -> odom
  Nav2 -> plan, control, recover
```

## Map Integration Deep Dive

### What The Map Is

In Nav2, the static map is usually a `nav_msgs/OccupancyGrid` published on
`/map`. It represents a 2D grid where each cell is free, occupied, or unknown.
The map is not merely visual context for RViz; it is a runtime input to:

- AMCL or another localization source.
- The global costmap static layer.
- The planner server through the global costmap.
- RViz map display and debugging overlays.

The map must agree with the robot's TF, sensor calibration, and odometry. If
laser scans do not overlay walls in RViz, planner/controller tuning is premature.

### Map Artifacts

A normal static map has two files:

```text
maps/
  floor1_v2026_05_23.yaml
  floor1_v2026_05_23.pgm
```

Example:

```yaml
image: floor1_v2026_05_23.pgm
mode: trinary
resolution: 0.05
origin: [-12.4, -8.7, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
```

Field meanings:

| Field | Meaning | Engineering notes |
|---|---|---|
| `image` | Occupancy image path | Prefer a relative path next to the YAML so the pair can move together |
| `mode` | Pixel interpretation | Common values are `trinary`, `scale`, and `raw` |
| `resolution` | Meters per pixel/cell | Must match the scale used during mapping |
| `origin` | Map origin as `[x, y, yaw]` in `map` frame | Incorrect origin produces systematic pose offsets |
| `negate` | Invert black/white occupancy interpretation | Wrong value can turn walls into free space |
| `occupied_thresh` | Occupied probability threshold | Default map saver value is commonly `0.65` |
| `free_thresh` | Free probability threshold | Default map saver value is commonly `0.25` |

Production practice:

- Use descriptive map names: `site_floor_revision_date`.
- Keep map YAML and image in version control if size allows.
- Store source bags or SLAM sessions separately for re-generation.
- Never edit map scale manually unless you know the mapping resolution is wrong.
- Do not bake temporary objects into the static map.

### Map Quality Criteria

A production map should satisfy:

- Walls align with live laser scans across the operating area.
- Doorways and corridors are wide enough after inflation and footprint checks.
- Unknown regions are intentional, not mapping holes.
- Dynamic objects were removed before saving where possible.
- Loop closures did not bend long corridors or duplicate walls.
- Resolution is fine enough for the robot footprint and environment constraints.
- The map origin and orientation are stable across saved versions.

Practical checks in RViz:

```text
Fixed Frame: map
Displays: Map, LaserScan, TF, RobotModel, Global Costmap, Local Costmap, Plan
Check: scan endpoints lie on mapped walls when robot is localized
Check: robot footprint is inside free space, not overlapping walls
Check: global path avoids static obstacles and unknown space as intended
```

### Map Server Configuration

For fixed-map navigation, configure `map_server` with the map YAML or pass it as
a launch argument.

```yaml
map_server:
  ros__parameters:
    yaml_filename: "/absolute/path/to/maps/floor1_v2026_05_23.yaml"
    topic_name: "map"
    frame_id: "map"
    introspection_mode: "disabled"
```

Important implementation detail: Nav2 launch files may override
`yaml_filename` through the launch argument named `map`. Do not configure the
same map path in two competing places unless that behavior is intentional.

Typical launch:

```bash
ros2 launch nav2_bringup localization_launch.py \
  map:=/absolute/path/to/maps/floor1_v2026_05_23.yaml \
  params_file:=/absolute/path/to/config/nav2_params.yaml
```

`map_server` is a lifecycle node. If `/map` is missing, check lifecycle state
before debugging costmaps:

```bash
ros2 lifecycle nodes
ros2 lifecycle get /map_server
ros2 topic echo /map --once
ros2 topic echo /map_metadata --once
```

Expected behavior:

- Active map server publishes `/map`.
- Late subscribers should still receive the map when QoS is configured correctly.
- The map frame should match the global frame used by AMCL and global costmap.

### `/map` And `/map_metadata`

The main runtime topics are:

| Topic | Message | Purpose |
|---|---|---|
| `/map` | `nav_msgs/msg/OccupancyGrid` | Full occupancy grid |
| `/map_metadata` | `nav_msgs/msg/MapMetaData` | Resolution, dimensions, origin |

Useful commands:

```bash
ros2 topic info /map --verbose
ros2 topic echo /map_metadata --once
ros2 topic echo /map --once
```

Inspect these fields:

```text
header.frame_id
info.resolution
info.width
info.height
info.origin.position
info.origin.orientation
```

If `header.frame_id` is not `map`, make sure every consumer is configured for
the actual frame name. Avoid unusual global frame names unless there is a strong
reason.

### AMCL Coupling

AMCL consumes the map and laser scan, then estimates the robot pose in the map.
It normally publishes `map -> odom`.

Baseline AMCL map-related configuration:

```yaml
amcl:
  ros__parameters:
    global_frame_id: "map"
    odom_frame_id: "odom"
    base_frame_id: "base_link"
    scan_topic: "scan"
    map_topic: "map"
    tf_broadcast: true
    set_initial_pose: false
    always_reset_initial_pose: false
    first_map_only: false
```

Notes:

- `global_frame_id` must match the map frame.
- `odom_frame_id` must match the odometry frame.
- `base_frame_id` must match the robot base frame used by Nav2.
- `scan_topic` must match the laser topic.
- `map_topic` must match the map server topic.
- `tf_broadcast: true` lets AMCL publish `map -> odom`.
- `first_map_only: false` allows AMCL to accept a new map after map reloads.

Initial pose flow:

```text
Map starts
AMCL receives map
Robot starts with unknown global pose
Operator or startup config provides initial pose
AMCL particle cloud converges
map -> odom becomes useful
Nav2 can navigate
```

Commands:

```bash
ros2 topic echo /amcl_pose --once
ros2 topic echo /particle_cloud --once
ros2 topic pub /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "..."
ros2 run tf2_ros tf2_echo map odom
```

Common AMCL-map failures:

| Symptom | Likely cause |
|---|---|
| No `/amcl_pose` | AMCL inactive, missing scan, missing map, lifecycle issue |
| Pose jumps badly | Bad odometry, bad laser transform, ambiguous map area |
| Laser scan shifted from map | Wrong initial pose, wrong map origin, bad lidar extrinsics |
| AMCL never converges | Poor map, too few features, wrong scan topic, wrong frame names |
| Navigation works once but breaks after map reload | AMCL `first_map_only`, lifecycle sequencing, stale initial pose |

### Static Layer Coupling

The global costmap usually consumes the static map through
`nav2_costmap_2d::StaticLayer`.

```yaml
global_costmap:
  global_costmap:
    ros__parameters:
      global_frame: "map"
      robot_base_frame: "base_link"
      rolling_window: false
      resolution: 0.05
      track_unknown_space: true
      plugins: ["static_layer", "obstacle_layer", "inflation_layer"]

      static_layer:
        plugin: "nav2_costmap_2d::StaticLayer"
        map_topic: "map"
        map_subscribe_transient_local: true
        subscribe_to_updates: true
```

Key points:

- `global_frame` should normally be `map`.
- `rolling_window` should usually be `false` for global map planning.
- `map_topic` must match map server topic.
- `map_subscribe_transient_local: true` helps late subscribers receive the map.
- `subscribe_to_updates: true` is useful when the map source can update.

Namespace rule:

```text
map_topic: map   -> relative to namespace, e.g. /robot1/map
map_topic: /map  -> absolute global topic
```

Use absolute `/map` for a shared map. Use relative `map` for per-robot maps in
namespaced multi-robot systems.

### Global Costmap Versus Local Costmap

The static map normally belongs in the global costmap. The local costmap should
usually be rolling and based on live obstacle observations.

Global costmap:

```yaml
global_costmap:
  global_costmap:
    ros__parameters:
      global_frame: "map"
      rolling_window: false
      plugins: ["static_layer", "obstacle_layer", "inflation_layer"]
```

Local costmap:

```yaml
local_costmap:
  local_costmap:
    ros__parameters:
      global_frame: "odom"
      robot_base_frame: "base_link"
      rolling_window: true
      width: 4.0
      height: 4.0
      resolution: 0.05
      plugins: ["obstacle_layer", "inflation_layer"]
```

Use the static map for long-range planning. Use live sensors for near-field
collision avoidance. Adding the static layer to the local costmap can be useful
in some constrained systems, but it often makes local navigation brittle if
localization is noisy or the environment changes.

### Map Saving Workflow

After mapping, save the map:

```bash
ros2 run nav2_map_server map_saver_cli -f /absolute/path/to/maps/floor1_v2026_05_23
```

This produces:

```text
floor1_v2026_05_23.yaml
floor1_v2026_05_23.pgm
```

Then verify:

```bash
sed -n '1,120p' maps/floor1_v2026_05_23.yaml
ros2 launch nav2_bringup localization_launch.py \
  map:=$PWD/maps/floor1_v2026_05_23.yaml \
  params_file:=$PWD/config/nav2_params.yaml
```

Checklist before accepting a saved map:

- Start navigation using the saved map.
- Set initial pose in RViz.
- Confirm scan overlay alignment in multiple locations.
- Send short goals in open space.
- Send goals through doorways and narrow corridors.
- Confirm global costmap and map agree.
- Confirm local costmap detects current obstacles.
- Commit the map only after a successful smoke test.

### Map Replacement And Multi-Map Systems

Map switching is possible, but it is a system-level event, not just a file
change. A map switch affects:

- `map_server` loaded map.
- AMCL particle state and initial pose.
- `map -> odom` transform.
- Global costmap static layer.
- Planner assumptions.
- Behavior tree task state.

Safe map replacement procedure:

```text
1. Stop or pause navigation goals.
2. Load the new map through launch or map server service.
3. Ensure AMCL accepts the new map.
4. Reset or provide initial pose.
5. Clear global and local costmaps.
6. Verify /map, /map_metadata, /amcl_pose, and map -> odom.
7. Resume navigation only after localization is stable.
```

Avoid changing maps while the controller is actively tracking a path unless the
behavior tree and application layer explicitly handle that state transition.

### Map Masks, Keepout Zones, And Speed Zones

Do not overload the static occupancy map with every operational rule. Use
separate semantic layers or filter masks for policy:

- Static map: physical walls and permanent obstacles.
- Obstacle layer: live obstacles from sensors.
- Inflation layer: safety margin and planner cost gradient.
- Keepout filter: forbidden zones.
- Speed filter: speed-restricted zones.
- Application logic: doors, elevators, human workflows, docking areas.

This separation keeps the base map reusable and makes operational constraints
easier to audit.

### Map Integration Validation Commands

Run these after bringup:

```bash
ros2 lifecycle nodes
ros2 lifecycle get /map_server
ros2 topic info /map --verbose
ros2 topic echo /map_metadata --once
ros2 topic echo /map --once
ros2 topic echo /amcl_pose --once
ros2 topic hz /scan
ros2 topic hz /odom
ros2 run tf2_ros tf2_echo map odom
ros2 run tf2_ros tf2_echo odom base_link
ros2 run tf2_ros tf2_echo map base_link
ros2 topic echo /global_costmap/costmap --once
ros2 topic echo /local_costmap/costmap --once
```

RViz checks:

```text
Fixed Frame = map
Map display uses /map
LaserScan overlays walls
RobotModel is correctly placed
TF tree is connected
Global Costmap includes static walls
Local Costmap follows robot
Global Path avoids occupied cells
Footprint matches physical robot
```

### Map Integration Failure Modes

| Symptom | Likely cause | First checks |
|---|---|---|
| `/map` missing | Map server inactive, wrong launch arg, bad YAML path | `ros2 lifecycle get /map_server`, launch logs |
| `/map` exists but global costmap empty | Static layer topic/QoS/namespace mismatch | `map_topic`, `map_subscribe_transient_local`, `ros2 topic info` |
| Robot offset from map | Wrong initial pose, AMCL not converged, wrong map origin | RViz scan overlay, `/amcl_pose`, map YAML `origin` |
| Scan rotates around wrong point | Bad lidar extrinsics | TF from `base_link` to lidar frame |
| Planner drives through walls | Static layer missing, inverted map, bad thresholds | costmap display, YAML `negate`, `occupied_thresh` |
| Planner refuses useful unknown regions | Unknown-space policy mismatch | `track_unknown_space`, planner `allow_unknown` |
| Costmap shows robot inside obstacle | Bad footprint, wrong robot frame, poor localization | footprint display, TF, initial pose |
| AMCL never publishes useful pose | Missing scan/map/TF or lifecycle inactive | `/scan`, `/map`, `map -> odom`, lifecycle |
| Works in sim, fails on robot | `use_sim_time`, timestamps, sensor frame, QoS | `/clock`, topic stamps, TF buffer |
| Works until restart | Non-versioned map path, missing launch arg, stale initial pose | launch file, params file, saved pose behavior |

### Map Acceptance Checklist

Before declaring a map production-ready:

- Map file pair is named, versioned, and committed.
- YAML uses a relative `image` path unless deployment requires absolute paths.
- Resolution is appropriate for the robot footprint.
- Static obstacles match reality.
- Temporary obstacles were removed.
- Scan overlay is checked in at least three distinct regions.
- Narrow passages remain navigable after footprint and inflation.
- Initial pose workflow is documented.
- Map launch command is documented.
- Rollback map version is available.

## Costmaps

Costmaps are where most navigation behavior becomes real. A planner does not
plan over the raw map image; it plans over costmaps built from layers.

Common layers:

| Layer | Purpose |
|---|---|
| Static layer | Permanent occupancy from `/map` |
| Obstacle layer | 2D live obstacle marking and clearing |
| Voxel layer | 3D obstacle marking and clearing projected into 2D |
| Inflation layer | Safety margin and cost gradient around obstacles |
| Keepout filter | Forbidden areas |
| Speed filter | Region-specific speed limits |

Global costmap answers:

```text
Where can the robot route through the known world?
```

Local costmap answers:

```text
What is immediately around the robot right now?
```

Debug commands:

```bash
ros2 topic list | grep costmap
ros2 topic echo /global_costmap/costmap --once
ros2 topic echo /local_costmap/costmap --once
ros2 topic echo /global_costmap/published_footprint --once
ros2 topic echo /local_costmap/published_footprint --once
```

Inflation should be tuned deliberately. A narrow lethal buffer may avoid direct
collisions but still produce wall-hugging paths. Use inflation to create useful
cost gradients, then verify the resulting global plan in RViz.

## Footprint

Use `robot_radius` only for robots that are effectively circular. Use
`footprint` for rectangular, asymmetric, long, or payload-carrying robots.

Example:

```yaml
local_costmap:
  local_costmap:
    ros__parameters:
      footprint: "[[0.35, 0.25], [0.35, -0.25], [-0.35, -0.25], [-0.35, 0.25]]"
```

Common footprint mistakes:

- Using a radius for a rectangular robot.
- Forgetting payloads, bumpers, forks, antennas, or sensor protrusions.
- Defining footprint around the wrong base frame.
- Setting inflation to compensate for a bad footprint.

## Planner And Controller Selection

Start simple, then change based on robot kinematics and failure evidence.

Planner starting points:

| Robot/environment | Candidate planner |
|---|---|
| Small circular differential robot | NavFn, Smac 2D |
| Differential robot needing smoother paths | Smac 2D, Theta* |
| Non-circular robot | Smac State Lattice |
| Ackermann/car-like robot | Smac Hybrid-A* |
| Large robot with turn constraints | Smac Hybrid-A* or State Lattice |

Controller starting points:

| Need | Candidate controller |
|---|---|
| Default configurable local planning | DWB |
| Efficient path tracking | Regulated Pure Pursuit |
| Predictive control and richer constraints | MPPI |

Selection rule: choose algorithms that match the robot's actual motion model.
Do not expect a holonomic controller to behave well on a differential robot, or
a point-robot planner to respect a long rectangular base in tight spaces.

## Behavior Trees And Recovery

The BT Navigator owns task-level behavior:

- Compute path.
- Follow path.
- Replan.
- Clear costmaps.
- Retry.
- Back up.
- Spin.
- Wait.
- Cancel or fail task.

Behavior trees are not decorative. They are the right place to encode task flow,
recovery policy, retries, pauses, docking transitions, route-following logic,
and application-level safety decisions.

Useful customizations:

```text
replanning frequency
retry count
clear-global-costmap timing
clear-local-costmap timing
backup distance
wait duration
goal update behavior
docking or charging transition
route graph integration
human-supervised pause/resume
```

Keep BT XML files versioned and reviewed like code. A small recovery change can
substantially alter robot behavior.

## Lifecycle And Bringup

Nav2 nodes are lifecycle nodes. A node can exist but not be active. Always check
state before assuming a topic problem.

Typical lifecycle manager configuration:

```yaml
lifecycle_manager:
  ros__parameters:
    autostart: true
    node_names:
      - controller_server
      - planner_server
      - behavior_server
      - bt_navigator
      - waypoint_follower
      - map_server
      - amcl
```

Commands:

```bash
ros2 lifecycle nodes
ros2 lifecycle get /map_server
ros2 lifecycle get /amcl
ros2 lifecycle get /planner_server
ros2 lifecycle get /controller_server
ros2 node list
ros2 action list
```

Bringup order should respect dependencies:

```text
robot_state_publisher
base driver / odom
sensors
map_server
localization
costmaps
planner/controller/behavior servers
bt_navigator
application goals
```

## Debugging Playbooks

### Robot Does Not Move

Check:

```bash
ros2 action list
ros2 topic echo /cmd_vel --once
ros2 topic hz /cmd_vel
ros2 lifecycle nodes
ros2 topic echo /odom --once
ros2 run tf2_ros tf2_echo odom base_link
```

Likely causes:

- Navigation action rejected or stuck.
- Controller server inactive.
- No valid local plan.
- Base controller not subscribed to expected command topic.
- Safety layer, collision monitor, or hardware E-stop blocking motion.

### Robot Localizes Poorly

Check:

```bash
ros2 topic hz /scan
ros2 topic echo /amcl_pose --once
ros2 topic echo /particle_cloud --once
ros2 run tf2_ros tf2_echo map odom
ros2 run tf2_ros tf2_echo base_link <lidar_frame>
```

Likely causes:

- Bad initial pose.
- Laser frame wrong.
- Odometry too noisy.
- Map changed since it was saved.
- Map has too little geometric structure.

### Planner Fails

Check:

```bash
ros2 topic echo /global_costmap/costmap --once
ros2 topic echo /goal_pose --once
ros2 run tf2_ros tf2_echo map base_link
```

Likely causes:

- Goal is in occupied or unknown space.
- Global costmap missing static layer.
- Robot footprint too large for passage.
- Planner unknown-space policy conflicts with map.
- Transform timeout.

### Controller Oscillates Or Stalls

Check:

```bash
ros2 topic hz /odom
ros2 topic hz /local_costmap/costmap
ros2 topic echo /cmd_vel --once
ros2 run tf2_ros tf2_echo odom base_link
```

Likely causes:

- Poor odometry.
- Local costmap too small or stale.
- Velocity/acceleration limits unrealistic.
- Controller does not match robot kinematics.
- Footprint or inflation makes path locally infeasible.

## Production Checklist

Before field deployment:

- TF tree is connected and stable.
- Odometry is continuous and correctly framed.
- Sensor timestamps are valid.
- Static map is versioned and smoke-tested.
- AMCL initial pose procedure is documented.
- Global costmap includes static map.
- Local costmap detects live obstacles.
- Footprint matches the physical robot.
- Inflation is tuned for environment and robot width.
- Planner matches robot kinematics.
- Controller respects platform velocity and acceleration limits.
- Behavior tree recovery behavior is reviewed.
- Lifecycle bringup is deterministic.
- RViz debug config is committed.
- Launch commands are documented.
- Logs and bags can be collected during failures.

## Recommended Engineering Reading Order

1. [Nav2 First-Time Robot Setup Guide](https://docs.nav2.org/setup_guides/index.html)
2. [Setting Up Transformations](https://docs.nav2.org/setup_guides/transformation/setup_transforms.html)
3. [Mapping and Localization](https://docs.nav2.org/setup_guides/sensors/mapping_localization.html)
4. [Map Server](https://docs.nav2.org/configuration/packages/map_server/configuring-map-server.html)
5. [AMCL Configuration](https://docs.nav2.org/configuration/packages/configuring-amcl.html)
6. [Costmap 2D Configuration](https://docs.nav2.org/configuration/packages/configuring-costmaps.html)
7. [Static Layer Parameters](https://docs.nav2.org/configuration/packages/costmap-plugins/static.html)
8. [Inflation Layer Parameters](https://docs.nav2.org/configuration/packages/costmap-plugins/inflation.html)
9. [Robot Footprint Setup](https://docs.nav2.org/setup_guides/footprint/setup_footprint.html)
10. [Navigation Plugin Selection](https://docs.nav2.org/setup_guides/algorithm/select_algorithm.html)
11. [Nav2 Behavior Trees](https://docs.nav2.org/behavior_trees/)
12. [Lifecycle Manager](https://docs.nav2.org/configuration/packages/configuring-lifecycle.html)
