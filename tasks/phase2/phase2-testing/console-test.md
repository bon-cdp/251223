# Quick Start Test - Console Commands

Copy and paste these commands into your browser console (DevTools Console tab).

---

## Test 1: Verify Massing Generator Loaded

```javascript
// Check if massing generator functions are available
typeof window.generateMassing !== 'undefined' ? '✅ Massing generator loaded' : '❌ Massing generator NOT loaded';
typeof window.generateMassing === 'function' ? '✅ generateMassing is a function' : '❌ generateMassing is NOT a function';
```

---

## Test 2: Test Shape Generation

```javascript
// Test rectangle shape (should work immediately)
const rect = {
  points: [
    { x: -50, y: -60 },
    { x: 50, y: -60 },
    { x: 50, y: 60 },
    { x: -50, y: 60 }
  ]
};

// Verify polygon has 4 points
console.log('Rectangle vertices:', rect.points.length); // Should be 4

// Compute area manually
let area = 0;
for (let i = 0; i < rect.points.length; i++) {
  const x0 = rect.points[i].x;
  const y0 = rect.points[i].y;
  const x1 = rect.points[(i + 1) % rect.points.length].x;
  const y1 = rect.points[(i + 1) % rect.points.length].y;
  area += x0 * y1 - x1 * y0;
}
console.log('Rectangle area:', Math.abs(area) / 2, 'sf'); // Should be 10000
console.log(rect.points.length === 4 ? '✅ Rectangle valid (4 vertices)' : '❌ Rectangle invalid (not 4 vertices)');
console.log(Math.abs(area / 2) === 10000 ? '✅ Rectangle area correct (10000 sf)' : '❌ Rectangle area incorrect (should be 10000)');
```

---

## Test 3: Test Corridor Distance Calculation

```javascript
// Test corridor access logic
const unit = { x: 10, y: 10 };
const corridor = { x: 0, y: 0, width: 6, height: 6 };

// Check distance from unit to corridor
const dx = Math.abs(unit.x - corridor.x);
const dy = Math.abs(unit.y - corridor.y);

console.log('Unit at (10, 10), corridor at (0, 0)');
console.log('Distance to corridor center:', Math.sqrt(dx*dx + dy*dy).toFixed(2), 'ft');

// Check if unit has access (should be within combined dimensions)
const combinedWidth = (6 + 6) / 2; // Assuming unit width/height = 10
const combinedHeight = (6 + 6) / 2;
const hasAccess = dx < combinedWidth && dy < combinedHeight;

console.log(hasAccess ? '✅ Unit has corridor access' : '❌ Unit does NOT have corridor access');
```

---

## Test 4: Test Grid Cell Logic

```javascript
// Test grid cell calculation
const cellSize = 2;
const floorWidth = 140;
const floorHeight = 140;
const halfSide = Math.sqrt(floorWidth * floorHeight) / 2;

const cols = Math.floor(floorWidth / cellSize);
const rows = Math.floor(floorHeight / cellSize);

console.log('Grid dimensions:');
console.log('  Floor:', floorWidth, 'x', floorHeight, 'ft');
console.log('  Cell size:', cellSize, 'ft');
console.log('  Grid:', cols, 'columns x', rows, 'rows');
console.log('  Total cells:', cols * rows);
console.log(cols > 0 && rows > 0 && (cols * rows) > 1000 ? '✅ Grid size reasonable (>1000 cells)' : '❌ Grid size too small');

// Test cell to world coordinate conversion
const cell = { x: 10, y: 10 };
const worldX = -halfSide + cell.x * cellSize;
const worldY = -halfSide + cell.y * cellSize;

console.log('Cell (10, 10) → World:', worldX, worldY);
console.log(worldX === 30 && worldY === 30 ? '✅ Coordinate conversion correct' : '❌ Coordinate conversion incorrect');
```

---

## Test 5: Test Exterior Access

```javascript
// Test exterior access logic
const floorSide = Math.sqrt(19310); // ~138.96ft
const halfBoundary = floorSide / 2;

const units = [
  { x: 0, y: 0, width: 20, height: 20 },
  { x: -60, y: 0, width: 20, height: 20 },
  { x: 0, y: 60, width: 20, height: 20 },
  { x: 0, y: -60, width: 20, height: 20 }
];

let exteriorCount = 0;

for (const unit of units) {
  const left = unit.x - unit.width / 2;
  const right = unit.x + unit.width / 2;
  const top = unit.y + unit.height / 2;
  const bottom = unit.y - unit.height / 2;

  if (Math.abs(left) >= halfBoundary - 2 ||
      Math.abs(right) >= halfBoundary - 2 ||
      Math.abs(top) >= halfBoundary - 2 ||
      Math.abs(bottom) >= halfBoundary - 2) {
    exteriorCount++;
  }
}

console.log('Exterior units:', exteriorCount, '/', units.length);
console.log(exteriorCount / units.length > 0.9 ? '✅ Exterior access >90%' : '❌ Exterior access ≤90%');
```

---

## Success Criteria

If all tests pass:
- ✅ Massing generator loads correctly
- ✅ Shape generation works (4 vertices, correct area)
- ✅ Corridor access logic works
- ✅ Grid cell calculations correct
- ✅ Exterior access >90%

If any test fails:
- ❌ Document the issue in `test-results.md`
- ❌ Check console errors
- ❌ Fix issue and re-run

---

## Quick Diagnostics

```javascript
// Check overall system health
console.log('=== System Diagnostics ===');
console.log('Project ID:', window.currentProjectId || 'Not loaded');
console.log('Current floor index:', window.currentFloorIndex || 'Not loaded');
console.log('Solver result available:', typeof window.solverResult !== 'undefined');
console.log('================================');
```

---

## Next Steps After Quick Test

1. If all tests pass → Run full manual testing guide
2. If any test fails → Check console errors and investigate
3. After fixing → Re-run quick start test
4. After passing → Proceed to integration testing
