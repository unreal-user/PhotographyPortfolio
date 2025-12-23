import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi } from '../../services/photoApi';
import PhotoCard from '../../components/PhotoCard/PhotoCard';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import UploadPhotoModal from '../../components/UploadPhotoModal/UploadPhotoModal';
import EditPhotoModal from '../../components/EditPhotoModal/EditPhotoModal';
import { BatchUploadModal } from '../../components/BatchUploadModal/BatchUploadModal';
import './AdminDashboard.css';

type TabType = 'pending' | 'published' | 'archived';

const AdminDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 6d: Selection state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
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

  // Load photos when tab changes
  useEffect(() => {
    loadPhotos();
    setSelectedPhotoIds(new Set()); // Clear selection on tab change
  }, [activeTab]);

  const loadPhotos = async () => {
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

  const handleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.photoId)));
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
    setShowUploadModal(true);
  };

  const handleBatchUploadClick = () => {
    setShowBatchUploadModal(true);
  };

  const hasSelection = selectedPhotoIds.size > 0;

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-dashboard-header-actions">
          {hasSelection ? (
            <>
              <span className="selection-count">{selectedPhotoIds.size} selected</span>
              <button type="button" className="btn-select-all" onClick={handleSelectAll}>
                {selectedPhotoIds.size === photos.length ? 'Deselect All' : 'Select All'}
              </button>
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
          ) : (
            <>
              <button type="button" className="btn-select-all" onClick={handleSelectAll}>
                Select All
              </button>
              <button type="button" className="admin-dashboard-upload-button" onClick={handleUploadClick}>
                Upload Photo
              </button>
              <button type="button" className="admin-dashboard-upload-button" onClick={handleBatchUploadClick}>
                Batch Upload
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
      </div>

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="admin-dashboard-loading">
          <p>Loading photos...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="admin-dashboard-empty">
          <p>No {activeTab} photos yet.</p>
          {activeTab === 'pending' && (
            <>
              <button
                type="button"
                className="admin-dashboard-upload-button"
                onClick={handleUploadClick}
              >
                Upload Your First Photo
              </button>
              <button
                type="button"
                className="admin-dashboard-upload-button"
                onClick={handleBatchUploadClick}
                style={{ marginLeft: '1rem' }}
              >
                Batch Upload
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="admin-dashboard-grid">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.photoId}
              photo={photo}
              onView={() => handleView(photo)}
              onEdit={() => handleEdit(photo)}
              onPublish={photo.status === 'pending' ? () => handlePublish(photo) : undefined}
              onArchive={() => handleArchive(photo)}
              isSelected={selectedPhotoIds.has(photo.photoId)}
              onSelect={handleSelect}
            />
          ))}
        </div>
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

      <UploadPhotoModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onPhotoUploaded={loadPhotos}
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
    </div>
  );
};

export default AdminDashboard;
