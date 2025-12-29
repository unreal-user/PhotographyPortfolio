import React from "react";
import "./Hero.css";

interface HeroProps {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  imageUrl,
  title = "Photography Portfolio",
  subtitle = "Capturing life one frame at a time",
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <section className="hero hero-skeleton">
        <div className="hero-skeleton-shimmer" />
        <div className="hero-content">
          <div className="hero-title-skeleton" />
          <div className="hero-subtitle-skeleton" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="hero"
      style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }}
    >
      <div className="hero-overlay" />

      <div className="hero-content">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </div>
    </section>
  );
};
