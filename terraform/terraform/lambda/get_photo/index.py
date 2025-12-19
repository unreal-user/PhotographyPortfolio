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
    Get single photo metadata by photoId.

    Path Parameters:
    - photoId: UUID v4

    Output:
    {
        "photoId": "...",
        "title": "...",
        ...
    }
    """
    try:
        # Parse path parameter
        photo_id = event['pathParameters']['photoId']

        # Get item from DynamoDB
        table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

        response = table.get_item(Key={'photoId': photo_id})

        if 'Item' not in response:
            return error_response(404, 'Photo not found', 'NotFoundError')

        return success_response(response['Item'])

    except KeyError as e:
        return error_response(400, f'Missing path parameter: {str(e)}', 'ValidationError')
    except Exception as e:
        print(f"Error getting photo: {str(e)}")
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
