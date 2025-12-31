import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi, extendedSettingsApi } from '../../services/photoApi';
import './ContactSettingsModal.css';

interface ContactSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const ContactSettingsModal: React.FC<ContactSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [formData, setFormData] = useState({
    heroPhotoId: '',
    title: '',
    subtitle: '',
    fitImageToContainer: false,
  });
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [settings, pendingPhotos, publishedPhotos, archivedPhotos] = await Promise.all([
        extendedSettingsApi.getContactSettings(),
        photoApi.listPhotos('pending', 100),
        photoApi.listPhotos('published', 100),
        photoApi.listPhotos('archived', 100),
      ]);

      const combinedPhotos = [
        ...publishedPhotos.photos,
        ...pendingPhotos.photos,
        ...archivedPhotos.photos,
      ];

      setFormData({
        heroPhotoId: settings.heroPhotoId || '',
        title: settings.title || 'Get In Touch',
        subtitle: settings.subtitle || "Let's create something beautiful together",
        fitImageToContainer: settings.fitImageToContainer || false,
      });
      setAllPhotos(combinedPhotos);
    } catch (err) {
      setError('Failed to load settings');
      console.error('Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.subtitle.trim()) return 'Subtitle is required';
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoSelect = (photoId: string) => {
    setFormData((prev) => ({ ...prev, heroPhotoId: photoId }));
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await extendedSettingsApi.updateContactSettings({
        heroPhotoId: formData.heroPhotoId || undefined,
        title: formData.title,
        subtitle: formData.subtitle,
        fitImageToContainer: formData.fitImageToContainer,
      });

      onSettingsUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setError(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const filteredPhotos = allPhotos
    .filter((photo) =>
      photo.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 10);

  const selectedPhoto = allPhotos.find((p) => p.photoId === formData.heroPhotoId);

  return (
    <div className="contact-settings-backdrop" onClick={handleBackdropClick}>
      <div className="contact-settings-modal">
        <div className="contact-settings-header">
          <h2>Contact Page Settings</h2>
          <button
            type="button"
            className="contact-settings-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="contact-settings-content">
          {isLoading ? (
            <div className="contact-settings-loading">Loading settings...</div>
          ) : (
            <>
              {/* Title Input */}
              <div className="contact-settings-form-group">
                <label htmlFor="contact-title" className="contact-settings-label">
                  Title <span className="contact-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="contact-title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="contact-settings-input"
                  placeholder="Get In Touch"
                  disabled={isSaving}
                />
              </div>

              {/* Subtitle Input */}
              <div className="contact-settings-form-group">
                <label htmlFor="contact-subtitle" className="contact-settings-label">
                  Subtitle <span className="contact-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="contact-subtitle"
                  name="subtitle"
                  value={formData.subtitle}
                  onChange={handleInputChange}
                  className="contact-settings-input"
                  placeholder="Let's create something beautiful together"
                  disabled={isSaving}
                />
              </div>

              {/* Fit Image to Container */}
              <div className="contact-settings-form-group">
                <label className="contact-settings-label">
                  <input
                    type="checkbox"
                    name="fitImageToContainer"
                    checked={formData.fitImageToContainer}
                    onChange={handleInputChange}
                    disabled={isSaving}
                    style={{ marginRight: '8px' }}
                  />
                  Show full image
                </label>
                <p className="contact-settings-hint">
                  When checked, the full image will be visible with empty space on the sides if needed. When unchecked, the image will fill the entire screen width.
                </p>
              </div>

              {/* Photo Selection */}
              <div className="contact-settings-form-group">
                <label className="contact-settings-label">Hero Image</label>
                <p className="contact-settings-hint">
                  Search and select from all your photos
                </p>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="contact-settings-input"
                  placeholder="Search by image title..."
                  disabled={isSaving}
                  style={{ marginBottom: '12px' }}
                />

                {selectedPhoto && (
                  <div className="contact-settings-selected-preview">
                    <img
                      src={selectedPhoto.thumbnailUrl}
                      alt={selectedPhoto.alt}
                    />
                    <span className="contact-settings-selected-title">
                      {selectedPhoto.title}
                    </span>
                  </div>
                )}

                {allPhotos.length === 0 ? (
                  <p className="contact-settings-no-photos">
                    No photos available. Upload some photos first.
                  </p>
                ) : filteredPhotos.length === 0 ? (
                  <p className="contact-settings-no-photos">
                    No photos match your search. Try a different search term.
                  </p>
                ) : (
                  <>
                    <p className="contact-settings-hint" style={{ fontSize: '12px', marginBottom: '8px' }}>
                      Showing {filteredPhotos.length} of {allPhotos.length} photos
                    </p>
                    <div className="contact-settings-photo-grid">
                      {filteredPhotos.map((photo) => (
                        <div
                          key={photo.photoId}
                          className={`contact-settings-photo-option ${
                            formData.heroPhotoId === photo.photoId ? 'selected' : ''
                          }`}
                          onClick={() => handlePhotoSelect(photo.photoId)}
                        >
                          <img src={photo.thumbnailUrl} alt={photo.alt} />
                          {formData.heroPhotoId === photo.photoId && (
                            <div className="contact-settings-photo-check">&#10003;</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="contact-settings-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="contact-settings-actions">
          <button
            type="button"
            className="contact-settings-button contact-settings-button--cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="contact-settings-button contact-settings-button--save"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactSettingsModal;
