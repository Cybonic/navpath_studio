import type { NavPathExport, Waypoint } from '../types';
import { waypointQuaternion } from './headingGeneration';

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
