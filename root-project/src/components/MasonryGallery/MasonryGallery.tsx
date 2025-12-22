import React from 'react';
import './MasonryGallery.css';

export interface MasonryGalleryProps {
  children: React.ReactNode;
  columns?: number; // Number of columns (responsive via CSS)
  gap?: string; // Gap between items (default: 16px)
}

export const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  children,
  columns = 3,
  gap = '16px'
}) => {
  return (
    <div
      className="masonry-gallery"
      style={{
        '--masonry-columns': columns,
        '--masonry-gap': gap
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};
