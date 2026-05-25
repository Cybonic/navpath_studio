# NavPath Studio PoC Execution Plan

## 1. Purpose

Use this plan to generate a quick but Nav2-compatible proof of concept for a web application that lets users draw predefined trajectories on Nav2 occupancy maps and export them as ROS 2 navigation artifacts.

The proof of concept should stay minimal, but it must respect the map, frame, coordinate, and path contracts expected by Nav2.

The application is intended for **2D ground robots only**.

Supported robot categories include:

- differential-drive robots
- skid-steer robots
- tracked ground robots
- Ackermann / car-like robots
- omnidirectional ground robots
- forklift-like or large indoor AMRs
- generic 2D wheeled/tracked UGVs

The app does **not** support:

- aerial robots
- underwater or marine robots
- robot arms
- 3D terrain planning
- legged foothold planning
- live robot control in the PoC

---

## 2. Role

You are an expert full-stack robotics software engineer specializing in:

- ROS 2
- Nav2
- occupancy-grid maps
- map-frame coordinate transforms
- path and trajectory generation
- web-based robotics tools
- 2D ground mobile robot navigation

---

## 3. Product Goal

Build a quick proof of concept called **NavPath Studio** that allows users to:

1. Upload a Nav2-compatible occupancy map.
2. Display it with correct world scaling and coordinate transforms.
3. Draw simple 2D ground-robot trajectory primitives on top of the map.
4. Generate ordered waypoints in the `map` frame.
5. Compute yaw and quaternion orientation for each waypoint.
6. Export a valid ROS 2 `nav_msgs/Path` representation.
7. Export a Nav2-ready standard file package containing ROS-message-shaped YAML artifacts that can be loaded by a small ROS 2/Nav2 runner script.
8. Provide basic geometric validation so users can identify paths that are poorly sampled, discontinuous, or likely unsuitable for Nav2 tracking.

The application is a **design-time planning tool**. It does not command a robot directly in this PoC.

> **Path vs. trajectory distinction.** NavPath Studio produces a **geometric path**: a sequence of poses parameterized by arc-length distance `(x(s), y(s), θ(s))`. This is what `nav_msgs/Path` represents. A full **trajectory** additionally encodes time, velocity, angular velocity, and acceleration `(x(t), y(t), v(t), ω(t), a(t))` and requires time parameterization, velocity profiling, and dynamic-feasibility analysis. NavPath Studio does not produce trajectories in this sense. Users must apply a velocity profile and a Nav2 controller to convert the exported path into an executable trajectory on the robot.

The PoC must distinguish between:

- raw drawing control points
- geometric primitives
- computed smooth trajectory
- generated waypoints
- exported Nav2 poses
- trajectory-attached semantic/action markers

The exported `nav_msgs/Path` only represents the generated path. Rich metadata such as trajectory-attached action nodes, primitive types, smoothing settings, robot profile, and validation reports should be stored in the app’s native project/export format.

---

## 4. Key Principle

NavPath Studio should not simply export raw mouse strokes or raw polylines.

The user provides **navigation intent**.

The app produces a **ROS-compatible, world-frame path artifact**.

For the PoC, this means:

```text
user drawing
  ↓
control points
  ↓
line / arc primitives
  ↓
smoothing
  ↓
generated world-frame waypoints
  ↓
yaw generation
  ↓
quaternion generation
  ↓
curvature and heading validation  ← must run on post-smoothed output
  ↓
nav_msgs/Path-compatible export
```

Future versions may add:

```text
velocity profiling and time parameterization
footprint checking
clearance checking
curvature-speed coupling analysis
controller-specific validation
route graph generation
mission execution metadata
```

---

## 5. Core Functional Requirements

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
7. Preserve Nav2/ROS map-frame convention. Generated poses are expressed in `frame_id: "map"` unless the YAML or user explicitly chooses another frame.
8. Provide the primary rough control-point drawing workflow:
   - click-to-add ordered control points
   - display the rough control polygon
   - provide a **Compute Smooth Trajectory** button
   - optional explicit arc tool
   - action node placement on the computed smooth trajectory only
9. Provide an editable field/table of existing control points and computed trajectory summary:
   - list point index, x, and y in meters
   - allow editing point coordinates
   - allow removing points
   - allow clearing the trajectory
   - show ordered rough segments between control points
   - show whether the computed trajectory is current or stale
   - allow editing smoothing settings such as smoothing method, corner radius, smoothing strength, interpolation behavior, and waypoint spacing
10. Generate waypoints along lines and arcs with configurable spacing.
    - Default waypoint spacing: `0.1` meters.
    - Spacing is in world meters, not pixels.
11. Compute and visualize pose orientation for path waypoints.
    - For line segments, yaw follows the segment direction.
    - For arcs, yaw follows the tangent direction.
    - Store orientation as a quaternion.
    - Display orientation at each waypoint using arrows and/or yaw labels.
    - Include yaw and quaternion values in the waypoint details/table.
12. Export the trajectory as `nav_msgs/Path`-compatible data in both JSON and YAML.
13. Export a Nav2-ready standard file package as downloadable `.yaml` files plus an optional ROS 2 runner script. The primary standard artifact is a `nav_msgs/Path` YAML file for Nav2 `followPath`-style execution. A secondary artifact may export sparse `PoseStamped` waypoints for `NavigateThroughPoses` / waypoint-follower-style execution.
14. Include a simple properties sidebar showing selected element information:
    - primitive type
    - world coordinates
    - length/radius
    - waypoint count
    - spacing
    - associated trajectory-attached action node metadata if applicable
14. Include a basic validation report.
15. Allow action nodes to be defined only along the latest computed smooth trajectory, using snap-to-trajectory placement.
16. Include a minimal robot profile abstraction.
17. Include or prepare for a native project export format that preserves data not representable in `nav_msgs/Path`.
18. Provide a **Clear All Content** action that removes all user-created navigation content, including rough control points, computed trajectories, generated waypoints, action nodes, validation state, and export previews, while keeping the loaded map and robot profile available unless the user explicitly resets the whole project.
19. When obstacle avoidance is enabled in the smoothing settings, compute a path that avoids occupied cells in the loaded occupancy grid. The avoidance strategy is **integrated into the selected smoothing method**, not applied as a uniform post-processing step. Each smoother uses the occupancy grid to guide how it deforms the path away from obstacles. The endpoint waypoints are always preserved. If the smoother cannot find a free path within the configured maximum perturbation distance, the computation reports an error and the intersecting segments are highlighted in the validation panel.

---

## 6. Robot Profile Requirements

The PoC should include a minimal configurable 2D ground-robot profile.

This profile is not used for full collision checking in the PoC, but it must exist so the architecture remains robot-agnostic.

Minimum robot profile fields:

```yaml
robot_profile:
  name: generic_2d_ground_robot

  kinematics:
    type: differential | skid_steer | ackermann | omni | generic
    holonomic: false
    can_reverse: false
    can_rotate_in_place: true

  footprint:
    type: circle | rectangle | polygon
    radius: 0.35
    polygon: []

  motion_limits:
    max_linear_velocity: 0.5
    max_angular_velocity: 1.0
    min_turning_radius: 0.8

  path_constraints:
    default_spacing: 0.1
    max_spacing: 0.3
    min_spacing: 0.02
    max_yaw_jump_deg: 30
```

For the PoC, these fields may be configured through defaults or a simple JSON/YAML editor.

The same drawn path may be valid for a differential-drive robot but invalid for an Ackermann robot. The architecture must not assume that all 2D ground robots can rotate in place or follow zero-radius turns.

Kinematic constraint implications for validation:

| `kinematics.type` | In-place rotation | Hard curvature limit | Lateral motion |
|---|---|---|---|
| `differential` | yes | no — can spin; curvature violation is a warning | no |
| `skid_steer` | limited | soft — wheel slip risk; curvature violation is a warning | no |
| `ackermann` | **no** | **yes — curvature > 1/R_min is an error** | no |
| `omni` | yes | no — full lateral motion allowed | yes |
| `generic` | see `can_rotate_in_place` | warn if κ > 1/R_min | no |

The validator must use `kinematics.type` together with `can_rotate_in_place` to decide whether a curvature violation is an error (robot physically cannot execute the turn) or a warning (turn is possible but may require low speed or cause slip).

---

## 7. Internal Data Model Requirements

The application must internally separate the following concepts.

### 7.1 Map Metadata

Represents the uploaded Nav2 map YAML and image-derived properties.

