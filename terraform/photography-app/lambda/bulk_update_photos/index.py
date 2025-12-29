import boto3
import json
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')

def is_authenticated(event):
    """Check if request has valid authentication header"""
    headers = event.get('headers', {})
    auth_header = headers.get('Authorization') or headers.get('authorization')
    return auth_header is not None and auth_header.startswith('Bearer ')

def get_allowed_origin(event):
    """CORS allowlist"""
    headers = event.get('headers', {})
    origin = headers.get('Origin') or headers.get('origin', '')

    allowed_origins = [
        'https://www.cindyashleyphotography.com',
        'https://cindyashleyphotography.com',
        'http://localhost:5173',
        'http://localhost:3000',
    ]

    return origin if origin in allowed_origins else 'https://www.cindyashleyphotography.com'

def lambda_handler(event, context):
    """
    Bulk update photos.

    POST body:
    {
        "photoIds": ["uuid1", "uuid2", "uuid3"],
        "updates": {
            "gallery": "Landscapes",
            "status": "published"
        }
    }

    Supports bulk:
    - gallery assignment
    - status change (published, archived)
    - metadata updates (title, description, alt, copyright)
    """
    try:
        # Require authentication
        if not is_authenticated(event):
            return error_response(401, 'Authentication required', 'UnauthorizedError', get_allowed_origin(event))

        allowed_origin = get_allowed_origin(event)

        # Parse request
        body = json.loads(event['body'])
        photo_ids = body.get('photoIds', [])
        updates = body.get('updates', {})

        # Validate
        if not photo_ids or not isinstance(photo_ids, list):
            return error_response(400, 'photoIds must be a non-empty array', 'ValidationError', allowed_origin)

        if not updates or not isinstance(updates, dict):
            return error_response(400, 'updates must be a non-empty object', 'ValidationError', allowed_origin)

        # Limit batch size (warn user at 100)
        if len(photo_ids) > 100:
            return error_response(400, 'Maximum 100 photos per batch. Please select fewer photos.', 'ValidationError', allowed_origin)

        # Build update expression
        update_expression_parts = []
        expression_attribute_names = {}
        expression_attribute_values = {}

        allowed_fields = ['gallery', 'status', 'title', 'description', 'alt', 'copyright']

        for key, value in updates.items():
            if key not in allowed_fields:
                continue

            update_expression_parts.append(f"#{key} = :{key}")
            expression_attribute_names[f"#{key}"] = key
            expression_attribute_values[f":{key}"] = value

        # Add updatedAt timestamp
        update_expression_parts.append("#updatedAt = :updatedAt")
        expression_attribute_names["#updatedAt"] = "updatedAt"
        expression_attribute_values[":updatedAt"] = datetime.utcnow().isoformat() + 'Z'

        # Handle publishedAt for status changes to published
        if 'status' in updates and updates['status'] == 'published':
            update_expression_parts.append("#publishedAt = if_not_exists(#publishedAt, :publishedAt)")
            expression_attribute_names["#publishedAt"] = "publishedAt"
            expression_attribute_values[":publishedAt"] = datetime.utcnow().isoformat() + 'Z'

        update_expression = "SET " + ", ".join(update_expression_parts)

        # Update each photo
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
        succeeded = []
        failed = []

        for photo_id in photo_ids:
            try:
                table.update_item(
                    Key={'photoId': photo_id},
                    UpdateExpression=update_expression,
                    ExpressionAttributeNames=expression_attribute_names,
                    ExpressionAttributeValues=expression_attribute_values
                )
                succeeded.append(photo_id)
            except Exception as e:
                print(f"Failed to update {photo_id}: {str(e)}")
                failed.append({'photoId': photo_id, 'error': str(e)})

        return success_response({
            'message': f'Updated {len(succeeded)} of {len(photo_ids)} photos',
            'succeeded': succeeded,
            'failed': failed
        }, allowed_origin)

    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body', 'ValidationError', allowed_origin)
    except Exception as e:
        print(f"Error in bulk update: {str(e)}")
        return error_response(500, 'Internal server error', 'InternalError', allowed_origin)

def success_response(data, allowed_origin, status_code=200):
    """Standard success response with CORS"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        'body': json.dumps(data)
    }

def error_response(status_code, message, error_type='Error', allowed_origin='https://www.cindyashleyphotography.com'):
    """Standard error response with CORS"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        },
        'body': json.dumps({
            'error': message,
            'errorType': error_type
        })
    }
