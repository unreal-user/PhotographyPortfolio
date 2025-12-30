export interface Photo {
  // Core identifiers
  photoId: string;

  // Metadata (from user input)
  title: string;
  description: string;
  alt: string;
  copyright: string;
  gallery?: string; // NEW: Gallery categorization (optional)

  // System fields (from backend)
  uploadedBy: string; // Email from Cognito
  uploadDate: string; // ISO 8601 timestamp
  status: 'pending' | 'published' | 'archived';
  originalKey: string; // S3 key (uploads/*, originals/*, archive/*)

  // Optional timestamps
  publishedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;

  // File metadata
  fileSize: number;
  mimeType: string;

  // URL generation (computed on frontend)
  thumbnailUrl?: string; // Phase 7 will add Lambda for generation
  fullResUrl?: string; // Generated from originalKey
}
