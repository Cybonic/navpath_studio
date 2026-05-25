# Trajectory Planning Know-How for Autonomous Mobile Robots

This document summarizes the most important theoretical and practical knowledge needed to create good trajectories for autonomous ground robots. It is written for use as training or reference material for another agent that needs to reason about trajectory quality.

The focus is **trajectory planning**, not robot software architecture.

---

## 1. Path vs. Trajectory

A **path** describes where the robot should go geometrically.

```text
path = x(s), y(s), theta(s)
```

where `s` is distance along the path.

A **trajectory** describes how the robot moves over time.

```text
trajectory = x(t), y(t), theta(t), v(t), omega(t), a(t)
```

A trajectory includes:

- position
- orientation
- velocity
- angular velocity
- acceleration
- curvature
- timing
- feasibility constraints

A path can be collision-free but still be a bad trajectory if it is too sharp, too fast, dynamically infeasible, or difficult for the robot to track.

---

## 2. Core Principle

A good trajectory is not simply the shortest route.

A good trajectory should be:

```text
safe
physically feasible
smooth
trackable
robust to error
task-aware
efficient enough
```

The correct priority order is usually:

```text
1. Safety
2. Physical feasibility
3. Smoothness and trackability
4. Robustness
5. Task satisfaction
6. Efficiency
```

Efficiency should not dominate safety or feasibility.

---

## 3. Critical Trajectory Elements

The following elements are critical. If these are wrong, the robot may behave poorly or fail.

---

### 3.1 Collision Safety

The trajectory must be collision-free for the **whole robot body**, not only for the center point.

A trajectory should be checked using the robot footprint along the full motion.

```text
for every pose in trajectory:
    robot footprint must not intersect obstacles
```

Bad trajectory:

```text
centerline is free, but the robot body touches an obstacle
```

Good trajectory:

```text
robot footprint remains collision-free with margin
```

Important checks:

- Is the centerline collision-free?
- Is the full footprint collision-free?
- Is there enough clearance from obstacles?
- Does the robot pass too close to walls, vegetation, poles, people, or corners?
- Is the trajectory robust to localization and tracking errors?

Collision-free is necessary, but not sufficient. A good trajectory also needs clearance.

---

### 3.2 Obstacle Clearance

Clearance is the distance between the robot and nearby obstacles.

A trajectory with very low clearance can be technically valid but practically unsafe.

Bad:

```text
robot passes 2 cm from an obstacle
```

Good:

```text
robot has enough margin for localization error, controller error, map error, and perception noise
```

Clearance should account for:

- robot footprint
- localization uncertainty
- map uncertainty
- sensor noise
- tracking error
- terrain irregularity
- dynamic obstacles

Principle:

```text
collision-free is not enough; robust clearance is needed
```

---

### 3.3 Kinematic Feasibility

The trajectory must match the robot type.

For a differential-drive or skid-steer robot, a simplified model is:

```text
x_dot = v cos(theta)
y_dot = v sin(theta)
theta_dot = omega
```

This means the robot cannot move sideways directly.

A bad trajectory may require lateral motion that the robot cannot perform.

Bad:

```text
robot is facing forward, but trajectory immediately moves sideways
```

Good:

```text
trajectory direction is compatible with robot heading and motion constraints
```

Different robot types require different trajectory assumptions:

| Robot type | Trajectory implication |
|---|---|
| Differential drive | Cannot move sideways, can rotate in place |
| Skid steer | Similar to differential drive, but may slip during sharp turns |
| Car-like | Cannot rotate in place, has minimum turning radius |
| Omnidirectional | Can move laterally, more flexible trajectories |

Principle:

```text
the same geometric path may be feasible for one robot and infeasible for another
```

---

### 3.4 Dynamic Feasibility

A trajectory must respect the physical limits of the robot.

Important limits include:

- maximum linear velocity
- maximum angular velocity
- maximum linear acceleration
- maximum linear deceleration
- maximum angular acceleration
- maximum curvature
- minimum turning radius
- friction limits
- actuator limits

Bad trajectory:

```text
straight line -> instant 90-degree turn -> straight line
```

A real robot cannot instantaneously change heading at speed.

A feasible trajectory should avoid:

- sudden velocity jumps
- sudden acceleration jumps
- sudden heading jumps
- excessive curvature
- excessive angular velocity
- sharp stop-start motion
- high-speed turns

---

### 3.5 Smoothness

Smoothness is one of the most important practical properties of a trajectory.

A trajectory should avoid discontinuities in:

