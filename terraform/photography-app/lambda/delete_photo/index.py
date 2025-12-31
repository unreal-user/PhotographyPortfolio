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
    Delete photo - soft delete (move to archive/) or permanent delete.

    - If photo is not archived: soft delete (copy to archive/)
    - If photo is already archived: permanent delete (remove from S3 and DynamoDB)

    Path Parameters:
    - photoId: UUID v4

    Output (soft delete):
    {
        "photoId": "...",
        "status": "archived",
        "archivedAt": "2025-12-19T10:45:00Z"
    }

    Output (permanent delete):
    {
        "photoId": "...",
        "status": "deleted",
        "deletedAt": "2025-12-19T10:45:00Z"
    }
    """
    try:
        # Parse path parameter
        photo_id = event['pathParameters']['photoId']

        # Get current item
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
        response = table.get_item(Key={'photoId': photo_id})

        if 'Item' not in response:
            return error_response(404, 'Photo not found', 'NotFoundError')

        current_item = response['Item']
        current_status = current_item.get('status', '')
        source_key = current_item['originalKey']
        bucket = os.environ['PHOTOS_BUCKET_NAME']
        now = datetime.utcnow().isoformat() + 'Z'

        # Extract filename for thumbnail/display deletion
        # For uploads/originals: uploads/file.jpg -> file.jpg
        # For archive: archive/uuid.jpg -> uuid.jpg (but we need original filename)
        # We'll use the basename for simplicity
        filename = os.path.basename(source_key)
        thumbnail_key = f"thumbnails/{filename}"
        display_key = f"display/{filename}"

        # If already archived, permanently delete
        if current_status == 'archived':
            # Delete original/archive from S3
            s3_client.delete_object(Bucket=bucket, Key=source_key)

            # Delete thumbnail and display versions (may not exist, ignore errors)
            try:
                s3_client.delete_object(Bucket=bucket, Key=thumbnail_key)
            except Exception as e:
                print(f"Warning: Could not delete thumbnail {thumbnail_key}: {str(e)}")

            try:
                s3_client.delete_object(Bucket=bucket, Key=display_key)
            except Exception as e:
                print(f"Warning: Could not delete display {display_key}: {str(e)}")

            # Delete from DynamoDB
            table.delete_item(Key={'photoId': photo_id})

            return success_response({
                'photoId': photo_id,
                'status': 'deleted',
                'deletedAt': now
            })

        # Otherwise, soft delete (move to archive/)
        ext = source_key.split('.')[-1]
        dest_key = f"archive/{photo_id}.{ext}"

        # Copy original to archive
        s3_client.copy_object(
            Bucket=bucket,
            CopySource={'Bucket': bucket, 'Key': source_key},
            Key=dest_key
        )

        # Delete original from uploads/originals
        try:
            s3_client.delete_object(Bucket=bucket, Key=source_key)
        except Exception as e:
            print(f"Warning: Could not delete original {source_key}: {str(e)}")

        # Keep thumbnail and display versions when archiving
        # This allows archived photos to be used as hero images
        # They will be deleted only during permanent deletion

        # Update status to archived
        now_decimal = json.loads(json.dumps(now), parse_float=Decimal)

        table.update_item(
            Key={'photoId': photo_id},
            UpdateExpression="SET #status = :status, originalKey = :originalKey, archivedAt = :archivedAt, updatedAt = :updatedAt",
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'archived',
                ':originalKey': dest_key,
                ':archivedAt': now_decimal,
                ':updatedAt': now_decimal
            }
        )

        return success_response({
            'photoId': photo_id,
            'status': 'archived',
            'archivedAt': now
        })

    except KeyError as e:
        return error_response(400, f'Missing path parameter: {str(e)}', 'ValidationError')
    except s3_client.exceptions.NoSuchKey:
        return error_response(404, 'Source file not found in S3', 'NotFoundError')
    except Exception as e:
        print(f"Error deleting photo: {str(e)}")
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
