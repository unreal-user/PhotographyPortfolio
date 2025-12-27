import React, { useState, useEffect } from 'react';
import { Hero } from '../components/Hero/Hero';
import { settingsApi } from '../services/photoApi';
import type { AboutSettings } from '../services/photoApi';
import './AboutPage.css';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=1974&auto=format&fit=crop';

/**
 * Parse body text into paragraphs by splitting on double newlines
 */
const parseParagraphs = (body: string): string[] => {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

const AboutPage: React.FC = () => {
  const [settings, setSettings] = useState<AboutSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const aboutSettings = await settingsApi.getAboutSettings();
        setSettings(aboutSettings);
      } catch (err) {
        console.error('Failed to load about settings:', err);
        // Use defaults on error
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const heroImageUrl = settings?.heroImageUrl || DEFAULT_HERO_IMAGE;
  const title = settings?.title || 'About Me';
  const subtitle = settings?.subtitle || 'Telling stories through the lens';
  const sections = settings?.sections || [];

  return (
    <>
      <Hero imageUrl={heroImageUrl} title={title} subtitle={subtitle} />

      <div className="about-container">
        {isLoading ? (
          <div className="about-loading">Loading...</div>
        ) : (
          <>
            {/* Dynamic Sections */}
            {sections.map((section, index) => (
              <section key={index} className="about-section">
                <h2 className="about-heading">{section.heading}</h2>
                {parseParagraphs(section.body).map((paragraph, pIndex) => (
                  <p key={pIndex} className="about-text">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}

            {/* Static Services Section */}
            <section className="about-section">
              <h2 className="about-heading">Services</h2>
              <ul className="about-list">
                <li className="about-list-item">Portrait Photography</li>
                <li className="about-list-item">
                  Landscape & Nature Photography
                </li>
                <li className="about-list-item">Event Photography</li>
                <li className="about-list-item">
                  Commercial & Product Photography
                </li>
                <li className="about-list-item">Photo Editing & Retouching</li>
              </ul>
            </section>

            {/* Static CTA Section */}
            <section className="about-section about-cta">
              <h2 className="about-heading">Let's Work Together</h2>
              <p className="about-text">
                I'm always excited to collaborate on new projects and bring
                creative visions to life. Whether you need professional
                portraits, stunning landscapes, or event coverage, I'd love to
                hear from you.
              </p>
              <a href="/contact" className="about-cta-button">
                Get In Touch
              </a>
            </section>
          </>
        )}
      </div>
    </>
  );
};

export default AboutPage;
