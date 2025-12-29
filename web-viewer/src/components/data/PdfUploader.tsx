/**
 * PDF Upload component - extracts text and processes via Qwen API
 */

import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - use unpkg for latest versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Matches p1_building.json schema for proper visualization
export interface ExtractedBuildingData {
  building: {
    property_type?: string;
    construction_type?: string;
    lot_size_sf: number;
    far: number;
    gfa_sf: number;
    gba_sf?: number;
    stories_total: number;
    stories_above_grade: number;
    stories_below_grade: number;
    floor_plate_sf: number;
    rentable_sf?: number;
    net_to_gross?: number;
    height_above_grade_ft: number;
    height_below_grade_ft?: number;
  };
  dwelling_units: Array<{
    type: string;  // "studio" | "1br" | "2br" | "3br"
    name: string;
    count: number;
    area_sf: number;
    width_ft: number;
    depth_ft: number;
    bedrooms: number;
    bathrooms: number;
  }>;
  circulation: {
    corridor_width_ft: number;
    corridor_length_ft?: number;
    elevators: {
      passenger: { count: number; sf_per_floor: number };
      freight?: { count: number; sf_per_floor: number };
    };
    stairs: { count: number; sf_per_floor: number };
  };
  parking: {
    surface_stalls: number;
    podium_stalls: number;
    underground_stalls: number;
    indoor_parking_sf?: number;
    surface_lot_sf?: number;
  };
  support?: Array<{ name: string; area_sf: number; floor?: string }>;
  amenities_indoor?: Array<{ name: string; area_sf: number; floor?: string }>;
  amenities_outdoor?: Array<{ name: string; area_sf: number; floor?: string }>;
}

// Legacy interface for backward compatibility
interface ExtractedData {
  properties?: Record<string, any>;
  constraints?: Record<string, any>;
  units?: Array<{ type: string; count: number; area_sf: number }>;
  metadata?: Record<string, any>;
  raw_response?: string;
  // New structured data
  building_data?: ExtractedBuildingData;
}

