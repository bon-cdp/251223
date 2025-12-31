/**
 * Polygon math utilities for vertex editing
 * Supports area calculation, collision detection, and geometry operations
 */

export type Point = [number, number];
export type Polygon = Point[];

/**
 * Calculate polygon area using the Shoelace formula
 * Returns absolute area (always positive)
 */
export function calculatePolygonArea(vertices: Polygon): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }

  return Math.abs(area / 2);
}

/**
 * Calculate the centroid (center of mass) of a polygon
 */
export function calculateCentroid(vertices: Polygon): Point {
  if (vertices.length === 0) return [0, 0];

  let cx = 0;
  let cy = 0;
  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = vertices[i][0] * vertices[j][1] - vertices[j][0] * vertices[i][1];
    area += cross;
    cx += (vertices[i][0] + vertices[j][0]) * cross;
    cy += (vertices[i][1] + vertices[j][1]) * cross;
  }

  area /= 2;
  if (Math.abs(area) < 1e-10) {
    // Degenerate polygon, return average of points
    const avgX = vertices.reduce((sum, v) => sum + v[0], 0) / n;
    const avgY = vertices.reduce((sum, v) => sum + v[1], 0) / n;
    return [avgX, avgY];
  }

  cx /= (6 * area);
  cy /= (6 * area);

  return [cx, cy];
}

/**
 * Check if a point is inside a polygon using ray casting
 */
export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Get the bounding box of a polygon
 */
export function getBoundingBox(vertices: Polygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const [x, y] of vertices) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if two polygons overlap using SAT (Separating Axis Theorem)
 * Simplified version - checks bounding box first, then does point-in-polygon
 */
export function polygonsOverlap(poly1: Polygon, poly2: Polygon): boolean {
  // Quick bounding box rejection test
  const bb1 = getBoundingBox(poly1);
  const bb2 = getBoundingBox(poly2);

  if (bb1.maxX < bb2.minX || bb2.maxX < bb1.minX ||
      bb1.maxY < bb2.minY || bb2.maxY < bb1.minY) {
    return false;
  }

  // Check if any vertex of poly1 is inside poly2
  for (const vertex of poly1) {
    if (pointInPolygon(vertex, poly2)) return true;
  }

  // Check if any vertex of poly2 is inside poly1
  for (const vertex of poly2) {
    if (pointInPolygon(vertex, poly1)) return true;
  }

  // Check edge intersections
  return edgesIntersect(poly1, poly2);
}

/**
 * Check if any edges of two polygons intersect
 */
function edgesIntersect(poly1: Polygon, poly2: Polygon): boolean {
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % poly1.length];

    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % poly2.length];

      if (lineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(b1, b2, a1)) return true;
  if (d2 === 0 && onSegment(b1, b2, a2)) return true;
  if (d3 === 0 && onSegment(a1, a2, b1)) return true;
  if (d4 === 0 && onSegment(a1, a2, b2)) return true;

  return false;
}

function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
}

function onSegment(p1: Point, p2: Point, p: Point): boolean {
  return Math.min(p1[0], p2[0]) <= p[0] && p[0] <= Math.max(p1[0], p2[0]) &&
         Math.min(p1[1], p2[1]) <= p[1] && p[1] <= Math.max(p1[1], p2[1]);
}

/**
 * Translate all vertices by a delta
 */
export function translatePolygon(vertices: Polygon, dx: number, dy: number): Polygon {
  return vertices.map(([x, y]) => [x + dx, y + dy] as Point);
}

/**
 * Rotate polygon around its centroid
 */
export function rotatePolygon(vertices: Polygon, angleDegrees: number): Polygon {
  const [cx, cy] = calculateCentroid(vertices);
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return vertices.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [
      cx + dx * cos - dy * sin,
      cy + dx * sin + dy * cos,
    ] as Point;
  });
}

/**
 * Scale polygon from its centroid
 */
export function scalePolygon(vertices: Polygon, scale: number): Polygon {
  const [cx, cy] = calculateCentroid(vertices);

  return vertices.map(([x, y]) => [
    cx + (x - cx) * scale,
    cy + (y - cy) * scale,
  ] as Point);
}

/**
 * Add a vertex to an edge (insert between two existing vertices)
 * @param vertices The polygon vertices
 * @param edgeIndex The index of the starting vertex of the edge
 * @returns New polygon with inserted vertex at edge midpoint
 */
