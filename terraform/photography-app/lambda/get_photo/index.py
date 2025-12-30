import boto3
import json
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert DynamoDB Decimal to int/float"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def is_authenticated(event):
    """Check if request has valid authentication header"""
    headers = event.get('headers', {})
    # Check for Authorization header (case-insensitive)
    auth_header = headers.get('Authorization') or headers.get('authorization')
    return auth_header is not None and auth_header.startswith('Bearer ')

def get_allowed_origin(event):
    """
    Get allowed origin for CORS based on request origin.
    Only allows requests from cindyashleyphotography.com domains.
    """
    headers = event.get('headers', {})
    origin = headers.get('Origin') or headers.get('origin', '')

    allowed_origins = [
        'https://www.cindyashleyphotography.com',
        'https://cindyashleyphotography.com',
        'http://localhost:5173',  # For local development
        'http://localhost:3000',  # Alternative dev port
    ]

    if origin in allowed_origins:
        return origin

    # Default to main domain if origin not recognized
    return 'https://www.cindyashleyphotography.com'

def strip_sensitive_fields(photo, is_auth):
    """Remove sensitive fields from photo object for unauthenticated users"""
    if not is_auth:
        # Remove email address from public responses
        photo.pop('uploadedBy', None)
    return photo

def generate_cloudfront_url(original_key, cloudfront_domain):
    """Generate CloudFront URL from S3 key."""
    if not original_key:
        return None
    return f"https://{cloudfront_domain}/{original_key}"

def enrich_photo_with_urls(photo, cloudfront_domain):
    """Add thumbnailUrl and fullResUrl to photo object."""
    if 'originalKey' in photo:
        # Extract filename from original key
        import os
        filename = os.path.basename(photo['originalKey'])

        # Thumbnail URL (400px for gallery display)
        thumbnail_key = f"thumbnails/{filename}"
        photo['thumbnailUrl'] = generate_cloudfront_url(thumbnail_key, cloudfront_domain)

        # Display URL (1920px for full-screen viewing)
        display_key = f"display/{filename}"
        photo['fullResUrl'] = generate_cloudfront_url(display_key, cloudfront_domain)

    return photo

def lambda_handler(event, context):
    """
    Get single photo metadata by photoId.

    Path Parameters:
    - photoId: UUID v4

    Security:
    - Unauthenticated users can only view published photos
    - Authenticated users can view all photos
    - Sensitive fields stripped from unauthenticated responses

    Output:
    {
        "photoId": "...",
        "title": "...",
        "thumbnailUrl": "https://...cloudfront.net/originals/...",
        "fullResUrl": "https://...cloudfront.net/originals/...",
        ...
    }
    """
    try:
        # Check authentication
        is_auth = is_authenticated(event)

        # Get allowed origin for CORS
        allowed_origin = get_allowed_origin(event)

        # Get CloudFront domain from environment
        cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN_NAME')
        if not cloudfront_domain:
            print("WARNING: CLOUDFRONT_DOMAIN_NAME not set in environment")

        # Parse path parameter
        photo_id = event['pathParameters']['photoId']

        # Get item from DynamoDB
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
        response = table.get_item(Key={'photoId': photo_id})

        if 'Item' not in response:
            return error_response(404, 'Photo not found', 'NotFoundError', allowed_origin)

        photo = response['Item']

        # Security: Restrict unauthenticated users to published photos only
        if not is_auth and photo.get('status') != 'published':
            return error_response(
                403,
                'Authentication required to view non-published photos',
                'ForbiddenError',
                allowed_origin
            )

        # Enrich with CloudFront URLs
        if cloudfront_domain:
            photo = enrich_photo_with_urls(photo, cloudfront_domain)

        # Strip sensitive fields for unauthenticated users
        photo = strip_sensitive_fields(photo, is_auth)

        return success_response(photo, allowed_origin)

    except KeyError as e:
        return error_response(400, f'Missing path parameter: {str(e)}', 'ValidationError', allowed_origin)
    except Exception as e:
        print(f"Error getting photo: {str(e)}")
        return error_response(500, 'Internal server error', 'InternalError', allowed_origin)

def success_response(data, allowed_origin, status_code=200):
    """Standard success response format with CORS"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        'body': json.dumps(data, cls=DecimalEncoder)
    }

def error_response(status_code, message, error_type='Error', allowed_origin='https://www.cindyashleyphotography.com'):
    """Standard error response format with CORS"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        'body': json.dumps({
            'error': message,
            'errorType': error_type
        })
    }
