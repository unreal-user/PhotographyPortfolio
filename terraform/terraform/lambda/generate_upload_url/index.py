import boto3
import uuid
import json
import os
from datetime import datetime, timedelta

s3_client = boto3.client('s3')

ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def lambda_handler(event, context):
    """
    Generate pre-signed S3 URL for photo upload.

    Input:
    {
        "fileType": "image/jpeg",
        "fileSize": 5242880,
        "fileName": "photo.jpg"
    }

    Output:
    {
        "uploadUrl": "https://...",
        "photoId": "uuid-v4",
        "s3Key": "uploads/uuid-v4.jpg",
        "expiresAt": "2025-12-19T10:05:00Z"
    }
    """
    try:
        # Parse input
        body = json.loads(event['body'])
        file_type = body.get('fileType')
        file_size = body.get('fileSize')
        file_name = body.get('fileName', 'upload')

        # Validate file type
        if not file_type or file_type not in ALLOWED_MIME_TYPES:
            return error_response(400, 'Invalid file type. Allowed: JPEG, PNG, WebP', 'ValidationError')

        # Validate file size
        if not file_size or file_size > MAX_FILE_SIZE:
            return error_response(400, f'File too large (max {MAX_FILE_SIZE} bytes)', 'ValidationError')

        # Generate UUID for photo
        photo_id = str(uuid.uuid4())

        # Determine file extension
        ext_map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        }
        ext = ext_map.get(file_type, 'jpg')

        # S3 key for upload
        s3_key = f"uploads/{photo_id}.{ext}"

        # Get bucket name from environment
        bucket_name = os.environ['PHOTOS_BUCKET_NAME']

        # Generate pre-signed URL
        expires_in = int(os.environ.get('UPLOAD_EXPIRATION', '300'))  # 5 minutes default

        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': s3_key,
                'ContentType': file_type,
            },
            ExpiresIn=expires_in
        )

        # Calculate expiration time
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat() + 'Z'

        return success_response({
            'uploadUrl': presigned_url,
            'photoId': photo_id,
            's3Key': s3_key,
            'expiresAt': expires_at
        })

    except KeyError as e:
        return error_response(400, f'Missing required field: {str(e)}', 'ValidationError')
    except Exception as e:
        print(f"Error generating upload URL: {str(e)}")
        return error_response(500, 'Internal server error', 'InternalError')

def success_response(data, status_code=200):
    """Standard success response format"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # CORS handled by API Gateway
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(data)
    }

def error_response(status_code, message, error_type='Error'):
    """Standard error response format"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps({
            'error': message,
            'errorType': error_type
        })
    }
