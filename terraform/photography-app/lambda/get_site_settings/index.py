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

def lambda_handler(event, context):
    """
    Get site settings by settingId.
    For hero settings, resolves heroPhotoId to CloudFront URL.

    Path Parameters:
    - settingId: "hero" | "about" | etc.

    Output (for hero):
    {
        "settingId": "hero",
        "heroPhotoId": "abc-123",
        "heroImageUrl": "https://cloudfront.../originals/abc-123.jpg",
        "title": "Welcome",
        "subtitle": "Portfolio",
        "updatedAt": "2025-12-27T10:00:00Z"
    }
    """
    try:
        allowed_origin = get_allowed_origin(event)
        setting_id = event['pathParameters']['settingId']

        # Get settings from DynamoDB
        settings_table = dynamodb.Table(os.environ['SITE_SETTINGS_TABLE_NAME'])
        response = settings_table.get_item(Key={'settingId': setting_id})

        if 'Item' not in response:
            # Return defaults for hero settings
            if setting_id == 'hero':
                return success_response({
                    'settingId': 'hero',
                    'heroPhotoId': None,
                    'heroImageUrl': None,
                    'title': 'Photography Portfolio',
                    'subtitle': 'Capturing life one frame at a time'
                }, allowed_origin)
            # Return defaults for about settings
            if setting_id == 'about':
                return success_response({
                    'settingId': 'about',
                    'heroPhotoId': None,
                    'heroImageUrl': None,
                    'title': 'About Me',
                    'subtitle': 'Telling stories through the lens',
                    'sections': [
                        {
                            'heading': 'My Journey',
                            'body': 'Photography has been my passion for over a decade. What started as a hobby quickly became a way of seeing and experiencing the world.\n\nEvery photograph is an opportunity to freeze time, to capture the fleeting beauty of a moment that will never come again.'
                        },
                        {
                            'heading': 'My Approach',
                            'body': 'My photography style blends technical precision with artistic intuition. I believe that the best photographs are those that evoke emotion and tell a story.\n\nI work primarily with natural light and believe in minimal post-processing, letting the authentic beauty of each moment shine through.'
                        }
                    ]
                }, allowed_origin)
            return error_response(404, 'Setting not found', 'NotFoundError', allowed_origin)

        item = response['Item']
        data = item.get('data', {})

        # For hero settings, resolve photoId to CloudFront URL
        if setting_id == 'hero' and data.get('heroPhotoId'):
            cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN_NAME')
            photos_table = dynamodb.Table(os.environ['PHOTOS_TABLE_NAME'])

            photo_response = photos_table.get_item(
                Key={'photoId': data['heroPhotoId']}
            )

            if 'Item' in photo_response:
                photo = photo_response['Item']
                original_key = photo.get('originalKey', '')
                data['heroImageUrl'] = f"https://{cloudfront_domain}/{original_key}"
            else:
                # Photo was deleted, clear the reference
                data['heroImageUrl'] = None

        # For about settings, resolve photoId to CloudFront URL
        if setting_id == 'about' and data.get('heroPhotoId'):
            cloudfront_domain = os.environ.get('CLOUDFRONT_DOMAIN_NAME')
            photos_table = dynamodb.Table(os.environ['PHOTOS_TABLE_NAME'])

            photo_response = photos_table.get_item(
                Key={'photoId': data['heroPhotoId']}
            )

            if 'Item' in photo_response:
                photo = photo_response['Item']
                original_key = photo.get('originalKey', '')
                data['heroImageUrl'] = f"https://{cloudfront_domain}/{original_key}"
            else:
                # Photo was deleted, clear the reference
                data['heroImageUrl'] = None

        return success_response({
            'settingId': setting_id,
            **data,
            'updatedAt': item.get('updatedAt')
        }, allowed_origin)

    except KeyError as e:
        return error_response(400, f'Missing path parameter: {str(e)}', 'ValidationError', allowed_origin)
    except Exception as e:
        print(f"Error getting site settings: {str(e)}")
        return error_response(500, 'Internal server error', 'InternalError', allowed_origin)

def success_response(data, allowed_origin, status_code=200):
    """Standard success response format with CORS"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
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
            'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        'body': json.dumps({
            'error': message,
            'errorType': error_type
        })
    }