```ts
type MapMetadata = {
  image: string;
  mode: "trinary" | "scale" | "raw";
  resolution: number;
  origin: [number, number, number];
  negate: number;
  occupied_thresh: number;
  free_thresh: number;
  width: number;
  height: number;
  frame_id: string;
};
```

### 7.2 Control Points

User-created points used to define primitives. These are not necessarily exported directly.

```ts
type ControlPoint = {
  id: string;
  x: number;
  y: number;
};
```

### 7.3 Drawing Primitives

Geometric elements created by the user.

```ts
type PathPrimitive = LinePrimitive | ArcPrimitive;

type LinePrimitive = {
  id: string;
  type: "line";
  start: ControlPoint;
  end: ControlPoint;
};

type ArcPrimitive = {
  id: string;
  type: "arc";
  start: ControlPoint;
  end: ControlPoint;
  radius: number;
  clockwise: boolean;
  center?: { x: number; y: number };
};
```

### 7.4 Generated Waypoints

Sampled points generated from primitives at world-meter spacing.

```ts
type Waypoint = {
  id: string;
  x: number;
  y: number;
  yaw: number;
  yaw_deg?: number;
  orientation_quaternion?: Quaternion;
  source_primitive_id: string;
};
```

### 7.4.1 Smoothing Settings and Computed Trajectory

Smoothing settings control how the app converts rough control points into a computed trajectory.

```ts
type SmoothingMethod =
  | "none"
  | "corner_rounding"
  | "chaikin"
  | "catmull_rom"
  | "cubic_spline"
  | "bezier"
  | "savitzky_golay";

type SmoothingSettings = {
  enabled: boolean;
  method: SmoothingMethod;
  waypoint_spacing: number;
  corner_radius: number;
  smoothing_strength: number;
  interpolation_resolution_m: number;
  preserve_endpoints: boolean;
  preserve_action_attachments: boolean;
  min_turning_radius?: number;
  max_yaw_jump_deg: number;
  max_deviation_from_control_polyline_m?: number;
};

type ComputedTrajectory = {
  id: string;
  source_control_point_ids: string[];
  smoothing_settings: SmoothingSettings;
  waypoints: Waypoint[];
  is_stale: boolean;
  validation?: ValidationReport;
};
```

### 7.5 Trajectory-Attached Action Nodes

Semantic/action markers are attached to the **computed smooth trajectory**, not to rough control points and not to arbitrary map positions. They are not part of `nav_msgs/Path` unless the user explicitly exports them as separate pose goals or mission metadata.

Control points define the rough route geometry only. A control point must not automatically become an action waypoint.

```ts
type ActionNode = {
  id: string;
  type: string;

  // Pose is derived from the computed trajectory attachment.
  x: number;
  y: number;
  yaw?: number;

  // Attachment to the computed trajectory.
  trajectory_id: string;
  arc_length_s_m: number;
  waypoint_index?: number;
  source_waypoint_id?: string;

  // The action must remain on the trajectory.
  placement_mode: "snap_to_trajectory";
  attachment_status: "attached" | "stale" | "invalid";

  metadata?: Record<string, unknown>;
};
```

Example action node types:

- stop
- wait
- inspect
- deliver
- dock
- charge
- scan
- trigger external process

### 7.6 Validation Report

Stores geometric and export-readiness diagnostics.

```ts
type ValidationIssue = {
  type: string;
  severity: "info" | "warning" | "error";
  message: string;
  primitive_id?: string;
  waypoint_index?: number;
};

type ValidationReport = {
  status: "valid" | "valid_with_warnings" | "invalid";
  metrics: {
    waypoint_count: number;
    path_length_m: number;
    mean_spacing_m: number;
    min_spacing_m: number;
    max_spacing_m: number;
    max_yaw_jump_deg: number;
    duplicate_waypoint_count: number;
  };
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};
```

The app must not treat user control points, generated waypoints, action nodes, and exported poses as the same object.

### 7.6.1 Nav2 Export Profile

The application must explicitly model how the user wants to export the latest computed trajectory for Nav2 use.

```ts
type Nav2ExportTarget =
  | "nav_msgs_path"
  | "navigate_through_poses"
  | "waypoint_follower"
  | "native_project";

type Nav2ExportProfile = {
  target: Nav2ExportTarget;
  frame_id: string;
  include_header_stamp: boolean;
  stamp_policy: "omit" | "zero" | "export_time";
  path_filename: string;
  poses_filename?: string;
  project_filename?: string;
  include_runner_script: boolean;
  controller_id?: string;
  goal_checker_id?: string;
  progress_checker_id?: string;
  downsample_for_pose_goals?: boolean;
  pose_goal_spacing_m?: number;
};
```

The export profile is not part of `nav_msgs/Path`; it is app metadata used to generate files that are convenient to consume from a ROS 2/Nav2 workflow.

### 7.7 Action Attachment Validation

The app must validate that every action node is attached to the latest computed trajectory.

Validation rules:

- action nodes may only be created after a computed trajectory exists,
- action node clicks must snap to the computed trajectory,
- off-path action placement must be rejected,
- each action node must store `trajectory_id` and either `arc_length_s_m`, `waypoint_index`, or both,
- if the computed trajectory becomes stale, attached action nodes must also be marked stale,
- after recomputation, action nodes should be reattached using stored arc length where possible,
- if reattachment fails, export should warn or block mission/project export depending on severity.

The `nav_msgs/Path` export should not include action nodes. Action nodes belong to the native project or mission metadata export.

---

## 8. Nav2 Compliance Requirements

The PoC must follow these implementation contracts.

---

## 9. Map Contract

The uploaded map represents a static Nav2 occupancy map normally consumed by `nav2_map_server` and published as `/map`.

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
- Parse and preserve `scale` and `raw` modes if present, even if advanced behavior is left as a documented extension.
- Surface invalid map YAML errors clearly.
- Keep map resolution, origin, width, and height available to all drawing and export tools.

---

## 10. Coordinate Transform Contract

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

### 10.1 Required Unit Tests

Add unit tests for:

- zero-origin map
- nonzero-origin map
- nonzero resolution
- round-trip pixel -> world -> pixel
- at least one map with `origin` yaw equal to `0`

If origin yaw support is implemented but not exhaustively tested, document the limitation explicitly.

Do not silently ignore yaw.

### 10.2 Coordinate Convention

The implementation should be explicit about the relationship between image coordinates and ROS map coordinates.

Typical image coordinates:

```text
px increases to the right
py increases downward
```

Typical ROS map/world coordinates:

```text
x increases to the right in map frame
y increases upward in map frame
```

Therefore, the implementation must correctly handle image Y-axis inversion.

---

## 11. User Workflow and Drawing Tools

### 11.1 Required User Workflow

The app must work as an **iterative rough-sketch → compute → edit → recompute** trajectory tool.

The primary workflow is:

```text
1. User loads a Nav2 occupancy map and matching YAML metadata.
2. User defines a rough path estimate using a sequence of linear control points.
3. The app displays the rough control polygon over the map.
4. User clicks **Compute Smooth Trajectory**.
5. The app generates a constrained, smoothed, resampled trajectory from the rough control points.
6. The app displays the computed trajectory, generated waypoints, yaw arrows, and validation report.
7. Control returns to the user.
8. User may move, insert, delete, or numerically edit control points and constraints.
9. At any time, user may click **Compute Smooth Trajectory** again.
10. The app recomputes the smoothed trajectory from the current control points and current constraints.
11. User exports the latest computed trajectory as `nav_msgs/Path` JSON/YAML.
```

The rough control-point polyline is the user's editable navigation intent.

The computed smooth trajectory is the generated Nav2 path candidate.

The app must never confuse these two layers.

### 11.2 Rough Control-Point Drawing Tool

The primary drawing mode is a rough linear control-point tool:

- First click creates the first control point.
- Each next click appends a new control point.
- Consecutive control points are connected by straight preview segments.
- These preview segments are only the rough sketch, not the final trajectory.
- Control points are stored in world coordinates in the selected frame, normally `map`.
- Control points must be editable after creation.

The rough polyline should be displayed differently from the computed smooth trajectory.

Recommended visual convention:

```text
rough control polygon: thin dashed line with draggable control points
computed trajectory: thicker solid line with sampled waypoint markers
yaw direction: small arrows along the computed trajectory
invalid sections: red overlay
warning sections: yellow overlay
```

### 11.3 Compute Smooth Trajectory Button

The app must provide a clear button named:

```text
Compute Smooth Trajectory
```

When clicked, the app must:

