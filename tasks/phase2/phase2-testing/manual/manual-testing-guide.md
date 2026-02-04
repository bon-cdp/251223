# Phase 2: Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the Phase 2 massing algorithm enhancements.

## Prerequisites
- Web viewer running (`npm run dev`)
- DevTools console open for debugging
- A test project loaded (P1, P4, P7, or P9)

---

## Test 1: Basic Shape Generation

### Objective
Verify each building shape generates correctly with expected geometry.

### Steps

1. **Test Rectangle Shape**
   - Open DevTools console
   - Execute: `window.testMassingShape('rectangle', { width: 100, height: 120 })`
   - Verify: Polygon has 4 vertices, forms a proper rectangle
   - Expected: `outline.points.length === 4`

2. **Test Courtyard Shape**
   - Execute: `window.testMassingShape('courtyard', { width: 100, height: 120, courtyardWidth: 40, courtyardDepth: 50 })`
   - Verify: Outline is outer rectangle, interior is smaller rectangle centered
   - Expected: Two polygons, interior fully contained within outline

3. **Test Donut Shape**
   - Execute: `window.testMassingShape('donut', { width: 100, height: 100 })`
   - Verify: Ring shape with uniform ~20ft thickness
   - Expected: Interior rectangle is ~60x60ft

4. **Test H-Shape**
   - Execute: `window.testMassingShape('h-shape', { width: 100, height: 120, armWidth: 20, armDepth: 40 })`
   - Verify: Two vertical arms connected by horizontal bar
   - Expected: Polygon has 8-12 vertices

5. **Test T-Shape**
   - Execute: `window.testMassingShape('t-shape', { width: 80, height: 100, armWidth: 48, armDepth: 30 })`
   - Verify: Top bar with vertical stem
   - Expected: Polygon has 6-8 vertices

### Success Criteria
- ✓ All shapes generate without errors
- ✓ Polygons have valid winding (counterclockwise)
- ✓ No self-intersections
- ✓ Vertex coordinates are reasonable

---

## Test 2: Corridor Routing

### Objective
Verify corridors are placed equidistant from all walls (balanced access).

### Steps

1. **Test Straight Skeleton Computation**
   - Execute: `window.testSkeleton(rectanglePolygon)`
   - Verify: Nodes converge to center point
   - Verify: Edges form medial axis

2. **Test Corridor on Simple Rectangle**
   - Execute: `window.testCorridors(rectanglePolygon, 6)`
   - Verify: Single line through center
   - Verify: Corridor width = 6ft (3ft each side of centerline)

3. **Test Corridor on Courtyard Shape**
   - Execute: `window.testCorridors(courtyardPolygon, 6)`
   - Verify: Outer ring corridor + inner courtyard corridor
   - Verify: No corridor in courtyard void

4. **Test Corridor on H-Shape**
   - Execute: `window.testCorridors(hShapePolygon, 6)`
   - Verify: Corridor follows H topology
   - Verify: All three segments connect

5. **Verify Balanced Distance**
   - Pick 10 random non-corridor cells
   - Measure distance to nearest corridor cell
   - Expected: All distances are within 50% of each other

### Success Criteria
- ✓ All units have corridor access within 30ft
- ✓ Corridor cells form continuous paths
- ✓ No isolated corridors (all connected)

---

## Test 3: Grid Fitting

### Objective
Verify grid cells are placed correctly within polygon boundaries.

### Steps

1. **Test Basic Rectangle Grid**
   - Execute: `window.testGridFitting(rectangle100x120)`
   - Verify: All cells inside polygon
   - Verify: No gaps larger than 2ft

2. **Test Setback Application**
   - Execute: `window.testGridFittingWithSetbacks(rectangle100x120, { front: 10, rear: 10, side: 10 })`
   - Verify: Grid bounds are 80x100ft (100-20, 120-20)
   - Verify: Grid is centered within original rectangle

3. **Test Exterior Cell Detection**
   - Count cells where `isExerior === true`
   - Verify: Exterior cells are on boundary only
   - Expected: ~10-15% of cells are exterior

