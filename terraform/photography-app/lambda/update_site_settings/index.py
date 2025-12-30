import boto3
import json
import os
from datetime import datetime
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

def get_user_email(event):
    """Extract user email from Cognito authorizer claims"""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    return claims.get('email', 'unknown')

def lambda_handler(event, context):
    """
    Update site settings. Protected endpoint - requires Cognito authentication.

    Path Parameters:
    - settingId: "hero" | "about" | etc.

    Body (for hero):
    {
        "heroPhotoId": "abc-123",
        "title": "Welcome",
        "subtitle": "Portfolio"
    }

    Output:
    {
        "settingId": "hero",
        "updatedAt": "2025-12-27T10:00:00Z",
        "message": "Settings updated successfully"
    }
    """
    allowed_origin = get_allowed_origin(event)

    try:
        setting_id = event['pathParameters']['settingId']
        body = json.loads(event['body'])
        user_email = get_user_email(event)

        # Validate hero settings
        if setting_id == 'hero':
            hero_photo_id = body.get('heroPhotoId')

            # Validate required fields
            if not body.get('title'):
                return error_response(400, 'Title is required', 'ValidationError', allowed_origin)
            if not body.get('subtitle'):
                return error_response(400, 'Subtitle is required', 'ValidationError', allowed_origin)

            # Validate galleryColumns if provided
            if 'galleryColumns' in body:
                try:
                    columns = int(body.get('galleryColumns'))
                    if columns < 1 or columns > 6:
                        return error_response(400, 'Gallery columns must be between 1 and 6', 'ValidationError', allowed_origin)
                    body['galleryColumns'] = columns  # Ensure it's stored as int
                except (ValueError, TypeError):
                    return error_response(400, 'Gallery columns must be a number', 'ValidationError', allowed_origin)

            # Validate fitImageToContainer if provided
            if 'fitImageToContainer' in body:
                if not isinstance(body.get('fitImageToContainer'), bool):
                    return error_response(400, 'fitImageToContainer must be a boolean', 'ValidationError', allowed_origin)

            # Validate photo exists and is published
            if hero_photo_id:
                photos_table = dynamodb.Table(os.environ['PHOTOS_TABLE_NAME'])
                photo_response = photos_table.get_item(
                    Key={'photoId': hero_photo_id}
                )

                if 'Item' not in photo_response:
                    return error_response(400, 'Photo not found', 'ValidationError', allowed_origin)

                if photo_response['Item'].get('status') != 'published':
                    return error_response(400, 'Only published photos can be used as hero image', 'ValidationError', allowed_origin)

        # Validate about settings
        if setting_id == 'about':
            about_photo_id = body.get('heroPhotoId')

            # Validate required fields
            if not body.get('title'):
                return error_response(400, 'Title is required', 'ValidationError', allowed_origin)
            if not body.get('subtitle'):
                return error_response(400, 'Subtitle is required', 'ValidationError', allowed_origin)

            # Validate sections array
            sections = body.get('sections', [])
            if not isinstance(sections, list):
                return error_response(400, 'Sections must be an array', 'ValidationError', allowed_origin)

            for i, section in enumerate(sections):
                if not isinstance(section, dict):
                    return error_response(400, f'Section {i + 1} must be an object', 'ValidationError', allowed_origin)
                if not section.get('heading'):
                    return error_response(400, f'Section {i + 1} heading is required', 'ValidationError', allowed_origin)
                if not section.get('body'):
                    return error_response(400, f'Section {i + 1} body is required', 'ValidationError', allowed_origin)

            # Validate fitImageToContainer if provided
            if 'fitImageToContainer' in body:
                if not isinstance(body.get('fitImageToContainer'), bool):
                    return error_response(400, 'fitImageToContainer must be a boolean', 'ValidationError', allowed_origin)

            # Validate photo exists and is published
            if about_photo_id:
                photos_table = dynamodb.Table(os.environ['PHOTOS_TABLE_NAME'])
                photo_response = photos_table.get_item(
                    Key={'photoId': about_photo_id}
                )

                if 'Item' not in photo_response:
                    return error_response(400, 'Photo not found', 'ValidationError', allowed_origin)

                if photo_response['Item'].get('status') != 'published':
                    return error_response(400, 'Only published photos can be used as about hero image', 'ValidationError', allowed_origin)

        # Update settings in DynamoDB
        settings_table = dynamodb.Table(os.environ['SITE_SETTINGS_TABLE_NAME'])
        now = datetime.utcnow().isoformat() + 'Z'

        settings_table.put_item(
            Item={
                'settingId': setting_id,
                'updatedAt': now,
                'updatedBy': user_email,
                'data': body
            }
        )

        return success_response({
            'settingId': setting_id,
            'updatedAt': now,
            'message': 'Settings updated successfully'
        }, allowed_origin)

    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON body', 'ValidationError', allowed_origin)
    except KeyError as e:
        return error_response(400, f'Missing required field: {str(e)}', 'ValidationError', allowed_origin)
    except Exception as e:
        print(f"Error updating site settings: {str(e)}")
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
