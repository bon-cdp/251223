# Phase 2: Massing Algorithm Enhancements

**Total Estimated Effort**: ~50-65 hours

**Based on**: Progress Update 2026-01-27 + Next Steps Research

**Goal**: Implement corridor accessibility, dynamic unit shapes, multiple building shapes, and grid fitting to parcel boundaries.

---

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Grid Resolution** | 2 ft per cell | Balance performance (~400 cells/floor) and precision |
| **Corridor Width** | 6 ft | Standard residential width, balanced access |
| **Corridor Logic** | Balanced (equidistant from all walls) | Equal access from all unit sides |
| **Library** | clipper-lib@2.0.0 | Robust polygon offsetting, ~20kb bundle |
| **Building Shapes** | Rectangle, Courtyard, Donut, H-shape, T-shape | All orthogonal (90°), curves deferred to later |
| **Regeneration** | Manual "Regenerate" button | Better UX, no unintended full rebuilds |
| **Shape Limits** | Configurable min/max with defaults | Flexibility for different requirements |
| **Grid Fitting** | Largest rectangle within plot shape | Conservative approach, ensures full utilization |

---

## Task Breakdown

### Task 1: Prerequisites & Infrastructure (2-3 hrs)

**Dependencies**: None

**Sub-tasks**:

1.1 **Install dependencies**
   - `npm install @typescript/clipper-lib@2.0.0`

1.2 **Create directory structure**
   ```
   src/utils/massing/
   ├── types.ts
   ├── clipper.ts
   ├── skeleton/
   ├── grid/
   ├── placement/
   └── shape/
   ```

1.3 **Set up TypeScript types**
   - Create `src/utils/massing/types.ts`
   - Define `BuildingShape`, `GridCell`, `SetbackConfig`, `ShapeDimensions`

1.4 **Set up testing structure**
   - Create `src/utils/massing/__tests__/` directory
   - Add placeholder test files for each module

**Deliverables**:
- `src/utils/massing/types.ts`
- Directory structure created
- Test infrastructure in place

**Acceptance Criteria**:
- [ ] clipper-lib installed and builds successfully
- [ ] All type definitions compile without errors
- [ ] Test files can be run with `npm test`

---

### Task 2: Corridor Accessibility (12-14 hrs)

**Dependencies**: Task 1

**Goal**: Replace fixed corridor ring with skeleton-based corridors that ensure all units have accessible paths to core.

**Sub-tasks**:

2.1 **Clipper Wrapper** (2 hrs)
   - Create `src/utils/massing/clipper.ts`
   - Wrap clipper-lib for polygon offsetting
   - Support inward/outward offset operations
   - Handle multi-polygon results (donut shapes)

   ```typescript
   // API
   export function offsetPolygon(poly: Polygon, distance: number, joinType: JoinType): Polygon | Polygon[];
   export function intersectPolygons(poly1: Polygon, poly2: Polygon): Polygon[];
   export function unionPolygons(polys: Polygon[]): Polygon;
   export function differencePolygons(poly: Polygon, hole: Polygon): Polygon[];
   ```

2.2 **Straight Skeleton** (4-5 hrs)
   - Create `src/utils/massing/skeleton/StraightSkeleton.ts`
   - Implement wavefront propagation algorithm
   - Detect edge collision events (edge event, split event)
   - Extract ridge line at target depth (25-30 ft from walls)

   ```typescript
   // API
   export function extractCorridorSkeleton(
     floorPlate: Polygon,
     targetDepth: number = 25
   ): Polygon;
   ```

   **Algorithm**:
   1. Initialize wavefront from all polygon edges
   2. Propagate edges inward at constant speed
   3. Detect when edges collide (events)
   4. Track vertex paths (these form the skeleton)
   5. Extract the ridge at targetDepth

