import React, { useState, useRef } from 'react';
import { photoApi } from '../../services/photoApi';
import './UploadPhotoModal.css';

interface UploadPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoUploaded: () => void;
}

const UploadPhotoModal: React.FC<UploadPhotoModalProps> = ({
  isOpen,
  onClose,
  onPhotoUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    alt: '',
    copyright: `© ${new Date().getFullYear()} Your Name`,
    gallery: '',
  });

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // File validation
  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload JPEG, PNG, or WebP images.';
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 10MB.';
    }

    return null;
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!file) return 'Please select a file';
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.alt.trim()) return 'Alt text is required';
    if (!formData.copyright.trim()) return 'Copyright is required';
    return null;
  };

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      setError(error);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Auto-fill alt text from filename if empty
    if (!formData.alt) {
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setFormData((prev) => ({ ...prev, alt: fileName }));
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // File input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Form input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Upload workflow
  const handleUpload = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Generate upload URL
      setUploadProgress('Generating upload URL...');
      const uploadResponse = await photoApi.generateUploadUrl({
        fileType: file.type,
        fileSize: file.size,
        fileName: file.name,
      });

      // Step 2: Upload to S3
      setUploadProgress('Uploading to S3...');
      await photoApi.uploadToS3(uploadResponse.uploadUrl, file);

      // Step 3: Create photo metadata
      setUploadProgress('Saving metadata...');
      await photoApi.createPhoto({
        photoId: uploadResponse.photoId,
        title: formData.title,
        description: formData.description || undefined,
        alt: formData.alt,
        copyright: formData.copyright,
        gallery: formData.gallery || undefined,
      });

      // Success!
      setUploadProgress('Upload complete!');
      setTimeout(() => {
        handleClose();
        onPhotoUploaded();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Close modal
  const handleClose = () => {
    if (isUploading) return; // Prevent closing during upload

    setFile(null);
    setPreviewUrl(null);
    setFormData({
      title: '',
      description: '',
      alt: '',
      copyright: `© ${new Date().getFullYear()} Your Name`,
      gallery: '',
    });
    setError(null);
    setUploadProgress('');
    onClose();
  };

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="upload-modal-backdrop" onClick={handleBackdropClick}>
      <div className="upload-modal">
        <div className="upload-modal-header">
          <h2>Upload Photo</h2>
          <button
            type="button"
            className="upload-modal-close"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="upload-modal-content">
          {/* File Upload Area */}
          {!file ? (
            <div
              className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                className="upload-dropzone-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="upload-dropzone-text">
                Drag and drop your photo here, or click to select
              </p>
              <p className="upload-dropzone-hint">
                JPEG, PNG, or WebP • Max 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <>
              {/* Preview */}
              <div className="upload-preview">
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="upload-preview-image" />
                )}
                <button
                  type="button"
                  className="upload-preview-remove"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isUploading}
                >
                  Remove
                </button>
              </div>

              {/* Metadata Form */}
              <form className="upload-form" onSubmit={(e) => e.preventDefault()}>
                <div className="upload-form-group">
                  <label htmlFor="title" className="upload-form-label">
                    Title <span className="upload-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="upload-form-input"
                    placeholder="Enter photo title"
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="upload-form-group">
                  <label htmlFor="description" className="upload-form-label">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="upload-form-textarea"
                    placeholder="Optional description"
                    rows={3}
                    disabled={isUploading}
                  />
                </div>

                <div className="upload-form-group">
                  <label htmlFor="alt" className="upload-form-label">
                    Alt Text <span className="upload-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="alt"
                    name="alt"
                    value={formData.alt}
                    onChange={handleInputChange}
                    className="upload-form-input"
                    placeholder="Describe the image for accessibility"
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="upload-form-group">
                  <label htmlFor="copyright" className="upload-form-label">
                    Copyright <span className="upload-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    id="copyright"
                    name="copyright"
                    value={formData.copyright}
                    onChange={handleInputChange}
                    className="upload-form-input"
                    placeholder="© 2025 Your Name"
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="upload-form-group">
                  <label htmlFor="gallery" className="upload-form-label">
                    Gallery
                  </label>
                  <input
                    type="text"
                    id="gallery"
                    name="gallery"
                    value={formData.gallery}
                    onChange={handleInputChange}
                    className="upload-form-input"
                    placeholder="e.g., Portraits, Landscapes"
                    disabled={isUploading}
                  />
                  <p className="upload-form-hint">Optional: Categorize this photo</p>
                </div>
              </form>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="upload-error" role="alert">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && uploadProgress && (
            <div className="upload-progress">
              <div className="upload-progress-spinner"></div>
              <p>{uploadProgress}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {file && (
          <div className="upload-modal-actions">
            <button
              type="button"
              className="upload-modal-button upload-modal-button--cancel"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="upload-modal-button upload-modal-button--upload"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPhotoModal;