1. Read the current ordered control points.
2. Read the current robot profile and path constraints.
3. Generate a smooth path from the rough control polygon.
4. Preserve the first and last control points exactly unless the user disables endpoint locking.
5. Do not treat rough control points as action poses.
6. Apply the configured smoothing method.
7. Resample the result at world-meter spacing.
8. Generate yaw from the smoothed path tangent unless a different yaw mode is configured.
9. Convert yaw to quaternion for export.
10. Run validation.
11. Update the preview and validation panel.

The button can be clicked repeatedly. Every click recomputes the computed trajectory from the current editable control points and current constraints.

The app should not continuously recompute on every mouse move in the PoC unless this is implemented cleanly. Manual recomputation is acceptable and preferred for the PoC.

### 11.4 Post-Compute Editing

After a smooth trajectory is computed, control returns to the user. The user must be able to:

- move existing control points,
- insert new control points,
- delete control points,
- edit control point `x` and `y` numerically,
- clear all control points,
- clear all content, including control points, computed trajectory, generated waypoints, and actions,
- modify smoothing settings,
- modify waypoint spacing,
- modify robot/path constraints,
- add action nodes on the computed smooth trajectory,
- lock endpoints,
- recompute the trajectory.

The generated waypoint list should normally be treated as computed output, not the primary editing object. For the PoC, direct waypoint editing may be omitted. If direct waypoint editing is provided, the app must clearly indicate that recomputing from control points may overwrite manual waypoint edits.

### 11.5 Action Node Tool

Action nodes must be placed **on the computed smooth trajectory only**. They are not placed on the rough control polygon and not on arbitrary free-space map locations.

The action node placement workflow is:

1. User first creates or recomputes a smooth trajectory.
2. User selects the action node tool.
3. User clicks near the computed smooth trajectory.
4. The app projects/snaps the click to the nearest point on the computed trajectory.
5. If the click is farther than the configured snap tolerance, the app rejects placement and shows an error.
6. The action node stores its attachment to the trajectory using arc-length distance along the path, waypoint index, or both.
7. The marker is displayed on the smooth trajectory.
8. The marker is preserved in the native project format.
9. The marker is not automatically part of the exported `nav_msgs/Path`.

Default action snap behavior:

```yaml
action_placement:
  placement_mode: snap_to_trajectory
  max_snap_distance_m: 0.25
  store_arc_length_s: true
  store_waypoint_index: true
  allow_off_path_actions: false
```

Action node metadata may include:

```yaml
action_node:
  id: inspect_01
  type: inspect
  pose: [1.0, 2.0, 1.57]
  trajectory_id: computed_traj_01
  arc_length_s_m: 12.4
  waypoint_index: 124
  placement_mode: snap_to_trajectory
  attachment_status: attached
  stop_required: true
  hold_time: 3.0
  metadata: {}
```

If the user edits control points or smoothing settings, existing action nodes become stale until the smooth trajectory is recomputed. On recompute, the app should try to reattach each action node using its stored arc-length distance along the trajectory. If reattachment is not possible, the action node must be marked `stale` or `invalid` and must not be silently moved off the trajectory.

### 11.6 Waypoint Orientation Visualization

The app must allow the user to see the orientation at each generated waypoint after a smooth trajectory is computed.

Required behavior:

- Display a small orientation arrow at each generated waypoint or at a configurable waypoint stride.
- Provide a toggle named **Show Waypoint Orientations**.
- Provide an orientation-density setting so dense paths do not become visually cluttered.
- When a waypoint is selected, show its waypoint index, `x`, `y`, yaw in radians, yaw in degrees, quaternion `x`, `y`, `z`, `w`, and source trajectory/primitive identifier if available.
- The waypoint table should include at least `index`, `x`, `y`, and `yaw_deg`.
- The properties sidebar should show the full orientation quaternion for the selected waypoint.
- Orientation arrows must be derived from the same yaw used for export.
- Changing smoothing settings and recomputing the trajectory must update the orientation arrows and waypoint orientation table.

Recommended display options:

```yaml
orientation_display:
  show_arrows: true
  show_yaw_labels: false
  arrow_stride: 1
  arrow_length_m: 0.25
  selected_waypoint_show_quaternion: true
```

The app should avoid displaying stale orientation arrows. If the computed trajectory is stale, the UI should clearly mark the orientation overlay as stale or hide it until recomputation.

### 11.7 Optional Arc Tool

The explicit arc tool is optional in this workflow.

The preferred PoC workflow is rough linear control points plus automated smoothing. However, if the arc tool is included, it must follow these rules:

- First click creates the start point if no trajectory exists.
- Next click defines the end point of the arc.
- The user must be able to specify or edit arc radius and clockwise/counter-clockwise direction.
- The app computes the feasible arc center from start point, end point, radius, and direction.
- If the radius is too small to connect the start and end points, the app must show a clear validation error.
- Generated arc waypoints must be sampled at approximately uniform arc-length spacing.
- Arc waypoint yaw must follow the tangent direction.

For an arc from start point `S` to end point `E` with radius `r`, the arc is geometrically feasible only if:

```text
distance(S, E) <= 2r
```

If this condition is not satisfied, the arc cannot be constructed with the requested radius.

### 11.8 Clear All Content Action

The app must provide a clear user action named:

```text
Clear All Content
```

This action is intended to reset the current trajectory-design workspace without requiring the user to reload the map.

When triggered, the app must remove:

- all rough control points,
- all rough control polygon segments,
- the computed smooth trajectory,
- all generated waypoints,
- all trajectory-attached action nodes,
- all stale action-node attachments,
- the current validation report,
- selected element state,
- export preview data derived from the cleared trajectory.

The action must not remove by default:

- the loaded map image,
- parsed map YAML metadata,
- map zoom/pan state, unless the user chooses a separate map-view reset,
- the selected robot profile,
- global path-generation defaults such as spacing and smoothing parameters.

The UI should protect users from accidental data loss. Recommended behavior:

1. If there is no user-created content, the button may be disabled.
2. If there are control points, a computed trajectory, or action nodes, clicking the button should show a confirmation dialog.
3. The confirmation text should clearly state that rough points, computed paths, generated waypoints, and action nodes will be removed.
4. After clearing, the app should return to an empty drawing state on the same loaded map.
5. Export buttons should become disabled until a new smooth trajectory is computed.

The app may also provide a separate stronger action named:

```text
Reset Project
```

`Reset Project` may remove the map, robot profile overrides, and all project data. This is optional for the PoC. `Clear All Content` is required.


## 12. Geometry and Waypoint Generation Requirements

### 12.1 General Rules

- Generate a smooth trajectory from ordered control points using the selected smoothing method.
- Resample computed trajectory waypoints at uniform world-meter spacing.
- Include start and end points.
- Avoid duplicate adjacent waypoints.
- Compute tangent yaw for each waypoint.
- Store yaw in radians internally and show yaw in degrees in the UI when useful.
- Generate the export quaternion from the same yaw shown in the UI.
- Store all generated waypoints in world coordinates.
- Convert to pixels only for display.
- Do not export pixel coordinates.

### 12.2 Line Waypoint Generation

For a line segment from `A` to `B`:

- Compute segment length in meters.
- Generate points at approximately configured spacing.
- Always include `A` and `B`.
- Yaw is:

```text
yaw = atan2(B.y - A.y, B.x - A.x)
```

### 12.3 Arc Waypoint Generation

For an arc:

- Compute feasible center.
- Compute start angle and end angle around the center.
- Respect clockwise/counter-clockwise direction.
- Compute arc length.
- Sample at approximately configured spacing.
- Always include start and end points.
- Yaw follows the tangent direction.

For counter-clockwise arcs:

```text
yaw = radial_angle + pi / 2
```

For clockwise arcs:

```text
yaw = radial_angle - pi / 2
```

Normalize yaw to a consistent interval, for example `[-pi, pi]`.

### 12.4 Quaternion Generation

Convert yaw to quaternion using roll = 0 and pitch = 0:

```text
qx = 0
qy = 0
qz = sin(yaw / 2)
qw = cos(yaw / 2)
```

The quaternion should be normalized.

### 12.5 Rough Polyline to Computed Trajectory

The primary generated path should come from the rough control-point polyline, not from directly exported control points.

Given ordered control points:

```text
P0, P1, P2, ..., Pn
```

the app should:

1. Treat them as the user's rough route intent.
2. Generate a smoothed curve that respects endpoints and configured constraints.
3. Resample the curve at the configured waypoint spacing.
4. Generate yaw from the local tangent of the computed curve.
5. Use the resulting waypoints as the export source.

