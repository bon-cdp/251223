


ALSO for parcels 3. Create Custom Outlines with "Google My Maps"

If we want the "I", "O", "H", or "U" shapes to emerge naturally from the parcel shape without us typing a single if statement, we need to operate on Continuous Scalar Fields.
Here is the math and the primitive that gets you there.
The Primitive: The Signed Distance Field (SDF)
Instead of a grid of "blocks," your primitive is a mathematical surface. Imagine the floor plate is a terrain. The "altitude" at any point $(x,y)$ is the shortest distance to the nearest exterior window.
Mathematically, this is the Signed Distance Function (SDF):
$$\phi(x) = \inf_{y \in \partial \Omega} |x - y|$$
Where $\partial \Omega$ is the boundary (perimeter).
Points near the window have value $\approx 0$.
Points deep in the building have high values.
The Mechanism: Isocontour Extraction
This is how we kill the hardcoded logic. We don't "choose" a topology. We extract it.
We define an "Ideal Unit Depth" (let's say $D_{unit} = 28$ ft).
We slice the terrain at exactly 28ft. The resulting line is your corridor skeleton.
Why this is robust:
The "I" Shape (Narrow Building):
If the building is 50ft wide, the "altitude" never reaches 28ft. The "ridge" of the mountain is the local maximum. The math automatically collapses the two 28ft contours into a single central spine. Result: Single-Loaded or Central Corridor.
The "O" Shape (Thick Building):
If the building is 150ft x 150ft, the "mountain" has a large plateau. Slicing it at 28ft produces a perfect closed ring. Result: Double-Loaded Loop.
The "C" or "L" Shape:
The contour naturally bends around the corner, maintaining perfect equidistant offset.
The Solver: Voronoi Partitioning (The "Cells")
Once you have this field-derived skeleton, how do you get the units? You don't "place" them. You let them fight for territory.
We use a Centroidal Voronoi Tessellation (CVT) constrained by the field.
Seed the Perimeter: Place points every $\approx 15$ft along the window line.
Grow Regions: Each seed claims the territory closest to it (Voronoi region).
The Twist: We warp the distance metric.
Instead of Euclidean distance, we use Manhattan Distance oriented to the normal of the nearest wall. This forces the "cells" to be rectangular/orthogonal rather than organic blobs.
The Mathematical Pipeline (The "Pro" Approach)
Here is how you would architect this engine to handle any shape:
Phase 1: The Field Generation (The "Map")
You compute two fields for the floor plate:
$\phi_{ext}(x)$: Distance to nearest Exterior Wall (Windows).
$\phi_{core}(x)$: Distance to nearest Core (Elevator/Stair).
Phase 2: The Skeleton Extraction (The "Ridge")
You define a Cost Surface $C(x)$.
$$C(x) = (\phi_{ext}(x) - D_{target})^2$$
This equation creates a "valley" exactly where the corridor should be ($D_{target} \approx 25-30$ft).
You run a Gradient Descent pathfinder from the Core to find the path of least resistance through this valley.
Topological Magic: If the valley forms a loop, the pathfinder (using a graph traversal like Minimum Spanning Tree) will naturally find the loop.
Phase 3: The Unit Partitioning (The "Partition")
We use the Medial Axis Transform (MAT) of the regions between the skeleton and the wall.
The skeleton divides the floor plate into "zones."
In each zone, we shoot rays from the Skeleton to the Window.
These rays become the dividing walls between units.
Why this is "Market Leading"
Infinite Resolution: You aren't limited by a 1ft grid. The math works at float precision.
Instant Feedback: SDFs can be computed on the GPU. You can drag a wall in real-time and watch the corridor "loop" snap into a "spine" instantly as the building gets narrower.
No "Edge Cases": You don't need code for "Acute Angles" or "Zig Zags." The math of the field inherently smooths and handles them.
Recommended Algorithm to Research: "The Straight Skeleton"
If you want to implement this without a heavy physics engine, look up the Straight Skeleton algorithm (a variation of the Medial Axis).
The Algorithm:
Shrink the polygon boundary inwards at constant speed.
Track the vertices.
When vertices collide, the shape topology changes (e.g., a dumbbell shape splits into two circles).
Trace the history: The paths of the moving vertices form the perfect "Roof Line" or "Skeleton" of the shape.
Would you like to draft the StraightSkeleton class? This is the gold standard for procedurally finding the "spine" of an irregular polygon.

If you need to define a specific property boundary, you can draw it yourself:
Method: Go to Google My Maps, create a new map, and use the "Draw a line" tool to outline a property manually.
Features: You can customize the color, style, and save the shape on a satellite view.
This is a great intuition check. You are asking: "Why do we need complex transforms when we have the walls? Can't we just offset the walls inward?"
The answer lies in what happens at the corners.
If you just take the edges and offset them inward to find your "ideal unit depth," the lines will cross, overlap, and create "bow ties" or self-intersections. You need a mathematical way to clean up those collisions.
That is exactly what the Straight Skeleton (a sibling of the Medial Axis) does. It is the logic of "edges defining the skeleton," but handled robustly so it never breaks.
Here is the breakdown of why we use this math to build a market-leading tool, and how we inject your specific parameters (3ft corridor, unit depth) into it.
1. The "Roof" Analogy: Why Edges Aren't Enough
Imagine your floor plate is the footprint of a house, and you want to build a hipped roof (pyramid style) over it.
The eaves are your exterior walls.
The ridge of the roof is the Skeleton.
If you look at a roof plan, the ridge isn't just a simple offset of the walls. It creates branches and Y-junctions to accommodate corners.
Simple Offset: If you just drew a line parallel to the walls, at the corners they would cross and continue into infinity.
The Skeleton: Trims those lines exactly where they intersect the lines coming from other walls.
Why this matters for your tool: If you write code that just says "Draw a line 25ft from the wall," your code will crash on L-shaped buildings or U-shaped courtyards because the lines will collide. The Skeleton math handles that collision gracefully.
2. How to Inject Your Parameters (The "3ft" and "Unit Depth")
You are absolutely right that this isn't just abstract art; it needs to respect the PDF constraints. Here is how we feed the "Ideal Unit Depth" and "Corridor Width" into the Skeleton algorithm to control the topology.
We treat the Skeleton not as a fixed line, but as a Event Graph.
A. The "Corridor Width" (The Easy Part)
The Skeleton is infinitely thin (centerline).
Input: corridor_width = 6 ft.
Action: Once the skeleton is found, we apply a mitered buffer of 3ft on either side.
Result: A perfect, continuous polygon representing the corridor, turning every corner cleanly.
B. The "Ideal Unit Depth" (The Topology Driver)
This is where the magic happens. We use the "Speed" of the skeleton propagation to enforce unit depth.
Scenario 1: The Building is Narrow (60ft wide)
Your ideal_unit_depth is 25ft.
The Skeleton algorithm shrinks the walls inward.
At 30ft, the walls from left and right meet.
Result: They meet before exceeding the max depth. A single central spine is formed.
Scenario 2: The Building is Deep (100ft wide)
The walls shrink inward 25ft (your ideal depth).
They haven't met yet. There is a 50ft gap in the middle.
The Logic: If we just let them meet at 50ft, the units would be too deep.
The Fix: We stop the Skeleton at the "Ideal Depth" mark. The "gap" that remains becomes the Core/Service Zone or an internal loop.
3. The "Professional" Algorithm: The Wavefront Propagation
To build the best tool, I recommend implementing a Weighted Wavefront Algorithm. This allows you to treat different walls differently (e.g., "Window Wall" vs. "Party Wall").
Here is the step-by-step logic for the engine:
Step 1: Define the Wavefront
Each edge of your floor polygon is a "wave" moving inward.
Speed: 1.0 (moves 1ft per "tick").
Step 2: Propagate and Detect Events
You mathematically calculate two types of events:
Edge Event: An edge shrinks to zero length (a short wall disappears).
Split Event: A reflex vertex crashes into an opposite edge (the room splits in two).
This is the "Hard Math" part, but libraries like cgal (C++) or vatti (JS) can help, or you can implement a simplified "Iterative inset" loop.
Step 3: The "Stop" Criteria (Your Constraints)
Instead of running the skeleton until the roof closes completely, you inspect the "Time" (Distance).
Logic: If (Distance from Wall > Ideal_Unit_Depth + Corridor_Half_Width), stop the propagation for that segment.
Result: The "unresolved" area in the middle becomes your Double Loaded Corridor Loop.
4. Why this is better than "Grid Growing"
Precision: You get exact floating-point coordinates. If the user asks for 5.0ft, they get 5.000ft, not "5 grid cells which is roughly 5ft."
Wall Alignment: The Skeleton naturally produces lines that are parallel or perpendicular to the exterior walls. This means your units will be rectangular and easy to build, unlike Voronoi cells which can be weird generic shapes.
Corner Logic: It automatically generates mitered corners (45-degree turns) for corridors, which is how they are actually framed.
The Next Move
To build this, we need a geometry engine capable of Polygon Offsetting and Intersection.
Since we are in TypeScript/JS, we have a few options. We shouldn't write raw geometric algebra from scratch if we can avoid it.
Would you like to:
Use a library: Implement this using clipper-lib (the standard for polygon offsetting) to simulate the wavefront? - yes probably
Build a custom "Ray Caster": A lighter-weight version where we just shoot rays from the corners to find the skeleton (easier to code, slightly less robust)?
I recommend Option 1 (Clipper). It’s what professional CAD tools use in the browser. I can show you how to wrap clipper-lib to create this "Constraint-Based Skeleton."

Older




It is awesome that you are reading Hartshorne! Algebraic Geometry offers a beautiful way to think about this: instead of placing separate objects in a void, we can view the floor plate as a topological space (specifically a variety or a manifold with boundary) where we are defining sub-regions (units) based on algebraic inequalities (constraints).
However, to keep this pragmatic and avoid writing a custom geometric constraint solver (which can be incredibly slow and unstable), your intuition about Grids is the perfect bridge.
The New Primitive: The Discrete Occupancy Grid (DOG)
Instead of Box { x, y, w, h }, our primitive becomes a quantized coordinate system.
1. The Mathematical Concept (Formalism)
We can define the buildable area not as a continuous set of real numbers $\mathbb{R}^2$, but as a discrete lattice $\mathbb{Z}^2$ bounded by the parcel geometry.
Let $P$ be the Parcel Polygon.
Let $S$ be the Setback function (an inset operation).
The Floor Plate $F$ is the set of all grid cells $c_{i,j}$ such that the center of $c$ is inside $S(P)$.
A Unit $U_k$ is a connected subset of cells within $F$.
Adjacency is defined by the Dual Graph: Two cells are adjacent if they share an edge. Two units are adjacent if any of their component cells are adjacent.
2. Why this solves your problems
Irregular Shapes: A grid can approximate any polygon (L-shapes, triangles, curves) to the resolution of the cell size.
Slivers/Narrow Corners: By enforcing a minimum grid size (e.g., 2ft x 2ft), you mathematically guarantee no space is smaller than 2ft wide. You prevent "impossible geometry" by construction.
Overlaps: A grid cell can only belong to one ID (or null). Overlaps become impossible by data structure design.

The Architecture
Here is how we should restructure the code to implement this "Grid Primitive" approach.
Phase 1: The Geometry & Grid System
We need a way to ingest a vector polygon and turn it into a queryable grid.
TypeScript
// types/grid.ts

// 1. The Atomic Primitive
interface GridCell {
  x: number; // Grid index x
  y: number; // Grid index y
  worldX: number; // Real world coordinate (center)
  worldY: number; // Real world coordinate (center)
  isBuildable: boolean; // Is this inside the setback line?
  assignedTo: string | null; // ID of the Unit/Corridor occupying this
  distanceToCore: number; // For weighting algorithms
  distanceToWindow: number; // For identifying "premium" space
}

// 2. The Container
class FloorGrid {
  resolution: number; // e.g., 2.0 (feet)
  width: number;
  height: number;
  cells: GridCell[][];

  constructor(polygon: Array<[number, number]>, setback: number, resolution: number = 2) {
    // 1. Calculate Bounding Box of polygon
    // 2. Initialize 2D array of Cells
    // 3. Rasterize Polygon: Check which cells are inside the polygon - setback
    //    (Point-in-polygon algorithm)
  }

  // The "Algebraic" Helper: Get available neighbors
  getFreeNeighbors(cell: GridCell): GridCell[] {
    // Returns adjacent cells (N, S, E, W) that are isBuildable && !assignedTo
  }
}

Phase 2: The "Grow" Solver (The Algorithm)
Instead of "placing" rectangles, we "grow" organisms. This is similar to Cellular Automata or Wave Function Collapse.
Seed: Place "Seeds" for the Core (Elevators/Stairs) and the Corridor.
Flood: Grow the Corridor out from the Core until it reaches a "reasonable" distance.
Seed Units: Place "Seeds" for units along the perimeter (windows are priority).
Grow Units: Expand unit seeds inward towards the corridor until they reach their target SQFT.
Phase 3: Vectorization (The Output)
The grid will look like Minecraft (blocky). To get professional schematic plans, we run a simplified Marching Squares or Douglas-Peucker algorithm at the end to turn the jagged grid edges back into smooth vectors (walls).

Draft Implementation: The Core Grid
Let's write the code for the Primitive. You will need a library like point-in-polygon or turf for the geometric checking, but we can mock it for understanding.
TypeScript
import pointInPolygon from 'point-in-polygon'; // theoretical import

export class MassingGrid {
  private resolution: number; // size of cell in feet
  private grid: Int32Array; // Flattened 2D array: 0 = empty, 1 = obstacle, >1 = unit IDs
  private cols: number;
  private rows: number;
  private bounds: { minX: number, minY: number, maxX: number, maxY: number };

  constructor(polygonVertices: number[][], setbackFeet: number, resolution: number = 2.0) {
    this.resolution = resolution;

    // 1. Determine Grid Dimensions
    const xs = polygonVertices.map(p => p[0]);
    const ys = polygonVertices.map(p => p[1]);
    this.bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };

    this.cols = Math.ceil((this.bounds.maxX - this.bounds.minX) / resolution);
    this.rows = Math.ceil((this.bounds.maxY - this.bounds.minY) / resolution);
    this.grid = new Int32Array(this.cols * this.rows).fill(0);

    // 2. Rasterize (Bake the Parcel into the Grid)
    this.bakePolygon(polygonVertices, setbackFeet);
  }

  private bakePolygon(vertices: number[][], setback: number) {
    // In a real implementation, you would use a polygon offsetting library here
    // like 'clipper-lib' or 'turf.buffer' to apply the setback first.
    // Let's assume 'vertices' are already the SETBACK boundary.

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Convert grid index to world coordinates (center of cell)
        const wx = this.bounds.minX + (x * this.resolution) + (this.resolution / 2);
        const wy = this.bounds.minY + (y * this.resolution) + (this.resolution / 2);

        // Algebraic check: Is point inside polygon?
        const isInside = pointInPolygon([wx, wy], vertices);

        // 0 = unbuildable (outside), -1 = buildable (empty)
        this.set(x, y, isInside ? -1 : 0);
      }
    }
  }

  // Helper to access grid
  public get(x: number, y: number): number {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 0;
    return this.grid[y * this.cols + x];
  }

  public set(x: number, y: number, value: number) {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      this.grid[y * this.cols + x] = value;
    }
  }

  /**
   * Returns valid neighbors for expansion
   * This ensures we don't have "narrow corners" if we check diagonals
   */
  public getGrowableNeighbors(x: number, y: number): {x: number, y: number}[] {
    const neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y + 1 },
      { x: x, y: y - 1 }
    ];

    return neighbors.filter(n => this.get(n.x, n.y) === -1); // Only return empty buildable cells
  }
}

