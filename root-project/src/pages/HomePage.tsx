import { Hero } from '../components/Hero/Hero';
import { PhotoGallery } from '../components/PhotoGallery/PhotoGallery';
import { samplePhotos } from '../helpers/SampleData';

const HomePage = () => {
  return (
    <>
      <Hero 
        imageUrl="https://images.unsplash.com/photo-1756142754696-2bc410d5b248?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" 
        title="Welcome - Title" 
        subtitle="Subtitle" 
      />
      <PhotoGallery photos={samplePhotos} />
    </>
  );
};

export default HomePage;