If there are only two control points, the computed trajectory may be a straight resampled segment.

If there are three or more control points, the smoother should reduce abrupt heading changes at interior control points when feasible.

---

## 13. Automated Smoothing and Trajectory Computation Requirements

Automated smoothing is a required PoC feature. The app must provide an on-demand trajectory computation function that converts the rough control-point polyline into a smoother path candidate.

### 13.1 Required Computation Pipeline

The computation pipeline must be explicit and modular:

```text
ordered control points
  ↓
rough control polyline
  ↓
constraint-aware smoothing / corner rounding
  ↓
obstacle-aware path deformation (if enabled — method-dependent)  ← new step
  ↓
world-meter resampling
  ↓
yaw generation
  ↓
quaternion generation
  ↓
validation
  ↓
computed trajectory preview
  ↓
Nav2 path export
```

### 13.2 Smoothing Method Options

The app must provide more than one smoothing method so users can compare the resulting trajectory shape.

Required PoC smoothing methods:

1. **None / resample only**
   - Preserves the rough control polyline.
   - Resamples it at the configured waypoint spacing.
   - Useful for debugging coordinate conversion, yaw generation, and export.

2. **Corner rounding with line/arc replacement**
   - Recommended default method.
   - Replaces sharp interior corners with circular arcs where feasible.
   - Best first method for Nav2-style ground-robot paths because it is predictable and easy to validate.

3. **Chaikin smoothing**
   - Simple local polyline smoothing.
   - Useful for quickly reducing sharp corners.
   - Must preserve endpoints.
   - Must be followed by resampling and validation.

Recommended additional methods if time allows:

4. **Catmull-Rom interpolation**
   - Produces a smooth curve passing through or near control points.
   - Useful for natural-looking paths.
   - Must be checked for overshoot and map-boundary violations.

5. **Cubic spline smoothing**
   - Produces a globally smooth curve.
   - Useful for longer routes.
   - Must be constrained or validated because it may deviate from the intended corridor.

6. **Bézier segment smoothing**
   - Useful for designer-controlled curves.
   - Should expose handles or automatic handle generation only if the UI remains simple.

7. **Savitzky-Golay / filtering-based smoothing**
   - Useful for denoising freehand or highly sampled paths.
   - Less useful for converting very sparse control points into high-quality turns.

The UI should allow the user to choose the smoothing method before clicking **Compute Smooth Trajectory**. The selected method must be stored in the native project format and shown in the computed trajectory metadata.

### 13.3 Default Smoothing Method

The recommended default PoC smoother is **corner rounding with line/arc replacement**.

For each interior control point, the smoother should replace a sharp corner:

```text
line → corner → line
```

with:

```text
line → circular arc → line
```

The arc radius should be selected from the smoothing settings and constrained by the neighboring segment lengths.

If the requested radius is too large for a local corner, the app should reduce the radius for that corner or report a warning.

If the requested radius is too small relative to the selected robot profile's `min_turning_radius`, the app should warn or clamp it to the minimum turning radius.

### 13.4 Required Smoothing Settings

The app must expose at least these settings:

```yaml
smoothing_settings:
  enabled: true
  method: corner_rounding
  waypoint_spacing: 0.1
  corner_radius: 0.5
  smoothing_strength: 0.5
  interpolation_resolution_m: 0.05
  preserve_endpoints: true
  preserve_action_attachments: true
  min_turning_radius: 0.8
  max_yaw_jump_deg: 30
  max_deviation_from_control_polyline_m: 0.5
  obstacle_avoidance_enabled: false
  obstacle_avoidance_clearance_m: 0.2
  obstacle_avoidance_max_perturbation_m: 1.0
  obstacle_avoidance_max_iterations: 50
```

The settings may be presented in a simple sidebar form in the PoC.

Smoothing settings should be method-aware. For example:

- `corner_radius` applies to corner rounding.
- `smoothing_strength` applies to Chaikin/filtering methods.
- `interpolation_resolution_m` applies to spline or interpolation-based methods before final resampling.
- `max_deviation_from_control_polyline_m` is used as a warning threshold for methods that may overshoot.
- `obstacle_avoidance_enabled` activates the method-specific obstacle deformation step. The deformation behaviour differs per method (see §13.9).
- `obstacle_avoidance_clearance_m` is the minimum acceptable distance between any waypoint and the nearest occupied cell centre. Must be ≥ 0.
- `obstacle_avoidance_max_perturbation_m` caps how far any waypoint may be displaced from its pre-deformation position. Limits deviation from the user's intended corridor.
- `obstacle_avoidance_max_iterations` controls the elastic-band iteration budget for methods that use iterative deformation.

### 13.5 Smoother Input and Output

Input:

- ordered control points in world coordinates,
- robot profile constraints,
- smoothing settings,
- optional trajectory-attached action-node metadata,
- occupancy grid (required when `obstacle_avoidance_enabled` is true; ignored otherwise).

Output:

- computed smooth trajectory in world coordinates,
- generated waypoints,
- yaw values,
- validation report,
- warnings/errors from smoothing.

### 13.6 Endpoint Preservation and Action Attachment

By default, the smoother must preserve:

- first control point,
- last control point,
- explicitly locked control points.

Control points are not action waypoints. They are route-shaping inputs only.

Action nodes are not smoothing constraints in the PoC. They are attached to the computed smooth trajectory after it exists. Therefore:

- an action cannot be placed outside the computed smooth trajectory,
- an action cannot be attached to the rough control polygon,
- an action cannot force the smoother to pass through an arbitrary off-path point,
- recomputation may move the smooth trajectory, so action attachments must be re-associated or marked stale/invalid.

The smoother must not silently move locked control points. If a locked control point makes the trajectory impossible under the selected constraints, the app must report a clear validation error.

### 13.7 Recompute Semantics

The computed smooth trajectory is derived data.

When the user edits control points or smoothing settings, the previous computed trajectory becomes stale. The UI should indicate this, for example:

```text
Trajectory out of date. Click Compute Smooth Trajectory to update.
```

When the user clicks **Compute Smooth Trajectory**, the app replaces the previous computed trajectory with a new one generated from the current state.

### 13.8 Fallback Smoothing Method

If corner rounding is not implemented fully in the first PoC, the fallback smoother may be Chaikin-style polyline smoothing or another simple local smoothing method, but it must obey these rules:

- endpoints remain fixed,
- trajectory action attachments are re-associated or marked stale,
- smoothing is applied in world coordinates,
- output is resampled after smoothing,
- validation reports any excessive deviation or yaw discontinuity,
- the README documents the limitations of the fallback method.

### 13.9 Obstacle-Aware Path Computation

When `obstacle_avoidance_enabled` is true and a parsed occupancy grid is available, the smoother must deform the path to avoid occupied cells before the final resampling step. The deformation strategy depends on the selected smoothing method.

#### Common rules for all methods

- The first and last waypoints are never moved (endpoint preservation).
- A waypoint is considered in violation if its world position maps to an occupied cell (occupancy ≥ `occupied_thresh`) or if it is within `obstacle_avoidance_clearance_m` of any occupied cell centre.
- A waypoint may not be displaced more than `obstacle_avoidance_max_perturbation_m` from its pre-deformation position.
- Displacement is perpendicular to the local path tangent at each waypoint, biased toward the direction of lower occupancy.
- If a waypoint cannot be moved to a free position within the perturbation budget, the computation records a `repair_failed` error for that waypoint and continues to the next. The validation report classifies the trajectory as `invalid` if any `repair_failed` errors remain.
- After deformation, the path is resampled at the configured `waypoint_spacing` and yaw is regenerated from the deformed geometry.
- Validation always runs on the post-deformation, post-resampling output.

#### Method-specific deformation behaviour

| Method | Deformation approach |
|---|---|
| `none` | Elastic-band relaxation: iterate, pushing each violated waypoint away from the nearest occupied cell along the perpendicular direction until no violations remain or the iteration budget is exhausted. |
| `corner_rounding` | Increase the corner arc radius for corners whose arc passes through an occupied cell, up to the perturbation budget. If a larger radius cannot clear the obstacle, fall back to elastic-band relaxation on the arc sample points. |
| `chaikin` | Apply elastic-band relaxation after the Chaikin subdivision. Each violated interior point is pushed outward; endpoints are locked. |
| `catmull_rom` | After interpolation, apply elastic-band relaxation on the densely sampled curve points before final resampling. |
| `cubic_spline` | After spline evaluation, apply elastic-band relaxation. The spline control points are not re-fitted; only the evaluated curve points are displaced. |
| `bezier` | After Bézier evaluation, apply elastic-band relaxation on the evaluated curve points. |
| `savitzky_golay` | After filtering, apply elastic-band relaxation. |

