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
    """
    Generate CloudFront URL from S3 key.

    Args:
        original_key: S3 object key (e.g., 'uploads/abc.jpg', 'originals/def.jpg')
        cloudfront_domain: CloudFront distribution domain name

    Returns:
        HTTPS URL to CloudFront distribution
    """
    if not original_key:
        return None

    # CloudFront URL format: https://{domain}/{key}
    return f"https://{cloudfront_domain}/{original_key}"

def enrich_photo_with_urls(photo, cloudfront_domain):
    """
    Add thumbnailUrl and fullResUrl to photo object.

    For Phase 7, both thumbnail and full-res use the same CloudFront URL.
    In future phases, we could implement Lambda@Edge for dynamic resizing.
    """
    if 'originalKey' in photo:
        # Both use the same URL for now (CloudFront serves original)
        url = generate_cloudfront_url(photo['originalKey'], cloudfront_domain)
        photo['thumbnailUrl'] = url
        photo['fullResUrl'] = url

    return photo

def lambda_handler(event, context):
    """
    List photos filtered by status.

    Query Parameters:
    - status: "pending" | "published" | "archived" (default: "published")
    - limit: Max number of photos to return (default: 50)

    Security:
    - Unauthenticated users can only view published photos
    - Authenticated users can view all statuses
    - Sensitive fields stripped from unauthenticated responses

    Output:
    {
        "photos": [ {...}, {...} ],
        "count": 25
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

        # Parse query parameters
        params = event.get('queryStringParameters') or {}
        status = params.get('status', 'published')
        limit = int(params.get('limit', 50))

        # Validate status value
        if status not in ['pending', 'published', 'archived']:
            return error_response(400, 'Invalid status. Must be: pending, published, or archived', 'ValidationError', allowed_origin)

        # Security: Restrict unauthenticated users to published photos only
        if not is_auth and status != 'published':
            return error_response(
                403,
                'Authentication required to view non-published photos',
                'ForbiddenError',
                allowed_origin
            )

        # Query DynamoDB using GSI
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

        response = table.query(
            IndexName='status-uploadDate-index',
            KeyConditionExpression='#status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': status},
            Limit=limit,
            ScanIndexForward=False  # Sort by uploadDate descending (newest first)
        )

        photos = response.get('Items', [])

        # Enrich each photo with CloudFront URLs
        if cloudfront_domain:
            photos = [enrich_photo_with_urls(photo, cloudfront_domain) for photo in photos]

        # Strip sensitive fields for unauthenticated users
        photos = [strip_sensitive_fields(photo, is_auth) for photo in photos]

        return success_response({
            'photos': photos,
            'count': len(photos)
        }, allowed_origin)

    except ValueError:
        return error_response(400, 'Invalid limit parameter', 'ValidationError', allowed_origin)
    except Exception as e:
        print(f"Error listing photos: {str(e)}")
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
