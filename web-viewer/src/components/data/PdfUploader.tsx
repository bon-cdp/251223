/**
 * PDF Upload component - extracts text and processes via Qwen API
 */

import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - use unpkg for latest versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ExtractedData {
  properties?: Record<string, any>;
  constraints?: Record<string, any>;
  units?: Array<{ type: string; count: number; area_sf: number }>;
  metadata?: Record<string, any>;
  raw_response?: string;
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

    const instructions = `Extract structured real estate development information from the following text.
Return a JSON object with these keys:
- properties: object with property details (apn, area_sf, dimensions, etc.)
- constraints: object with regulatory constraints (zoning, height, setbacks, parking, far)
- units: array of dwelling unit types if found (type, count, area_sf)
- metadata: object with any other relevant info

Focus on numerical values and regulatory requirements.`;

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
            content: 'You are a real estate data extraction assistant. Extract structured data from property documents. Always return valid JSON.',
          },
          {
            role: 'user',
            content: `${instructions}\n\nDOCUMENT TEXT:\n${text.slice(0, 8000)}\n\nReturn ONLY valid JSON, no other text.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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
