import React, { useState, useEffect } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { photoApi } from '../../services/photoApi';
import PhotoCard from '../../components/PhotoCard/PhotoCard';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import UploadPhotoModal from '../../components/UploadPhotoModal/UploadPhotoModal';
import EditPhotoModal from '../../components/EditPhotoModal/EditPhotoModal';
import './AdminDashboard.css';

type TabType = 'pending' | 'published' | 'archived';

const AdminDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states (placeholders for Phase 6.4-6.5)
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
  }, [activeTab]);

  const loadPhotos = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await photoApi.listPhotos(activeTab);
      setPhotos(response.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      console.error('Error loading photos:', err);
    } finally {
      setIsLoading(false);
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
    // TODO: Phase 6.4 - Open photo modal
    console.log('View photo:', photo.photoId);
  };

  const handleEdit = (photo: Photo) => {
    setSelectedPhoto(photo);
    setShowEditModal(true);
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <button
          type="button"
          className="admin-dashboard-upload-button"
          onClick={handleUploadClick}
        >
          Upload Photo
        </button>
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
            <button
              type="button"
              className="admin-dashboard-upload-button"
              onClick={handleUploadClick}
            >
              Upload Your First Photo
            </button>
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
    </div>
  );
};

export default AdminDashboard;
