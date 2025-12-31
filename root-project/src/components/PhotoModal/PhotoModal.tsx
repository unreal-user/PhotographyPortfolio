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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom when photo changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [photo.photoId]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 }); // Reset position when fully zoomed out
      }
      return newScale;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => {
      const newScale = Math.max(1, Math.min(prev + delta, 4));
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale > 1) {
      e.preventDefault(); // Prevent default drag behavior
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={photo.fullResUrl}
              alt={photo.alt}
              onClick={handleImageClick}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              }}
            />
          </div>
          <figcaption className="modal-copyright">{photo.copyright}</figcaption>
        </figure>
      </div>
    </div>
  );
};