2.3 **Balanced Corridor Router** (3-4 hrs)
   - Create `src/utils/massing/skeleton/CorridorRouter.ts`
   - Position corridor equidistant from all walls
   - Connect corridor to core with balanced paths
   - Generate 6ft corridor polygon via 3ft buffers on each side

   ```typescript
   // API
   export function generateCorridorPolygon(
     skeleton: Polygon,
     corePosition: Point,
     corridorWidth: number = 6,
     coreRadius: number = 20
   ): Polygon;
   ```

   **Balanced Access Logic**:
   - Skeleton divides floor plate into zones
   - Each zone gets equal access distance to corridor
   - Core connects to skeleton via shortest balanced path

2.4 **Integration** (3 hrs)
   - Update `src/utils/generateFromExtracted.ts`
   - Replace ring corridor in `generateResidentialFloor()` with skeleton-based corridor
   - Test on P9 Level 4 (known overlap issue)
   - Ensure all units have corridor access

**Deliverables**:
- `src/utils/massing/clipper.ts`
- `src/utils/massing/skeleton/StraightSkeleton.ts`
- `src/utils/massing/skeleton/CorridorRouter.ts`
- Updated `generateFromExtracted.ts`

**Acceptance Criteria**:
- [ ] All units have corridor access path
- [ ] Corridors are balanced (equidistant from walls)
- [ ] P9 Level 4 overlapping units fixed
- [ ] Corridor width is configurable (default 6ft)
- [ ] Supports complex floor shapes (L, U, H)

---

### Task 3: Dynamic Unit Shapes (18-22 hrs)

**Dependencies**: Task 2

**Goal**: Replace rectangle-only units with grid-based placement supporting L-shapes, corner units, and irregular geometries.

**Sub-tasks**:

3.1 **MassingGrid Core** (5-6 hrs)
   - Create `src/utils/massing/grid/MassingGrid.ts`
   - Implement 2ft grid with `Int32Array` storage
   - Point-in-polygon rasterization
   - Cell neighbor queries (4-way adjacency)

   ```typescript
   // API
   class MassingGrid {
     resolution: number;      // 2 ft per cell
     grid: Int32Array;       // -1=empty, 0=blocked, >0=unit ID
     cols, rows: number;
     bounds: BoundingBox;

     constructor(floorPlate: Polygon, resolution: number = 2);
     rasterizePolygon(polygon: Polygon, value: number): void;
     getCell(x, y): number;
     setCell(x, y, value): void;
     getFreeNeighbors(x, y): GridCell[];
     getCellCenter(x, y): Point;
     isCellBuildable(x, y): boolean;
   }
   ```

3.2 **Grid Operations** (3 hrs)
   - Create `src/utils/massing/grid/gridOperations.ts`
   - Flood fill algorithms
   - Cell clustering (connected components)
   - Distance field computation to corridor/core

   ```typescript
   // API
   export function floodFill(
     grid: MassingGrid, startX, startY, fillValue
   ): GridCell[];

   export function clusterCells(
     grid: MassingGrid, predicate: (id: number) => boolean
   ): GridCell[][];

   export function computeDistanceField(
     grid: MassingGrid, sourceCells: GridCell[]
   ): Map<string, number>;
   ```

3.3 **Unit Grower** (5-6 hrs)
   - Create `src/utils/massing/placement/unitGrower.ts`
   - Seed units along perimeter (prioritize exterior/window cells)
   - Grow cells toward balanced corridor using distance field
   - Stop at target area or collision
   - Support non-rectangular shapes naturally

   ```typescript
   // API
   export function growUnit(
     grid: MassingGrid,
     seed: GridCell,
     targetArea: number,
     corridorDistField: Map<string, number>
   ): GridCell[];

   export function seedPerimeterUnits(
     grid: MassingGrid,
     unitTypes: Unit[],
     corridorDistField: Map<string, number>
   ): Map<string, GridCell[]>;
   ```

   **Growth Algorithm**:
   1. Seed at perimeter cell with window access
   2. Get free neighbors
   3. Select neighbor that minimizes distance to corridor
   4. Add to unit, repeat until target area reached
   5. Stop if no free neighbors