4. **Test Distance Calculations**
   - Pick interior cell at (5, 5)
   - Verify: `distanceToExterior` is ~10ft (5 cells * 2ft/cell)
   - Verify: `distanceToCorridor` computed correctly after corridor setup

### Success Criteria
- ✓ Grid covers >95% of polygon area
- ✓ All cells are 2x2ft squares
- ✓ Distance calculations are accurate

---

## Test 4: Unit Growing

### Objective
Verify units grow to target area while maintaining shape quality.

### Steps

1. **Test Small Unit (500sf)**
   - Execute: `window.testUnitGrowing(500)`
   - Verify: Unit area is 450-550sf (±10%)
   - Verify: Unit is roughly rectangular

2. **Test Large Unit (1500sf)**
   - Execute: `window.testUnitGrowing(1500)`
   - Verify: Unit area is 1350-1650sf (±10%)
   - Verify: Unit doesn't become overly elongated

3. **Test Exterior Access Priority**
   - Grow unit from exterior seed vs interior seed
   - Verify: Exterior seed produces unit with window access
   - Verify: Interior seed still finds path to exterior

4. **Test Compactness Score**
   - Compute compactness for 10 random units
   - Verify: Most units have compactness > 0.5
   - Compactness = (4π × area) / perimeter²

### Success Criteria
- ✓ Units grow to ±10% of target area
- ✓ All units maintain connectivity (no disjoint cells)
- ✓ Compactness > 0.3 (minimum threshold)

---

## Test 5: Voronoi Partitioning

### Objective
Verify space is divided equitably among multiple units.

### Steps

1. **Test 2-Unit Partition**
   - Execute: `window.testVoronoi([500, 500])`
   - Verify: Two roughly equal regions
   - Verify: Boundary between them is reasonable

2. **Test 4-Unit Mixed Partition**
   - Execute: `window.testVoronoi([500, 500, 1000, 750])`
   - Verify: Larger targets get more cells
   - Verify: No region is completely isolated

3. **Test Priority-Based Partition**
   - Execute: `window.testVoronoi([500, 500])` on exterior-heavy grid
   - Verify: Both regions get some exterior cells
   - Verify: Priority function affects distribution

### Success Criteria
- ✓ Each region is contiguous
- ✓ Cell counts are proportional to target areas
- ✓ No region has zero cells

---

## Test 6: Full Pipeline Integration

### Objective
Verify all components work together end-to-end.

### Steps

1. **Generate Full Floor Plan**
   - Open MassingPanel in UI (if integrated)
   - Select: Rectangle shape, 100x120ft, 10ft setbacks
   - Click "Regenerate"
   - Expected: Full floor plan renders in <1 second

2. **Verify All Spaces Placed**
   - Count generated units
   - Verify: All unit types from project are present
   - Verify: No units overlap

3. **Verify Corridor Access**
   - For each unit, check `distanceToCorridor`
   - Verify: All units have `distanceToCorridor < Infinity`
   - Verify: Average distance < 30ft

4. **Verify Exterior Access**
   - Count units with `hasExteriorAccess === true`
   - Expected: >90% of units have exterior access
   - Verify: Core units (elevators, stairs) don't need exterior

5. **Verify Area Totals**
   - Sum all unit areas + corridor area
   - Compare to target floor area
   - Expected: Coverage >80% of total area

### Success Criteria
- ✓ Floor plan generates in <500ms
- ✓ All units have corridor access
- ✓ >90% of units have exterior access
- ✓ Coverage >80% of available area
- ✓ No overlapping units

---

## Test 7: Edge Cases

### Objective
Verify algorithm handles unusual inputs gracefully.

### Steps

1. **Test Very Small Floor**
   - Execute: `window.testMassingShape('rectangle', { width: 30, height: 30 })`
   - Verify: Still generates, may only fit 1-2 units

2. **Test Very Large Floor**
   - Execute: `window.testMassingShape('rectangle', { width: 300, height: 300 })`
   - Verify: Performance remains acceptable (<2s)

