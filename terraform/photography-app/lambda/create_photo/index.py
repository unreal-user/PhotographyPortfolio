import boto3
import json
import os
import re
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE
)

def lambda_handler(event, context):
    """
    Create photo metadata in DynamoDB after S3 upload.

    Input:
    {
        "photoId": "uuid-v4",
        "title": "Sunset Photo",
        "description": "Optional description",
        "alt": "Alt text for accessibility",
        "gallery": "Optional gallery name"
    }

    Copyright is auto-generated as "(C) [current year] Cindy Ashley"

    Output:
    {
        "photoId": "uuid-v4",
        "status": "pending",
        "createdAt": "2025-12-19T10:00:00Z"
    }
    """
    try:
        # Parse input
        body = json.loads(event['body'])

        # Get Cognito claims from authorizer
        claims = event['requestContext']['authorizer']['claims']
        uploaded_by = claims.get('email', claims.get('cognito:username', 'unknown'))

        # Required fields
        photo_id = body.get('photoId')
        title = body.get('title')
        alt = body.get('alt')

        # Optional fields
        description = body.get('description', '')
        gallery = body.get('gallery', '')

        # Auto-generate copyright with current year
        current_year = datetime.utcnow().year
        copyright = f"(C) {current_year} Cindy Ashley"

        # Validate required fields
        if not all([photo_id, title, alt]):
            missing = [f for f in ['photoId', 'title', 'alt']
                      if not body.get(f)]
            return error_response(400, f'Missing required fields: {", ".join(missing)}', 'ValidationError')

        # Validate UUID format
        if not UUID_PATTERN.match(photo_id):
            return error_response(400, 'Invalid photoId format (must be UUID v4)', 'ValidationError')

        # Find the uploaded file in S3
        bucket = os.environ['PHOTOS_BUCKET_NAME']
        original_key = None
        file_size = None
        mime_type = None

        # Try common extensions
        for ext in ['jpg', 'jpeg', 'png', 'webp']:
            key = f"uploads/{photo_id}.{ext}"
            try:
                response = s3_client.head_object(Bucket=bucket, Key=key)
                original_key = key
                file_size = response['ContentLength']
                mime_type = response.get('ContentType', 'image/jpeg')
                break
            except s3_client.exceptions.ClientError:
                continue

        if not original_key:
            return error_response(404, 'Uploaded file not found in S3', 'NotFoundError')

        # Create DynamoDB item
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

        now = datetime.utcnow().isoformat() + 'Z'

        item = {
            'photoId': photo_id,
            'title': title,
            'description': description,
            'alt': alt,
            'copyright': copyright,
            'gallery': gallery,
            'uploadedBy': uploaded_by,
            'uploadDate': now,
            'status': 'pending',
            'originalKey': original_key,
            'fileSize': file_size,
            'mimeType': mime_type,
            'createdAt': now,
            'updatedAt': now
        }

        # Convert numbers to Decimal for DynamoDB
        item = json.loads(json.dumps(item), parse_float=Decimal, parse_int=Decimal)

        table.put_item(Item=item)

        return success_response({
            'photoId': photo_id,
            'status': 'pending',
            'createdAt': now
        }, 201)

    except KeyError as e:
        return error_response(400, f'Missing field: {str(e)}', 'ValidationError')
    except Exception as e:
        print(f"Error creating photo: {str(e)}")
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
