import React, { useState, useRef, useEffect } from 'react';
import { useBatchUpload } from '../../hooks/useBatchUpload';
import './BatchUploadModal.css';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void; // Refresh admin page after upload
  existingGalleries: string[];
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({ isOpen, onClose, onComplete, existingGalleries }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('');
  const [newGalleryName, setNewGalleryName] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, isUploading, uploadFiles, retryFailed, clearUploads } = useBatchUpload();

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setSelectedGallery('');
      setNewGalleryName('');
      setIsCreatingNew(false);
      clearUploads();
    }
  }, [isOpen, clearUploads]);

  if (!isOpen) return null;

  const effectiveGallery = isCreatingNew ? newGalleryName.trim() : (selectedGallery || 'Uncategorized');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (isCreatingNew && !newGalleryName.trim()) return;

    const result = await uploadFiles(selectedFiles, effectiveGallery);

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

    await retryFailed(failedFiles, effectiveGallery);
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      setIsCreatingNew(true);
      setSelectedGallery('');
    } else {
      setIsCreatingNew(false);
      setSelectedGallery(value);
    }
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

              <div className="gallery-select-area">
                <label htmlFor="gallery-select" className="gallery-select-label">
                  Upload to Gallery:
                </label>
                <select
                  id="gallery-select"
                  value={isCreatingNew ? '__new__' : selectedGallery}
                  onChange={handleGalleryChange}
                  className="gallery-select-dropdown"
                >
                  <option value="">Uncategorized</option>
                  {existingGalleries.map(gallery => (
                    <option key={gallery} value={gallery}>{gallery}</option>
                  ))}
                  <option value="__new__">+ Create New Gallery</option>
                </select>
                {isCreatingNew && (
                  <input
                    type="text"
                    value={newGalleryName}
                    onChange={(e) => setNewGalleryName(e.target.value)}
                    placeholder="Enter new gallery name"
                    className="new-gallery-input"
                    autoFocus
                  />
                )}
              </div>

              <div className="batch-upload-actions">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || (isCreatingNew && !newGalleryName.trim())}
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
