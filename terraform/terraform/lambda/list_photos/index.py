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