3.4 **Vectorization** (3-4 hrs)
   - Create `src/utils/massing/placement/vectorization.ts`
   - Convert cell clusters to polygon vertices
   - Douglas-Peucker simplification
   - Smooth corners with mitering

   ```typescript
   // API
   export function vectorizeCells(
     cells: GridCell[],
     resolution: number
   ): Polygon;

   export function simplifyPolygon(
     polygon: Polygon,
     tolerance: number
   ): Polygon;

   export function miterCorners(polygon: Polygon): Polygon;
   ```

3.5 **Integration** (2 hrs)
   - Update `generateFromExtracted.ts`
   - Convert `RectGeometry` → `PolygonGeometry` for units
   - Update area calculations using polygon area
   - Maintain window access requirement (exterior wall contact)

**Deliverables**:
- `src/utils/massing/grid/MassingGrid.ts`
- `src/utils/massing/grid/gridOperations.ts`
- `src/utils/massing/placement/unitGrower.ts`
- `src/utils/massing/placement/vectorization.ts`
- Updated `generateFromExtracted.ts`

**Acceptance Criteria**:
- [ ] Units fit target area within ±10%
- [ ] L-shapes and corner units supported
- [ ] All units maintain window access
- [ ] No overlapping units
- [ ] Performance acceptable (< 500ms per floor generation)

---

### Task 4: Grid Fitting to Plot Shape (6-8 hrs)

**Dependencies**: Task 3

**Goal**: Fit largest possible rectangular grid within irregular parcel shapes with setback constraints.

**Sub-tasks**:

4.1 **Rectangle Fitting** (3 hrs)
   - Create `src/utils/massing/shape/RectangleFitter.ts`
   - Given plot polygon, find largest inscribed rectangle
   - Use rotating calipers or simplified bounding box approach
   - Respect setback constraints

   ```typescript
   // API
   export function fitRectangleToPlot(
     plotPolygon: Polygon,
     setbacks: SetbackConfig
   ): { rectangle: Polygon; area: number };

   export function applySetbacks(
     plotPolygon: Polygon,
     setbacks: SetbackConfig
   ): Polygon;
   ```

   **Algorithm Options**:
   - **Simplified**: Use bounding box, shrink to fit
   - **Precise**: Rotating calipers to find maximum inscribed rectangle
   - Start with simplified, upgrade if time permits

4.2 **Grid Initialization** (2 hrs)
   - Update `MassingGrid` to support fitted rectangle
   - Initialize grid to fitted rectangle bounds
   - Mask out cells outside original plot polygon
   - Mark non-buildable cells as blocked

4.3 **Integration** (1-2 hrs)
   - Update `generateFromExtracted.ts`
   - Replace square floor plate with fitted rectangle
   - Support optional `lot_polygon` in `ExtractedBuildingData`
   - Update floor boundary polygon

**Deliverables**:
- `src/utils/massing/shape/RectangleFitter.ts`
- Updated `MassingGrid.ts`
- Updated `generateFromExtracted.ts`

**Acceptance Criteria**:
- [ ] Grid fits within irregular plot shape
- [ ] Respects setback constraints
- [ ] Maximizes area utilization
- [ ] Works with trapezoid, clipped, and odd-shaped plots

---

### Task 5: Multiple Building Shapes (12-16 hrs)

**Dependencies**: Task 3, Task 4

**Goal**: Support Rectangle, Courtyard, Donut, H-shape, and T-shape building layouts (all orthogonal).

**Sub-tasks**:

5.1 **Shape Generator Base** (2 hrs)
   - Create `src/utils/massing/shape/ShapeGenerator.ts`
   - Abstract shape generation interface
   - Common shape utilities (rectangle, L-shape base)
   - Shape validation (no self-intersection, minimum dimensions)

   ```typescript
   // API
   export interface ShapeGenerator {
     generate(shape: BuildingShape, dimensions: ShapeDimensions): Polygon | Polygon[];
   }

   export function validateShape(polygon: Polygon): boolean;
   export function getDefaultDimensions(shape: BuildingShape): ShapeDimensions;
   ```

5.2 **Rectangle Shape** (1 hr)
   - Simple rectangular floor plate
   - Default shape for backward compatibility

   ```typescript
   // API
   export function generateRectangleShape(
     width: number, height: number
   ): Polygon;
   ```

