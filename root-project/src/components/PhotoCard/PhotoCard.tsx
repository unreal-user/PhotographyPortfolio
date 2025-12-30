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
  isSelected?: boolean; // Phase 6d: Checkbox selection
  onSelect?: (photoId: string) => void; // Phase 6d: Checkbox selection
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onEdit,
  onPublish,
  onArchive,
  isSelected = false,
  onSelect,
}) => {
  // Generate image URL from S3 key
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

  // Handle card click for selection (Phase 6d)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle selection if clicking on a button
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    onSelect?.(photo.photoId);
  };

  return (
    <div
      className={`photo-card ${isSelected ? 'photo-card--selected' : ''}`}
      onClick={handleCardClick}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      {onSelect && (
        <div className="photo-card-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(photo.photoId)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="photo-card-image-wrapper">
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
