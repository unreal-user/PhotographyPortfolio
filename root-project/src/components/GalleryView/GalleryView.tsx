import React, { useState } from 'react';
import type { Photo } from '../../interfaces/Photo';
import { MasonryGallery } from '../MasonryGallery/MasonryGallery';
import { PhotoThumbnail } from '../PhotoThumbnail/PhotoThumbnail';
import { PhotoModal } from '../PhotoModal/PhotoModal';
import './GalleryView.css';

export interface GalleryViewProps {
  galleryName: string;
  photos: Photo[];
  onBack: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  galleryName,
  photos,
  onBack
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const handleThumbnailClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  return (
    <div className="gallery-view">
      <header className="gallery-view-header">
        <button
          className="gallery-view-back-button"
          onClick={onBack}
          aria-label="Back to galleries"
        >
          ← Back
        </button>
        <h1 className="gallery-view-title">{galleryName}</h1>
        <p className="gallery-view-count">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </p>
      </header>

      <MasonryGallery columns={3} gap="16px">
        {photos.map((photo) => (
          <PhotoThumbnail
            key={photo.photoId}
            photo={photo}
            onClick={() => handleThumbnailClick(photo)}
          />
        ))}
      </MasonryGallery>

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={handleCloseModal}
          onBackdropClick={handleBackdropClick}
        />
      )}
    </div>
  );
};