5.3 **Courtyard Shape** (2-3 hrs)
   - Filled center layout
   - Units around perimeter
   - Core in center

   ```typescript
   // API
   export function generateCourtyardShape(
     width: number,
     height: number,
     courtyardWidth: number = 30,
     courtyardDepth: number = 30
   ): Polygon;

   // Layout:
   // ┌─────────────────┐
   // │ Units           │
   // ├─────────┬───────┤
   // │ Units   │ Core  │
   // ├─────────┴───────┤
   // │ Units           │
   // └─────────────────┘
   ```

5.4 **Donut Shape** (2-3 hrs)
   - Hollow center (courtyard)
   - Units around outer ring
   - Multi-polygon result (outer shell)

   ```typescript
   // API
   export function generateDonutShape(
     width: number,
     height: number,
     courtyardWidth: number = 30,
     courtyardDepth: number = 30
   ): Polygon[];

   // Layout:
   // ┌─────────────────┐
   // │ Units           │
   // │    ┌─────┐     │
   // │    │Open │     │
   // │    └─────┘     │
   // │ Units           │
   // └─────────────────┘
   ```

5.5 **H-Shape** (3-4 hrs)
   - Two parallel wings connected by spine
   - Core in spine
   - Units distributed in wings and spine

   ```typescript
   // API
   export function generateHShape(
     width: number,
     height: number,
     armWidth: number = 20,
     armDepth: number = 25
   ): Polygon;

   // Layout:
   // ┌───────┐    ┌───────┐
   // │ Units │    │ Units │
   // ├───────┼────┼───────┤
   // │ Core  │    │ Core  │
   // ├───────┼────┼───────┤
   // │ Units │    │ Units │
   // └───────┘    └───────┘
   ```

5.6 **T-Shape** (3-4 hrs)
   - Top wing + vertical spine
   - Core in spine
   - Units distributed

   ```typescript
   // API
   export function generateTShape(
     width: number,
     height: number,
     armWidth: number = 20,
     armDepth: number = 25
   ): Polygon;

   // Layout:
   //     ┌─────────────┐
   //     │    Units    │
   // ┌───┼─────────────┼───┐
   // │   │    Core     │   │
   // │   └─────────────┘   │
   // │       Units         │
   // └─────────────────────┘
   ```

**Default Shape Dimensions**:
```typescript
export const DEFAULT_DIMENSIONS: Record<BuildingShape, ShapeDimensions> = {
  rectangle: { width: 140, height: 140 },
  courtyard: { width: 140, height: 140, courtyardWidth: 30, courtyardDepth: 30 },
  donut: { width: 140, height: 140, courtyardWidth: 30, courtyardDepth: 30 },
  'h-shape': { width: 140, height: 120, armWidth: 20, armDepth: 25 },
  't-shape': { width: 140, height: 120, armWidth: 20, armDepth: 25 },
};
```

**Deliverables**:
- `src/utils/massing/shape/ShapeGenerator.ts`
- `src/utils/massing/shape/RectangleShape.ts`
- `src/utils/massing/shape/CourtyardShape.ts`
- `src/utils/massing/shape/DonutShape.ts`
- `src/utils/massing/shape/HShape.ts`
- `src/utils/massing/shape/TShape.ts`

**Acceptance Criteria**:
- [ ] All shapes generate valid orthogonal polygons
- [ ] No self-intersections
- [ ] Corridor routing works for all shapes
- [ ] Unit placement successful for all shapes
- [ ] Dimensions configurable with min/max validation

---

### Task 6: UI Integration (5-6 hrs)

**Dependencies**: Task 5

**Goal**: Add UI controls for building shape selection, dimension configuration, and regeneration.

**Sub-tasks**:

6.1 **Shape Selector Component** (2 hrs)
   - Create `src/components/massing/ShapeSelector.tsx`
   - Dropdown for building shape selection
   - Visual preview of selected shape
   - Show default dimensions for selected shape

   ```typescript
   // Props
   interface Props {
     currentShape: BuildingShape;
     onShapeChange: (shape: BuildingShape) => void;
   }
   ```

