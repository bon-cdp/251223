/**
 * Hook for parsing GLOQ Excel files into FullBuildingConfig
 * Supports both New (N) and Repurpose (R) build modes
 * and all 5 construction types: V, III, V/I, III/I, I
 */

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type {
  FullBuildingConfig,
  BuildMode,
  ConstructionType,
  UnitConfig,
} from '../types/building';
import { CONSTRUCTION_COSTS } from '../types/building';

// ============================================================================
// Types
// ============================================================================

interface ParsedExcelData {
  // Project info (from DATA INPUT)
  address: string;
  propertyType: string;
  lotSize: number;

  // Building dimensions (from APT SA)
  storiesAbove: number;
  storiesBelow: number;
  floorPlateArea: number;
  gba: number;
  gfa: number;
  netToGross: number;

  // Unit mix (from Gensler Proforma or APT Logic)
  units: {
    studio: UnitConfig;
    oneBed: UnitConfig;
    twoBed: UnitConfig;
    threeBed: UnitConfig;
  };
  totalUnits: number;

  // Space breakdown (from APT CC)
  circulation: number;
  retail: number;
  amenitiesIndoor: number;
  amenitiesOutdoor: number;
  supportAreas: number;
  parking: number;
  boh: number;

  // Construction costs per type (from APT CC N and R)
  costs: {
    new: Record<ConstructionType, { costPerSF: number; totalCost: number }>;
    repurpose: Record<ConstructionType, { costPerSF: number; totalCost: number }>;
  };
}

interface UseExcelDataResult {
  excelData: ParsedExcelData | null;
  config: FullBuildingConfig | null;
  loading: boolean;
  error: string | null;
  parseFile: (file: File) => Promise<void>;
  setConfig: (buildMode: BuildMode, constructionType: ConstructionType) => void;
  reset: () => void;
}

// ============================================================================
// Excel Parsing Helpers
// ============================================================================

function findValueByLabel(
  sheet: XLSX.WorkSheet,
  label: string,
  valueCol: string = 'G',
  partialMatch: boolean = true
): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');

  for (let row = range.s.r; row <= range.e.r; row++) {
    // Search in columns A through E for the label
    for (let col = 0; col <= 4; col++) {
      const labelCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!labelCell || typeof labelCell.v !== 'string') continue;

      const cellText = labelCell.v.toLowerCase();
      const searchLabel = label.toLowerCase();

      const match = partialMatch
        ? cellText.includes(searchLabel)
        : cellText === searchLabel;

      if (match) {
        const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: XLSX.utils.decode_col(valueCol) })];
        if (valueCell) {
          const val = valueCell.v;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsed)) return parsed;
          }
        }
      }
    }
  }
  return 0;
}

function getCellValue(sheet: XLSX.WorkSheet, cell: string): string | number | null {
  const c = sheet[cell];
  return c ? c.v : null;
}

// ============================================================================
// Sheet Parsers
// ============================================================================

function parseDataInput(sheet: XLSX.WorkSheet): {
  address: string;
  propertyType: string;
  lotSize: number;
  stories: number;
} {
  return {
    address: String(getCellValue(sheet, 'E4') || getCellValue(sheet, 'D4') || 'Unknown Address'),
    propertyType: String(getCellValue(sheet, 'E9') || getCellValue(sheet, 'D9') || 'Apartment'),
    lotSize: findValueByLabel(sheet, 'Lot Size', 'E') || findValueByLabel(sheet, 'Lot Size', 'G') || 30000,
    stories: findValueByLabel(sheet, 'Stories', 'E') || findValueByLabel(sheet, 'Stories', 'G') || 8,
  };
}

