import React from 'react';
import type { Photo } from '../../interfaces/Photo';
import StatusBadge from '../StatusBadge/StatusBadge';
import './PhotoCard.css';

interface PhotoCardProps {
  photo: Photo;
  onView: () => void;
  onEdit: () => void;
  onPublish?: () => void; // Only for pending photos
  onArchive: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onView,
  onEdit,
  onPublish,
  onArchive,
}) => {
  // Generate image URL from S3 key
  // TODO: Replace with CloudFront URL from env when available
  // For now, use originalKey directly (will work after deployment)
  const imageUrl = photo.thumbnailUrl || photo.fullResUrl || `/api/photos/${photo.originalKey}`;

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="photo-card">
      <div className="photo-card-image-wrapper" onClick={onView}>
        <img
          src={imageUrl}
          alt={photo.alt}
          className="photo-card-image"
          loading="lazy"
        />
        <div className="photo-card-overlay">
          <StatusBadge status={photo.status} />
        </div>
      </div>

      <div className="photo-card-content">
        <h3 className="photo-card-title">{photo.title}</h3>

        <div className="photo-card-meta">
          <span className="photo-card-date">
            {formatDate(photo.uploadDate)}
          </span>
          {photo.gallery && (
            <span className="photo-card-gallery">{photo.gallery}</span>
          )}
        </div>

        {photo.description && (
          <p className="photo-card-description">{photo.description}</p>
        )}

        <div className="photo-card-actions">
          <button
            type="button"
            className="photo-card-button photo-card-button--secondary"
            onClick={onEdit}
          >
            Edit
          </button>

          {photo.status === 'pending' && onPublish && (
            <button
              type="button"
              className="photo-card-button photo-card-button--primary"
              onClick={onPublish}
            >
              Publish
            </button>
          )}

          <button
            type="button"
            className="photo-card-button photo-card-button--danger"
            onClick={onArchive}
          >
            {photo.status === 'archived' ? 'Delete' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