interface PdfUploaderProps {
  onDataExtracted?: (data: ExtractedData) => void;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({ onDataExtracted }) => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'extracting' | 'processing' | 'done'>('upload');

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText;
  };

  const processWithQwen = async (text: string): Promise<ExtractedData> => {
    // Call DashScope API directly (international endpoint)
    const DASHSCOPE_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
    const DASHSCOPE_API_KEY = 'sk-3154176795dd40969654a6efb517ab0a';

    // Comprehensive prompt to extract structured building data with unit dimensions
    const instructions = `Extract real estate space allocation data from this document. This is a Space Allocation Analysis PDF.

Return a JSON object with this EXACT structure (use actual numbers from the document):

{
  "building": {
    "property_type": "apartment",
    "construction_type": "Type III/I",
    "lot_size_sf": <number from "Lot Size (GSF)">,
    "far": <number from "FAR">,
    "gfa_sf": <number from "Gross Floor Area (GFA)">,
    "gba_sf": <number from "Gross Building Area (GBA)">,
    "stories_total": <number from "Total of stories">,
    "stories_above_grade": <number from "Stories (Above Grade)">,
    "stories_below_grade": <number from "Stories (Below Grade)">,
    "floor_plate_sf": <number from "Typical floor plate area">,
    "rentable_sf": <number from "Rentable area">,
    "net_to_gross": <decimal from "Net-to-Gross ratio">,
    "height_above_grade_ft": <number from "Above grade height">,
    "height_below_grade_ft": <number from "Building height - Below grade">
  },
  "dwelling_units": [
    {
      "type": "studio",
      "name": "Studio + 1 Bath (Typical)",
      "count": <number from "Quantity of units">,
      "area_sf": <number from "Room Size">,
      "width_ft": <number from "Width" column>,
      "depth_ft": <number from "Depth" column>,
      "bedrooms": 0,
      "bathrooms": 1.0
    }
    // Include ALL unit types from the Dwelling units table (Studio, 1BR, 2BR variants, 3BR variants)
  ],
  "circulation": {
    "corridor_width_ft": <number from "Residential corridor width">,
    "corridor_length_ft": <number from "Residential corridor length">,
    "elevators": {
      "passenger": { "count": <number>, "sf_per_floor": <number from "Elevator -Passenger SF/floor"> }
    },
    "stairs": { "count": <number from "Qty of Stair">, "sf_per_floor": <number from "Stair SF/floor"> }
  },
  "parking": {
    "surface_stalls": <number from "Surface parking stalls">,
    "podium_stalls": <number from "Podium parking stalls">,
    "underground_stalls": <number from "Underground parking stalls">,
    "indoor_parking_sf": <number from "Parking - Indoor" GSF>,
    "surface_lot_sf": <number from "Parking - Surface Lot" GSF>
  },
  "support": [
    { "name": "Entry Lobby", "area_sf": <number>, "floor": "ground" },
    { "name": "Bicycle Room", "area_sf": <number>, "floor": "ground" }
    // Include items from Support Areas table
  ],
  "amenities_indoor": [
    { "name": "Bar / Café Nook", "area_sf": <number>, "floor": "ground" }
    // Include items from Amenities – Indoor table that have areas
  ],
  "amenities_outdoor": [
    { "name": "BBQ Stations", "area_sf": <number>, "floor": "roof" }
    // Include items from Amenities – Outdoor table that have areas
  ]
}

CRITICAL: Extract the EXACT Width and Depth values for each dwelling unit type from the table.
The PDF has columns: "Dwelling units | Has? | % SF | NSF | Quantity of units | Room Size | Width | Depth"

Return ONLY valid JSON, no other text or markdown.`;

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate data extraction assistant specialized in Space Allocation Analysis documents. Extract exact numerical values from tables. Always return valid JSON matching the requested schema.',
          },
          {
            role: 'user',
            content: `${instructions}\n\nDOCUMENT TEXT:\n${text.slice(0, 15000)}\n\nReturn ONLY valid JSON, no markdown code blocks.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Parse JSON from response (handle both raw JSON and markdown code blocks)
    let jsonStr = content;
    // Remove markdown code blocks if present
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const buildingData = JSON.parse(jsonMatch[0]) as ExtractedBuildingData;

      // Return with both legacy format and new structured data
      return {
        building_data: buildingData,
        // Legacy format for backward compatibility
        properties: {
          lot_size_sf: buildingData.building?.lot_size_sf,
          far: buildingData.building?.far,
          gfa_sf: buildingData.building?.gfa_sf,
          stories: buildingData.building?.stories_total,
          total_units: buildingData.dwelling_units?.reduce((sum, u) => sum + u.count, 0) || 0,
        },
        constraints: {
          maximum_height_feet: buildingData.building?.height_above_grade_ft,
          parking_stalls: (buildingData.parking?.surface_stalls || 0) +
                         (buildingData.parking?.podium_stalls || 0) +
                         (buildingData.parking?.underground_stalls || 0),
        },
        units: buildingData.dwelling_units?.map(u => ({
          type: u.name || u.type,
          count: u.count,
          area_sf: u.area_sf,
        })) || [],
      };
    }
    return { raw_response: content };
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setExtractedData(null);
      setExtractedText('');
      setStep('upload');
    } else {
      setError('Please select a PDF file');
    }
  }, []);

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Extract text from PDF
      setStep('extracting');
      const text = await extractTextFromPdf(file);
      setExtractedText(text);

      // Step 2: Process with Qwen API
      setStep('processing');
      const data = await processWithQwen(text);
      setExtractedData(data);
      setStep('done');

      if (onDataExtracted) {
        onDataExtracted(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>PDF Upload</h3>
        <span style={styles.badge}>Powered by Qwen</span>
      </div>

      <div style={styles.content}>
        {/* File Input */}
        <div style={styles.uploadArea}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={styles.fileInput}
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" style={styles.uploadLabel}>
            {file ? file.name : 'Choose PDF file...'}
          </label>
        </div>

        {/* Process Button */}
        {file && !loading && step !== 'done' && (
          <button onClick={handleProcess} style={styles.button}>
            Extract Data with AI
          </button>
        )}

        {/* Loading State */}
        {loading && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>
              {step === 'extracting' ? 'Extracting text from PDF...' : 'Processing with Qwen AI...'}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Results */}
        {extractedData && (
          <div style={styles.results}>
            <h4 style={styles.resultsTitle}>Extracted Data</h4>

            {extractedData.properties && Object.keys(extractedData.properties).length > 0 && (
              <div style={styles.section}>
                <span style={styles.sectionTitle}>Properties</span>
                {Object.entries(extractedData.properties).map(([key, value]) => (
                  <div key={key} style={styles.row}>
                    <span style={styles.key}>{key.replace(/_/g, ' ')}</span>
                    <span style={styles.value}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {extractedData.constraints && Object.keys(extractedData.constraints).length > 0 && (
              <div style={styles.section}>
                <span style={styles.sectionTitle}>Constraints</span>
                {Object.entries(extractedData.constraints).map(([key, value]) => (
                  <div key={key} style={styles.row}>
                    <span style={styles.key}>{key.replace(/_/g, ' ')}</span>
                    <span style={styles.value}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {extractedData.units && extractedData.units.length > 0 && (
              <div style={styles.section}>
                <span style={styles.sectionTitle}>Unit Mix</span>
                {extractedData.units.map((unit, i) => (
                  <div key={i} style={styles.row}>
                    <span style={styles.key}>{unit.type}</span>
                    <span style={styles.value}>
                      {unit.count} units @ {unit.area_sf?.toLocaleString()} SF
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview extracted text */}
        {extractedText && step === 'done' && (
          <details style={styles.details}>
            <summary style={styles.summary}>View extracted text</summary>
            <pre style={styles.textPreview}>{extractedText.slice(0, 1000)}...</pre>
          </details>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f8f9fa',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
  },
  badge: {
    fontSize: '10px',
    padding: '2px 6px',
    background: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '4px',
  },
  content: {
    padding: '16px',
  },
  uploadArea: {
    marginBottom: '12px',
  },
  fileInput: {
    display: 'none',
  },
  uploadLabel: {
    display: 'block',
    padding: '12px 16px',
    background: '#f5f5f5',
    border: '2px dashed #ddd',
    borderRadius: '8px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#666',
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: '#f5f5f5',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#666',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ddd',
    borderTopColor: '#1976d2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    padding: '12px',
    background: '#ffebee',
    color: '#c62828',
    borderRadius: '6px',
    fontSize: '12px',
  },
  results: {
    marginTop: '12px',
  },
  resultsTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
  },
  section: {
    marginBottom: '12px',
    padding: '8px',
    background: '#f8f9fa',
    borderRadius: '4px',
  },
  sectionTitle: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#666',
    marginBottom: '6px',
    textTransform: 'uppercase',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '12px',
  },
  key: {
    color: '#666',
    textTransform: 'capitalize',
  },
  value: {
    fontWeight: 500,
    color: '#333',
  },
  details: {
    marginTop: '12px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
  },
  textPreview: {
    marginTop: '8px',
    padding: '8px',
    background: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '10px',
    whiteSpace: 'pre-wrap',
    maxHeight: '150px',
    overflow: 'auto',
  },
};

export default PdfUploader;
