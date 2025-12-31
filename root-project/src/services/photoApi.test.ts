import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock aws-amplify
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => 'mock-token',
      },
    },
  }),
}));

// Import after mocks
import { photoApi, settingsApi } from './photoApi';

describe('photoApi', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('listPhotos', () => {
    it('fetches photos with correct status parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [], count: 0 }),
      });

      await photoApi.listPhotos('published', 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?status=published&limit=50'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(photoApi.listPhotos('published')).rejects.toThrow('Not found');
    });
  });

  describe('getPhoto', () => {
    it('fetches single photo by ID', async () => {
      const mockPhoto = {
        photoId: 'test-123',
        title: 'Test Photo',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhoto),
      });

      const result = await photoApi.getPhoto('test-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/photos/test-123'),
        expect.any(Object)
      );
      expect(result).toEqual(mockPhoto);
    });
  });
});

describe('settingsApi', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getHeroSettings', () => {
    it('fetches hero settings', async () => {
      const mockSettings = {
        settingId: 'hero',
        title: 'Test Title',
        subtitle: 'Test Subtitle',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSettings),
      });

      const result = await settingsApi.getHeroSettings();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/settings/hero'),
        expect.any(Object)
      );
      expect(result).toEqual(mockSettings);
    });
  });
});
