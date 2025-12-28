import React, { useState, useEffect } from 'react';
import type { Photo } from '../interfaces/Photo';
import { photoApi, settingsApi, type HeroSettings } from '../services/photoApi';
import { Hero } from '../components/Hero/Hero';
import { MasonryGallery } from '../components/MasonryGallery/MasonryGallery';
import { PhotoThumbnail } from '../components/PhotoThumbnail/PhotoThumbnail';
import { PhotoModal } from '../components/PhotoModal/PhotoModal';
import '../components/PhotoThumbnail/PhotoThumbnail.css';

const HomePage = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    settingId: 'hero',
    title: 'Photography Portfolio',
    subtitle: 'Capturing life one frame at a time',
    heroImageUrl: null,
  });

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    try {
      // Fetch hero settings and photos in parallel
      const [settings, photosResponse] = await Promise.all([
        settingsApi.getHeroSettings().catch(() => heroSettings), // Use defaults on error
        photoApi.listPhotos('published', 12),
      ]);

      setHeroSettings(settings);
      setPhotos(photosResponse.photos);
    } catch (error) {
      console.error('Error loading page data:', error);
      // Silently fail - just show empty state
    } finally {
      setIsLoading(false);
    }
  };

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
        imageUrl={heroSettings.heroImageUrl || undefined}
        title={heroSettings.title}
        subtitle={heroSettings.subtitle}
        isLoading={isLoading}
      />

      {isLoading ? (
        <MasonryGallery columns={3} gap="16px">
          {[1, 2, 3].map((i) => (
            <div key={i} className="photo-thumbnail-skeleton" />
          ))}
        </MasonryGallery>
      ) : photos.length > 0 ? (
        <MasonryGallery columns={3} gap="16px">
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