The elastic-band relaxation used as a fallback or primary step for methods without native obstacle awareness is:

```text
for iteration in 1 .. max_iterations:
    for each interior waypoint w_i (excluding endpoints):
        if w_i violates clearance constraint:
            direction = unit vector from nearest obstacle centre to w_i
            step = min(clearance_needed, max_perturbation - already_displaced)
            w_i = w_i + direction * step
    if no violations remain: break
```

#### UI requirements for obstacle avoidance

- The smoothing settings panel must expose the `obstacle_avoidance_enabled` toggle.
- The toggle is disabled (greyed out) when no occupancy grid is loaded.
- The settings panel must show `obstacle_avoidance_clearance_m` and `obstacle_avoidance_max_perturbation_m` only when the toggle is on.
- After computation, the validation panel must report:
  - how many waypoints were displaced by obstacle avoidance,
  - the maximum displacement applied,
  - any `repair_failed` waypoints with their indices.
- Displaced waypoints should be visually distinct on the map canvas (e.g., a different colour or marker) so users can see where the path was modified.

### 13.10 What the Smoother Does Not Guarantee

The smoother does not guarantee:

- robot footprint clearance (only centreline obstacle avoidance is implemented),
- dynamic feasibility,
- safety around people or dynamic obstacles,
- successful Nav2 controller tracking.

Even with `obstacle_avoidance_enabled`, the smoother only checks that each waypoint's world position is free. It does not inflate the robot footprint or check clearance along the footprint boundary. Full footprint collision checking remains a future extension (see §15.1).

> **Validation must run on the post-deformation, post-resampling output.** Smoothing and obstacle deformation can introduce curvature spikes, self-intersections, or map-boundary violations that were not present in the rough control polygon. The validation pipeline must always receive the final resampled waypoints.

## 14. Basic Path Validation Requirements

The PoC must include a basic geometric validator for generated waypoints. The validator must always receive the final post-smoothed, resampled waypoints.

The validator should compute:

- waypoint count
- path length
- mean spacing
- minimum spacing
- maximum spacing
- duplicate adjacent waypoint count
- zero-length segment count (segments shorter than a configured epsilon, e.g. 1e-6 m)
- maximum yaw jump between consecutive waypoints
- maximum approximate curvature `κ ≈ Δθ / Δs` along the path
- whether all exported poses are finite numbers
- whether all poses are in the selected frame
- whether the path contains at least two poses before export
- whether generated waypoints remain inside the known map image extent

The validator should warn if:

- waypoint spacing is much larger than the configured maximum spacing
- waypoint spacing is irregular
- duplicate adjacent waypoints or zero-length segments exist
- yaw jumps exceed the configured threshold
- maximum curvature exceeds `1 / min_turning_radius` from the robot profile (the robot cannot physically execute turns tighter than its minimum turning radius)
- a path has fewer than two poses
- an arc cannot be generated with the requested radius
- the generated path exits the known map image extent
- line-to-line corners create abrupt heading changes
- the path self-intersects (path crosses itself unexpectedly, which can indicate over-smoothing or incorrect arc direction)

The validator should classify the path as:

```text
valid
valid_with_warnings
invalid
```

The PoC must not claim that a path is collision-free or safe for execution unless collision checking is actually implemented.

Metric surfacing priority:

| Metric | Condition | Severity |
|---|---|---|
| `too_few_poses` | waypoint count < 2 | error |
| `non_finite_pose` | any non-finite x, y, or yaw | error |
| `curvature_exceeded` | κ_max > 1/R_min **and** `can_rotate_in_place: false` (e.g. Ackermann) | **error** |
| `curvature_exceeded` | κ_max > 1/R_min **and** `can_rotate_in_place: true` (e.g. differential) | warning |
| `yaw_jump` | Δθ_max > max_yaw_jump_deg | warning |
| `max_spacing_exceeded` | spacing_max > max_spacing | warning |
| `duplicate_waypoints` | zero-length or duplicate segments | warning |
| `self_intersection` | path crosses itself | warning |
| `outside_map` | any waypoint outside map extent | warning |
| `occupied_cell_intersection` | waypoint on occupied cell, avoidance disabled | error |
| `occupied_cell_intersection` | waypoint on occupied cell, avoidance enabled but repair failed | error |
| `obstacle_avoidance_applied` | avoidance displaced ≥ 1 waypoint and all are now free | info |

---

## 15. Occupancy Awareness Contract

Centreline obstacle detection and basic path repair are implemented when `obstacle_avoidance_enabled` is true (see §13.9). Full footprint collision checking remains a future extension.

For the PoC:

- Display occupied, free, and unknown regions distinctly enough for visual inspection.
- Keep parsed occupancy metadata available to frontend tools and the smoother.
- When `obstacle_avoidance_enabled` is true, pass the full occupancy grid to the smoother so it can deform the path away from occupied cells.
- Highlight waypoints that were displaced by obstacle avoidance on the map canvas.
- Report obstacle avoidance outcomes (displaced count, max displacement, repair failures) in the validation panel.
- Do not claim a path is Nav2-safe just because it exports as `nav_msgs/Path`.

The PoC may produce a `nav_msgs/Path`-compatible artifact, but this only means the exported structure is ROS-compatible.

It does not mean:

- the path is collision-free
- the robot footprint fits along the path
- the selected robot can physically track the path
- the local controller will successfully execute it
- the path is safe around people or dynamic obstacles

The UI and README must clearly distinguish:

```text
ROS-compatible export
```

from:

```text
validated executable robot trajectory
```

### 15.1 Architecture Extension Point for Footprint-Aware Validation

The centreline obstacle avoidance in §13.9 only checks whether each waypoint's position is free. Full footprint collision checking requires inflating the robot shape at each pose. To support this extension without restructuring the data model, the architecture must preserve at validation time:

- The full parsed occupancy grid (pixel values, resolution, origin, and thresholds), not only the display image.
- The robot footprint from the robot profile (circle radius or polygon vertices).
- All generated waypoints in world coordinates with their associated yaw.

When implemented, a footprint-aware validator would:

1. For each waypoint pose, inflate the robot footprint by a configured safety margin.
2. Transform the inflated footprint polygon into image pixel coordinates.
3. Check whether any footprint pixel overlaps an occupied cell.
4. Compute the clearance distance to the nearest occupied cell.
5. Warn if clearance falls below a configured minimum clearance margin.
6. Report an error if the footprint directly intersects an occupied cell.

The occupancy grid, coordinate transform, and waypoints are already available. Adding the footprint validator later requires only implementing steps 1–6 without changing the data model.

---

## 16. Path Export Contract

Export JSON/YAML using a ROS-compatible `nav_msgs/Path` structure. In ROS 2, `nav_msgs/Path` is a header plus an ordered array of `geometry_msgs/PoseStamped` poses. Nav2's Simple Commander exposes `followPath(path, ...)` using a `nav_msgs/Path`, while waypoint-oriented workflows use ordered `PoseStamped` goals through `NavigateThroughPoses` or the waypoint follower. Therefore, the PoC should export both a dense path artifact and, optionally, a sparse waypoint-goal artifact.

Primary dense path export:

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
- Timestamps may be omitted or set to a documented placeholder in the PoC.
- The structure should be easy to adapt to real ROS 2 messages later.
- Export must always use the latest non-stale computed smooth trajectory, never the rough control polygon.
- Export must be blocked when no valid computed trajectory exists.

### 16.1 Nav2 Standard File Export Feature

The app must provide an export option named:

```text
Export Nav2 Files
```

This feature exports a small file package intended for direct use in a ROS 2/Nav2 project. The package should be deterministic, human-readable, and versioned.

Required exported files:

```text
nav2_export/
├── path.nav2.yaml
├── path.nav2.json
├── waypoints.nav2.yaml          # optional, for sparse pose-goal workflows
├── navpath_project.yaml         # native project metadata
└── README_nav2_export.md
```

Optional exported files:

```text
nav2_export/
├── follow_path_runner.py        # loads path.nav2.yaml and calls BasicNavigator.followPath
└── navigate_through_poses_runner.py
```

The exported package must clearly separate:

- `path.nav2.yaml`: dense `nav_msgs/Path`-shaped path for path-following workflows.
- `waypoints.nav2.yaml`: sparse ordered `PoseStamped` goals for `NavigateThroughPoses` or waypoint-follower workflows.
- `navpath_project.yaml`: native design-time data containing control points, smoothing settings, robot profile, validation report, and action nodes.
- `README_nav2_export.md`: usage notes, assumptions, limitations, and a warning that export compatibility does not imply collision-free execution.

The user-facing UI must allow selecting at least these export targets:

```yaml
export_targets:
  - nav_msgs_path_yaml
  - nav_msgs_path_json
  - sparse_pose_goals_yaml
  - native_project_yaml
  - zipped_nav2_export_package
```

The default exported artifact should be `path.nav2.yaml`.

### 16.2 `path.nav2.yaml` Requirements

`path.nav2.yaml` must contain only the path information needed to reconstruct a ROS 2 `nav_msgs/Path` message.

Required fields:

```yaml
message_type: nav_msgs/msg/Path
header:
  frame_id: map
  stamp:
    sec: 0
    nanosec: 0
poses:
  - header:
      frame_id: map
      stamp:
        sec: 0
        nanosec: 0
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

Rules:

- `message_type` is included as file metadata for loaders; it is not a field of the ROS message itself.
- The loader script must ignore `message_type` when constructing the ROS message.
- `header.frame_id` must match every pose header frame.
- Header stamp policy must be explicit: `zero`, `export_time`, or `omit`.
- The PoC default is `zero` stamps for deterministic files.
- Positions must use meters in the `map` frame.
- Orientation must be quaternion orientation from the displayed waypoint yaw.

### 16.3 Sparse Pose-Goal Export Requirements

The app may export a second file named `waypoints.nav2.yaml` for workflows that prefer goals over dense path tracking. This export must be generated from the computed trajectory, not from the raw control points.

Example:

```yaml
message_type: geometry_msgs/msg/PoseStamped[]
frame_id: map
source: computed_trajectory
selection_policy:
  method: arc_length_downsample
  spacing_m: 1.0
poses:
  - header:
      frame_id: map
      stamp:
        sec: 0
        nanosec: 0
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

Rules:

- Sparse pose goals are not equivalent to the dense `nav_msgs/Path`.
- The sparse export should downsample the computed trajectory by arc length, not use rough control points directly.
- The final pose must always be included.
- The first pose should be included only if useful for the selected workflow; otherwise the runner may skip the current robot pose.
- Action nodes may be exported as mission metadata in `navpath_project.yaml`, but they must not be silently converted into Nav2 goals unless the user selects an explicit mission export mode.

### 16.4 Export Validation Gates

Before enabling `Export Nav2 Files`, the app must check:

- a map is loaded and parsed,
- a latest computed trajectory exists,
- the computed trajectory is not stale,
- the path contains at least two poses,
- every pose has finite `x`, `y`, yaw, and quaternion values,
- every pose uses the selected export frame, normally `map`,
- the validation report has no blocking errors,
- any stale or invalid action nodes are excluded from `nav_msgs/Path` and reported in the native project export.

When export is blocked, the UI must show a specific reason rather than a generic failure.

### 16.5 Nav2 Runner Script Export

If the optional runner script is generated, it must be clearly labeled as an example integration helper, not as part of Nav2 itself.

`follow_path_runner.py` should:

1. Load `path.nav2.yaml`.
2. Construct a `nav_msgs.msg.Path`.
3. Create a Nav2 Simple Commander `BasicNavigator`.
4. Wait until Nav2 is active.
5. Call `followPath(path, controller_id=..., goal_checker_id=...)`.
6. Print task feedback and final result.

The script must not be enabled as part of the web app. It is a downloaded utility that the user runs inside a configured ROS 2/Nav2 workspace.

The README must state that the robot still requires a working Nav2 bringup, localization, costmaps, controller server, and appropriate safety supervision.

---

## 17. Native Project Export Contract

In addition to `nav_msgs/Path` JSON/YAML, the PoC should support or prepare for a native NavPath Studio project format.

The native format should preserve information that cannot be represented in `nav_msgs/Path`, including:

- map metadata
- robot profile
- raw control points
- drawing primitives
- action nodes
- waypoint spacing
- arc radius and direction
- validation report
- export frame

Example:

```yaml
navpath_studio_project:
  version: 0.1
  frame_id: map

  map:
    image: floor1.pgm
    resolution: 0.05
    origin: [-12.4, -8.7, 0.0]

  robot_profile:
    name: generic_2d_ground_robot
    kinematics:
      type: generic

  primitives:
    - id: segment_1
      type: line
      start: [1.0, 2.0]
      end: [4.0, 2.0]

    - id: segment_2
      type: arc
      start: [4.0, 2.0]
      end: [5.0, 3.0]
      radius: 1.0
      clockwise: false

  action_nodes:
    - id: action_1
      type: inspect
      pose: [5.0, 3.0, 1.57]
      trajectory_id: computed_traj_01
      arc_length_s_m: 12.4
      placement_mode: snap_to_trajectory
      attachment_status: attached

  generated_waypoints:
    spacing: 0.1
    poses:
      - [1.0, 2.0, 0.0]
      - [1.1, 2.0, 0.0]

  validation:
    status: valid_with_warnings
```

The native project format is not required to be consumed directly by Nav2. It exists to preserve design-time information.

---

## 18. Controller Compatibility Extension Point

The PoC should include a placeholder controller profile field, even if advanced controller-specific validation is not implemented.

Supported initial values:

```text
generic
regulated_pure_pursuit
mppi
dwb
```

For the PoC, this field may only be stored and displayed.

Future validation should use this field to warn about:

- sparse paths
- sharp turns
- self-intersections
- large yaw jumps
- excessive curvature
- lookahead ambiguity for Regulated Pure Pursuit
- poor reference feasibility for MPPI

### 18.1 Optimization-Based Path Planning Extension Point

The current PoC uses explicit smoothing (corner rounding, Chaikin, splines) to improve path quality. This is a direct construction approach: the user specifies control points and the app applies a fixed transformation.

A more powerful future direction is **optimization-based path planning**, which formulates path generation as a cost minimization problem over both kinematics and obstacle proximity simultaneously:

```text
minimize:
    w_length    × path_length
  + w_curv      × curvature_cost
  + w_smooth    × heading_smoothness_cost
  + w_obs       × obstacle_proximity_cost
  + w_task      × task_preference_cost

subject to:
  κ_max ≤ 1 / min_turning_radius        (hard for Ackermann; soft for differential)
  all waypoints inside map extent
  (optionally) no footprint overlap with occupied cells
```

Key distinctions from the current smoothing-only approach:

| Property | Current smoother | Optimization-based planner |
|---|---|---|
| Obstacle awareness | visual only | cost term or hard constraint |
| Kinematic constraints | warning/error on result | enforced during generation |
| Curvature control | indirect (corner radius) | direct cost or constraint |
| User control | control points + settings | weights + boundary conditions |
| Computational cost | low | higher; may require iterative solver |

Relevant optimization approaches for ground-robot path planning:

- **Elastic band / TEB (Timed Elastic Band)** — deforms the path to avoid obstacles while respecting kinematic constraints. Used in Nav2's TEB local planner.
- **CHOMP / STOMP** — gradient-based or sampling-based trajectory optimization.
- **MPPI** — model-predictive path integral, used in Nav2's MPPI controller.
- **Gradient descent on waypoint positions** — simple iterative approach suitable for a web tool.

The architecture must preserve access to the occupancy grid, robot footprint, and waypoints in world coordinates (see §15.1) so an optimization-based planner can be added as a new smoother method without changing the data model or validation pipeline.

---

## 19. Integration Boundary

The app exports artifacts for Nav2. It does not replace:

- `map_server`
- AMCL/localization
- global costmaps
- local costmaps
- planner server
- controller server
- behavior trees
- lifecycle manager
- recovery behavior

Generated paths are design-time artifacts. A real robot still needs localization, costmaps, controller tracking, recovery behavior, and lifecycle-managed bringup.

---

## 20. Out of Scope for PoC

Keep these out of the initial implementation:

