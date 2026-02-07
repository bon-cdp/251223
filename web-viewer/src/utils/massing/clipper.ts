import * as clipperLib from 'js-angusj-clipper';
import type { Polygon } from './types';

let clipperInstance: Awaited<ReturnType<typeof clipperLib.loadNativeClipperLibInstanceAsync>> | null = null;

async function getClipperInstance() {
  if (!clipperInstance) {
    clipperInstance = await clipperLib.loadNativeClipperLibInstanceAsync(
      clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback
    );
  }
  return clipperInstance;
}

function toClipperPath(polygon: Polygon): { x: number; y: number }[] {
  return polygon.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

function fromClipperPath(path: { x: number; y: number }[]): Polygon {
  return { points: path.map(p => ({ x: p.x, y: p.y })) };
}

const SCALE = 1000;

export async function offsetPolygon(
  polygon: Polygon,
  delta: number
): Promise<Polygon[]> {
  const clipper = await getClipperInstance();

  const scaledPath = toClipperPath(polygon).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }));

  const result = await clipper.offsetToPaths({
    offsetInputs: [{
      data: scaledPath,
      joinType: clipperLib.JoinType.Miter,
      endType: clipperLib.EndType.ClosedPolygon
    }],
    delta: delta * SCALE
  });

  if (!result) return [];

  return result.map(path => {
    const descaledPath = path.map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));
    return fromClipperPath(descaledPath);
  });
}

export async function unionPolygons(
  polygons: Polygon[]
): Promise<Polygon[]> {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) return [polygons[0]];

  const clipper = await getClipperInstance();

  const scaledPaths = polygons.map(polygon =>
    toClipperPath(polygon).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }))
  );

  const result = await clipper.clipToPaths({
    clipType: clipperLib.ClipType.Union,
    subjectInputs: scaledPaths.map(path => ({ data: path, closed: true })),
    subjectFillType: clipperLib.PolyFillType.EvenOdd
  });

  return result.map(path => {
    const descaledPath = path.map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));
    return fromClipperPath(descaledPath);
  });
}

export async function differencePolygons(
  subject: Polygon,
  clip: Polygon
): Promise<Polygon[]> {
  const clipper = await getClipperInstance();

  const subjectPath = toClipperPath(subject).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }));
  const clipPath = toClipperPath(clip).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }));

  const result = await clipper.clipToPaths({
    clipType: clipperLib.ClipType.Difference,
    subjectInputs: [{ data: subjectPath, closed: true }],
    clipInputs: [{ data: clipPath }],
    subjectFillType: clipperLib.PolyFillType.EvenOdd
  });

  return result.map(path => {
    const descaledPath = path.map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));
    return fromClipperPath(descaledPath);
  });
}

export async function intersectPolygons(
  polygons: Polygon[]
): Promise<Polygon[]> {
  if (polygons.length < 2) return polygons;

  const clipper = await getClipperInstance();

  const scaledPaths = polygons.map(polygon =>
    toClipperPath(polygon).map(p => ({ x: p.x * SCALE, y: p.y * SCALE }))
  );

  const result = await clipper.clipToPaths({
    clipType: clipperLib.ClipType.Intersection,
    subjectInputs: [{ data: scaledPaths[0], closed: true }],
    clipInputs: scaledPaths.slice(1).map(path => ({ data: path })),
    subjectFillType: clipperLib.PolyFillType.EvenOdd
  });

  return result.map(path => {
    const descaledPath = path.map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));
    return fromClipperPath(descaledPath);
  });
}


