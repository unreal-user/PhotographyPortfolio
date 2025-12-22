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

    Output:
    {
        "photos": [ {...}, {...} ],
        "count": 25
    }
    """
    try:
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
            return error_response(400, 'Invalid status. Must be: pending, published, or archived', 'ValidationError')

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

        return success_response({
            'photos': photos,
            'count': len(photos)
        })

    except ValueError:
        return error_response(400, 'Invalid limit parameter', 'ValidationError')
    except Exception as e:
        print(f"Error listing photos: {str(e)}")
        return error_response(500, 'Internal server error', 'InternalError')

def success_response(data, status_code=200):
    """Standard success response format"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        'body': json.dumps(data, cls=DecimalEncoder)
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