- position
- heading
- curvature
- velocity
- acceleration
- jerk

For ground robots, the most practically important smoothness properties are:

```text
heading smoothness
curvature smoothness
velocity smoothness
```

Bad trajectory:

```text
P0 -------- P1
            |
            |
            P2
```

This creates a sharp corner.

Good trajectory:

```text
P0 -------- )
            )
            P2
```

A smoother trajectory reduces:

- oscillation
- overshoot
- controller saturation
- wheel slip
- poor tracking
- localization disturbance
- unstable sensor data
- uncomfortable motion

---

### 3.6 Curvature

Curvature measures how sharply a trajectory bends.

Approximate curvature:

```text
curvature = change in heading / change in distance
```

For a mobile robot:

```text
omega = v * curvature
```

where:

- `omega` is angular velocity
- `v` is linear velocity

This means curvature and speed are coupled.

Important rule:

```text
high curvature requires lower speed
high speed requires lower curvature
```

A good trajectory should have:

- bounded curvature
- no sudden curvature jumps
- wider turns when possible
- lower speed in curves

Bad:

```text
high speed + sharp curve
```

Possible consequences:

- wheel slip
- overshoot
- unstable motion
- controller saturation
- unsafe behavior

---

### 3.7 Time Parameterization

A geometric curve becomes a trajectory when timing and velocities are assigned.

Geometric path:

```text
x(s), y(s), theta(s)
```

Time-parameterized trajectory:

```text
x(t), y(t), theta(t), v(t), omega(t), a(t)
```

Time parameterization decides:

- where to accelerate
- where to decelerate
- where to stop
- how fast to enter curves
- how fast to pass near obstacles
- how long the motion takes

Practical rules:

```text
reduce speed in curves
reduce speed near obstacles
reduce speed near uncertain areas
reduce speed near task/action points
avoid abrupt acceleration or braking
```

---

### 3.8 Start-State Consistency

The trajectory should start from a state the robot can actually reach.

The initial state includes:

- position
- heading
- linear velocity
- angular velocity

Bad trajectory start:

- starts far from the robot
- starts with an incompatible heading
- starts with nonzero speed while robot is stopped
- immediately requires a sharp turn
- immediately requires high acceleration

Good trajectory start:

```text
current robot state -> smooth acceleration -> main motion
```

---

### 3.9 Goal-State Consistency

The trajectory should end in a meaningful and reachable final state.

The goal should define:

- final position
- final heading
- final velocity
- stopping behavior
- task-specific orientation if needed

Bad trajectory end:

- final pose too close to obstacle
- impossible final orientation
- abrupt stop
- high curvature immediately before goal
- final velocity incompatible with task

Good trajectory end:

```text
smooth approach -> correct final pose -> controlled stop or transition
```

---

### 3.10 Robustness to Tracking Error

A real robot never follows the trajectory perfectly.

The trajectory should tolerate small errors in:

- localization
- perception
- actuation
- control tracking
- terrain response
- wheel slip

Bad trajectory:

```text
small tracking error causes collision
```

Good trajectory:

```text
small tracking error remains safe
```

For real robots, robustness is often more important than mathematical optimality.

---

## 4. Important but Secondary Elements

These elements are useful, but they should not dominate the critical elements above.

---

### 4.1 Path Length

Shorter is not always better.

A short trajectory may be bad if it is:

- too close to obstacles
- too sharp
- too fast
- hard to track
- unsafe
- not robust

Better objective:

```text
minimize length while preserving safety, feasibility, smoothness, and clearance
```

---

### 4.2 Execution Time

Fast trajectories are useful, but not at the expense of safety.

A time-optimal trajectory may produce:

- high acceleration
- hard braking
- aggressive turns
- high energy use
- poor tracking
- unsafe behavior near obstacles

Principle:

```text
execution time is an objective, not the only objective
```

---

### 4.3 Energy Efficiency

Energy efficiency matters for long-duration robots, but usually after safety and feasibility.

Energy-efficient trajectories tend to avoid:

- frequent stop-start motion
- unnecessary turns
- oscillations
- excessive acceleration
- long detours
- high-speed sharp turns

Smooth velocity profiles are usually better for energy use.

---

### 4.4 Comfort and Sensor Stability

Comfort is important when the robot carries people, fragile payloads, cameras, LiDARs, or inspection sensors.

Comfort relates to:

- acceleration
- jerk
- angular acceleration
- vibration
- sudden stops
- sudden heading changes

For inspection or mapping robots, smooth trajectories improve sensor data quality.

