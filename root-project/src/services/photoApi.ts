import { fetchAuthSession } from 'aws-amplify/auth';
import type { Photo } from '../interfaces/Photo';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// ============================================================================
// Type Definitions
// ============================================================================

interface GenerateUploadUrlRequest {
  fileType: string; // 'image/jpeg' | 'image/png' | 'image/webp'
  fileSize: number;
  fileName: string;
}

interface GenerateUploadUrlResponse {
  uploadUrl: string;
  photoId: string;
  s3Key: string;
  expiresAt: string;
}

interface CreatePhotoRequest {
  photoId: string;
  title: string;
  description?: string;
  alt: string;
  copyright: string;
  gallery?: string;
}

interface UpdatePhotoRequest {
  title?: string;
  description?: string;
  alt?: string;
  copyright?: string;
  gallery?: string;
  status?: 'published' | 'archived';
}

interface ListPhotosResponse {
  photos: Photo[];
  count: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get authentication headers with JWT token from AWS Amplify
 * Throws error if not authenticated (use for write operations)
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get headers with optional authentication (for public read endpoints)
 * Includes auth token if user is logged in, otherwise just content-type
 */
async function getOptionalAuthHeaders(): Promise<HeadersInit> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch (error) {
    // User not authenticated, continue without auth headers
  }

  return {
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// API Client
// ============================================================================

export const photoApi = {
  /**
   * Generate pre-signed S3 URL for photo upload
   */
  async generateUploadUrl(request: GenerateUploadUrlRequest): Promise<GenerateUploadUrlResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/upload-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate upload URL' }));
      throw new Error(error.error || 'Failed to generate upload URL');
    }

    return response.json();
  },

  /**
   * Upload file directly to S3 using pre-signed URL
   * (No authentication required - URL is pre-signed)
   */
  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file to S3');
    }
  },

  /**
   * Create photo metadata in DynamoDB after S3 upload
   */
  async createPhoto(request: CreatePhotoRequest): Promise<{ photoId: string; status: string; createdAt: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create photo' }));
      throw new Error(error.error || 'Failed to create photo');
    }

    return response.json();
  },

  /**
   * List photos by status using DynamoDB GSI
   * Public endpoint - no authentication required for viewing published photos
   */
  async listPhotos(status: 'pending' | 'published' | 'archived', limit = 50): Promise<ListPhotosResponse> {
    const headers = await getOptionalAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos?status=${status}&limit=${limit}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to list photos' }));
      throw new Error(error.error || 'Failed to list photos');
    }

    return response.json();
  },

  /**
   * Get single photo by photoId
   * Public endpoint - no authentication required for viewing published photos
   */
  async getPhoto(photoId: string): Promise<Photo> {
    const headers = await getOptionalAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/${photoId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get photo' }));
      throw new Error(error.error || 'Failed to get photo');
    }

    return response.json();
  },

  /**
   * Update photo metadata and/or status
   */
  async updatePhoto(photoId: string, updates: UpdatePhotoRequest): Promise<{ photoId: string; status: string; updatedAt: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/${photoId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update photo' }));
      throw new Error(error.error || 'Failed to update photo');
    }

    return response.json();
  },

  /**
   * Soft delete photo (moves to archive/)
   */
  async deletePhoto(photoId: string): Promise<{ photoId: string; status: string; archivedAt: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/${photoId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete photo' }));
      throw new Error(error.error || 'Failed to delete photo');
    }

    return response.json();
  },

  /**
   * Bulk update multiple photos (Phase 6d)
   */
  async bulkUpdatePhotos(photoIds: string[], updates: Partial<UpdatePhotoRequest>): Promise<{ message: string; succeeded: string[]; failed: any[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/photos/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ photoIds, updates }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to bulk update photos' }));
      throw new Error(error.error || 'Failed to bulk update photos');
    }

    return response.json();
  },
};

// ============================================================================
// Site Settings Types
// ============================================================================

export interface HeroSettings {
  settingId: 'hero';
  heroPhotoId?: string | null;
  heroImageUrl?: string | null;
  title: string;
  subtitle: string;
  galleryColumns?: number;
  fitImageToContainer?: boolean;
  updatedAt?: string;
}

export interface UpdateHeroSettingsRequest {
  heroPhotoId?: string;
  title: string;
  subtitle: string;
  galleryColumns?: number;
  fitImageToContainer?: boolean;
}

// ============================================================================
// Settings API Client
// ============================================================================

export const settingsApi = {
  /**
   * Get hero settings (public endpoint)
   */
  async getHeroSettings(): Promise<HeroSettings> {
    const response = await fetch(`${API_BASE_URL}/settings/hero`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to load hero settings' }));
      throw new Error(error.error || 'Failed to load hero settings');
    }

    return response.json();
  },

  /**
   * Update hero settings (protected endpoint - requires authentication)
   */
  async updateHeroSettings(settings: UpdateHeroSettingsRequest): Promise<{ settingId: string; updatedAt: string; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/settings/hero`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update settings' }));
      throw new Error(error.error || 'Failed to update settings');
    }

    return response.json();
  },

  /**
   * Get about page settings (public endpoint)
   */
  async getAboutSettings(): Promise<AboutSettings> {
    const response = await fetch(`${API_BASE_URL}/settings/about`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to load about settings' }));
      throw new Error(error.error || 'Failed to load about settings');
    }

    return response.json();
  },

  /**
   * Update about page settings (protected endpoint - requires authentication)
   */
  async updateAboutSettings(settings: UpdateAboutSettingsRequest): Promise<{ settingId: string; updatedAt: string; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/settings/about`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update settings' }));
      throw new Error(error.error || 'Failed to update settings');
    }

    return response.json();
  },
};

// ============================================================================
// About Settings Types
// ============================================================================

export interface AboutSection {
  heading: string;
  body: string; // Double newlines separate paragraphs
}

export interface AboutSettings {
  settingId: 'about';
  heroPhotoId?: string | null;
  heroImageUrl?: string | null;
  title: string;
  subtitle: string;
  sections: AboutSection[];
  fitImageToContainer?: boolean;
  updatedAt?: string;
}

export interface UpdateAboutSettingsRequest {
  heroPhotoId?: string;
  title: string;
  subtitle: string;
  sections: AboutSection[];
  fitImageToContainer?: boolean;
}
