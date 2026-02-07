# Integration Testing Plan

## Overview
Integration testing verifies that all Phase 2 components work together correctly when combined.

## Test Scenarios

### Scenario 1: Simple Rectangle Floor

**Objective**: Generate a complete floor plan for a simple rectangular building.

**Input**:
```typescript
{
  shape: 'rectangle',
  dimensions: { width: 100, height: 120 },
  setbacks: { front: 10, rear: 10, side: 10 }
}
```

**Expected Results**:
- Grid size: ~2500 cells (80x100ft effective area at 2ft resolution)
- Corridor: Single line through center, length ~80ft
- Corridor cells: ~120 cells (80ft × 6ft ÷ 4sf/cell)
- Available cells for units: ~2400
- Unit coverage: >80% of available area

**Verification Steps**:
1. Generate shape → verify 80x100ft rectangle after setbacks
2. Create grid → verify ~2500 cells, all within bounds
3. Compute corridors → verify single centerline segment
4. Setup corridors → verify ~120 cells marked as corridors
5. Partition space → verify seed cells distributed
6. Grow units → verify units reach target area ±10%

---

### Scenario 2: Courtyard Building

**Objective**: Generate floor plan for building with central courtyard.

**Input**:
```typescript
{
  shape: 'courtyard',
  dimensions: {
    width: 120,
    height: 140,
    courtyardWidth: 40,
    courtyardDepth: 50
  },
  setbacks: { front: 10, rear: 10, side: 10 }
}
```

**Expected Results**:
- Outline: 120x140ft rectangle
- Interior: 40x50ft courtyard hole
- Corridors: Outer ring + courtyard boundary
- No units in courtyard void

**Verification Steps**:
1. Verify interior polygon is centered
2. Verify corridor cells don't overlap courtyard
3. Verify no unit cells placed in courtyard area
4. Verify courtyard cells are not marked as available

---

### Scenario 3: H-Shape Building

**Objective**: Generate floor plan for complex H-shaped building.

**Input**:
```typescript
{
  shape: 'h-shape',
  dimensions: {
    width: 120,
    height: 140,
    armWidth: 20,
    armDepth: 40
  },
  setbacks: { front: 10, rear: 10, side: 10 }
}
```

**Expected Results**:
- Polygon has 8-12 vertices
- Corridor follows H topology (3 connected segments)
- Left and right arms each have corridor access
- Center bar connects the arms

**Verification Steps**:
1. Verify polygon forms proper H shape
2. Verify corridor skeleton has 3 main branches
3. Verify all three corridor segments connect
4. Verify units can grow in all three wings

---

### Scenario 4: Mixed Unit Sizes

**Objective**: Verify algorithm handles varying unit target areas.

**Input**:
```typescript
targetAreas = [400, 500, 750, 1000, 1500]
```

**Expected Results**:
- 400sf unit: ~100 cells
- 1500sf unit: ~375 cells
- All units: ±10% of target
- Larger units get more cells from partitioner

**Verification Steps**:
1. Run partitioner with 5 targets
2. Verify cell counts roughly proportional
3. Grow each unit from seed
4. Verify each unit area within tolerance
5. Verify no overlap between units

---

### Scenario 5: High-Density Packing

**Objective**: Verify algorithm handles many small units.

**Input**:
```typescript
targetAreas = Array(20).fill(400)  // Twenty 400sf studios
```

**Expected Results**:
- 20 units generated
- Total unit area: ~8000sf
- All units have corridor access
- Most units have exterior access

**Verification Steps**:
1. Verify partitioner creates 20 regions
2. Verify regions are distributed throughout floor
3. Grow all units
4. Verify coverage >80%
5. Verify no overlapping cells

---

### Scenario 6: Low-Density Large Units

**Objective**: Verify algorithm handles few large units.

**Input**:
```typescript
targetAreas = [2000, 2000, 2000]  // Three 3BR units
```

**Expected Results**:
- 3 units, each ~500 cells
- Units spread across floor
- All maintain reasonable shape (not overly elongated)

**Verification Steps**:
1. Verify each unit has ~500 cells
2. Verify units are spread out (not clustered)
3. Check compactness score for each unit
4. Verify corridor access for all units

---

### Scenario 7: Edge Case - Tiny Floor

**Objective**: Verify algorithm handles very small floors gracefully.

**Input**:
```typescript
{
  shape: 'rectangle',
  dimensions: { width: 30, height: 30 },
  setbacks: { front: 5, rear: 5, side: 5 }
}
```

**Expected Results**:
- Effective area: 20x20ft = 400sf
- Grid: ~100 cells
- May only fit 1-2 small units
- Corridor still generated

**Verification Steps**:
1. Verify grid created successfully
2. Verify corridor computed (may be minimal)
3. Verify algorithm doesn't crash
4. Verify output is valid even if limited

---

### Scenario 8: Edge Case - Extreme Aspect Ratio

**Objective**: Verify algorithm handles very narrow/wide floors.

**Input**:
```typescript
{
  shape: 'rectangle',
  dimensions: { width: 30, height: 200 },
  setbacks: { front: 10, rear: 10, side: 5 }
}
```