---

### 4.5 Semantic Preferences

Some trajectories are preferred because of the task context.

Examples:

- keep right
- keep left
- stay centered in a corridor
- avoid crop rows
- approach object from a specific direction
- slow down near inspection targets
- stop at delivery points
- avoid muddy areas

These are usually task-level preferences. They should be encoded as costs or constraints.

Example cost function:

```text
cost = obstacle_cost
     + smoothness_cost
     + curvature_cost
     + task_preference_cost
```

---

## 5. Less Critical Elements

These are useful, but should not be overemphasized in early trajectory generation.

---

### 5.1 Perfect Mathematical Optimality

A trajectory does not need to be globally optimal to be good.

A slightly longer but safer, smoother, and more robust trajectory is often better than a mathematically optimal but fragile one.

Principle:

```text
good, robust, and executable is better than optimal but fragile
```

---

### 5.2 Extremely Dense Sampling

Too sparse is bad because it loses shape information.

Too dense can also be bad because it increases computation and may introduce numerical noise.

Sampling should depend on:

- robot size
- robot speed
- map resolution
- curvature
- environment complexity
- controller behavior

Practical principle:

```text
sample more densely in curves
sample less densely on long straight segments
```

---

### 5.3 Perfect Orientation at Every Point

Orientation is important, but tiny intermediate errors are usually less critical than:

- correct global direction
- smooth heading progression
- correct final orientation
- no heading discontinuities

For ground robots, intermediate orientation should usually follow the tangent of the path.

```text
theta_i = atan2(y_{i+1} - y_i, x_{i+1} - x_i)
```

---

### 5.4 Aesthetic Shape

A trajectory that looks visually nice is not necessarily good.

The trajectory should be judged using measurable properties:

- collision safety
- clearance
- curvature
- velocity feasibility
- acceleration feasibility
- smoothness
- robustness
- task success

---

## 6. Common Trajectory Representations

---

### 6.1 Waypoint Sequence

A waypoint sequence is a list of points:

```text
P0, P1, P2, ..., Pn
```

Advantages:

- simple
- easy to store
- easy to edit
- human-readable

Disadvantages:

- not necessarily smooth
- no timing
- no velocity profile
- may contain sharp corners
- may be dynamically infeasible

Use waypoints as rough input, not as the final executable trajectory.

---

### 6.2 Polyline

A polyline connects waypoints using straight segments.

It is useful as an initial path, but it usually contains heading discontinuities at corners.

Problem:

```text
straight segment -> sharp corner -> straight segment
```

A polyline should usually be smoothed before execution.

---

### 6.3 Spline Trajectory

Splines generate smooth curves from control points.

Common types:

- cubic spline
- B-spline
- Bezier curve
- Catmull-Rom spline
- clothoid

Advantages:

- smoother geometry
- continuous heading
- easier tracking
- useful for manually edited paths

Risks:

- smoothing can create collisions
- splines may overshoot control points
- curvature may become too high
- final path still needs validation

Important principle:

```text
validate after smoothing, not only before smoothing
```

---

### 6.4 Polynomial Trajectory

Polynomial trajectories are useful when timing and derivatives matter.

Example:

```text
x(t) = a0 + a1 t + a2 t^2 + a3 t^3 + ...
y(t) = b0 + b1 t + b2 t^2 + b3 t^3 + ...
```

They can enforce constraints on:

- position
- velocity
- acceleration
- jerk
- snap

Useful for smooth time-aware motion.

---

### 6.5 Optimization-Based Trajectory

Trajectory planning can be formulated as an optimization problem.

Example objective:

```text
minimize:
    path length
  + obstacle cost
  + curvature cost
  + acceleration cost
  + jerk cost
  + tracking risk
  + task preference cost
```

Subject to:

```text
collision constraints
velocity constraints
acceleration constraints
robot kinematics
boundary conditions
clearance constraints
```

This allows multiple requirements to be balanced.

---

## 7. Constraints vs. Costs

This distinction is critical.

---

### 7.1 Hard Constraints

Hard constraints must not be violated.

Examples:

- do not collide
- do not exceed physical limits
- do not enter forbidden zones
- do not violate robot kinematics
- do not exceed maximum velocity or acceleration

---

### 7.2 Soft Costs

Soft costs express preferences that can be traded off.

Examples:

- shorter distance
- smoother motion
- higher clearance
- lower energy
- preferred side
- comfort
- faster execution

Important principle:

```text
collision avoidance is a hard constraint
shortest distance is a soft cost
```