function parseGenslerProforma(sheet: XLSX.WorkSheet): {
  units: { studio: UnitConfig; oneBed: UnitConfig; twoBed: UnitConfig; threeBed: UnitConfig };
  totalUnits: number;
} {
  const defaultDepth = 28;

  const result = {
    units: {
      studio: { count: 0, area: 472, depth: defaultDepth, width: 17 },
      oneBed: { count: 0, area: 639, depth: defaultDepth, width: 23 },
      twoBed: { count: 0, area: 1108, depth: 30, width: 37 },
      threeBed: { count: 0, area: 1260, depth: 30, width: 42 },
    },
    totalUnits: 0,
  };

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z50');

  for (let row = range.s.r; row <= range.e.r; row++) {
    // Try columns D, C, B for labels
    let label = '';
    for (let col = 3; col >= 1; col--) {
      const labelCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (labelCell && typeof labelCell.v === 'string') {
        label = labelCell.v.toLowerCase();
        break;
      }
    }

    if (!label) continue;

    // Try columns E, F, G for count
    let count = 0;
    for (let col = 4; col <= 6; col++) {
      const countCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (countCell && typeof countCell.v === 'number') {
        count = Math.round(countCell.v);
        break;
      }
    }

    // Try columns F, G, H for area
    let area = 0;
    for (let col = 5; col <= 7; col++) {
      const areaCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (areaCell && typeof areaCell.v === 'number' && areaCell.v > 100) {
        area = areaCell.v;
        break;
      }
    }

    if (label.includes('studio')) {
      result.units.studio.count = count;
      if (area > 0) {
        result.units.studio.area = area;
        result.units.studio.width = Math.round(area / result.units.studio.depth);
      }
    } else if (label.includes('1 bedroom') || label.includes('1-bed') || label.includes('one bed') || label.includes('1br')) {
      result.units.oneBed.count = count;
      if (area > 0) {
        result.units.oneBed.area = area;
        result.units.oneBed.width = Math.round(area / result.units.oneBed.depth);
      }
    } else if ((label.includes('2 bedroom') || label.includes('2-bed') || label.includes('two bed') || label.includes('2br')) && !label.includes('powder')) {
      result.units.twoBed.count = count;
      if (area > 0) {
        result.units.twoBed.area = area;
        result.units.twoBed.width = Math.round(area / result.units.twoBed.depth);
      }
    } else if (label.includes('3 bedroom') || label.includes('3-bed') || label.includes('three bed') || label.includes('3br')) {
      result.units.threeBed.count = count;
      if (area > 0) {
        result.units.threeBed.area = area;
        result.units.threeBed.width = Math.round(area / result.units.threeBed.depth);
      }
    } else if (label.includes('total') && count > 10) {
      result.totalUnits = count;
    }
  }

  // Calculate total if not found
  if (result.totalUnits === 0) {
    result.totalUnits =
      result.units.studio.count +
      result.units.oneBed.count +
      result.units.twoBed.count +
      result.units.threeBed.count;
  }

  return result;
}

function parseSpaceAllocation(sheet: XLSX.WorkSheet): {
  gba: number;
  gfa: number;
  stories: number;
  floorPlate: number;
  rentable: number;
  netToGross: number;
} {
  return {
    gba: findValueByLabel(sheet, 'Gross Building Area') || findValueByLabel(sheet, 'GBA'),
    gfa: findValueByLabel(sheet, 'Gross Floor Area') || findValueByLabel(sheet, 'GFA'),
    stories: findValueByLabel(sheet, 'Stories'),
    floorPlate: findValueByLabel(sheet, 'floor plate') || findValueByLabel(sheet, 'Floor Plate'),
    rentable: findValueByLabel(sheet, 'Rentable') || findValueByLabel(sheet, 'Net Rentable'),
    netToGross: findValueByLabel(sheet, 'Net-to-Gross') || findValueByLabel(sheet, 'Efficiency'),
  };
}

function parseSpaceBreakdown(sheet: XLSX.WorkSheet): {
  circulation: number;
  retail: number;
  amenitiesIndoor: number;
  amenitiesOutdoor: number;
  supportAreas: number;
  parking: number;
  boh: number;
} {
  return {
    circulation: findValueByLabel(sheet, 'Circulation'),
    retail: findValueByLabel(sheet, 'Retail'),
    amenitiesIndoor: findValueByLabel(sheet, 'Amenities – Indoor') || findValueByLabel(sheet, 'Indoor Amenity'),
    amenitiesOutdoor: findValueByLabel(sheet, 'Amenities – Outdoor') || findValueByLabel(sheet, 'Outdoor Amenity'),
    supportAreas: findValueByLabel(sheet, 'Support'),
    parking: findValueByLabel(sheet, 'Parking'),
    boh:
      findValueByLabel(sheet, 'Back of House') +
      findValueByLabel(sheet, 'Electrical') +
      findValueByLabel(sheet, 'Mechanical') +
      findValueByLabel(sheet, 'Plumbing'),
  };
}