**Expected Results**:
- Effective area: 20x180ft
- Corridor runs along length (180ft)
- Units grow outward from central corridor

**Verification Steps**:
1. Verify corridor follows long axis
2. Verify units don't become too narrow (<8ft width)
3. Verify corridor access for all units
4. Verify exterior access maintained

---

### Scenario 9: Memory Leak Test

**Objective**: Verify no memory leaks during repeated regeneration.

**Procedure**:
1. Open browser DevTools → Memory tab
2. Take initial heap snapshot
3. Run full pipeline 10 times
4. Take final heap snapshot
5. Compare snapshots

**Expected Results**:
- Heap size increase <20%
- No detached DOM nodes
- No large arrays not garbage collected

**Verification Steps**:
1. Check for "Detached DOM nodes" in summary
2. Look for repeated object allocations
3. Verify grid objects are properly cleaned up

---

### Scenario 10: Performance Under Load

**Objective**: Verify algorithm scales with floor size.

**Test Cases**:
1. Small: 60x80ft (2400sf)
2. Medium: 100x120ft (12000sf)
3. Large: 200x300ft (60000sf)

**Expected Results**:
- Small: <200ms total generation time
- Medium: <500ms total generation time
- Large: <2000ms total generation time

**Verification Steps**:
1. Time each component (shape, grid, corridor, placement)
2. Verify linear or sub-linear scaling
3. Check if any component dominates runtime

---

## Integration Test Execution

### Prerequisites
- Development server running
- Console open with test-helpers loaded
- Test data prepared

### Execution Sequence

```typescript
// 1. Load test helpers
// (Import test-helpers.ts or paste into console)

// 2. Run Scenario 1 (Simple Rectangle)
await window.testFullPipeline('rectangle', {
  width: 100,
  height: 120
});

// 3. Run Scenario 2 (Courtyard)
await window.testFullPipeline('courtyard', {
  width: 120,
  height: 140,
  courtyardWidth: 40,
  courtyardDepth: 50
});

// 4. Run Scenario 3 (H-Shape)
await window.testFullPipeline('h-shape', {
  width: 120,
  height: 140,
  armWidth: 20,
  armDepth: 40
});

// 5. Run Scenario 4 (Mixed Sizes)
const polygon = {
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 120 },
    { x: 0, y: 120 }
  ]
};
await window.testVoronoi([400, 500, 750, 1000, 1500], polygon);

// 6. Run performance benchmark
await window.runBenchmark(50);
```

---

## Success Criteria

### All Scenarios Must Pass:
- ✓ No errors or exceptions thrown
- ✓ Output geometry is valid
- ✓ All units have corridor access
- ✓ >90% of units have exterior access
- ✓ Coverage >80% of available area
- ✓ No overlapping units

### Performance Criteria:
- ✓ Medium floor generates in <500ms
- ✓ Large floor generates in <2s
- ✓ No memory leaks detected
- ✓ UI remains responsive

### Quality Criteria:
- ✓ Units are compact (not overly elongated)
- ✓ Corridors form continuous network
- ✓ Output is visually plausible

---

## Defect Tracking

For failed scenarios, document:

```markdown
## Scenario X: [Name]

### Status: ❌ FAILED

### Error
[Error message or unexpected behavior]

### Root Cause
[Analysis of why it failed]

### Expected vs Actual
- Expected: [what should happen]
- Actual: [what actually happened]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Severity
- [ ] Critical (blocks all use)
- [ ] High (blocks most use)
- [ ] Medium (partial workaround exists)
- [ ] Low (minor issue)

### Assigned To
[Developer responsible]

### Status
- [ ] Open
- [ ] In Progress
- [ ] Fixed (awaiting verification)
- [ ] Verified (closed)
```

---

## Integration Test Results Template

```markdown
# Integration Test Results

**Date**: [YYYY-MM-DD]
**Tester**: [Name]
**Build**: [commit hash or version]

## Scenario Results

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Simple Rectangle | ⬜/✅/❌ | [Comments] |
| 2. Courtyard | ⬜/✅/❌ | [Comments] |
| 3. H-Shape | ⬜/✅/❌ | [Comments] |
| 4. Mixed Unit Sizes | ⬜/✅/❌ | [Comments] |
| 5. High-Density | ⬜/✅/❌ | [Comments] |
| 6. Low-Density | ⬜/✅/❌ | [Comments] |
| 7. Tiny Floor | ⬜/✅/❌ | [Comments] |
| 8. Extreme Ratio | ⬜/✅/❌ | [Comments] |
| 9. Memory Leak | ⬜/✅/❌ | [Comments] |
| 10. Performance | ⬜/✅/❌ | [Comments] |

## Overall Summary

- **Pass Rate**: X/10 (X%)
- **Critical Issues**: X
- **High Priority Issues**: X
- **Recommendation**: [Proceed/Block/Retest]

## Performance Data

| Floor Size | Generation Time | Notes |
|------------|-----------------|-------|
| Small (2400sf) | Xms | |
| Medium (12000sf) | Xms | |
| Large (60000sf) | Xms | |

## Next Steps

1. [ ] Fix critical issues
2. [ ] Address high-priority defects
3. [ ] Re-test failed scenarios
4. [ ] Update documentation
```
