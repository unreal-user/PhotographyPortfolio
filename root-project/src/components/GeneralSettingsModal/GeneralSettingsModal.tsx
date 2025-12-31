import React, { useState, useEffect } from 'react';
import { extendedSettingsApi, ThemeMode } from '../../services/photoApi';
import './GeneralSettingsModal.css';

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [theme, setTheme] = useState<ThemeMode>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await extendedSettingsApi.getGeneralSettings();
      setTheme(settings.theme || 'auto');
    } catch (err) {
      // Use localStorage fallback
      const savedTheme = localStorage.getItem('theme') as ThemeMode;
      setTheme(savedTheme || 'auto');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (newTheme: ThemeMode) => {
    if (newTheme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await extendedSettingsApi.updateGeneralSettings({ theme });
      onSettingsUpdated();
      onClose();
    } catch (err) {
      // Save to localStorage as fallback
      localStorage.setItem('theme', theme);
      onSettingsUpdated();
      onClose();
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

  if (!isOpen) return null;

  return (
    <div className="general-settings-backdrop" onClick={handleBackdropClick}>
      <div className="general-settings-modal">
        <div className="general-settings-header">
          <h2>General Settings</h2>
          <button
            type="button"
            className="general-settings-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="general-settings-content">
          {isLoading ? (
            <div className="general-settings-loading">Loading settings...</div>
          ) : (
            <>
              <div className="general-settings-form-group">
                <label className="general-settings-label">Theme</label>
                <p className="general-settings-hint">
                  Choose how the site appears to visitors
                </p>

                <div className="theme-options">
                  <label className={`theme-option ${theme === 'auto' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="auto"
                      checked={theme === 'auto'}
                      onChange={() => handleThemeChange('auto')}
                      disabled={isSaving}
                    />
                    <div className="theme-option-content">
                      <span className="theme-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="4"/>
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        </svg>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '-8px' }}>
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      </span>
                      <span className="theme-option-label">Auto</span>
                      <span className="theme-option-description">Follow system preference</span>
                    </div>
                  </label>

                  <label className={`theme-option ${theme === 'light' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={theme === 'light'}
                      onChange={() => handleThemeChange('light')}
                      disabled={isSaving}
                    />
                    <div className="theme-option-content">
                      <span className="theme-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="4"/>
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        </svg>
                      </span>
                      <span className="theme-option-label">Light</span>
                      <span className="theme-option-description">Always use light theme</span>
                    </div>
                  </label>

                  <label className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={theme === 'dark'}
                      onChange={() => handleThemeChange('dark')}
                      disabled={isSaving}
                    />
                    <div className="theme-option-content">
                      <span className="theme-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      </span>
                      <span className="theme-option-label">Dark</span>
                      <span className="theme-option-description">Always use dark theme</span>
                    </div>
                  </label>
                </div>
              </div>

              {error && (
                <div className="general-settings-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="general-settings-actions">
          <button
            type="button"
            className="general-settings-button general-settings-button--cancel"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="general-settings-button general-settings-button--save"
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

export default GeneralSettingsModal;
