import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';

describe('Hero', () => {
  it('renders with default props', () => {
    render(<Hero />);

    expect(screen.getByText('Photography Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Capturing life one frame at a time')).toBeInTheDocument();
  });

  it('renders with custom title and subtitle', () => {
    render(<Hero title="Custom Title" subtitle="Custom Subtitle" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<Hero isLoading={true} />);

    expect(document.querySelector('.hero-skeleton')).toBeInTheDocument();
  });

  it('applies contain class when fitImageToContainer is true', () => {
    render(<Hero fitImageToContainer={true} />);

    expect(document.querySelector('.hero--contain')).toBeInTheDocument();
  });

  it('sets background image when imageUrl is provided', () => {
    render(<Hero imageUrl="https://example.com/image.jpg" />);

    const hero = document.querySelector('.hero');
    expect(hero).toHaveStyle({ backgroundImage: 'url(https://example.com/image.jpg)' });
  });
});