function parseConstructionCosts(
  sheet: XLSX.WorkSheet,
  gfa: number
): Record<ConstructionType, { costPerSF: number; totalCost: number }> {
  // Try to find cost/SF for each construction type
  const types: ConstructionType[] = ['V', 'III', 'V/I', 'III/I', 'I'];
  const result: Record<ConstructionType, { costPerSF: number; totalCost: number }> = {} as any;

  for (const type of types) {
    let costPerSF = findValueByLabel(sheet, `Type ${type}`, 'H') ||
                    findValueByLabel(sheet, `Type ${type}`, 'G') ||
                    CONSTRUCTION_COSTS.new[type]; // Fallback to hardcoded

    result[type] = {
      costPerSF,
      totalCost: costPerSF * gfa,
    };
  }

  return result;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useExcelData(): UseExcelDataResult {
  const [excelData, setExcelData] = useState<ParsedExcelData | null>(null);
  const [config, setConfigState] = useState<FullBuildingConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      // Get sheets
      const dataInputSheet = workbook.Sheets['DATA INPUT'];
      const genslerSheet = workbook.Sheets['Gensler Proforma'];
      const aptSaSheet = workbook.Sheets['APT SA'];
      const aptCcNSheet = workbook.Sheets['APT CC (N)'];
      const aptCcRSheet = workbook.Sheets['APT CC (R)'];

      if (!dataInputSheet) {
        throw new Error('Missing DATA INPUT sheet in Excel file');
      }

      // Parse all data
      const dataInput = parseDataInput(dataInputSheet);
      const unitMix = genslerSheet
        ? parseGenslerProforma(genslerSheet)
        : {
            units: {
              studio: { count: 23, area: 472, depth: 28, width: 17 },
              oneBed: { count: 66, area: 639, depth: 28, width: 23 },
              twoBed: { count: 39, area: 1108, depth: 30, width: 37 },
              threeBed: { count: 0, area: 1260, depth: 30, width: 42 },
            },
            totalUnits: 128,
          };

      const spaceAlloc = aptSaSheet
        ? parseSpaceAllocation(aptSaSheet)
        : {
            gba: 150000,
            gfa: 120000,
            stories: dataInput.stories,
            floorPlate: 18000,
            rentable: 100000,
            netToGross: 0.68,
          };

      const spaceBreak = aptCcNSheet
        ? parseSpaceBreakdown(aptCcNSheet)
        : {
            circulation: 14000,
            retail: 5000,
            amenitiesIndoor: 2000,
            amenitiesOutdoor: 4000,
            supportAreas: 6000,
            parking: 25000,
            boh: 4000,
          };

      // Calculate GFA if not found
      const gfa = spaceAlloc.gfa || dataInput.lotSize * (spaceAlloc.stories || dataInput.stories) * 0.8;

      // Parse construction costs from both sheets
      const newCosts = aptCcNSheet
        ? parseConstructionCosts(aptCcNSheet, gfa)
        : Object.fromEntries(
            (['V', 'III', 'V/I', 'III/I', 'I'] as ConstructionType[]).map(t => [
              t,
              { costPerSF: CONSTRUCTION_COSTS.new[t], totalCost: CONSTRUCTION_COSTS.new[t] * gfa },
            ])
          ) as Record<ConstructionType, { costPerSF: number; totalCost: number }>;

      const repurposeCosts = aptCcRSheet
        ? parseConstructionCosts(aptCcRSheet, gfa)
        : Object.fromEntries(
            (['V', 'III', 'V/I', 'III/I', 'I'] as ConstructionType[]).map(t => [
              t,
              { costPerSF: CONSTRUCTION_COSTS.repurpose[t], totalCost: CONSTRUCTION_COSTS.repurpose[t] * gfa },
            ])
          ) as Record<ConstructionType, { costPerSF: number; totalCost: number }>;

      const stories = spaceAlloc.stories || dataInput.stories || 8;

      const parsedData: ParsedExcelData = {
        address: dataInput.address,
        propertyType: dataInput.propertyType,
        lotSize: dataInput.lotSize,
        storiesAbove: stories,
        storiesBelow: 1,
        floorPlateArea: spaceAlloc.floorPlate || dataInput.lotSize,
        gba: spaceAlloc.gba || gfa * 1.25,
        gfa,
        netToGross: spaceAlloc.netToGross || 0.68,
        units: unitMix.units,
        totalUnits: unitMix.totalUnits,
        ...spaceBreak,
        costs: {
          new: newCosts,
          repurpose: repurposeCosts,
        },
      };

      setExcelData(parsedData);

      // Set default config (new construction, Type V)
      buildConfig(parsedData, 'new', 'V');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse Excel file');
    } finally {
      setLoading(false);
    }
  }, []);

  const buildConfig = useCallback(
    (data: ParsedExcelData, buildMode: BuildMode, constructionType: ConstructionType) => {
      const costs = data.costs[buildMode][constructionType];

      const fullConfig: FullBuildingConfig = {
        address: data.address,
        propertyType: data.propertyType,
        buildMode,
        constructionType,
        lotSize: data.lotSize,
        storiesAbove: data.storiesAbove,
        storiesBelow: data.storiesBelow,
        floorPlateArea: data.floorPlateArea,
        floorPlateAspect: 1.4, // Default, can be made configurable
        gba: data.gba,
        gfa: data.gfa,
        netToGross: data.netToGross,
        units: data.units,
        totalUnits: data.totalUnits,
        circulation: data.circulation,
        retail: data.retail,
        amenitiesIndoor: data.amenitiesIndoor,
        amenitiesOutdoor: data.amenitiesOutdoor,
        supportAreas: data.supportAreas,
        parking: data.parking,
        boh: data.boh,
        costPerSF: costs.costPerSF,
        totalConstructionCost: costs.totalCost,
      };

      setConfigState(fullConfig);
    },
    []
  );

  const setConfig = useCallback(
    (buildMode: BuildMode, constructionType: ConstructionType) => {
      if (excelData) {
        buildConfig(excelData, buildMode, constructionType);
      }
    },
    [excelData, buildConfig]
  );

  const reset = useCallback(() => {
    setExcelData(null);
    setConfigState(null);
    setError(null);
  }, []);

  return { excelData, config, loading, error, parseFile, setConfig, reset };
}