- Robot connection or live `cmd_vel`
- Direct Nav2 action client integration
- Full robot footprint collision checking (centreline avoidance is in scope; footprint inflation is not)
- Dynamic obstacle handling
- AMCL/localization UI
- Lifecycle control
- Advanced editing
- Multi-floor routing
- Multi-robot namespacing
- Save/load project database
- Undo/redo
- Graph optimization
- Footprint collision checking
- Controller simulation
- Route graph optimization
- Velocity profiling and time parameterization (converting the geometric path into a trajectory with `v(t)`, `ω(t)`, `a(t)`)
- Curvature-speed coupling (automatic speed reduction in high-curvature sections)
- Dynamic feasibility analysis (checking whether the robot can physically follow the path at any given speed)
- Clearance-based validation along the robot footprint boundary (centreline clearance is partially covered by `obstacle_avoidance_clearance_m`)

Do not remove extension points for these features.

---

## 21. Tech Stack

Use this stack:

- Frontend: React 18 + Vite + TypeScript
- Canvas: Konva.js / react-konva
- State management: Zustand
- Backend: FastAPI
- Map parsing: Pillow + PyYAML
- Geometry: numpy; shapely only if it simplifies geometry cleanly
- Export: JSON and YAML
- Packaging: Docker Compose

---

## 22. Required Project Structure

```text
navpath-poc/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapCanvas.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   ├── PropertiesSidebar.tsx
│   │   │   ├── PointTable.tsx
│   │   │   ├── WaypointTable.tsx
│   │   │   ├── SmoothingPanel.tsx
│   │   │   ├── ValidationPanel.tsx
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
│   │   │   ├── nav2FileExport.ts
│   │   │   ├── projectExport.ts
│   │   │   ├── waypointGeneration.ts
│   │   │   ├── smoothing.ts
│   │   │   ├── headingGeneration.ts
│   │   │   ├── orientationDisplay.ts
│   │   │   ├── validation.ts
│   │   │   └── arcGeometry.ts
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
│   │   │   ├── coordinate_transform.py
│   │   │   ├── path_generator.py
│   │   │   ├── path_smoother.py
│   │   │   ├── path_validator.py
│   │   │   └── path_exporter.py
│   │   └── models/
│   │       ├── map.py
│   │       ├── robot_profile.py
│   │       ├── primitives.py
│   │       └── path.py
│   ├── tests/
│   │   ├── test_coordinates.py
│   │   ├── test_arc_geometry.py
│   │   ├── test_path_smoothing.py
│   │   ├── test_path_validation.py
│   │   └── test_path_export.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

---

## 23. Recommended App Architecture

```text
Map Manager
  ↓
Coordinate Transform Layer
  ↓
Drawing Layer
  ↓
Primitive Model
  ↓
Geometric Path Generator
  ↓
Automated Smoothing Layer
  ↓
World-Meter Resampler
  ↓
Orientation / Quaternion Generator
  ↓
Basic Geometric Validator
  ↓
Nav2 Path Exporter
  ↓
Native Project Exporter
```

Required modules:

```text
APP/
  map_manager
  coordinate_transform
  drawing_editor
  primitive_manager
  line_generator
  arc_generator
  path_smoother
  obstacle_deformer          ← elastic-band obstacle avoidance, called by each smoother
  waypoint_resampler
  heading_generator
  quaternion_converter
  orientation_visualizer
  smoothing_method_registry
  path_validator
  action_waypoint_manager
  robot_profile_manager
  nav2_exporter
  project_exporter
```

Future extension modules:

```text
  lane_generator
  path_smoother
  curvature_analyzer
  footprint_checker
  clearance_checker
  controller_profile_analyzer
  route_graph_editor
