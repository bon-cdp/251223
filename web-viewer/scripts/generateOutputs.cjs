#!/usr/bin/env node
/**
 * Generate pre-computed outputs using LOT SIZE + PERIMETER layout
 * Units placed around all 4 edges + interior rows = maximum capacity
 */

const fs = require('fs');
const path = require('path');

const PROJECTS = {
  p1: {
    lotSizeSF: 29639,
    floorsAbove: 7,
    floorsBelow: 1,
    targetUnits: 116,
    units: [
      { type: 'studio', name: 'Studio', count: 30, width: 17.4, depth: 30.0 },
      { type: '1br', name: '1 Bedroom', count: 29, width: 23.9, depth: 28.0 },
      { type: '2br', name: '2 Bedroom', count: 28, width: 36.0, depth: 28.0 },
      { type: '3br', name: '3 Bedroom', count: 29, width: 42.0, depth: 30.0 },
    ],
  },
  p4: {
    lotSizeSF: 56914,
    floorsAbove: 8,
    floorsBelow: 2,
    targetUnits: 348,
    units: [
      { type: 'studio', name: 'Studio', count: 158, width: 17.4, depth: 26.0 },
      { type: '1br', name: '1 Bedroom', count: 143, width: 23.9, depth: 24.0 },
      { type: '2br', name: '2 Bedroom', count: 38, width: 36.0, depth: 24.0 },
      { type: '3br', name: '3 Bedroom', count: 9, width: 42.0, depth: 26.0 },
    ],
  },
  p7: {
    lotSizeSF: 77858,
    floorsAbove: 8,
    floorsBelow: 2,
    targetUnits: 429,
    units: [
      { type: 'studio', name: 'Studio', count: 184, width: 17.4, depth: 26.0 },
      { type: '1br', name: '1 Bedroom', count: 180, width: 23.9, depth: 24.0 },
      { type: '2br', name: '2 Bedroom', count: 45, width: 36.0, depth: 24.0 },
      { type: '3br', name: '3 Bedroom', count: 20, width: 42.0, depth: 26.0 },
    ],
  },
  p9: {
    lotSizeSF: 32467,
    floorsAbove: 31,
    floorsBelow: 3,
    targetUnits: 427,
    units: [
      { type: 'studio', name: 'Studio', count: 209, width: 17.4, depth: 28.0 },
      { type: '1br', name: '1 Bedroom', count: 151, width: 23.9, depth: 26.0 },
      { type: '2br', name: '2 Bedroom', count: 53, width: 36.0, depth: 25.0 },
      { type: '3br', name: '3 Bedroom', count: 14, width: 42.0, depth: 27.0 },
    ],
  },
};

function createSpace(id, type, name, floorIndex, x, y, width, height, isVertical = false) {
  return {
    id, type, name, floor_index: floorIndex,
    geometry: { x, y, width, height, rotation: 0 },
    target_area_sf: Math.round(width * height),
    actual_area_sf: Math.round(width * height),
    membership: 1.0, area_deviation: '+0.0%', is_vertical: isVertical,
  };
}

function generateCirculation(floorIndex) {
  return [
    createSpace(`elev_1_f${floorIndex}`, 'CIRCULATION', 'Elevator 1', floorIndex, -5, 0, 8, 17, true),
    createSpace(`elev_2_f${floorIndex}`, 'CIRCULATION', 'Elevator 2', floorIndex, 4, 0, 8, 17, true),
    createSpace(`stair_1_f${floorIndex}`, 'CIRCULATION', 'Stair 1', floorIndex, -15, 0, 10, 19, true),
    createSpace(`stair_2_f${floorIndex}`, 'CIRCULATION', 'Stair 2', floorIndex, 14, 0, 10, 19, true),
  ];
}

