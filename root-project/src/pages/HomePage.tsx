import React, { useState } from 'react';
import useSWR from 'swr';
import type { Photo } from '../interfaces/Photo';
import { photoApi, settingsApi, type HeroSettings } from '../services/photoApi';
import { Hero } from '../components/Hero/Hero';
import { MasonryGallery } from '../components/MasonryGallery/MasonryGallery';
import { PhotoThumbnail } from '../components/PhotoThumbnail/PhotoThumbnail';
import { PhotoModal } from '../components/PhotoModal/PhotoModal';
import '../components/PhotoThumbnail/PhotoThumbnail.css';

const defaultHeroSettings: HeroSettings = {
  settingId: 'hero',
  title: 'Photography Portfolio',
  subtitle: 'Capturing life one frame at a time',
  heroImageUrl: null,
  galleryColumns: 3,
  fitImageToContainer: false,
};

const HomePage = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Fetch hero settings with SWR
  const { data: heroSettings, isLoading: heroLoading } = useSWR(
    'heroSettings',
    () => settingsApi.getHeroSettings().catch(() => defaultHeroSettings)
  );

  // Fetch photos with SWR
  const { data: photosData, isLoading: photosLoading } = useSWR(
    'homePhotos',
    () => photoApi.listPhotos('published', 12)
  );

  const isLoading = heroLoading || photosLoading;
  const photos = photosData?.photos ?? [];
  const settings = heroSettings ?? defaultHeroSettings;
  const galleryColumns = settings.galleryColumns ?? 3;

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
    <>
      <Hero
        imageUrl={settings.heroImageUrl || undefined}
        title={settings.title}
        subtitle={settings.subtitle}
        isLoading={isLoading}
        fitImageToContainer={settings.fitImageToContainer}
      />

      {isLoading ? (
        <MasonryGallery columns={galleryColumns} gap="16px">
          {Array.from({ length: galleryColumns }, (_, i) => (
            <div key={i} className="photo-thumbnail-skeleton" />
          ))}
        </MasonryGallery>
      ) : photos.length > 0 ? (
        <MasonryGallery columns={galleryColumns} gap="16px">
          {photos.map((photo) => (
            <PhotoThumbnail
              key={photo.photoId}
              photo={photo}
              onClick={() => handleThumbnailClick(photo)}
            />
          ))}
        </MasonryGallery>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          No photos available yet.
        </div>
      )}

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={handleCloseModal}
          onBackdropClick={handleBackdropClick}
        />
      )}
    </>
  );
};

export default HomePage;
