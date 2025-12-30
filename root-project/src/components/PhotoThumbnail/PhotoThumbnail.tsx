import type { Photo } from "../../interfaces/Photo";
import './PhotoThumbnail.css';

export interface PhotoThumbnailProps {
  photo: Photo;
  onClick: () => void;
}

export const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ photo, onClick }) => {
  return (
    <article className="photo-thumbnail" onClick={onClick}>
      <img src={photo.thumbnailUrl} alt={photo.alt} />
    </article>
  );
};

