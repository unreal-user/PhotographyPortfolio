import { useState, useCallback } from 'react';
import { photoApi } from '../services/photoApi';

export interface UploadProgress {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'failed';
  progress: number; // 0-100
  photoId?: string;
  error?: string;
}

export interface BatchUploadResult {
  succeeded: string[]; // photoIds
  failed: { file: File; error: string }[];
}

export const useBatchUpload = () => {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: File[]): Promise<BatchUploadResult> => {
    setIsUploading(true);

    const uploadMap = new Map<string, UploadProgress>();
    files.forEach(file => {
      uploadMap.set(file.name, {
        file,
        status: 'pending',
        progress: 0
      });
    });
    setUploads(new Map(uploadMap));

    const succeeded: string[] = [];
    const failed: { file: File; error: string }[] = [];

    // Upload all files in parallel
    await Promise.all(
      files.map(async (file) => {
        try {
          // Update status: generating URL
          setUploads(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(file.name);
            if (current) {
              newMap.set(file.name, {
                ...current,
                status: 'pending',
                progress: 10
              });
            }
            return newMap;
          });

          // Step 1: Generate upload URL
          const { uploadUrl, photoId, s3Key } = await photoApi.generateUploadUrl({
            fileType: file.type,
            fileSize: file.size,
            fileName: file.name
          });

          // Update status: uploading to S3
          setUploads(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(file.name);
            if (current) {
              newMap.set(file.name, {
                ...current,
                status: 'uploading',
                progress: 20,
                photoId
              });
            }
            return newMap;
          });

          // Step 2: Upload to S3
          await photoApi.uploadToS3(uploadUrl, file);

          // Update status: creating metadata
          setUploads(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(file.name);
            if (current) {
              newMap.set(file.name, {
                ...current,
                status: 'processing',
                progress: 80
              });
            }
            return newMap;
          });

          // Step 3: Create metadata in DynamoDB
          await photoApi.createPhoto({
            photoId,
            title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
            description: '',
            alt: file.name,
            copyright: `© ${new Date().getFullYear()}`,
            gallery: 'Uncategorized'
          });

          // Success
          setUploads(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(file.name);
            if (current) {
              newMap.set(file.name, {
                ...current,
                status: 'success',
                progress: 100
              });
            }
            return newMap;
          });

          succeeded.push(photoId);

        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          setUploads(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(file.name);
            if (current) {
              newMap.set(file.name, {
                ...current,
                status: 'failed',
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload failed'
              });
            }
            return newMap;
          });

          failed.push({
            file,
            error: error instanceof Error ? error.message : 'Upload failed'
          });
        }
      })
    );

    setIsUploading(false);
    return { succeeded, failed };
  }, []);

  const retryFailed = useCallback(async (files: File[]): Promise<BatchUploadResult> => {
    // Filter to only retry files that exist in uploads map and failed
    const filesToRetry = files.filter(file => {
      const upload = uploads.get(file.name);
      return upload?.status === 'failed';
    });

    return uploadFiles(filesToRetry);
  }, [uploads, uploadFiles]);

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFiles,
    retryFailed,
    clearUploads
  };
};