export function addVertexToEdge(vertices: Polygon, edgeIndex: number): Polygon {
  const result = [...vertices];
  const i = edgeIndex;
  const j = (edgeIndex + 1) % vertices.length;

  const midpoint: Point = [
    (vertices[i][0] + vertices[j][0]) / 2,
    (vertices[i][1] + vertices[j][1]) / 2,
  ];

  result.splice(i + 1, 0, midpoint);
  return result;
}

/**
 * Remove a vertex from the polygon
 * @returns New polygon without the vertex, or null if removal would create invalid polygon
 */
export function removeVertex(vertices: Polygon, vertexIndex: number): Polygon | null {
  if (vertices.length <= 3) {
    // Can't remove vertex from triangle
    return null;
  }

  const result = [...vertices];
  result.splice(vertexIndex, 1);
  return result;
}

/**
 * Move a single vertex to a new position
 */
export function moveVertex(vertices: Polygon, vertexIndex: number, newPosition: Point): Polygon {
  const result = [...vertices];
  result[vertexIndex] = newPosition;
  return result;
}

/**
 * Check if a polygon is valid (non-self-intersecting, has area)
 */
export function isValidPolygon(vertices: Polygon): boolean {
  if (vertices.length < 3) return false;

  // Check for self-intersection
  for (let i = 0; i < vertices.length; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % vertices.length];

    for (let j = i + 2; j < vertices.length; j++) {
      if (j === (i + vertices.length - 1) % vertices.length) continue; // Skip adjacent edges
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % vertices.length];

      if (lineSegmentsIntersect(a1, a2, b1, b2)) {
        return false;
      }
    }
  }

  // Check for positive area
  return calculatePolygonArea(vertices) > 1; // Minimum 1 sq ft
}

/**
 * Find the closest edge to a point
 * Returns edge index and distance
 */
export function findClosestEdge(point: Point, vertices: Polygon): { edgeIndex: number; distance: number } {
  let minDist = Infinity;
  let closestEdge = 0;

  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dist = pointToLineSegmentDistance(point, vertices[i], vertices[j]);

    if (dist < minDist) {
      minDist = dist;
      closestEdge = i;
    }
  }

  return { edgeIndex: closestEdge, distance: minDist };
}

/**
 * Calculate distance from point to line segment
 */
function pointToLineSegmentDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Project point onto line
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Create a rectangle polygon from center, width, height
 */
export function createRectPolygon(cx: number, cy: number, width: number, height: number): Polygon {
  const hw = width / 2;
  const hh = height / 2;
  return [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ];
}

/**
 * Create an L-shaped polygon
 */
export function createLShapePolygon(
  cx: number,
  cy: number,
  totalWidth: number,
  totalHeight: number,
  cutoutWidth: number,
  cutoutHeight: number,
  corner: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right'
): Polygon {
  const hw = totalWidth / 2;
  const hh = totalHeight / 2;

  // Create full rectangle first
  const base: Polygon = [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ];

  // Modify based on which corner to cut
  switch (corner) {
    case 'top-right':
      return [
        [cx - hw, cy - hh],
        [cx + hw - cutoutWidth, cy - hh],
        [cx + hw - cutoutWidth, cy - hh + cutoutHeight],
        [cx + hw, cy - hh + cutoutHeight],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
    case 'top-left':
      return [
        [cx - hw, cy - hh + cutoutHeight],
        [cx - hw + cutoutWidth, cy - hh + cutoutHeight],
        [cx - hw + cutoutWidth, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
    case 'bottom-right':
      return [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh - cutoutHeight],
        [cx + hw - cutoutWidth, cy + hh - cutoutHeight],
        [cx + hw - cutoutWidth, cy + hh],
        [cx - hw, cy + hh],
      ];
    case 'bottom-left':
      return [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw + cutoutWidth, cy + hh],
        [cx - hw + cutoutWidth, cy + hh - cutoutHeight],
        [cx - hw, cy + hh - cutoutHeight],
      ];
    default:
      return base;
  }
}

/**
 * Snap a point to a grid
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return [
    Math.round(point[0] / gridSize) * gridSize,
    Math.round(point[1] / gridSize) * gridSize,
  ];
}