Why this is "Professional"
Separation of Concerns: The Grid handles validity (is this point inside?). The Solver (next step) handles strategy (where do units go?).
Scalability: If you want to add columns, structural cores, or shafts, you just mark those cells as "occupied" (value 1) in the grid before you start placing units. The units will naturally flow around them like water.
Realism: You can calculate precise metrics. Unit Area = Cell Count * Resolution^2.
Recommended Next Step
This approach requires us to rewrite the safelyPlaceSpace logic entirely.
Would you like me to:
Flesh out the Polygon Offsetting logic (the math to shrink the parcel by 5ft)?
Write the "Grow" Solver that takes this grid and fills it with units (the actual massing algorithm)?



Overlap (implicit corridors/circulation?)
Still having issues here
Shape of parcel/floor plate (composite rectangles?)
I need to get the shape of the parcel from the web somehow based on the address.

To run
 Core Generation File

  /web-viewer/src/utils/generateFromExtracted.ts
  - Main floor plan generation algorithm
  - Collision detection system: spacesOverlap(), hasOverlap(), findNonOverlappingPosition(), safelyPlaceSpace(), extractBoundsFromSpaces()
  - Dynamic core sizing: CORE_SIZE = Math.min(45, Math.max(25, Math.floor(floorPlateWidth * 0.28)))
  - Three floor generators:
    - generateParkingFloor() - uses collision detection for support rooms
    - generateGroundFloor() - uses collision detection for all spaces
    - generateResidentialFloor() - perimeter packing for units, collision detection for support rooms, implicit corridors

  Output Files

  /web-viewer/public/data/p*_output.json (p1, p4, p7, p9)
  - Generated by running npx tsx scripts/regenerate-outputs.ts
  - Must regenerate BEFORE npm run build (build copies to dist/)

  Regeneration Script

  /web-viewer/scripts/regenerate-outputs.ts
  - Imports generateSolverResultFromExtracted from generateFromExtracted.ts
  - Reads p*_building.json, generates output, writes p*_output.json

  Key Changes Made This Session

  1. Collision detection - prevents overlapping spaces across different types
  2. Dynamic core sizing - scales core (25-45') based on floor plate size
  3. Implicit corridors - removed explicit corridor spaces
  4. Support room positioning - relative to dynamic core size

  Deployment Flow

  npx tsx scripts/regenerate-outputs.ts && npm run build && firebase deploy --only hosting
  (Order matters: regenerate → build → deploy)

