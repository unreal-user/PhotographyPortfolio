import boto3
import json
import os
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert DynamoDB Decimal to int/float"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    """
    Update photo metadata and handle status transitions.

    Path Parameters:
    - photoId: UUID v4

    Input:
    {
        "title": "Updated title",
        "description": "Updated description",
        "alt": "Updated alt text",
        "status": "published"  // Triggers copy from uploads/ to originals/
    }

    Output:
    {
        "photoId": "...",
        "status": "...",
        "updatedAt": "2025-12-19T10:30:00Z"
    }
    """
    try:
        # Parse path parameter and body
        photo_id = event['pathParameters']['photoId']
        body = json.loads(event['body'])

        # Get current item
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
        response = table.get_item(Key={'photoId': photo_id})

        if 'Item' not in response:
            return error_response(404, 'Photo not found', 'NotFoundError')

        current_item = response['Item']
        current_status = current_item['status']
        new_status = body.get('status', current_status)

        # Build update expression
        update_expr = "SET updatedAt = :updatedAt"
        expr_values = {':updatedAt': datetime.utcnow().isoformat() + 'Z'}
        expr_names = {}

        if 'title' in body:
            update_expr += ", title = :title"
            expr_values[':title'] = body['title']

        if 'description' in body:
            update_expr += ", description = :description"
            expr_values[':description'] = body['description']

        if 'alt' in body:
            update_expr += ", alt = :alt"
            expr_values[':alt'] = body['alt']

        if 'copyright' in body:
            update_expr += ", copyright = :copyright"
            expr_values[':copyright'] = body['copyright']

        # Handle status change: pending -> published
        if new_status != current_status:
            if new_status == 'published':
                # Copy from uploads/ to originals/
                bucket = os.environ['PHOTOS_BUCKET_NAME']
                source_key = current_item['originalKey']

                # Determine destination key
                ext = source_key.split('.')[-1]
                dest_key = f"originals/{photo_id}.{ext}"

                # Copy object
                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': source_key},
                    Key=dest_key
                )

                # Update status and keys
                update_expr += ", #status = :status, originalKey = :originalKey, publishedAt = :publishedAt"
                expr_names['#status'] = 'status'
                expr_values[':status'] = 'published'
                expr_values[':originalKey'] = dest_key
                expr_values[':publishedAt'] = datetime.utcnow().isoformat() + 'Z'

            elif new_status == 'archived':
                # Handle archiving (similar to delete, but through update)
                bucket = os.environ['PHOTOS_BUCKET_NAME']
                source_key = current_item['originalKey']
                ext = source_key.split('.')[-1]
                dest_key = f"archive/{photo_id}.{ext}"

                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': source_key},
                    Key=dest_key
                )

                update_expr += ", #status = :status, originalKey = :originalKey, archivedAt = :archivedAt"
                expr_names['#status'] = 'status'
                expr_values[':status'] = 'archived'
                expr_values[':originalKey'] = dest_key
                expr_values[':archivedAt'] = datetime.utcnow().isoformat() + 'Z'

        # Convert numbers to Decimal
        expr_values = json.loads(json.dumps(expr_values), parse_float=Decimal, parse_int=Decimal)

        # Update DynamoDB
        update_kwargs = {
            'Key': {'photoId': photo_id},
            'UpdateExpression': update_expr,
            'ExpressionAttributeValues': expr_values
        }

        if expr_names:
            update_kwargs['ExpressionAttributeNames'] = expr_names

        table.update_item(**update_kwargs)

        return success_response({
            'photoId': photo_id,
            'status': new_status,
            'updatedAt': expr_values[':updatedAt']
        })

    except KeyError as e:
        return error_response(400, f'Missing field: {str(e)}', 'ValidationError')
    except s3_client.exceptions.NoSuchKey:
        return error_response(404, 'Source file not found in S3', 'NotFoundError')
    except Exception as e:
        print(f"Error updating photo: {str(e)}")
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