```

---

## 24. Backend Implementation Requirements

The backend must:

- Validate uploaded YAML and image pair.
- Return normalized map metadata to the frontend.
- Return a displayable map image or image URL.
- Provide path export helpers if export is backend-owned.
- Include tests for coordinate transform and path export behavior.
- Use clear error messages for:
  - missing YAML fields
  - invalid origin
  - invalid resolution
  - unsupported image file
  - image/YAML mismatch
  - unsupported map mode
- Keep Python Pydantic models aligned with frontend TypeScript types.
- Provide reusable services for:
  - map loading
  - coordinate transform
  - path generation
  - path smoothing / trajectory computation
  - smoothing method selection
  - path validation
  - path export
  - Nav2 standard file package export

---

## 25. Frontend Implementation Requirements

The frontend must:

- Render the uploaded map in a stable canvas coordinate system.
- Expand the map canvas to fill the available workspace viewport.
- Support zooming without changing exported world-frame coordinates.
- Support panning without changing exported world-frame coordinates.
- Keep all internal geometry in world coordinates where practical.
- Convert to pixels only for drawing.
- Show cursor world coordinate while hovering over the map.
- Draw rough control-point polylines and action-node markers.
- Build rough trajectories sequentially from ordered control points.
- Provide editable numeric fields for existing control points.
- Provide a Compute Smooth Trajectory button.
- Provide a smoothing method selector with at least `none`, `corner_rounding`, and `chaikin`.
- Mark computed trajectories as stale after control-point or settings edits.
- Generate preview waypoints from the latest computed trajectory.
- Show orientation arrows for generated waypoints.
- Provide a toggle and density/stride setting for waypoint orientation visualization.
- Show waypoint yaw and quaternion data in the waypoint table/properties sidebar.
- Show selected element metadata in the sidebar.
- Show validation status and validation metrics.
- Expose an obstacle avoidance toggle and its settings (`clearance_m`, `max_perturbation_m`) in the smoothing panel; disable the toggle when no occupancy grid is loaded.
- Display displaced waypoints visually on the map canvas with a distinct colour or marker after a computation that applied obstacle avoidance.
- Show obstacle avoidance outcome in the validation panel: waypoints displaced, maximum displacement, and any repair failures.
- Export JSON/YAML from world-frame waypoints.
- Provide an **Export Nav2 Files** action that produces `path.nav2.yaml`, optional sparse pose-goal YAML, native project YAML, and a README in a downloadable package.
- Keep pan/zoom state separate from world geometry.

---

## 26. Type Requirements

Define TypeScript types for:

- map metadata
- robot profile
- control points
- drawing primitives
- line primitives
- arc primitives
- action nodes
- waypoints
- quaternions
- exported path
- validation report
- validation issue
- smoothing settings
- smoothing method options
- waypoint orientation display settings
- computed trajectory
- native project format
- Nav2 export profile and exported file manifest

Keep Python Pydantic models aligned with frontend types.

---

## 27. Required Tests

### 27.1 Coordinate Transform Tests

Add unit tests for:

- zero-origin map
- nonzero-origin map
- nonzero resolution
- round-trip pixel -> world -> pixel
- image Y-axis inversion
- origin yaw equal to `0`

If nonzero origin yaw is implemented but not exhaustively tested, document this limitation explicitly.

### 27.2 Waypoint Generation Tests

Add unit tests for:

- line segment waypoint generation includes start and end points
- line segment waypoints use approximately uniform spacing
- line segment yaw follows segment direction
- arc generation rejects impossible radius
- arc generation includes start and end points
- arc waypoints use approximately uniform arc-length spacing
- arc yaw follows tangent direction
- adjacent segments do not create duplicate waypoints
- yaw-to-quaternion conversion returns normalized quaternions

### 27.3 Smoothing Tests

Add unit tests for:

- smoothing preserves endpoints by default
- recompute preserves or invalidates trajectory-attached action nodes according to the action-node attachment rules
- Compute Smooth Trajectory produces at least two waypoints for a valid two-point path
- corner rounding reduces abrupt line-to-line heading changes where feasible
- computed trajectory is marked stale after control point edits
- recomputation replaces the previous computed trajectory
- smoothed output is resampled at approximately the configured spacing
- smoothing method `none` preserves the rough polyline shape before resampling
- smoothing method selection changes the computed trajectory metadata
- Chaikin smoothing preserves endpoints
- spline/interpolation methods, if implemented, report excessive deviation from the control polyline

### 27.4 Orientation Visualization Tests

Add unit tests for:

- waypoint yaw in radians is converted correctly to yaw in degrees for display
- orientation arrows use the same yaw values as export
- selected waypoint properties include yaw and quaternion values
- stale computed trajectories mark or hide stale orientation overlays

### 27.5 Path Export Tests

Add unit tests for:

- exported path has a `header.frame_id`
- every pose has the same frame as the path header
- position `z` is `0.0`
- exported positions are in meters
- orientation is a valid quaternion
- waypoint ordering is preserved
- empty paths or one-point paths are rejected or warned before export
- `path.nav2.yaml` can be loaded and reconstructed as a `nav_msgs/Path`-shaped object
- optional sparse pose-goal export preserves ordering and includes the final pose
- export is blocked when the computed trajectory is stale

### 27.6 Validation Tests

Add unit tests for:

- duplicate waypoint detection
- max spacing warning
- yaw jump warning
- invalid arc detection
- path outside known map extent
- fewer than two poses warning/error
- `occupied_cell_intersection` error is reported when a waypoint falls on an occupied cell and avoidance is disabled
- `obstacle_avoidance_applied` info is reported when avoidance displaces at least one waypoint and all violations are cleared
- `repair_failed` error is reported when a waypoint cannot be cleared within `max_perturbation_m`

### 27.7 Obstacle Avoidance Tests

Add unit tests for:

- with avoidance disabled, a path through an occupied cell produces an `occupied_cell_intersection` error and is not modified
- with avoidance enabled, a path through an occupied cell is deformed so the final waypoints avoid the occupied cell
- the first and last waypoints are never displaced by obstacle avoidance regardless of method
- no waypoint is displaced more than `obstacle_avoidance_max_perturbation_m` from its pre-deformation position
- corner rounding with avoidance enabled increases the arc radius when the initial arc intersects an obstacle
- Chaikin with avoidance enabled applies elastic-band relaxation after subdivision
- elastic-band relaxation converges within `max_iterations` for a single-obstacle, single-waypoint violation
- when a waypoint cannot be cleared, a `repair_failed` error is produced and the trajectory is classified as `invalid`
- the validation report always runs on the post-deformation, post-resampling waypoints

---

## 28. Acceptance Criteria

The PoC is acceptable when:

1. A Nav2-style `.yaml` + `.pgm` or `.png` map pair can be uploaded.
2. The map displays with correct scale and origin-aware coordinate conversion.
3. The map can be zoomed in, zoomed out, and reset without changing world-frame coordinates.
4. The map can be panned up, down, left, and right while zoomed in.
5. The map canvas expands to the available screen workspace.
6. The map is centered in the canvas by default and remains centered while zooming.
7. The mouse can drag the map to pan it without corrupting drawn waypoints.
8. Hovering or clicking reports world coordinates in meters.
9. User can draw a rough path as ordered linear control points.
10. Existing control points can be edited from a numeric point table.
11. The app clearly distinguishes the rough control polygon from the computed smooth trajectory.
12. User can click **Compute Smooth Trajectory** to generate a smoothed trajectory from the rough control points.
13. The app provides at least three smoothing options: `none`, `corner_rounding`, and `chaikin`.
14. The selected smoothing method is stored in computed trajectory metadata and native project export.
15. The smoother preserves endpoints by default.
16. The smoothed trajectory is resampled at the configured world-meter spacing.
17. After computation, the user can edit control points and recompute the trajectory.
18. The app marks the computed trajectory as stale after control-point or smoothing-setting changes.
19. A line trajectory can be converted into waypoints at `0.1 m` spacing.
20. An arc can be drawn and converted into tangent-oriented waypoints if the optional arc tool is implemented.
21. The app displays orientation at generated waypoints using arrows or another explicit yaw indicator.
22. The app provides a **Show Waypoint Orientations** toggle.
23. The app provides an orientation-density or arrow-stride setting so dense paths remain readable.
24. Selecting a waypoint shows its index, `x`, `y`, yaw in radians/degrees, and quaternion.
25. Exported path orientation is a quaternion derived from the same waypoint yaw shown in the UI.
26. An action node can be placed only by snapping to the computed smooth trajectory and is shown in the properties sidebar.
27. Rough control points are not automatically treated as action waypoints.
28. Action nodes cannot be placed outside the computed smooth trajectory.
29. When control points or smoothing settings change, existing action nodes are marked stale until recomputation and reattachment.
30. Exported path positions are in the `map` frame, not pixels.
31. JSON and YAML exports follow `nav_msgs/Path` structure.
32. The app provides **Export Nav2 Files** and generates at least `path.nav2.yaml`, `path.nav2.json`, `navpath_project.yaml`, and `README_nav2_export.md`.
33. The exported `path.nav2.yaml` is shaped so a ROS 2 helper script can reconstruct a `nav_msgs/Path` message and send it through a Nav2 `followPath` workflow.
34. Optional sparse pose-goal export is clearly labeled as a `NavigateThroughPoses` / waypoint-follower convenience artifact, not as the dense path.
35. Coordinate conversion and path export tests pass.
33. README explains how this PoC relates to Nav2 and what it does not replace.
34. The app distinguishes between control points, primitives, generated waypoints, action nodes, and exported poses.
35. The app provides a basic validation report for the generated path.
36. The validation report includes waypoint count, path length, min/mean/max spacing, duplicate waypoint count, and max yaw jump.
37. Invalid arcs, such as arcs whose requested radius cannot connect the selected start and end points, are rejected with a clear error.
38. Export is blocked or clearly warned when the path has fewer than two generated poses.
39. The app provides a native project export or internal structure capable of preserving primitives and trajectory-attached action nodes separately from `nav_msgs/Path`.
40. The app includes a minimal robot profile abstraction, even if only default values are used in the PoC.
41. The README clearly states that geometric validity and ROS message validity do not imply collision-free or robot-executable behavior.
42. The exported `nav_msgs/Path` uses the latest computed trajectory, not the rough control polygon.
43. The app provides a **Clear All Content** action that removes all rough control points, computed trajectories, generated waypoints, action nodes, validation state, and export previews while preserving the loaded map and selected robot profile.
44. After **Clear All Content**, export controls are disabled until the user defines new control points and recomputes a smooth trajectory.
45. When obstacle avoidance is disabled and the computed path intersects an occupied cell, the validation panel reports an `occupied_cell_intersection` error and the trajectory is classified as `invalid`.
46. When obstacle avoidance is enabled and the computed path initially intersects an occupied cell, the smoother deforms the path away from the obstacle using the method-specific strategy defined in §13.9; the resulting waypoints avoid the occupied cell.
47. Displaced waypoints are visually distinct on the map canvas after an obstacle-avoidance computation.
48. When avoidance cannot clear all violations within the perturbation budget, the validation panel reports `repair_failed` errors with the affected waypoint indices and the trajectory is classified as `invalid`.
49. The obstacle avoidance toggle is disabled when no occupancy grid is loaded.
50. The endpoint waypoints are never displaced by obstacle avoidance.

---

## 29. Commands To Provide In Final Output

The generated project should include exact commands.

Run with Docker Compose:

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

---

## 30. README Requirements

The README must explain:

- what NavPath Studio is
- how to upload a Nav2 map
- how coordinates are converted
- how to draw a rough control-point polyline
- how to use **Compute Smooth Trajectory**
- how to select smoothing methods and tune smoothing parameters
- what each PoC smoothing method does and its limitations
- how control-point edits and recomputation work
- how waypoints are generated
- how to display waypoint orientation arrows
- how to inspect waypoint yaw and quaternion values
- how yaw and quaternion orientation are computed
- how to export JSON/YAML `nav_msgs/Path`
- how to use **Export Nav2 Files** and what each generated file contains
- how to load `path.nav2.yaml` from a ROS 2/Nav2 helper script
- how this PoC relates to Nav2
- what the PoC does not replace
- limitations of the PoC
- how to run backend tests
- how to run frontend tests
- how to run the app with Docker Compose

The README must clearly state:

```text
A path that exports as nav_msgs/Path is ROS-compatible, but not necessarily collision-free, dynamically feasible, or safe for execution on a real robot.
```

---

## 31. Generation Instructions for LLM or Coding Agent

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
11. Keep drawing geometry in world coordinates where practical.
12. Convert to pixels only for rendering.
13. Do not silently ignore map origin yaw.
14. Do not claim collision safety unless collision checking is implemented.
15. Keep robot profile, controller profile, and validation architecture extensible.

---

## 32. Summary

NavPath Studio PoC should be a minimal but correct 2D ground-robot trajectory drawing tool for Nav2 maps.

It should prioritize:

- correct map loading
- correct coordinate transforms
- world-frame drawing
- rough control-point path definition
- on-demand constrained smoothing with selectable smoothing methods
- resampling, yaw, quaternion orientation, and waypoint orientation visualization
- action placement only on the computed smooth trajectory
- clear-all-content workspace reset behavior
- basic validation
- ROS-compatible `nav_msgs/Path` export
- Nav2 standard file package export for practical ROS 2 integration
- clear separation between design-time project data and Nav2 runtime artifacts

The core output of the PoC is not a robot-safe mission. The core output is a correctly framed, correctly scaled, geometrically generated, `nav_msgs/Path`-compatible design artifact that can later be integrated into a larger Nav2 workflow.
