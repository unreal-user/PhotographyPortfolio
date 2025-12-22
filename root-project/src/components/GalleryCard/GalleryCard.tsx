import React from 'react';
import type { Photo } from '../../interfaces/Photo';
import './GalleryCard.css';

export interface GalleryCardProps {
  galleryName: string;
  photos: Photo[];
  featuredPhoto: Photo; // The cover image
  onClick: () => void;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  galleryName,
  photos,
  featuredPhoto,
  onClick
}) => {
  return (
    <article className="gallery-card" onClick={onClick}>
      <div className="gallery-card-image-wrapper">
        <img
          src={featuredPhoto.thumbnailUrl || featuredPhoto.fullResUrl}
          alt={featuredPhoto.alt}
          className="gallery-card-image"
          loading="lazy"
        />
        <div className="gallery-card-overlay">
          <h3 className="gallery-card-title">{galleryName}</h3>
          <p className="gallery-card-count">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</p>
        </div>
      </div>
    </article>
  );
};
