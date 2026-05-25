import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Stage, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';

import { useStudioStore } from '../store/useStudioStore';
import { worldToPixel, pixelToWorld } from '../utils/coordinates';

const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const COMPUTED_TRAJECTORY_COLOR = '#0f766e';
const STALE_TRAJECTORY_COLOR = '#f59e0b';
const ORIENTATION_ARROW_COLOR = '#d55e00';
const SELECTED_WAYPOINT_COLOR = '#0072b2';
const ORIENTATION_HALO_COLOR = '#ffffff';

export function MapCanvas() {
  const map = useStudioStore((state) => state.map);
  const imageDataUrl = useStudioStore((state) => state.imageDataUrl);
  const elements = useStudioStore((state) => state.elements);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const computedTrajectory = useStudioStore((state) => state.computedTrajectory);
  const orientationDisplay = useStudioStore((state) => state.orientationDisplay);
  const selectedWaypointIndex = useStudioStore((state) => state.selectedWaypointIndex);
  const tool = useStudioStore((state) => state.tool);
  const zoom = useStudioStore((state) => state.zoom);
  const pan = useStudioStore((state) => state.pan);
  const draftPoint = useStudioStore((state) => state.draftPoint);
  const selectedId = useStudioStore((state) => state.selectedId);
  const setDraftPoint = useStudioStore((state) => state.setDraftPoint);
  const setCursorWorld = useStudioStore((state) => state.setCursorWorld);
  const addActionAtPoint = useStudioStore((state) => state.addActionAtPoint);
  const addTrajectoryPoint = useStudioStore((state) => state.addTrajectoryPoint);
  const addArcTrajectoryPoint = useStudioStore((state) => state.addArcTrajectoryPoint);
  const setSelectedId = useStudioStore((state) => state.setSelectedId);
  const setSelectedWaypointIndex = useStudioStore((state) => state.setSelectedWaypointIndex);
  const setZoom = useStudioStore((state) => state.setZoom);
  const setPan = useStudioStore((state) => state.setPan);
  const [image] = useImage(imageDataUrl ?? '');
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const dragMovedRef = useRef(false);
  const [viewport, setViewport] = useState({
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
  });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateSize = () => {
      const rect = shell.getBoundingClientRect();
      setViewport({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!map) return 1;
    return Math.min(viewport.width / map.width, viewport.height / map.height, 1.25);
  }, [map, viewport.height, viewport.width]);

  if (!map) {
    return (
      <div className="canvasShell" ref={shellRef}>
        <div className="emptyCanvas">Upload a Nav2 map YAML and image to begin.</div>
      </div>
    );
  }

  const scale = fitScale * zoom;
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const mapWidth = map.width * scale;
  const mapHeight = map.height * scale;
  const centerPan = {
    x: (viewportWidth - mapWidth) / 2,
    y: (viewportHeight - mapHeight) / 2,
  };
  const mapPan = {
    x: centerPan.x + pan.x,
    y: centerPan.y + pan.y,
  };

  const pointerToWorld = () => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    return pixelToWorld({ px: (pointer.x - mapPan.x) / scale, py: (pointer.y - mapPan.y) / scale }, map);
  };

  const handleClick = () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    const point = pointerToWorld();
    if (!point) return;

    if (tool === 'pan') {
      return;
    }
    if (tool === 'select') {
      setSelectedId(null);
      return;
    }
    if (tool === 'action') {
      addActionAtPoint(point);
      return;
    }
    if (tool === 'line') {
      addTrajectoryPoint(point);
      return;
    }
    if (tool === 'arc') {
      addArcTrajectoryPoint(point);
    }
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.15 : 1 / 1.15;
    setZoom(zoom * factor);
  };

  const handlePanDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    setPan({
      x: event.target.x() - centerPan.x,
      y: event.target.y() - centerPan.y,
    });
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  return (
    <div className="canvasShell" ref={shellRef}>
      <Stage
        ref={stageRef}
        width={viewportWidth}
        height={viewportHeight}
        onClick={handleClick}
        onMouseMove={() => setCursorWorld(pointerToWorld())}
        onMouseLeave={() => setCursorWorld(null)}
        onWheel={handleWheel}
      >
        <Layer>
          <Group
            x={mapPan.x}
            y={mapPan.y}
            draggable
            onDragMove={() => {
              dragMovedRef.current = true;
            }}
            onDragEnd={handlePanDragEnd}
          >
            {image && <KonvaImage image={image} width={mapWidth} height={mapHeight} />}
            <RoughControlView points={trajectoryPoints} map={map} scale={scale} />
            {computedTrajectory && (
              <ComputedTrajectoryView
                trajectory={computedTrajectory}
                orientationDisplay={orientationDisplay}
                selectedWaypointIndex={selectedWaypointIndex}
                map={map}
                scale={scale}
                onSelectWaypoint={setSelectedWaypointIndex}
              />
            )}
            {elements.map((element) => (
              <ElementView
                key={element.id}
                element={element}
                map={map}
                scale={scale}
                selected={selectedId === element.id}
                onSelect={() => setSelectedId(element.id)}
              />
            ))}
            {draftPoint && <DraftPoint point={draftPoint} map={map} scale={scale} />}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}

