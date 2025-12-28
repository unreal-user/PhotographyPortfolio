import React, { useState, useEffect } from 'react';
import type { Photo } from '../interfaces/Photo';
import { photoApi, settingsApi, type HeroSettings } from '../services/photoApi';
import { Hero } from '../components/Hero/Hero';
import { MasonryGallery } from '../components/MasonryGallery/MasonryGallery';
import { PhotoThumbnail } from '../components/PhotoThumbnail/PhotoThumbnail';
import { PhotoModal } from '../components/PhotoModal/PhotoModal';

const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1756142754696-2bc410d5b248?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

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
        imageUrl={heroSettings.heroImageUrl || DEFAULT_HERO_IMAGE}
        title={heroSettings.title}
        subtitle={heroSettings.subtitle}
      />

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          Loading photos...
        </div>
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
