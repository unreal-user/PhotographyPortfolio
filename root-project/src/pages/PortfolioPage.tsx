import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Photo } from '../interfaces/Photo';
import { photoApi } from '../services/photoApi';
import { MasonryGallery } from '../components/MasonryGallery/MasonryGallery';
import { GalleryCard } from '../components/GalleryCard/GalleryCard';
import { GalleryView } from '../components/GalleryView/GalleryView';
import './PortfolioPage.css';

interface Gallery {
  name: string;
  photos: Photo[];
  featuredPhoto: Photo;
}

const PortfolioPage: React.FC = () => {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  // Reset to gallery list when navigating to portfolio via header
  useEffect(() => {
    const state = location.state as { resetKey?: number } | null;
    if (state?.resetKey) {
      setSelectedGallery(null);
      window.scrollTo(0, 0);
    }
  }, [location.state]);

  useEffect(() => {
    loadGalleries();
  }, []);

  const loadGalleries = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all published photos
      const response = await photoApi.listPhotos('published', 100);
      const photos = response.photos;

      // Group photos by gallery name
      const galleryMap = new Map<string, Photo[]>();

      photos.forEach(photo => {
        const galleryName = photo.gallery || 'Uncategorized';
        if (!galleryMap.has(galleryName)) {
          galleryMap.set(galleryName, []);
        }
        galleryMap.get(galleryName)!.push(photo);
      });

      // Convert to Gallery objects with featured photo (first photo in each gallery)
      const galleriesArray: Gallery[] = Array.from(galleryMap.entries()).map(([name, photos]) => ({
        name,
        photos,
        featuredPhoto: photos[0] // Use first photo as featured
      }));

      // Sort galleries alphabetically
      galleriesArray.sort((a, b) => a.name.localeCompare(b.name));

      setGalleries(galleriesArray);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load galleries');
      console.error('Error loading galleries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGalleryClick = (gallery: Gallery) => {
    setSelectedGallery(gallery);
  };

  const handleBackToGalleries = () => {
    setSelectedGallery(null);
  };

  // If viewing a specific gallery
  if (selectedGallery) {
    return (
      <GalleryView
        galleryName={selectedGallery.name}
        photos={selectedGallery.photos}
        onBack={handleBackToGalleries}
      />
    );
  }

  // Main portfolio view
  return (
    <div className="portfolio-page">
      <header className="portfolio-page-header">
        <h1 className="portfolio-page-title">Portfolio</h1>
        <p className="portfolio-page-subtitle">Explore my photography galleries</p>
      </header>

      {error && (
        <div className="portfolio-page-error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="portfolio-page-loading">
          <p>Loading galleries...</p>
        </div>
      ) : galleries.length === 0 ? (
        <div className="portfolio-page-empty">
          <p>No galleries available yet. Check back soon!</p>
        </div>
      ) : (
        <MasonryGallery columns={3} gap="24px">
          {galleries.map((gallery) => (
            <GalleryCard
              key={gallery.name}
              galleryName={gallery.name}
              photos={gallery.photos}
              featuredPhoto={gallery.featuredPhoto}
              onClick={() => handleGalleryClick(gallery)}
            />
          ))}
        </MasonryGallery>
      )}
    </div>
  );
};

export default PortfolioPage;
