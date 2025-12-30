# Photography Portfolio - Routing Setup

## Project Structure

```
/src
  App.tsx              - Main app with Router setup
  Layout.tsx           - Wrapper component with Header
  Header.tsx           - Navigation header (uses react-router-dom Link)
  main.tsx             - App entry point
  
  /pages
    HomePage.tsx       - Home page (/)
    AboutPage.tsx      - About page (/about)
    PortfolioPage.tsx  - Portfolio page (/portfolio)
    ContactPage.tsx    - Contact page (/contact)
  
  /components
    Hero.tsx           - Hero section component
    PhotoGallery.tsx   - Photo grid component
    PhotoModal.tsx     - Fullscreen photo modal
    PhotoThumbnail.tsx - Individual photo thumbnail
```

## Routing

The app uses `react-router-dom` v6 with the following routes:

- `/` - Home page
- `/about` - About page
- `/portfolio` - Portfolio/gallery page
- `/contact` - Contact page

## Layout

All pages are wrapped in the `Layout` component which includes:
- Header (fixed, with scroll detection)
- Main content area (with proper padding-top for fixed header)

## Design Tokens

CSS variables are defined in `tokens.css` for:
- Colors (light/dark theme support)
- Typography (Lora serif font)
- Spacing
- Transitions
- Layout dimensions

## Adding Content to Pages

Each page is a simple placeholder. To add content:

1. Import components you need (Hero, PhotoGallery, etc.)
2. Add your content inside the component
3. Example for HomePage:

```tsx
import React from 'react';
import { Hero } from '../Hero';
import { PhotoGallery } from '../PhotoGallery';

const HomePage: React.FC = () => {
  const photos = [ /* your photo data */ ];
  
  return (
    <>
      <Hero 
        imageUrl="your-image-url" 
        title="Welcome" 
        subtitle="Photography Portfolio"
      />
      <PhotoGallery photos={photos} />
    </>
  );
};

export default HomePage;
```

## Next Steps

1. Build out each page with actual content
2. Add photo data/galleries
3. Create contact form
4. Add any additional styling

The routing is all set up and ready to go!