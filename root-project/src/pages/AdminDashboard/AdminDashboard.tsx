import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi } from '../../services/photoApi';
import PhotoCard from '../../components/PhotoCard/PhotoCard';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import EditPhotoModal from '../../components/EditPhotoModal/EditPhotoModal';
import { BatchUploadModal } from '../../components/BatchUploadModal/BatchUploadModal';
import { AssignGalleryModal } from '../../components/AssignGalleryModal/AssignGalleryModal';
import HeroSettingsModal from '../../components/HeroSettingsModal/HeroSettingsModal';
import AboutSettingsModal from '../../components/AboutSettingsModal/AboutSettingsModal';
import ContactSettingsModal from '../../components/ContactSettingsModal/ContactSettingsModal';
import GeneralSettingsModal from '../../components/GeneralSettingsModal/GeneralSettingsModal';
import './AdminDashboard.css';

type PhotoStatus = 'pending' | 'published' | 'archived';
type TabType = PhotoStatus | 'settings';

const AdminDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allGalleries, setAllGalleries] = useState<string[]>([]); // All galleries across all tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGallery, setSelectedGallery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 6d: Selection state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [showAssignGalleryModal, setShowAssignGalleryModal] = useState(false);
  const [showHeroSettingsModal, setShowHeroSettingsModal] = useState(false);
  const [showAboutSettingsModal, setShowAboutSettingsModal] = useState(false);
  const [showContactSettingsModal, setShowContactSettingsModal] = useState(false);
  const [showGeneralSettingsModal, setShowGeneralSettingsModal] = useState(false);

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

  // Load all galleries on mount (from pending + published)
  useEffect(() => {
    loadAllGalleries();
  }, []);

  // Load photos when tab changes (except for settings tab)
  useEffect(() => {
    if (activeTab !== 'settings') {
      loadPhotos();
      setSelectedPhotoIds(new Set()); // Clear selection on tab change
      setSearchQuery(''); // Clear search on tab change
      setSelectedGallery(''); // Clear gallery filter on tab change
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

  const loadAllGalleries = async () => {
    try {
      // Fetch from both pending and published to get all galleries
      const [pendingResponse, publishedResponse] = await Promise.all([
        photoApi.listPhotos('pending', 100),
        photoApi.listPhotos('published', 100)
      ]);

      const allPhotos = [...pendingResponse.photos, ...publishedResponse.photos];
      const galleries = Array.from(new Set(
        allPhotos
          .map(p => p.gallery)
          .filter((g): g is string => !!g && g !== '' && g !== 'Uncategorized')
      )).sort();

      setAllGalleries(galleries);
    } catch (err) {
      console.error('Error loading galleries:', err);
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

  const handleBulkAssignGallery = () => {
    if (selectedPhotoIds.size === 0) return;
    if (selectedPhotoIds.size > 100) {
      alert('Maximum 100 photos can be bulk updated at once. Please select fewer photos.');
      return;
    }
    setShowAssignGalleryModal(true);
  };

  const handleAssignGalleryConfirm = async (galleryName: string) => {
    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { gallery: galleryName });
      setSelectedPhotoIds(new Set());
      setShowAssignGalleryModal(false);
      loadPhotos();
      loadAllGalleries(); // Refresh galleries in case new one was created
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

  // Extract unique galleries from current photos (including Uncategorized)
  const galleries = Array.from(new Set(
    photos
      .map(p => p.gallery || 'Uncategorized')
      .filter(g => g !== '')
  )).sort();

  // Filter photos by search query and gallery
  const filteredPhotos = photos.filter((photo) => {
    const matchesSearch = photo.title.toLowerCase().includes(searchQuery.toLowerCase());
    const photoGallery = photo.gallery || 'Uncategorized';
    const matchesGallery = !selectedGallery || photoGallery === selectedGallery;
    return matchesSearch && matchesGallery;
  });

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

      {/* Search and Filter Bar - Only show when not in settings tab */}
      {activeTab !== 'settings' && (
        <div className="admin-dashboard-filters">
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

          {/* Gallery Filter */}
          {galleries.length > 0 && (
            <select
              value={selectedGallery}
              onChange={(e) => setSelectedGallery(e.target.value)}
              className="admin-dashboard-gallery-select"
            >
              <option value="">All Galleries</option>
              {galleries.map((gallery) => (
                <option key={gallery} value={gallery}>
                  {gallery}
                </option>
              ))}
            </select>
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
            <h3>General</h3>
            <p>Site-wide settings including theme preferences.</p>
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={() => setShowGeneralSettingsModal(true)}
            >
              Edit General Settings
            </button>
          </div>

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

          <div className="admin-settings-card">
            <h3>Portfolio Page</h3>
            <p>Configure the Portfolio page layout and gallery display options.</p>
            <button
              type="button"
              className="admin-dashboard-upload-button"
              disabled
            >
              Coming Soon
            </button>
          </div>

          <div className="admin-settings-card">
            <h3>Contact Page</h3>
            <p>Configure the Contact page hero image and text.</p>
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={() => setShowContactSettingsModal(true)}
            >
              Edit Contact Page Settings
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
        title={
          confirmDialog.action === 'publish'
            ? 'Publish Photo?'
            : confirmDialog.photo?.status === 'archived'
            ? 'Delete Photo?'
            : 'Archive Photo?'
        }
        message={
          confirmDialog.action === 'publish'
            ? 'This will move the photo from uploads/ to originals/ and make it visible on the public portfolio.'
            : confirmDialog.photo?.status === 'archived'
            ? 'This will permanently delete the photo.'
            : 'This will move the photo to the archive. You can restore it later.'
        }
        confirmLabel={
          confirmDialog.action === 'publish'
            ? 'Publish'
            : confirmDialog.photo?.status === 'archived'
            ? 'Delete'
            : 'Archive'
        }
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
        onComplete={() => {
          loadPhotos();
          loadAllGalleries(); // Refresh galleries in case new one was created
        }}
        existingGalleries={allGalleries}
      />

      <AssignGalleryModal
        isOpen={showAssignGalleryModal}
        onClose={() => setShowAssignGalleryModal(false)}
        onAssign={handleAssignGalleryConfirm}
        existingGalleries={allGalleries}
        selectedCount={selectedPhotoIds.size}
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

      <ContactSettingsModal
        isOpen={showContactSettingsModal}
        onClose={() => setShowContactSettingsModal(false)}
        onSettingsUpdated={() => setShowContactSettingsModal(false)}
      />

      <GeneralSettingsModal
        isOpen={showGeneralSettingsModal}
        onClose={() => setShowGeneralSettingsModal(false)}
        onSettingsUpdated={() => setShowGeneralSettingsModal(false)}
      />
    </div>
  );
};

export default AdminDashboard;
