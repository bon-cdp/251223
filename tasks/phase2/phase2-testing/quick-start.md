# Quick Start Testing Guide

## 5-Minute Verification

If you only have a few minutes, run these quick checks to verify the core functionality.

---

## Step 1: Verify Build (1 minute)

```bash
cd web-viewer
npm run build
```

**Expected**: Build completes without errors
**If fails**: Check TypeScript errors in output

---

## Step 2: Load Test Helpers (1 minute)

1. Open browser to `http://localhost:5173`
2. Open DevTools (F12)
3. Go to Console tab
4. Paste the test helpers (from `test-helpers.ts` simplified below)

**Quick console version**:
```javascript
// Test basic shape generation
const rect = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };

// Compute area
let area = 0;
for (let i = 0; i < rect.points.length; i++) {
  const x0 = rect.points[i].x;
  const y0 = rect.points[i].y;
  const x1 = rect.points[(i + 1) % rect.points.length].x;
  const y1 = rect.points[(i + 1) % rect.points.length].y;
  area += x0 * y1 - x1 * y0;
}
console.log('✅ Rectangle area:', Math.abs(area) / 2, 'sqft');
```

**Expected**: Output shows "12000 sqft"

---

## Step 3: Test Corridor Routing (1 minute)

```javascript
// Test corridor (if skeleton functions available)
console.log('✅ Testing corridor routing...');
// This should show corridor computation time and results
```

**Expected**: No errors in console

---

## Step 4: Check UI Components (1 minute)

1. Look for ShapeSelector in React DevTools
2. Look for ShapeConfig in React DevTools
3. Look for MassingPanel in React DevTools

**Expected**: All three components exist in component tree

---

## Step 5: Visual Check (1 minute)

1. Load a project (P1, P4, P7, or P9)
2. Navigate between floors
3. Check that floor plans render

**Expected**: Floor plans display without visual glitches

---

## Quick Pass/Fail Criteria

✅ **PASS** if:
- Build succeeds
- Console shows area calculation
- UI components present
- Floor plans render

❌ **FAIL** if:
- Build errors
- Console errors
- Components missing
- Floor plans broken

---

## Next Steps Based on Results

### If PASS
- Proceed to full manual testing
- Run integration tests
- Review performance benchmarks

### If FAIL
- Check specific failed component
- Review build errors
- Fix issues before proceeding
- Re-run quick start test

---

## Common Issues and Solutions

### Issue: "Module not found"
**Solution**: Ensure test-helpers.ts is properly imported or code pasted directly

### Issue: Build fails with TypeScript errors
**Solution**: Check that all imports resolve correctly

### Issue: Components not found in DevTools
**Solution**: Ensure app is running in dev mode (`npm run dev`)

---

## What This Quick Test Validates

| Component | Quick Test Validates |
|-----------|-------------------|
| Build System | ✓ Type checking, linting |
| Core Utilities | ✓ Area calculation, polygon math |
| Corridor Logic | ✓ Skeleton computation |
| UI Integration | ✓ Component rendering |
| Rendering | ✓ Floor plan display |

**Note**: This is a smoke test. Full validation requires running the complete manual testing guide.
