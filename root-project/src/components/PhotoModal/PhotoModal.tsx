import { useState, useRef, useEffect } from "react";
import type { Photo } from "../../interfaces/Photo";
import './PhotoModal.css';

export interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ photo, onClose, onBackdropClick }) => {
  const [scale, setScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom when photo changes
  useEffect(() => {
    setScale(1);
  }, [photo.photoId]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleReset = () => {
    setScale(1);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(1, Math.min(prev + delta, 4)));
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle between fit and 2x zoom
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onBackdropClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        {/* Zoom Controls */}
        <div className="modal-zoom-controls">
          <button
            onClick={handleZoomIn}
            disabled={scale >= 4}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            disabled={scale === 1}
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            ⟲
          </button>
          <span className="modal-zoom-level">{Math.round(scale * 100)}%</span>
        </div>

        <figure className="modal-figure">
          <div
            className={`modal-image-container ${scale > 1 ? 'zoomed' : ''}`}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={photo.fullResUrl}
              alt={photo.alt}
              onClick={handleImageClick}
              style={{
                transform: `scale(${scale})`,
                cursor: scale === 1 ? 'zoom-in' : 'zoom-out',
              }}
            />
          </div>
          <figcaption className="modal-copyright">{photo.copyright}</figcaption>
        </figure>
      </div>
    </div>
  );
};
