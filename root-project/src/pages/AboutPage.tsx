import React from 'react';
import { Hero } from '../components/Hero/Hero';
import './AboutPage.css';

const AboutPage: React.FC = () => {
  return (
    <>
      <Hero
        imageUrl="https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=1974&auto=format&fit=crop"
        title="About Me"
        subtitle="Telling stories through the lens"
      />

      <div className="about-container">
        <section className="about-section">
          <h2 className="about-heading">My Journey</h2>
          <p className="about-text">
            Photography has been my passion for over a decade. What started as a hobby
            quickly became a way of seeing and experiencing the world. Through my lens,
            I capture moments that tell stories, evoke emotions, and preserve memories.
          </p>
          <p className="about-text">
            Every photograph is an opportunity to freeze time, to capture the fleeting
            beauty of a moment that will never exist again in quite the same way.
            I believe in the power of visual storytelling to connect people across
            cultures, backgrounds, and experiences.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-heading">My Approach</h2>
          <p className="about-text">
            My photography style blends technical precision with artistic intuition.
            I strive to find the extraordinary in the ordinary, whether it's the play
            of light on a landscape, the candid emotion in a portrait, or the intricate
            details of everyday life.
          </p>
          <p className="about-text">
            I work primarily with natural light and believe in minimal post-processing,
            allowing the authentic beauty of each scene to shine through. My goal is
            to create images that feel timeless and genuine.
          </p>
        </section>

        <section className="about-section">
          <h2 className="about-heading">Services</h2>
          <ul className="about-list">
            <li className="about-list-item">Portrait Photography</li>
            <li className="about-list-item">Landscape & Nature Photography</li>
            <li className="about-list-item">Event Photography</li>
            <li className="about-list-item">Commercial & Product Photography</li>
            <li className="about-list-item">Photo Editing & Retouching</li>
          </ul>
        </section>

        <section className="about-section about-cta">
          <h2 className="about-heading">Let's Work Together</h2>
          <p className="about-text">
            I'm always excited to collaborate on new projects and bring creative visions to life.
            Whether you need professional portraits, stunning landscapes, or event coverage,
            I'd love to hear from you.
          </p>
          <a href="/contact" className="about-cta-button">
            Get In Touch
          </a>
        </section>
      </div>
    </>
  );
};

export default AboutPage;
