import React from "react";
import "./Hero.css";

interface HeroProps {
  imageUrl: string;
  title?: string;
  subtitle?: string;
}

export const Hero: React.FC<HeroProps> = ({
  imageUrl,
  title = "Photography Portfolio",
  subtitle = "Capturing life one frame at a time",
}) => {
  return (
    <section
      className="hero"
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="hero-overlay" />

      <div className="hero-content">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </div>
    </section>
  );
};