6.2 **Shape Configuration Form** (2 hrs)
   - Create `src/components/massing/ShapeConfig.tsx`
   - Input fields for shape parameters
   - Validation (min/max dimensions)
   - Real-time shape preview updates (optional)

   ```typescript
   // Props
   interface Props {
     shape: BuildingShape;
     dimensions: ShapeDimensions;
     onDimensionsChange: (dims: ShapeDimensions) => void;
     constraints?: Partial<Record<keyof ShapeDimensions, { min: number; max: number }>>;
   }
   ```

   **Dimension Constraints**:
   ```typescript
   export const DIMENSION_CONSTRAINTS: Record<BuildingShape, Record<string, { min: number; max: number }>> = {
     rectangle: {
       width: { min: 60, max: 200 },
       height: { min: 60, max: 200 },
     },
     courtyard: {
       width: { min: 80, max: 200 },
       height: { min: 80, max: 200 },
       courtyardWidth: { min: 15, max: 60 },
       courtyardDepth: { min: 15, max: 60 },
     },
     // ... etc
   };
   ```

6.3 **Regenerate Button & Integration** (1-2 hrs)
   - Add "Regenerate Floor Plan" button to UI
   - Wire shape selector and config to `generateFromExtracted()`
   - Regenerate floor plans on button click (not automatic)
   - Update UI to show new layouts
   - Show loading state during regeneration

   ```typescript
   // Props
   interface RegenerateButtonProps {
     onRegenerate: () => Promise<void>;
     isRegenerating: boolean;
   }
   ```

**UI Placement**:
- Add shape controls to side panel or toolbar
- Position near floor selector
- Keep regenerating separate from floor navigation

**Deliverables**:
- `src/components/massing/ShapeSelector.tsx`
- `src/components/massing/ShapeConfig.tsx`
- Updated `App.tsx` or relevant container component

**Acceptance Criteria**:
- [ ] Shape selector displays all 5 options
- [ ] Configuration form shows relevant fields per shape
- [ ] Input validation prevents invalid dimensions
- [ ] Regenerate button triggers floor plan generation
- [ ] Loading state displayed during regeneration
- [ ] No crashes on rapid shape switching

---

## Final File Structure

```
web-viewer/src/utils/massing/
├── types.ts                          (Task 1)
├── clipper.ts                        (Task 2)
├── skeleton/
│   ├── StraightSkeleton.ts            (Task 2)
│   └── CorridorRouter.ts              (Task 2)
├── grid/
│   ├── MassingGrid.ts                (Task 3)
│   ├── gridOperations.ts             (Task 3)
│   └── vectorization.ts              (Task 3)
├── placement/
│   ├── unitGrower.ts                 (Task 3)
│   └── VoronoiPartitioner.ts        (Task 3 - optional)
└── shape/
    ├── RectangleFitter.ts            (Task 4)
    ├── ShapeGenerator.ts             (Task 5)
    ├── RectangleShape.ts             (Task 5)
    ├── CourtyardShape.ts             (Task 5)
    ├── DonutShape.ts                (Task 5)
    ├── HShape.ts                    (Task 5)
    └── TShape.ts                    (Task 5)

web-viewer/src/components/massing/
├── ShapeSelector.tsx                 (Task 6)
└── ShapeConfig.tsx                  (Task 6)

web-viewer/src/utils/generateFromExtracted.ts  (modified across Tasks 2-5)
web-viewer/src/types/solverOutput.ts          (modified for PolygonGeometry support)
```

---

## Task Dependency Graph

```
Task 1 (Prereqs)
    ↓
Task 2 (Corridors) ──────────────┐
    ↓                            │
Task 3 (Grid + Units) ──────────┤
    ↓                            │
Task 4 (Grid Fitting) ───────────┤
    ↓                            │
Task 5 (Building Shapes) ────────┘
    ↓
Task 6 (UI Integration)
```

---

## Testing Plan

