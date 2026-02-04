/**
 * Script to regenerate output JSON files using floor generation algorithm
 * Run with: npx tsx scripts/regenerate-outputs.ts
 *
 * Algorithm Selection:
 *   --legacy: Use original perimeter packing (default)
 *   --phase2: Use new grid-based corridor routing
 *   --shape: Choose building shape (rectangle, courtyard, donut, h-shape, t-shape)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Import generation functions
import { generateSolverResultFromExtracted } from "../src/utils/generateFromExtracted.ts";
import {
  generateMassing,
  type MassingConfig,
} from "../src/utils/massingGenerator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../public/data");

const PROJECTS = [
  { id: "p1", buildingFile: "p1_building.json", outputFile: "p1_output.json" },
  { id: "p4", buildingFile: "p4_building.json", outputFile: "p4_output.json" },
  { id: "p7", buildingFile: "p7_building.json", outputFile: "p7_output.json" },
  { id: "p9", buildingFile: "p9_building.json", outputFile: "p9_output.json" },
];

function parseArgs(): MassingConfig {
  const args = process.argv.slice(2);
  const config: MassingConfig = { algorithm: "legacy" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg.toLowerCase()) {
      case "--legacy":
        config.algorithm = "legacy";
        break;
      case "--phase2":
        config.algorithm = "phase2";
        break;
      case "--shape=rectangle":
        config.shape = "rectangle";
        config.algorithm = "phase2";
        break;
      case "--shape=courtyard":
        config.shape = "courtyard";
        config.algorithm = "phase2";
        break;
      case "--shape=donut":
        config.shape = "donut";
        config.algorithm = "phase2";
        break;
      case "--shape=h-shape":
        config.shape = "h-shape";
        config.algorithm = "phase2";
        break;
      case "--shape=t-shape":
        config.shape = "t-shape";
        config.algorithm = "phase2";
        break;
    }
  }

  return config;
}

async function regenerateAll() {
  console.log("Regenerating output files with floor generation algorithm...\n");

  const config = parseArgs();

  if (config.algorithm === "phase2") {
    console.log(
      `🚀 Using Phase 2 massing algorithm${config.shape ? ` with ${config.shape} shape` : ""}\n`,
    );
  } else {
    console.log("📦 Using legacy perimeter packing algorithm\n");
  }

  for (const project of PROJECTS) {
    const buildingPath = path.join(DATA_DIR, project.buildingFile);
    const outputPath = path.join(DATA_DIR, project.outputFile);

    if (!fs.existsSync(buildingPath)) {
      console.log(
        `⏭️  Skipping ${project.id}: ${project.buildingFile} not found`,
      );
      continue;
    }

    console.log(`📦 Processing ${project.id}...`);

    const buildingData = JSON.parse(fs.readFileSync(buildingPath, "utf-8"));

    let solverResult;

    if (config.algorithm === "phase2") {
      const massingResult = await generateMassing(buildingData, config);
      solverResult = massingResult.result;

      console.log(
        `   → Generation time: ${massingResult.metrics.generationTime.toFixed(0)}ms`,
      );
      console.log(
        `   → Coverage: ${massingResult.metrics.coverage.toFixed(1)}%`,
      );
      console.log(
        `   → Corridor access: ${massingResult.metrics.corridorAccessScore.toFixed(1)}%`,
      );
      console.log(
        `   → Exterior access: ${massingResult.metrics.exteriorAccessScore.toFixed(1)}%`,
      );
    } else {
      solverResult = generateSolverResultFromExtracted({
        building_data: buildingData,
      });
    }

    const residentialFloors = solverResult.building.floors.filter(
      (f) => f.floor_type === "RESIDENTIAL_TYPICAL",
    );

    if (residentialFloors.length > 0) {
      const floor1 = residentialFloors[0];
      const unitsOnFloor = floor1.spaces.filter(
        (s) => s.type === "DWELLING_UNIT",
      ).length;
      console.log(
        `   → Floor plate: ${Math.round(Math.sqrt(floor1.area_sf))}' x ${Math.round(Math.sqrt(floor1.area_sf))}'`,
      );
      console.log(`   → Units per floor: ${unitsOnFloor}`);
      console.log(`   → Total floors: ${solverResult.building.floors.length}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(solverResult, null, 2));
    console.log(`   ✅ Wrote ${project.outputFile}\n`);
  }

  console.log("Done! All output files regenerated.");
}

regenerateAll().catch(console.error);
