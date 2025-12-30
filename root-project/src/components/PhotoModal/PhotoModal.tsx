import type { Photo } from "../../interfaces/Photo";
import './PhotoModal.css';

export interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({ photo, onClose, onBackdropClick }) => {
  return (
    <div className="modal-backdrop" onClick={onBackdropClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>
        <figure className="modal-figure">
          <img src={photo.fullResUrl} alt={photo.alt} />
          <figcaption className="modal-copyright">{photo.copyright}</figcaption>
        </figure>
      </div>
    </div>
  );
};
