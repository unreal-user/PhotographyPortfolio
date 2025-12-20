import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi } from '../../services/photoApi';
import './EditPhotoModal.css';

interface EditPhotoModalProps {
  isOpen: boolean;
  photo: Photo | null;
  onClose: () => void;
  onPhotoUpdated: () => void;
}

const EditPhotoModal: React.FC<EditPhotoModalProps> = ({
  isOpen,
  photo,
  onClose,
  onPhotoUpdated,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    alt: '',
    copyright: '',
    gallery: '',
  });

  // Update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when photo changes
  useEffect(() => {
    if (photo) {
      setFormData({
        title: photo.title,
        description: photo.description || '',
        alt: photo.alt,
        copyright: photo.copyright,
        gallery: photo.gallery || '',
      });
      setError(null);
    }
  }, [photo]);

  if (!isOpen || !photo) return null;

  // Form validation
  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.alt.trim()) return 'Alt text is required';
    if (!formData.copyright.trim()) return 'Copyright is required';
    return null;
  };

  // Handle input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle save
  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await photoApi.updatePhoto(photo.photoId, {
        title: formData.title,
        description: formData.description || undefined,
        alt: formData.alt,
        copyright: formData.copyright,
        gallery: formData.gallery || undefined,
      });

      // Success - close modal and refresh
      handleClose();
      onPhotoUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update photo');
      console.error('Update error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Close modal
  const handleClose = () => {
    if (isUpdating) return; // Prevent closing during update

    setError(null);
    onClose();
  };

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Generate image URL for preview
  const imageUrl = photo.thumbnailUrl || photo.fullResUrl || `/api/photos/${photo.originalKey}`;

  return (
    <div className="edit-modal-backdrop" onClick={handleBackdropClick}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <h2>Edit Photo</h2>
          <button
            type="button"
            className="edit-modal-close"
            onClick={handleClose}
            disabled={isUpdating}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="edit-modal-content">
          {/* Photo Preview */}
          <div className="edit-preview">
            <img
              src={imageUrl}
              alt={photo.alt}
              className="edit-preview-image"
            />
          </div>

          {/* Metadata Form */}
          <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
            <div className="edit-form-group">
              <label htmlFor="edit-title" className="edit-form-label">
                Title <span className="edit-form-required">*</span>
              </label>
              <input
                type="text"
                id="edit-title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="edit-form-input"
                placeholder="Enter photo title"
                disabled={isUpdating}
                required
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="edit-description" className="edit-form-label">
                Description
              </label>
              <textarea
                id="edit-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="edit-form-textarea"
                placeholder="Optional description"
                rows={3}
                disabled={isUpdating}
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="edit-alt" className="edit-form-label">
                Alt Text <span className="edit-form-required">*</span>
              </label>
              <input
                type="text"
                id="edit-alt"
                name="alt"
                value={formData.alt}
                onChange={handleInputChange}
                className="edit-form-input"
                placeholder="Describe the image for accessibility"
                disabled={isUpdating}
                required
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="edit-copyright" className="edit-form-label">
                Copyright <span className="edit-form-required">*</span>
              </label>
              <input
                type="text"
                id="edit-copyright"
                name="copyright"
                value={formData.copyright}
                onChange={handleInputChange}
                className="edit-form-input"
                placeholder="© 2025 Your Name"
                disabled={isUpdating}
                required
              />
            </div>

            <div className="edit-form-group">
              <label htmlFor="edit-gallery" className="edit-form-label">
                Gallery
              </label>
              <input
                type="text"
                id="edit-gallery"
                name="gallery"
                value={formData.gallery}
                onChange={handleInputChange}
                className="edit-form-input"
                placeholder="e.g., Portraits, Landscapes"
                disabled={isUpdating}
              />
              <p className="edit-form-hint">Optional: Categorize this photo</p>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="edit-error" role="alert">
              {error}
            </div>
          )}

          {/* Update Progress */}
          {isUpdating && (
            <div className="edit-progress">
              <div className="edit-progress-spinner"></div>
              <p>Saving changes...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="edit-modal-actions">
          <button
            type="button"
            className="edit-modal-button edit-modal-button--cancel"
            onClick={handleClose}
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="edit-modal-button edit-modal-button--save"
            onClick={handleSave}
            disabled={isUpdating}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPhotoModal;
