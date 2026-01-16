/**
 * Drag-and-drop Excel file uploader
 */

import { useCallback, useState } from 'react';

interface ExcelUploaderProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

export function ExcelUploader({ onFileSelect, loading }: ExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      className={`excel-uploader ${isDragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="uploader-content">
        <div className="uploader-icon">
          {loading ? (
            <div className="spinner" />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          )}
        </div>
        <h2>Upload GLOQ Excel File</h2>
        <p>Drag and drop your .xlsx file here</p>
        <label className="file-input-label">
          <span>Browse Files</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            disabled={loading}
          />
        </label>
      </div>
    </div>
  );
}
