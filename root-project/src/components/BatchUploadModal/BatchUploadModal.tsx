import React, { useState, useRef } from 'react';
import { useBatchUpload } from '../../hooks/useBatchUpload';
import './BatchUploadModal.css';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void; // Refresh admin page after upload
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, isUploading, uploadFiles, retryFailed } = useBatchUpload();

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const result = await uploadFiles(selectedFiles);

    if (result.failed.length === 0) {
      // All succeeded - close modal and refresh
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1000);
    }
  };

  const handleRetry = async () => {
    const failedFiles = uploads
      .filter(u => u.status === 'failed')
      .map(u => u.file);

    await retryFailed(failedFiles);
  };

  const totalFiles = uploads.length || selectedFiles.length;
  const completedFiles = uploads.filter(u => u.status === 'success').length;
  const failedFiles = uploads.filter(u => u.status === 'failed').length;
  const progressPercent = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  return (
    <div className="batch-upload-modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isUploading && onClose()}>
      <div className="batch-upload-modal">
        <div className="batch-upload-header">
          <h2>Upload Photos</h2>
          <button className="batch-upload-close" onClick={onClose} disabled={isUploading}>×</button>
        </div>

        <div className="batch-upload-content">
          {uploads.length === 0 ? (
            // File selection
            <>
              <div className="file-select-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="file-input-hidden"
                  id="batch-file-input"
                />
                <label htmlFor="batch-file-input" className="file-select-button">
                  Choose Photos
                </label>
                {selectedFiles.length > 0 && (
                  <p className="file-count">{selectedFiles.length} file(s) selected</p>
                )}
              </div>

              <div className="batch-upload-actions">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0}
                  className="btn-primary"
                >
                  Upload {selectedFiles.length} Photo(s)
                </button>
              </div>
            </>
          ) : (
            // Upload progress
            <>
              <div className="upload-progress-bar-container">
                <div className="upload-progress-bar" style={{ width: `${progressPercent}%` }} />
                <span className="upload-progress-text">
                  {completedFiles} / {totalFiles} uploaded
                </span>
              </div>

              <div className="upload-list">
                {uploads.map(upload => (
                  <div key={upload.file.name} className={`upload-item upload-${upload.status}`}>
                    <span className="upload-filename">{upload.file.name}</span>
                    <span className="upload-status">
                      {upload.status === 'pending' && 'Preparing...'}
                      {upload.status === 'uploading' && 'Uploading...'}
                      {upload.status === 'processing' && 'Processing...'}
                      {upload.status === 'success' && '✓ Complete'}
                      {upload.status === 'failed' && `✗ ${upload.error}`}
                    </span>
                  </div>
                ))}
              </div>

              {failedFiles > 0 && !isUploading && (
                <div className="upload-failed-actions">
                  <p className="upload-failed-message">
                    {failedFiles} file(s) failed to upload
                  </p>
                  <button onClick={handleRetry} className="btn-retry">
                    Retry Failed
                  </button>
                </div>
              )}

              {!isUploading && (
                <div className="batch-upload-actions">
                  <button onClick={onClose} className="btn-secondary">
                    {failedFiles > 0 ? 'Close' : 'Done'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