3. **Test Extreme Aspect Ratio**
   - Execute: `window.testMassingShape('rectangle', { width: 30, height: 200 })`
   - Verify: Corridor runs along length
   - Verify: Units don't become too narrow

4. **Test Zero Area Target**
   - Execute: `window.testUnitGrowing(0)`
   - Expected: Returns empty cell array or single cell

5. **Test Negative Dimensions**
   - Execute: `window.testMassingShape('rectangle', { width: -100, height: 120 })`
   - Expected: Error thrown or input normalized

### Success Criteria
- ✓ No crashes on edge cases
- ✓ Graceful degradation (partial output vs errors)
- ✓ Performance scales reasonably with size

---

## Test 8: Performance Benchmarks

### Objective
Verify implementation meets performance targets.

### Steps

1. **Benchmark Shape Generation**
   - Time each shape generation (100 iterations)
   - Expected: <10ms per shape

2. **Benchmark Corridor Computation**
   - Time corridor generation for 100x120ft rectangle
   - Expected: <200ms

3. **Benchmark Full Floor Plan**
   - Time complete floor plan generation
   - Expected: <500ms for typical floor

4. **Memory Usage**
   - Check heap before/after generation
   - Expected: No memory leaks after 10 regenerations

### Success Criteria
- ✓ All benchmarks within target
- ✓ No memory leaks detected
- ✓ UI remains responsive during generation

---

## Test 9: Visual Verification

### Objective
Verify rendered output looks correct.

### Steps

1. **Open Floor Plan Viewer**
   - Load project with regenerated floor
   - Zoom to fit

2. **Verify Corridor Rendering**
   - Corridors should be visibly distinct (different color)
   - Corridor width should be consistent (6ft)

3. **Verify Unit Shapes**
   - Units should be compact and reasonable
   - No overly elongated or jagged shapes

4. **Verify Exterior Walls**
   - Exterior cells should touch floor boundary
   - Interior cells should have corridor access path

5. **Verify No Overlaps**
   - Check visually for overlapping units
   - Check for gaps between units

### Success Criteria
- ✓ Visually plausible floor plan
- ✓ Clear corridor network visible
- ✓ Units appear well-formed

---

## Test 10: Regression Testing

### Objective
Verify existing functionality still works.

### Steps

1. **Load Existing Projects**
   - Load P1, P4, P7, P9
   - Verify: All load successfully

2. **Verify Existing Algorithms**
   - Navigate floors in each project
   - Verify: Floor plans render correctly

3. **Verify Polygon Editing**
   - Select a space and drag vertex
   - Verify: Vertex moves as expected

4. **Verify Space Properties**
   - Click on a unit
   - Verify: Details panel shows correct info

### Success Criteria
- ✓ No regressions in existing features
- ✓ All original projects load and display correctly

---

## Testing Checklist

Use this checklist to track progress:

- [ ] Test 1: Basic Shape Generation
- [ ] Test 2: Corridor Routing
- [ ] Test 3: Grid Fitting
- [ ] Test 4: Unit Growing
- [ ] Test 5: Voronoi Partitioning
- [ ] Test 6: Full Pipeline Integration
- [ ] Test 7: Edge Cases
- [ ] Test 8: Performance Benchmarks
- [ ] Test 9: Visual Verification
- [ ] Test 10: Regression Testing

---

## Bug Report Template

If you find an issue, document it using this format:

```
Title: [Brief description]

Reproduction Steps:
1. Step 1
2. Step 2
3. Step 3

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happened]

Environment:
- Browser: [Chrome/Firefox/Safari]
- OS: [Mac/Windows/Linux]
- Project: [P1/P4/P7/P9]
- Shape: [rectangle/courtyard/donut/h-shape/t-shape]

Console Errors:
[Any error messages from DevTools]

Screenshot:
[Attach screenshot of issue]
```

---

## Next Steps

After completing manual testing:
1. Review results in `verification/test-results.md`
2. Address any critical bugs
3. Update implementation if major issues found
4. Consider automated test suite for future