function generateResidentialFloor(floorIndex, halfSide, unitQueue, unitsNeeded) {
  const spaces = [];
  const M = 4; // margin
  const G = 1.5; // gap between units
  const CORE = 25; // core half-width
  const D = 26; // unit depth

  let placed = 0;
  let idx = 0;

  // Helper to place a unit if queue has items
  function placeUnit(x, y, rotated = false) {
    if (placed >= unitsNeeded || unitQueue.length === 0) return false;
    const u = unitQueue[0];
    const w = rotated ? D : u.width;
    const h = rotated ? u.width : D;
    spaces.push(createSpace(`unit_${u.type}_${idx}_f${floorIndex}`, 'DWELLING_UNIT', u.name, floorIndex, x, y, w, h, false));
    idx++; placed++;
    u.remaining--;
    if (u.remaining <= 0) unitQueue.shift();
    return true;
  }

  // ROW 1: North exterior (top edge)
  for (let x = -halfSide + M; x < halfSide - M && placed < unitsNeeded; ) {
    if (x > -CORE && x < CORE) { x = CORE + G; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (x + u.width > halfSide - M) break;
    if (x + u.width > -CORE && x < CORE) { x = CORE + G; continue; }
    placeUnit(x + u.width/2, -halfSide + M + D/2);
    x += u.width + G;
  }

  // ROW 2: South exterior (bottom edge)
  for (let x = -halfSide + M; x < halfSide - M && placed < unitsNeeded; ) {
    if (x > -CORE && x < CORE) { x = CORE + G; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (x + u.width > halfSide - M) break;
    if (x + u.width > -CORE && x < CORE) { x = CORE + G; continue; }
    placeUnit(x + u.width/2, halfSide - M - D/2);
    x += u.width + G;
  }

  // ROW 3: West edge (left, rotated 90°)
  for (let y = -halfSide + M + D + G; y < halfSide - M - D && placed < unitsNeeded; ) {
    if (y > -CORE && y < CORE) { y = CORE + G; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (y + u.width > halfSide - M - D) break;
    placeUnit(-halfSide + M + D/2, y + u.width/2, true);
    y += u.width + G;
  }

  // ROW 4: East edge (right, rotated 90°)
  for (let y = -halfSide + M + D + G; y < halfSide - M - D && placed < unitsNeeded; ) {
    if (y > -CORE && y < CORE) { y = CORE + G; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (y + u.width > halfSide - M - D) break;
    placeUnit(halfSide - M - D/2, y + u.width/2, true);
    y += u.width + G;
  }

  // ROW 5: North interior (facing corridor)
  for (let x = -halfSide + M + D + G; x < halfSide - M - D && placed < unitsNeeded; ) {
    if (x > -CORE - 5 && x < CORE + 5) { x = CORE + 7; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (x + u.width > halfSide - M - D) break;
    placeUnit(x + u.width/2, -D/2 - 4);
    x += u.width + G;
  }

  // ROW 6: South interior (facing corridor)
  for (let x = -halfSide + M + D + G; x < halfSide - M - D && placed < unitsNeeded; ) {
    if (x > -CORE - 5 && x < CORE + 5) { x = CORE + 7; continue; }
    const u = unitQueue[0]; if (!u) break;
    if (x + u.width > halfSide - M - D) break;
    placeUnit(x + u.width/2, D/2 + 4);
    x += u.width + G;
  }

  // Support
  spaces.push(createSpace(`trash_f${floorIndex}`, 'SUPPORT', 'Trash', floorIndex, -CORE + 5, 0, 8, 8, false));
  spaces.push(createSpace(`laundry_f${floorIndex}`, 'SUPPORT', 'Laundry', floorIndex, CORE - 5, 0, 10, 10, false));

  return { spaces, placed };
}

function generateGroundFloor(floorIndex, halfSide) {
  const s = Math.min(halfSide * 0.3, 40);
  return [
    createSpace(`lobby_f${floorIndex}`, 'CIRCULATION', 'Entry Lobby', floorIndex, 0, -halfSide + s/2 + 5, s * 1.2, s, false),
    createSpace(`mail_f${floorIndex}`, 'SUPPORT', 'Mail Room', floorIndex, -s, -halfSide + s/2, s * 0.6, s * 0.5, false),
    createSpace(`leasing_f${floorIndex}`, 'SUPPORT', 'Leasing Office', floorIndex, s, -halfSide + s/2, s * 0.6, s * 0.5, false),
    createSpace(`retail_f${floorIndex}`, 'RETAIL', 'Retail Space', floorIndex, -halfSide + s, 0, s * 1.2, s * 1.5, false),
    createSpace(`cafe_f${floorIndex}`, 'AMENITY_INDOOR', 'Cafe/Lounge', floorIndex, halfSide - s, 0, s * 1.2, s * 1.5, false),
    createSpace(`bicycle_f${floorIndex}`, 'SUPPORT', 'Bicycle Room', floorIndex, 0, halfSide - s/2 - 5, s * 1.5, s * 0.8, false),
  ];
}

function generateParkingFloor(floorIndex, halfSide) {
  const spaces = [];
  spaces.push(createSpace(`aisle_f${floorIndex}`, 'CIRCULATION', 'Drive Aisle', floorIndex, 0, 0, halfSide * 2 - 30, 24, false));
  let n = 0;
  for (let x = -halfSide + 15; x < halfSide - 15 && n < 60; x += 10) {
    spaces.push(createSpace(`parking_${n++}_f${floorIndex}`, 'PARKING', `Stall ${n}`, floorIndex, x, -22, 9, 18, false));
    spaces.push(createSpace(`parking_${n++}_f${floorIndex}`, 'PARKING', `Stall ${n}`, floorIndex, x, 22, 9, 18, false));
  }
  return spaces;
}

function generateProject(projectId, config) {
  const side = Math.sqrt(config.lotSizeSF);
  const halfSide = side / 2;
  const boundary = [[-halfSide, -halfSide], [halfSide, -halfSide], [halfSide, halfSide], [-halfSide, halfSide]];

  const unitQueue = config.units.map(u => ({ ...u, remaining: u.count }));
  const residentialFloors = config.floorsAbove - 1;
  const unitsPerFloor = Math.ceil(config.targetUnits / residentialFloors) + 5; // Allow overflow

  const floors = [];
  let totalUnitsPlaced = 0;

  for (let i = -config.floorsBelow; i < config.floorsAbove; i++) {
    const core = generateCirculation(i);
    let floorType, extraSpaces;

    if (i < 0) {
      floorType = 'PARKING_UNDERGROUND';
      extraSpaces = generateParkingFloor(i, halfSide);
    } else if (i === 0) {
      floorType = 'GROUND';
      extraSpaces = generateGroundFloor(i, halfSide);
    } else {
      floorType = 'RESIDENTIAL_TYPICAL';
      const result = generateResidentialFloor(i, halfSide, unitQueue, unitsPerFloor);
      extraSpaces = result.spaces;
      totalUnitsPlaced += result.placed;
    }

    floors.push({ floor_index: i, floor_type: floorType, boundary, area_sf: config.lotSizeSF, spaces: [...core, ...extraSpaces] });
  }

  const totalSpaces = floors.reduce((sum, f) => sum + f.spaces.length, 0);
  const placementRate = ((totalUnitsPlaced / config.targetUnits) * 100).toFixed(1);

  return {
    success: parseFloat(placementRate) >= 95,
    obstruction: Math.max(0, 100 - parseFloat(placementRate)) * 0.3,
    iterations: 1,
    message: parseFloat(placementRate) >= 95 ? 'Complete layout' : `${placementRate}% placed`,
    violations: parseFloat(placementRate) < 95 ? [`${config.targetUnits - totalUnitsPlaced} units could not fit`] : [],
    metrics: { placement_rate: `${placementRate}%`, avg_membership: '1.00', total_spaces: totalSpaces, placed_spaces: totalSpaces },
    building: {
      floors,
      stalks: [
        { id: 'elevator_stalk', type: 'elevator', floor_range: floors.map(f => f.floor_index), position: { x: 0, y: 0 } },
        { id: 'stair_stalk', type: 'stair', floor_range: floors.map(f => f.floor_index), position: { x: 14, y: 0 } },
      ],
      metrics: { total_floors: floors.length, total_spaces: totalSpaces, cohomology_obstruction: 0 },
    },
    _meta: { totalUnitsPlaced, targetUnits: config.targetUnits, placementRate, lotSide: Math.round(side) },
  };
}

console.log('Generating outputs with PERIMETER layout...\n');

for (const [projectId, config] of Object.entries(PROJECTS)) {
  const result = generateProject(projectId, config);
  const outputPath = path.join(__dirname, '..', 'public', 'data', `${projectId}_output.json`);
  const { _meta, ...clean } = result;
  fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2));

  const status = parseFloat(_meta.placementRate) >= 95 ? '✅' : '⚠️';
  console.log(`${status} ${projectId}_output.json`);
  console.log(`   Lot: ${config.lotSizeSF.toLocaleString()} SF (${_meta.lotSide}' × ${_meta.lotSide}')`);
  console.log(`   Units: ${_meta.totalUnitsPlaced} / ${_meta.targetUnits} (${_meta.placementRate}%)\n`);
}
