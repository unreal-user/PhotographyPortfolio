import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi } from '../../services/photoApi';
import PhotoCard from '../../components/PhotoCard/PhotoCard';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import EditPhotoModal from '../../components/EditPhotoModal/EditPhotoModal';
import { BatchUploadModal } from '../../components/BatchUploadModal/BatchUploadModal';
import HeroSettingsModal from '../../components/HeroSettingsModal/HeroSettingsModal';
import AboutSettingsModal from '../../components/AboutSettingsModal/AboutSettingsModal';
import './AdminDashboard.css';

type PhotoStatus = 'pending' | 'published' | 'archived';
type TabType = PhotoStatus | 'settings';

const AdminDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 6d: Selection state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [showHeroSettingsModal, setShowHeroSettingsModal] = useState(false);
  const [showAboutSettingsModal, setShowAboutSettingsModal] = useState(false);

  // Modal states
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    photo: Photo | null;
    action: 'publish' | 'archive' | null;
  }>({
    isOpen: false,
    photo: null,
    action: null,
  });

  // Load photos when tab changes (except for settings tab)
  useEffect(() => {
    if (activeTab !== 'settings') {
      loadPhotos();
      setSelectedPhotoIds(new Set()); // Clear selection on tab change
      setSearchQuery(''); // Clear search on tab change
    }
  }, [activeTab]);

  const loadPhotos = async () => {
    // Type guard: ensure activeTab is a valid PhotoStatus
    if (activeTab === 'settings') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await photoApi.listPhotos(activeTab, 100);
      setPhotos(response.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      console.error('Error loading photos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 6d: Selection handlers
  const handleSelect = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (filteredPhotos: Photo[]) => {
    if (selectedPhotoIds.size === filteredPhotos.length && filteredPhotos.length > 0) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(filteredPhotos.map(p => p.photoId)));
    }
  };

  // Phase 6d: Bulk actions
  const handleBulkPublish = async () => {
    if (selectedPhotoIds.size === 0) return;
    if (selectedPhotoIds.size > 100) {
      alert('Maximum 100 photos can be bulk updated at once. Please select fewer photos.');
      return;
    }

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { status: 'published' });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish photos');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedPhotoIds.size === 0) return;
    if (selectedPhotoIds.size > 100) {
      alert('Maximum 100 photos can be bulk updated at once. Please select fewer photos.');
      return;
    }

    if (!confirm(`Archive ${selectedPhotoIds.size} photo(s)?`)) return;

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { status: 'archived' });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive photos');
    }
  };

  const handleBulkAssignGallery = async () => {
    if (selectedPhotoIds.size === 0) return;
    if (selectedPhotoIds.size > 100) {
      alert('Maximum 100 photos can be bulk updated at once. Please select fewer photos.');
      return;
    }

    // Get unique galleries from current photos
    const existingGalleries = Array.from(new Set(
      photos
        .map(p => p.gallery)
        .filter(g => g && g !== 'Uncategorized')
    )).sort();

    // Create select dropdown HTML
    const gallerySelectHTML = `
      <div>
        <label for="gallery-select" style="display: block; margin-bottom: 8px;">Select gallery:</label>
        <select id="gallery-select" style="width: 100%; padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc;">
          ${existingGalleries.map(g => `<option value="${g}">${g}</option>`).join('')}
          <option value="__custom__">+ New Gallery</option>
        </select>
        <input id="custom-gallery" type="text" placeholder="Enter new gallery name" style="width: 100%; margin-top: 8px; padding: 8px; font-size: 14px; border-radius: 4px; border: 1px solid #ccc; display: none;">
      </div>
    `;

    // Show custom input when "New Gallery" is selected
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = gallerySelectHTML;
    const selectEl = tempDiv.querySelector('#gallery-select') as HTMLSelectElement;
    const customInputEl = tempDiv.querySelector('#custom-gallery') as HTMLInputElement;

    if (selectEl && customInputEl) {
      selectEl.addEventListener('change', () => {
        if (selectEl.value === '__custom__') {
          customInputEl.style.display = 'block';
        } else {
          customInputEl.style.display = 'none';
        }
      });
    }

    // Simple prompt-based approach (can be enhanced with a proper modal later)
    const galleryName = prompt(
      `Assign ${selectedPhotoIds.size} photo(s) to gallery:\n\nExisting galleries: ${existingGalleries.length > 0 ? existingGalleries.join(', ') : 'None'}\n\nEnter gallery name:`
    );

    if (!galleryName || galleryName.trim() === '') return;

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { gallery: galleryName.trim() });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign gallery');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.size === 0) return;

    if (!confirm(`Permanently delete ${selectedPhotoIds.size} photo(s)? This cannot be undone.`)) return;

    try {
      // Delete photos one by one
      await Promise.all(
        Array.from(selectedPhotoIds).map(photoId => photoApi.deletePhoto(photoId))
      );
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photos');
    }
  };

  const handlePublish = (photo: Photo) => {
    setConfirmDialog({
      isOpen: true,
      photo,
      action: 'publish',
    });
  };

  const handleArchive = (photo: Photo) => {
    setConfirmDialog({
      isOpen: true,
      photo,
      action: 'archive',
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.photo) return;

    try {
      if (confirmDialog.action === 'publish') {
        await photoApi.updatePhoto(confirmDialog.photo.photoId, { status: 'published' });
      } else if (confirmDialog.action === 'archive') {
        await photoApi.deletePhoto(confirmDialog.photo.photoId);
      }

      // Close dialog and reload photos
      setConfirmDialog({ isOpen: false, photo: null, action: null });
      loadPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      console.error('Error performing action:', err);
    }
  };

  const handleCancelAction = () => {
    setConfirmDialog({ isOpen: false, photo: null, action: null });
  };

  const handleView = (photo: Photo) => {
    console.log('View photo:', photo.photoId);
  };

  const handleEdit = (photo: Photo) => {
    setSelectedPhoto(photo);
    setShowEditModal(true);
  };

  const handleUploadClick = () => {
    setShowBatchUploadModal(true);
  };

  const hasSelection = selectedPhotoIds.size > 0;

  // Filter photos by search query
  const filteredPhotos = photos.filter((photo) =>
    photo.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-dashboard-header-actions">
          {hasSelection ? (
            <>
              <span className="selection-count">{selectedPhotoIds.size} selected</span>
              <button type="button" className="btn-select-all" onClick={() => handleSelectAll(filteredPhotos)}>
                {selectedPhotoIds.size === filteredPhotos.length && filteredPhotos.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              {activeTab === 'archived' ? (
                <>
                  <button type="button" className="btn-bulk-action" onClick={handleBulkPublish}>
                    Publish Selected
                  </button>
                  <button type="button" className="btn-bulk-action btn-bulk-action--danger" onClick={handleBulkDelete}>
                    Delete Selected
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-bulk-action" onClick={handleBulkPublish}>
                    Publish Selected
                  </button>
                  <button type="button" className="btn-bulk-action" onClick={handleBulkArchive}>
                    Archive Selected
                  </button>
                  <button type="button" className="btn-bulk-action" onClick={handleBulkAssignGallery}>
                    Assign Gallery
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn-select-all" onClick={() => handleSelectAll(filteredPhotos)}>
                Select All
              </button>
              <button type="button" className="admin-dashboard-upload-button" onClick={handleUploadClick}>
                Upload Photos
              </button>
            </>
          )}
        </div>
      </div>

      <div className="admin-dashboard-tabs">
        <button
          type="button"
          className={`admin-dashboard-tab ${activeTab === 'pending' ? 'admin-dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button
          type="button"
          className={`admin-dashboard-tab ${activeTab === 'published' ? 'admin-dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('published')}
        >
          Published
        </button>
        <button
          type="button"
          className={`admin-dashboard-tab ${activeTab === 'archived' ? 'admin-dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          Archived
        </button>
        <button
          type="button"
          className={`admin-dashboard-tab ${activeTab === 'settings' ? 'admin-dashboard-tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Search Bar - Only show when not in settings tab */}
      {activeTab !== 'settings' && (
        <div className="admin-dashboard-search">
          <input
            type="text"
            placeholder="Search photos by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-dashboard-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="admin-dashboard-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {activeTab === 'settings' ? (
        <div className="admin-dashboard-settings">
          <div className="admin-settings-card">
            <h3>Home Page</h3>
            <p>Configure the main image, title, and subtitle shown on the homepage.</p>
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={() => setShowHeroSettingsModal(true)}
            >
              Edit Home Page Settings
            </button>
          </div>

          <div className="admin-settings-card">
            <h3>About Page</h3>
            <p>Configure the About page hero section and content sections.</p>
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={() => setShowAboutSettingsModal(true)}
            >
              Edit About Page Settings
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="admin-dashboard-loading">
          <p>Loading photos...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="admin-dashboard-empty">
          <p>No {activeTab} photos yet.</p>
          {activeTab === 'pending' && (
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={handleUploadClick}
            >
              Upload Photos
            </button>
          )}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="admin-dashboard-empty">
          <p>No photos match your search.</p>
          <button
            type="button"
            className="admin-dashboard-upload-button"
            onClick={() => setSearchQuery('')}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <>
          {searchQuery && (
            <div className="admin-dashboard-search-results">
              Showing {filteredPhotos.length} of {photos.length} photos
            </div>
          )}
          <div className="admin-dashboard-grid">
            {filteredPhotos.map((photo) => (
            <PhotoCard
              key={photo.photoId}
              photo={photo}
              onView={() => handleView(photo)}
              onEdit={() => handleEdit(photo)}
              onPublish={photo.status === 'pending' || photo.status === 'archived' ? () => handlePublish(photo) : undefined}
              onArchive={() => handleArchive(photo)}
              isSelected={selectedPhotoIds.has(photo.photoId)}
              onSelect={handleSelect}
            />
          ))}
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'publish' ? 'Publish Photo?' : 'Archive Photo?'}
        message={
          confirmDialog.action === 'publish'
            ? 'This will move the photo from uploads/ to originals/ and make it visible on the public portfolio.'
            : confirmDialog.photo?.status === 'archived'
            ? 'This will permanently delete the photo.'
            : 'This will move the photo to the archive. You can restore it later.'
        }
        confirmLabel={confirmDialog.action === 'publish' ? 'Publish' : 'Archive'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        variant={confirmDialog.action === 'publish' ? 'info' : 'danger'}
      />

      <EditPhotoModal
        isOpen={showEditModal}
        photo={selectedPhoto}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPhoto(null);
        }}
        onPhotoUpdated={loadPhotos}
      />

      <BatchUploadModal
        isOpen={showBatchUploadModal}
        onClose={() => setShowBatchUploadModal(false)}
        onComplete={loadPhotos}
      />

      <HeroSettingsModal
        isOpen={showHeroSettingsModal}
        onClose={() => setShowHeroSettingsModal(false)}
        onSettingsUpdated={() => setShowHeroSettingsModal(false)}
      />

      <AboutSettingsModal
        isOpen={showAboutSettingsModal}
        onClose={() => setShowAboutSettingsModal(false)}
        onSettingsUpdated={() => setShowAboutSettingsModal(false)}
      />
    </div>
  );
};

export default AdminDashboard;
