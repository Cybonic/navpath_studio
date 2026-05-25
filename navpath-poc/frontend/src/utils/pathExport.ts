import type { NavPathExport, Waypoint } from '../types';
import { waypointQuaternion } from './headingGeneration';

/**
 * Subsample a dense waypoint list by accumulated arc-length distance.
 * The first and last waypoints are always preserved.
 */
export function subsampleByDistance(waypoints: Waypoint[], strideM: number): Waypoint[] {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) return [waypoints[0]];
  const safe = Math.max(strideM, 0.01);
  const result: Waypoint[] = [waypoints[0]];
  let accumulated = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    accumulated += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (accumulated >= safe || i === waypoints.length - 1) {
      result.push(curr);
      accumulated = 0;
    }
  }
  return result;
}

/**
 * Build a YAML string for the Nav2 NavigateThroughPoses / WaypointFollower action.
 * The `goals` list is subsampled from the dense waypoints at the given stride (metres).
 * Default stride is 1.0 m — coarse enough for waypoint-follower semantics.
 */
export function buildGoalsYaml(waypoints: Waypoint[], frameId = 'map', strideM = 1.0): string {
  const sparse = subsampleByDistance(waypoints, strideM);
  const lines: string[] = [
    `# Nav2 NavigateThroughPoses / WaypointFollower goals`,
    `# ${sparse.length} goals subsampled at ~${strideM} m stride from ${waypoints.length} dense waypoints`,
    'goals:',
  ];
  for (const wp of sparse) {
    const q = waypointQuaternion(wp);
    lines.push('  - header:');
    lines.push(`      frame_id: ${frameId}`);
    lines.push('    pose:');
    lines.push('      position:');
    lines.push(`        x: ${formatNumber(wp.x)}`);
    lines.push(`        y: ${formatNumber(wp.y)}`);
    lines.push('        z: 0.0');
    lines.push('      orientation:');
    lines.push(`        x: ${formatNumber(q.x)}`);
    lines.push(`        y: ${formatNumber(q.y)}`);
    lines.push(`        z: ${formatNumber(q.z)}`);
    lines.push(`        w: ${formatNumber(q.w)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildNavPath(waypoints: Waypoint[], frameId = 'map'): NavPathExport {
  return {
    header: {
      frame_id: frameId,
    },
    poses: waypoints.map((waypoint) => ({
      header: {
        frame_id: frameId,
      },
      pose: {
        position: {
          x: waypoint.x,
          y: waypoint.y,
          z: 0,
        },
        orientation: waypointQuaternion(waypoint),
      },
    })),
  };
}

export function pathToYaml(path: NavPathExport): string {
  const lines = ['header:', `  frame_id: ${path.header.frame_id}`, 'poses:'];
  for (const pose of path.poses) {
    lines.push('  - header:');
    lines.push(`      frame_id: ${pose.header.frame_id}`);
    lines.push('    pose:');
    lines.push('      position:');
    lines.push(`        x: ${formatNumber(pose.pose.position.x)}`);
    lines.push(`        y: ${formatNumber(pose.pose.position.y)}`);
    lines.push(`        z: ${formatNumber(pose.pose.position.z)}`);
    lines.push('      orientation:');
    lines.push(`        x: ${formatNumber(pose.pose.orientation.x)}`);
    lines.push(`        y: ${formatNumber(pose.pose.orientation.y)}`);
    lines.push(`        z: ${formatNumber(pose.pose.orientation.z)}`);
    lines.push(`        w: ${formatNumber(pose.pose.orientation.w)}`);
  }
  return `${lines.join('\n')}\n`;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '0';
}
