/**
 * Script to regenerate output JSON files using the updated floor generation algorithm
 * Run with: npx tsx scripts/regenerate-outputs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import the generation function
import { generateSolverResultFromExtracted } from '../src/utils/generateFromExtracted.js';
import { detectOverlaps } from './architect-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../public/data');

const PROJECTS = [
  { id: 'p1', buildingFile: 'p1_building.json', outputFile: 'p1_output.json' },
  { id: 'p4', buildingFile: 'p4_building.json', outputFile: 'p4_output.json' },
  { id: 'p7', buildingFile: 'p7_building.json', outputFile: 'p7_output.json' },
  { id: 'p9', buildingFile: 'p9_building.json', outputFile: 'p9_output.json' },
];

async function regenerateAll() {
  console.log('Regenerating output files with updated algorithm...\n');

  for (const project of PROJECTS) {
    const buildingPath = path.join(DATA_DIR, project.buildingFile);
    const outputPath = path.join(DATA_DIR, project.outputFile);

    if (!fs.existsSync(buildingPath)) {
      console.log(`⏭️  Skipping ${project.id}: ${project.buildingFile} not found`);
      continue;
    }

    console.log(`📦 Processing ${project.id}...`);

    // Load building data
    const buildingData = JSON.parse(fs.readFileSync(buildingPath, 'utf-8'));

    // Generate solver result using our updated algorithm
    const solverResult = generateSolverResultFromExtracted({
      building_data: buildingData,
    });

    // Count units per floor for verification
    const residentialFloors = solverResult.building.floors.filter(
      f => f.floor_type === 'RESIDENTIAL_TYPICAL'
    );

    if (residentialFloors.length > 0) {
      const floor1 = residentialFloors[0];
      const unitsOnFloor = floor1.spaces.filter(s => s.type === 'DWELLING_UNIT').length;
      const boundaryVerts = floor1.boundary.length;
      console.log(`   → Boundary vertices: ${boundaryVerts} (${boundaryVerts > 4 ? 'IRREGULAR' : 'square'})`);
      console.log(`   → Floor plate area: ${Math.round(floor1.area_sf)} SF`);
      console.log(`   → Units per floor: ${unitsOnFloor}`);
      console.log(`   → Total floors: ${solverResult.building.floors.length}`);
    }

    // Post-generation overlap validation
    let totalOverlaps = 0;
    for (const floor of solverResult.building.floors) {
      const overlaps = detectOverlaps(floor);
      if (overlaps.length > 0) {
        totalOverlaps += overlaps.length;
        console.log(`   ⚠️  Floor ${floor.floor_index} (${floor.floor_type}): ${overlaps.length} overlap(s)`);
        for (const o of overlaps) {
          console.log(`      ${o.space1} ↔ ${o.space2}: ${o.overlap_area} SF`);
        }
      }
    }
    if (totalOverlaps === 0) {
      console.log(`   ✅ No overlaps detected on any floor`);
    }

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(solverResult, null, 2));
    console.log(`   ✅ Wrote ${project.outputFile}\n`);
  }

  console.log('Done! All output files regenerated.');
}

regenerateAll().catch(console.error);
