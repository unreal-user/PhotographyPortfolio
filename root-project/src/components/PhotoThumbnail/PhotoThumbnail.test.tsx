import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoThumbnail } from './PhotoThumbnail';
import type { Photo } from '../../interfaces/Photo';

const mockPhoto: Photo = {
  photoId: 'test-123',
  title: 'Test Photo',
  description: 'A test photo description',
  alt: 'Test alt text',
  copyright: '2024 Test',
  gallery: 'Test Gallery',
  status: 'published',
  uploadDate: '2024-01-01T00:00:00Z',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  displayUrl: 'https://example.com/display.jpg',
  originalUrl: 'https://example.com/original.jpg',
};

describe('PhotoThumbnail', () => {
  it('renders photo with correct alt text', () => {
    render(<PhotoThumbnail photo={mockPhoto} />);

    const img = screen.getByAltText('Test alt text');
    expect(img).toBeInTheDocument();
  });

  it('uses thumbnail URL as image source', () => {
    render(<PhotoThumbnail photo={mockPhoto} />);

    const img = screen.getByAltText('Test alt text');
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<PhotoThumbnail photo={mockPhoto} onClick={handleClick} />);

    const thumbnail = document.querySelector('.photo-thumbnail');
    fireEvent.click(thumbnail!);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('displays title on hover', () => {
    render(<PhotoThumbnail photo={mockPhoto} />);

    expect(screen.getByText('Test Photo')).toBeInTheDocument();
  });
});