function RoughControlView({
  points,
  map,
  scale,
}: {
  points: { x: number; y: number }[];
  map: NonNullable<ReturnType<typeof useStudioStore.getState>['map']>;
  scale: number;
}) {
  if (points.length === 0) return null;

  const pixelPoints = points.map((point) => worldToPixel(point, map));
  const roughLinePoints = pixelPoints.flatMap((point) => [point.px * scale, point.py * scale]);

  return (
    <Group>
      {roughLinePoints.length >= 4 && (
        <Line
          points={roughLinePoints}
          stroke="#64748b"
          strokeWidth={1.8}
          dash={[7, 6]}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {pixelPoints.map((point, index) => (
        <Group key={index}>
          <Circle x={point.px * scale} y={point.py * scale} radius={5} fill="#ffffff" stroke="#2563eb" strokeWidth={2} />
          <Text
            x={point.px * scale + 7}
            y={point.py * scale - 17}
            text={`${index + 1}`}
            fontSize={12}
            fill="#1d4ed8"
          />
        </Group>
      ))}
    </Group>
  );
}

function ComputedTrajectoryView({
  trajectory,
  orientationDisplay,
  selectedWaypointIndex,
  map,
  scale,
  onSelectWaypoint,
}: {
  trajectory: NonNullable<ReturnType<typeof useStudioStore.getState>['computedTrajectory']>;
  orientationDisplay: ReturnType<typeof useStudioStore.getState>['orientationDisplay'];
  selectedWaypointIndex: number | null;
  map: NonNullable<ReturnType<typeof useStudioStore.getState>['map']>;
  scale: number;
  onSelectWaypoint: (index: number | null) => void;
}) {
  const linePoints = trajectory.waypoints.flatMap((point) => {
    const pixel = worldToPixel(point, map);
    return [pixel.px * scale, pixel.py * scale];
  });
  const color = trajectory.is_stale ? STALE_TRAJECTORY_COLOR : COMPUTED_TRAJECTORY_COLOR;

  return (
    <Group>
      {linePoints.length >= 4 && (
        <Line points={linePoints} stroke={color} strokeWidth={4} lineCap="round" lineJoin="round" />
      )}
      {trajectory.waypoints.map((waypoint, index) => {
        const shouldShowOrientation =
          orientationDisplay.show_arrows &&
          !trajectory.is_stale &&
          (index % orientationDisplay.arrow_stride === 0 || index === trajectory.waypoints.length - 1);
        const pixel = worldToPixel(waypoint, map);
        const arrowEnd = worldToPixel(
          {
            x: waypoint.x + Math.cos(waypoint.yaw) * orientationDisplay.arrow_length_m,
            y: waypoint.y + Math.sin(waypoint.yaw) * orientationDisplay.arrow_length_m,
          },
          map,
        );
        const isSelected = selectedWaypointIndex === index;
        const arrowColor = isSelected ? SELECTED_WAYPOINT_COLOR : ORIENTATION_ARROW_COLOR;
        const arrowPoints = [
          pixel.px * scale,
          pixel.py * scale,
          arrowEnd.px * scale,
          arrowEnd.py * scale,
        ];
        const selectWaypoint = (event: Konva.KonvaEventObject<MouseEvent>) => {
          event.cancelBubble = true;
          onSelectWaypoint(index);
        };
        return (
          <Group key={waypoint.id ?? index} onClick={selectWaypoint}>
            <Circle
              x={pixel.px * scale}
              y={pixel.py * scale}
              radius={isSelected ? 5 : 3}
              fill={isSelected ? SELECTED_WAYPOINT_COLOR : color}
              stroke="#ffffff"
              strokeWidth={isSelected ? 1.5 : 0}
            />
            {shouldShowOrientation && (
              <>
                <Arrow
                  points={arrowPoints}
                  stroke={ORIENTATION_HALO_COLOR}
                  fill={ORIENTATION_HALO_COLOR}
                  strokeWidth={4.5}
                  pointerLength={8}
                  pointerWidth={7}
                  lineCap="round"
                  lineJoin="round"
                />
                <Arrow
                  points={arrowPoints}
                  stroke={arrowColor}
                  fill={arrowColor}
                  strokeWidth={2}
                  pointerLength={7}
                  pointerWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
                {orientationDisplay.show_yaw_labels && (
                  <Text
                    x={pixel.px * scale + 5}
                    y={pixel.py * scale + 5}
                    text={`${Math.round((waypoint.yaw * 180) / Math.PI)} deg`}
                    fontSize={10}
                    fill={arrowColor}
                  />
                )}
              </>
            )}
          </Group>
        );
      })}
    </Group>
  );
}

function ElementView({
  element,
  map,
  scale,
  selected,
  onSelect,
}: {
  element: ReturnType<typeof useStudioStore.getState>['elements'][number];
  map: NonNullable<ReturnType<typeof useStudioStore.getState>['map']>;
  scale: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = selected ? '#ef4444' : '#0f766e';
  const select = (event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    onSelect();
  };

  if (element.type === 'action') {
    const pixel = worldToPixel(element.position, map);
    return (
      <Group onClick={select}>
        <Circle x={pixel.px * scale} y={pixel.py * scale} radius={7} fill="#f59e0b" stroke="#111827" />
        <Text x={pixel.px * scale + 9} y={pixel.py * scale - 8} text={element.label} fontSize={12} fill="#111827" />
      </Group>
    );
  }

  const points = element.waypoints.flatMap((waypoint) => {
    const pixel = worldToPixel(waypoint, map);
    return [pixel.px * scale, pixel.py * scale];
  });
  return (
    <Group onClick={select}>
      <Line points={points} stroke={color} strokeWidth={3} lineCap="round" lineJoin="round" />
      {element.waypoints.map((waypoint, index) => {
        const pixel = worldToPixel(waypoint, map);
        return <Circle key={index} x={pixel.px * scale} y={pixel.py * scale} radius={2.5} fill={color} />;
      })}
    </Group>
  );
}

function DraftPoint({
  point,
  map,
  scale,
}: {
  point: { x: number; y: number };
  map: NonNullable<ReturnType<typeof useStudioStore.getState>['map']>;
  scale: number;
}) {
  const pixel = worldToPixel(point, map);
  return <Circle x={pixel.px * scale} y={pixel.py * scale} radius={5} fill="#2563eb" />;
}
