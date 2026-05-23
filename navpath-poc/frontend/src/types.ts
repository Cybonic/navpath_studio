export type MapMode = 'trinary' | 'scale' | 'raw';

export interface MapMetadata {
  image: string;
  mode: MapMode;
  resolution: number;
  origin: [number, number, number];
  negate: 0 | 1;
  occupied_thresh: number;
  free_thresh: number;
  width: number;
  height: number;
  frame_id: string;
}

export interface PixelPoint {
  px: number;
  py: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Waypoint extends WorldPoint {
  yaw: number;
}

export type ToolMode = 'select' | 'pan' | 'line' | 'arc' | 'action';

export interface LinePrimitive {
  id: string;
  type: 'line';
  start: WorldPoint;
  end: WorldPoint;
  spacing: number;
  waypoints: Waypoint[];
}

export interface ArcPrimitive {
  id: string;
  type: 'arc';
  center: WorldPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
  spacing: number;
  waypoints: Waypoint[];
}

export interface ActionNode {
  id: string;
  type: 'action';
  position: WorldPoint;
  label: string;
}

export type DrawingElement = LinePrimitive | ArcPrimitive | ActionNode;

export interface NavPathExport {
  header: {
    frame_id: string;
  };
  poses: Array<{
    header: {
      frame_id: string;
    };
    pose: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: Quaternion;
    };
  }>;
}
