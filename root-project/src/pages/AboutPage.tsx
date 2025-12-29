import React from 'react';
import useSWR from 'swr';
import { Hero } from '../components/Hero/Hero';
import { settingsApi } from '../services/photoApi';
import './AboutPage.css';

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
  // Fetch about settings with SWR
  const { data: settings, isLoading } = useSWR(
    'aboutSettings',
    () => settingsApi.getAboutSettings()
  );

  const heroImageUrl = settings?.heroImageUrl || undefined;
  const title = settings?.title || 'About Me';
  const subtitle = settings?.subtitle || 'Telling stories through the lens';
  const sections = settings?.sections || [];

  return (
    <>
      <Hero
        imageUrl={heroImageUrl}
        title={title}
        subtitle={subtitle}
        isLoading={isLoading}
      />

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