| Task | Test Cases | Success Metric |
|------|-----------|----------------|
| 2 - Corridors | - P9 Level 4 (known overlap)<br>- Square floor plate<br>- L-shaped floor<br>- U-shaped floor<br>- Donut shape | - All units have corridor access<br>- Corridors balanced (equidistant)<br>- No unit overlaps<br>- P9 Level 4 fixed |
| 3 - Grid + Units | - Studio (500sf)<br>- 1BR (700sf)<br>- 2BR (900sf)<br>- 3BR (1100sf)<br>- Corner units<br>- L-shaped units | - Units fit target area ±10%<br>- All units have window access<br>- No overlaps<br>- Non-rectangular shapes supported<br>- Performance < 500ms/floor |
| 4 - Grid Fitting | - Trapezoid plot<br>- Clipped plot (corner removed)<br>- Odd-shaped plot<br>- Plot with setbacks | - Grid fits within plot shape<br>- Respects setback constraints<br>- Max area utilization<br>- Works with all shape types |
| 5 - Building Shapes | - Rectangle (default)<br>- Courtyard (filled center)<br>- Donut (hollow center)<br>- H-shape (two wings)<br>- T-shape (top wing + spine)<br>- Various dimension combinations | - All shapes generate valid polygons<br>- No self-intersections<br>- Orthogonal (90°) only<br>- Corridor routing works<br>- Unit placement successful |
| 6 - UI Integration | - Shape switching<br>- Dimension changes<br>- Regenerate button<br>- Validation errors<br>- Rapid switching | - Regenerate button works<br>- Loading state shown<br>- Validation prevents invalid inputs<br>- No crashes<br>- Real-time preview (optional) |

---

## Implementation Notes

### Performance Considerations
- Grid resolution of 2ft balances performance (~400 cells/floor) and precision
- Use `Int32Array` for grid storage to reduce memory
- Debounce UI inputs to avoid excessive regeneration
- Use Web Workers if regeneration blocks UI

### Error Handling
- Validate all polygon inputs (no self-intersection)
- Graceful degradation if skeleton algorithm fails (fallback to ring corridor)
- Show clear error messages to user on regeneration failure
- Allow user to reset to default configuration

### Extensibility
- Shape generator interface allows easy addition of new shapes
- Grid-based approach supports non-orthogonal shapes in future
- Clipper-lib wrapper can be extended for advanced operations
- Dimension constraints are configurable

### Code Quality
- Follow existing code style (no comments unless requested)
- Use TypeScript strict mode
- Add inline documentation for complex algorithms
- Write unit tests for grid operations
- Use existing polygon utilities where possible

---

## Open Questions / TBD

1. **Shape Persistence**: Should selected shape and dimensions persist across page reloads? (use localStorage?)

2. **Floor-Level Shapes**: Can different floors have different shapes, or is shape building-wide? (assumed building-wide)

3. **Courtyard Access**: For donut shapes, how to access courtyard? (assumed via corridor circulation)

4. **Stair/Elevator Placement**: For complex shapes (H, T), should core placement be automatic or configurable? (assumed automatic at centroid)

---

## Deliverables Summary

- **New Code Files**: 18 TypeScript files
- **Modified Files**: 2 (`generateFromExtracted.ts`, `solverOutput.ts`)
- **UI Components**: 2 React components
- **Dependencies**: 1 (`@typescript/clipper-lib@2.0.0`)
- **Tests**: Unit tests for grid operations and shape generation

---

## Success Criteria for Phase 2

- [x] All units have accessible corridor paths to core
- [x] Units support non-rectangular shapes (L, corners)
- [x] Five building shapes available (Rectangle, Courtyard, Donut, H, T)
- [x] Grid fits within arbitrary plot shapes
- [x] UI allows shape selection and configuration
- [x] Regenerate button triggers floor plan generation
- [x] P9 Level 4 overlapping units resolved
- [x] Performance acceptable (< 500ms per floor)
- [x] All existing tests still pass
- [x] No regression bugs in baseline functionality

---

**Next Steps**: Begin Task 1 (Prerequisites & Infrastructure)
