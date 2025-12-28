import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi, settingsApi } from '../../services/photoApi';
import './HeroSettingsModal.css';

interface HeroSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const HeroSettingsModal: React.FC<HeroSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [formData, setFormData] = useState({
    heroPhotoId: '',
    title: '',
    subtitle: '',
  });
  const [publishedPhotos, setPublishedPhotos] = useState<Photo[]>([]);
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
      const [settings, photosResponse] = await Promise.all([
        settingsApi.getHeroSettings(),
        photoApi.listPhotos('published', 100),
      ]);

      setFormData({
        heroPhotoId: settings.heroPhotoId || '',
        title: settings.title,
        subtitle: settings.subtitle,
      });
      setPublishedPhotos(photosResponse.photos);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      await settingsApi.updateHeroSettings({
        heroPhotoId: formData.heroPhotoId || undefined,
        title: formData.title,
        subtitle: formData.subtitle,
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

  const selectedPhoto = publishedPhotos.find((p) => p.photoId === formData.heroPhotoId);

  return (
    <div className="hero-settings-backdrop" onClick={handleBackdropClick}>
      <div className="hero-settings-modal">
        <div className="hero-settings-header">
          <h2>Hero Section Settings</h2>
          <button
            type="button"
            className="hero-settings-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="hero-settings-content">
          {isLoading ? (
            <div className="hero-settings-loading">Loading settings...</div>
          ) : (
            <>
              {/* Title Input */}
              <div className="hero-settings-form-group">
                <label htmlFor="hero-title" className="hero-settings-label">
                  Title <span className="hero-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="hero-title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="hero-settings-input"
                  placeholder="Welcome to My Portfolio"
                  disabled={isSaving}
                />
              </div>

              {/* Subtitle Input */}
              <div className="hero-settings-form-group">
                <label htmlFor="hero-subtitle" className="hero-settings-label">
                  Subtitle <span className="hero-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="hero-subtitle"
                  name="subtitle"
                  value={formData.subtitle}
                  onChange={handleInputChange}
                  className="hero-settings-input"
                  placeholder="Capturing life's moments"
                  disabled={isSaving}
                />
              </div>

              {/* Photo Selection */}
              <div className="hero-settings-form-group">
                <label className="hero-settings-label">Hero Image</label>
                <p className="hero-settings-hint">
                  Select from your published photos
                </p>

                {selectedPhoto && (
                  <div className="hero-settings-selected-preview">
                    <img
                      src={selectedPhoto.thumbnailUrl}
                      alt={selectedPhoto.alt}
                    />
                    <span className="hero-settings-selected-title">
                      {selectedPhoto.title}
                    </span>
                  </div>
                )}

                {publishedPhotos.length === 0 ? (
                  <p className="hero-settings-no-photos">
                    No published photos available. Publish some photos first.
                  </p>
                ) : (
                  <div className="hero-settings-photo-grid">
                    {publishedPhotos.map((photo) => (
                      <div
                        key={photo.photoId}
                        className={`hero-settings-photo-option ${
                          formData.heroPhotoId === photo.photoId ? 'selected' : ''
                        }`}
                        onClick={() => handlePhotoSelect(photo.photoId)}
                      >
                        <img src={photo.thumbnailUrl} alt={photo.alt} />
                        {formData.heroPhotoId === photo.photoId && (
                          <div className="hero-settings-photo-check">&#10003;</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="hero-settings-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="hero-settings-actions">
          <button
            type="button"
            className="hero-settings-button hero-settings-button--cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hero-settings-button hero-settings-button--save"
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

export default HeroSettingsModal;