---

## 8. Example Trajectory Cost Function

A general trajectory cost can be written as:

```text
J = w_length * length
  + w_obs * obstacle_cost
  + w_clearance * clearance_cost
  + w_smooth * smoothness_cost
  + w_curv * curvature_cost
  + w_vel * velocity_cost
  + w_acc * acceleration_cost
  + w_jerk * jerk_cost
  + w_task * task_cost
```

Where:

| Weight | Meaning |
|---|---|
| `w_length` | importance of short trajectory |
| `w_obs` | importance of avoiding obstacles |
| `w_clearance` | importance of maintaining clearance |
| `w_smooth` | importance of smooth geometry |
| `w_curv` | importance of low curvature |
| `w_vel` | velocity preference |
| `w_acc` | acceleration penalty |
| `w_jerk` | jerk penalty |
| `w_task` | task-specific preference |

Changing weights changes behavior.

Examples:

```text
high obstacle weight -> safer but larger detours
high length weight -> shorter but possibly riskier
high smoothness weight -> smoother but may cut corners
high task weight -> follows task preference more strongly
```

---

## 9. Practical Trajectory Generation Pipeline

A practical trajectory-generation pipeline is:

```text
1. Receive rough waypoints or task intent
2. Generate initial geometric path
3. Remove invalid or duplicate points
4. Smooth the path
5. Resample the path
6. Compute orientation along the path
7. Check collision and clearance
8. Check curvature
9. Add velocity profile
10. Check dynamic feasibility
11. Validate final trajectory
12. Accept or reject trajectory
```

Pseudocode:

```python
def generate_trajectory(waypoints, map_data, robot_model):
    path = initial_path_from_waypoints(waypoints)

    path = remove_duplicate_points(path)
    path = smooth_path(path)
    path = resample_by_distance(path)
    path = compute_tangent_orientation(path)

    if not collision_free(path, robot_model, map_data):
        return "invalid: collision"

    if not has_minimum_clearance(path, map_data):
        return "invalid: insufficient clearance"

    curvature = compute_curvature(path)

    if max(abs(curvature)) > robot_model.max_curvature:
        return "invalid: curvature too high"

    velocity_profile = compute_velocity_profile(path, curvature, robot_model)

    if not dynamically_feasible(path, velocity_profile, robot_model):
        return "invalid: dynamic limits exceeded"

    return Trajectory(path, velocity_profile, curvature)
```

---

## 10. Trajectory Validation Checklist

Before accepting a trajectory, check the following.

---

### 10.1 Geometry Checks

- no NaN values
- no infinite values
- no duplicate consecutive points
- no zero-length segments
- no unintended loops
- no unintended self-intersections
- reasonable point spacing
- smooth heading progression
- bounded curvature
- no sharp heading discontinuities

---

### 10.2 Safety Checks

- centerline is collision-free
- full robot footprint is collision-free
- minimum clearance is satisfied
- trajectory avoids uncertain regions when possible
- trajectory is safe under expected localization error
- trajectory is safe under expected tracking error

---

### 10.3 Feasibility Checks

- velocity limits are respected
- acceleration limits are respected
- angular velocity limits are respected
- angular acceleration limits are respected
- curvature limits are respected
- start state is reachable
- goal state is reachable
- trajectory is compatible with robot kinematics

---

### 10.4 Practical Motion Checks

- no unnecessary zigzags
- no wall hugging
- no aggressive turns near obstacles
- no abrupt stop-start pattern
- no high curvature at high speed
- no sharp turn immediately after start
- no sharp turn immediately before goal
- robust to small disturbances

---

## 11. Good Trajectory Characteristics

A good trajectory has:

```text
safe obstacle clearance
smooth heading changes
bounded curvature
reasonable velocity profile
low acceleration peaks
low jerk when possible
reachable start state
reachable goal state
robustness to tracking error
task-compatible behavior
no unnecessary oscillation
no unnecessary detours
```

---

## 12. Bad Trajectory Characteristics

A bad trajectory often has:

```text
sharp corners
duplicate points
zero-length segments
sudden heading jumps
low obstacle clearance
wall hugging
unnecessary zigzags
high curvature at high speed
backtracking
unintended self-intersections
stop-start-stop behavior
unreachable start state
unreachable final state
unsafe velocity near obstacles
```

---

## 13. Typical Failure Patterns

---

### 13.1 Sharp Corner

```text
----------------|
                |
                |
```

Problem:

- high curvature
- heading discontinuity
- aggressive rotation required
- likely overshoot or oscillation

Better:

```text
---------------)
              )
             )
```

---

### 13.2 Zigzag Path

```text
/\/\/\/\/\/\
```

Problem:

- unnecessary angular motion
- poor tracking
- high energy use
- unstable sensor data

Better:

```text
---------------
```

or a smooth curve if direction change is needed.

---

### 13.3 Wall Hugging

```text
wall || trajectory very close to wall
```

Problem:

- low robustness
- collision risk under localization error
- unsafe under tracking error

Better:

```text
trajectory centered with adequate clearance
```

---

### 13.4 High Speed Through Curve

```text
large velocity + large curvature = large angular velocity demand
```

Problem:

- slip
- overshoot
- actuator saturation
- unsafe motion

Better:

```text
reduce speed when curvature increases
```

---

### 13.5 Smoothing-Induced Collision

A raw path may avoid obstacles, but smoothing may bend the curve into an obstacle.

Problem:

```text
valid rough path -> smoothing -> invalid trajectory
```

Important rule:

```text
always validate the final smoothed trajectory
```

---

## 14. Practical Rules for Creating Trajectories

Use these rules when generating trajectories for autonomous ground robots:

```text
1. Prefer smooth arcs over sharp corners.
2. Keep obstacle clearance whenever possible.
3. Slow down in curves.
4. Slow down near obstacles.
5. Avoid unnecessary zigzags.
6. Avoid trajectories requiring sideways motion unless the robot is omnidirectional.
7. Avoid high curvature immediately after start.
8. Avoid high curvature immediately before the goal.
9. Do not place the trajectory exactly on obstacle boundaries.
10. Validate the full robot footprint, not only the centerline.
11. Use wider turns for higher speeds.
12. Resample the trajectory reasonably.
13. Treat shortest path as only one objective.
14. Make the trajectory robust to localization and tracking errors.
15. Validate again after smoothing.
16. Reduce speed in high-curvature sections.
17. Reduce speed in low-clearance sections.
18. Make start and goal states physically reachable.
19. Avoid abrupt stop-start behavior.
20. Prefer robust, repeatable behavior over theoretical optimality.
```

---

## 15. Critical vs. Less Critical Summary

| Category | Element | Importance |
|---|---:|---|
| Safety | Collision-free footprint | Critical |
| Safety | Obstacle clearance | Critical |
| Safety | Robustness to tracking error | Critical |
| Feasibility | Kinematic compatibility | Critical |
| Feasibility | Velocity limits | Critical |
| Feasibility | Acceleration limits | Critical |
| Feasibility | Curvature limits | Critical |
| Motion quality | Heading smoothness | Critical |
| Motion quality | Curvature smoothness | Very important |
| Motion quality | Jerk minimization | Useful, less critical for slow robots |
| Task | Correct start state | Critical |
| Task | Correct goal state | Critical |
| Task | Preferred side or lane | Important, task-dependent |
| Efficiency | Exact path length | Secondary |
| Efficiency | Execution time | Important, but not above safety |
| Optimization | Global mathematical optimality | Less critical |
| Data quality | No duplicate or invalid points | Critical |
| Data quality | Extremely dense sampling | Less critical |
| Data quality | Reasonable sampling | Important |
| Timing | Velocity profile | Important |
| Timing | Full time-optimal plan | Task-dependent |

---

## 16. What an Agent Should Learn

An agent learning trajectory planning should internalize these principles:

```text
A trajectory must be executable, not only geometrically valid.

A shorter trajectory is not always better.

Safety and feasibility dominate efficiency.

The robot footprint matters more than the centerline.

Clearance matters because real robots have localization and control errors.

Curvature and speed must be planned together.

A smooth trajectory is easier to follow than a jagged one.

A trajectory must match the robot's kinematics.

A good trajectory is robust to small disturbances.

Optimization should balance safety, feasibility, smoothness, and task objectives.

Smoothing can create collisions, so validation must happen after smoothing.

Perfect mathematical optimality is less important than robust real-world execution.
```

---

## 17. Final Takeaway

A good trajectory for an autonomous mobile robot is one that the real robot can follow safely, smoothly, and repeatedly under imperfect sensing, imperfect localization, imperfect control, and imperfect terrain conditions.

The best trajectory is usually not the shortest one. It is the one that best balances:

```text
safety
feasibility
smoothness
robustness
task success
efficiency
```

Trajectory planning should therefore be treated as a multi-objective problem, not as a simple shortest-path problem.
