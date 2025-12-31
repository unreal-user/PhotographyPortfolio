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
  uploadedBy: 'test@example.com',
  uploadDate: '2024-01-01T00:00:00Z',
  originalKey: 'originals/test.jpg',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  fileSize: 1024,
  mimeType: 'image/jpeg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
};

describe('PhotoThumbnail', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('renders photo with correct alt text', () => {
    render(<PhotoThumbnail photo={mockPhoto} onClick={mockOnClick} />);

    const img = screen.getByAltText('Test alt text');
    expect(img).toBeInTheDocument();
  });

  it('uses thumbnail URL as image source', () => {
    render(<PhotoThumbnail photo={mockPhoto} onClick={mockOnClick} />);

    const img = screen.getByAltText('Test alt text');
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  it('calls onClick when clicked', () => {
    render(<PhotoThumbnail photo={mockPhoto} onClick={mockOnClick} />);

    const thumbnail = document.querySelector('.photo-thumbnail');
    fireEvent.click(thumbnail!);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
