import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import type { AboutSection } from '../../services/photoApi';
import { photoApi, settingsApi } from '../../services/photoApi';
import './AboutSettingsModal.css';

interface AboutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const AboutSettingsModal: React.FC<AboutSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [formData, setFormData] = useState({
    heroPhotoId: '',
    title: '',
    subtitle: '',
    sections: [] as AboutSection[],
    fitImageToContainer: false,
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
        settingsApi.getAboutSettings(),
        photoApi.listPhotos('published', 100),
      ]);

      setFormData({
        heroPhotoId: settings.heroPhotoId || '',
        title: settings.title,
        subtitle: settings.subtitle,
        sections: settings.sections || [],
        fitImageToContainer: settings.fitImageToContainer || false,
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
    for (let i = 0; i < formData.sections.length; i++) {
      if (!formData.sections[i].heading.trim()) {
        return `Section ${i + 1} heading is required`;
      }
      if (!formData.sections[i].body.trim()) {
        return `Section ${i + 1} body is required`;
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePhotoSelect = (photoId: string) => {
    setFormData((prev) => ({ ...prev, heroPhotoId: photoId }));
  };

  const handleSectionChange = (
    index: number,
    field: 'heading' | 'body',
    value: string
  ) => {
    setFormData((prev) => {
      const newSections = [...prev.sections];
      newSections[index] = { ...newSections[index], [field]: value };
      return { ...prev, sections: newSections };
    });
  };

  const handleAddSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, { heading: '', body: '' }],
    }));
  };

  const handleRemoveSection = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.sections.length) return;

    setFormData((prev) => {
      const newSections = [...prev.sections];
      [newSections[index], newSections[newIndex]] = [
        newSections[newIndex],
        newSections[index],
      ];
      return { ...prev, sections: newSections };
    });
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
      await settingsApi.updateAboutSettings({
        heroPhotoId: formData.heroPhotoId || undefined,
        title: formData.title,
        subtitle: formData.subtitle,
        sections: formData.sections,
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

  const selectedPhoto = publishedPhotos.find(
    (p) => p.photoId === formData.heroPhotoId
  );

  return (
    <div className="about-settings-backdrop" onClick={handleBackdropClick}>
      <div className="about-settings-modal">
        <div className="about-settings-header">
          <h2>About Page Settings</h2>
          <button
            type="button"
            className="about-settings-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="about-settings-content">
          {isLoading ? (
            <div className="about-settings-loading">Loading settings...</div>
          ) : (
            <>
              {/* Title Input */}
              <div className="about-settings-form-group">
                <label htmlFor="about-title" className="about-settings-label">
                  Title <span className="about-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="about-title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="about-settings-input"
                  placeholder="About Me"
                  disabled={isSaving}
                />
              </div>

              {/* Subtitle Input */}
              <div className="about-settings-form-group">
                <label
                  htmlFor="about-subtitle"
                  className="about-settings-label"
                >
                  Subtitle <span className="about-settings-required">*</span>
                </label>
                <input
                  type="text"
                  id="about-subtitle"
                  name="subtitle"
                  value={formData.subtitle}
                  onChange={handleInputChange}
                  className="about-settings-input"
                  placeholder="Telling stories through the lens"
                  disabled={isSaving}
                />
              </div>

              {/* Fit Image to Container */}
              <div className="about-settings-form-group">
                <label className="about-settings-label">
                  <input
                    type="checkbox"
                    name="fitImageToContainer"
                    checked={formData.fitImageToContainer}
                    onChange={handleInputChange}
                    disabled={isSaving}
                    style={{ marginRight: '8px' }}
                  />
                  Show full image on About page
                </label>
                <p className="about-settings-hint">
                  When checked, the full image will be visible with empty space on the sides if needed. When unchecked, the image will fill the entire screen width.
                </p>
              </div>

              {/* Photo Selection */}
              <div className="about-settings-form-group">
                <label className="about-settings-label">Hero Image</label>
                <p className="about-settings-hint">
                  Select from your published photos
                </p>

                {selectedPhoto && (
                  <div className="about-settings-selected-preview">
                    <img
                      src={selectedPhoto.thumbnailUrl}
                      alt={selectedPhoto.alt}
                    />
                    <span className="about-settings-selected-title">
                      {selectedPhoto.title}
                    </span>
                  </div>
                )}

                {publishedPhotos.length === 0 ? (
                  <p className="about-settings-no-photos">
                    No published photos available. Publish some photos first.
                  </p>
                ) : (
                  <div className="about-settings-photo-grid">
                    {publishedPhotos.map((photo) => (
                      <div
                        key={photo.photoId}
                        className={`about-settings-photo-option ${
                          formData.heroPhotoId === photo.photoId
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => handlePhotoSelect(photo.photoId)}
                      >
                        <img src={photo.thumbnailUrl} alt={photo.alt} />
                        {formData.heroPhotoId === photo.photoId && (
                          <div className="about-settings-photo-check">
                            &#10003;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sections */}
              <div className="about-settings-form-group">
                <div className="about-settings-sections-header">
                  <label className="about-settings-label">
                    Content Sections
                  </label>
                  <button
                    type="button"
                    className="about-settings-add-section"
                    onClick={handleAddSection}
                    disabled={isSaving}
                  >
                    + Add Section
                  </button>
                </div>
                <p className="about-settings-hint">
                  Use blank lines to separate paragraphs within each section
                </p>

                {formData.sections.length === 0 ? (
                  <p className="about-settings-no-sections">
                    No sections yet. Add a section to get started.
                  </p>
                ) : (
                  <div className="about-settings-sections-list">
                    {formData.sections.map((section, index) => (
                      <div key={index} className="about-settings-section-card">
                        <div className="about-settings-section-header">
                          <span className="about-settings-section-number">
                            Section {index + 1}
                          </span>
                          <div className="about-settings-section-actions">
                            <button
                              type="button"
                              className="about-settings-section-action"
                              onClick={() => handleMoveSection(index, 'up')}
                              disabled={index === 0 || isSaving}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="about-settings-section-action"
                              onClick={() => handleMoveSection(index, 'down')}
                              disabled={
                                index === formData.sections.length - 1 ||
                                isSaving
                              }
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="about-settings-section-action about-settings-section-action--danger"
                              onClick={() => handleRemoveSection(index)}
                              disabled={isSaving}
                              title="Remove section"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="about-settings-section-fields">
                          <input
                            type="text"
                            value={section.heading}
                            onChange={(e) =>
                              handleSectionChange(
                                index,
                                'heading',
                                e.target.value
                              )
                            }
                            className="about-settings-input"
                            placeholder="Section Heading"
                            disabled={isSaving}
                          />
                          <textarea
                            value={section.body}
                            onChange={(e) =>
                              handleSectionChange(index, 'body', e.target.value)
                            }
                            className="about-settings-textarea"
                            placeholder="Section body text. Use blank lines to separate paragraphs."
                            rows={5}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="about-settings-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="about-settings-actions">
          <button
            type="button"
            className="about-settings-button about-settings-button--cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="about-settings-button about-settings-button--save"
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

export default AboutSettingsModal;
