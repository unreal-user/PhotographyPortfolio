import React, { useState, useEffect } from 'react';
import './AssignGalleryModal.css';

interface AssignGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (gallery: string) => void;
  existingGalleries: string[];
  selectedCount: number;
}

export const AssignGalleryModal: React.FC<AssignGalleryModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  existingGalleries,
  selectedCount
}) => {
  const [selectedGallery, setSelectedGallery] = useState<string>('');
  const [newGalleryName, setNewGalleryName] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGallery('');
      setNewGalleryName('');
      setIsCreatingNew(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveGallery = isCreatingNew ? newGalleryName.trim() : selectedGallery;
  const canAssign = effectiveGallery !== '';

  const handleGalleryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      setIsCreatingNew(true);
      setSelectedGallery('');
    } else {
      setIsCreatingNew(false);
      setSelectedGallery(value);
    }
  };

  const handleAssign = () => {
    if (canAssign) {
      onAssign(effectiveGallery);
    }
  };

  return (
    <div className="assign-gallery-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="assign-gallery-modal">
        <div className="assign-gallery-header">
          <h2>Assign to Gallery</h2>
          <button className="assign-gallery-close" onClick={onClose}>×</button>
        </div>

        <div className="assign-gallery-content">
          <p className="assign-gallery-description">
            Assign {selectedCount} selected photo{selectedCount !== 1 ? 's' : ''} to a gallery:
          </p>

          <div className="gallery-select-area">
            <label htmlFor="assign-gallery-select" className="gallery-select-label">
              Select Gallery:
            </label>
            <select
              id="assign-gallery-select"
              value={isCreatingNew ? '__new__' : selectedGallery}
              onChange={handleGalleryChange}
              className="gallery-select-dropdown"
            >
              <option value="">-- Select a gallery --</option>
              {existingGalleries.map(gallery => (
                <option key={gallery} value={gallery}>{gallery}</option>
              ))}
              <option value="__new__">+ Create New Gallery</option>
            </select>
            {isCreatingNew && (
              <input
                type="text"
                value={newGalleryName}
                onChange={(e) => setNewGalleryName(e.target.value)}
                placeholder="Enter new gallery name"
                className="new-gallery-input"
                autoFocus
              />
            )}
          </div>

          <div className="assign-gallery-actions">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!canAssign}
              className="btn-primary"
            >
              Assign to Gallery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
