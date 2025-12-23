import boto3
import json
import os
from datetime import datetime

ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

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
    Handle contact form submissions and send email via SES.

    POST body:
    {
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Question about pricing",
        "message": "I'd like to inquire about..."
    }
    """
    try:
        allowed_origin = get_allowed_origin(event)

        # Parse request body
        body = json.loads(event['body'])
        name = body.get('name', '').strip()
        sender_email = body.get('email', '').strip()
        subject = body.get('subject', '').strip()
        message = body.get('message', '').strip()

        # Validate required fields
        if not all([name, sender_email, subject, message]):
            return error_response(400, 'Missing required fields', 'ValidationError', allowed_origin)

        # Basic email validation
        if '@' not in sender_email or '.' not in sender_email:
            return error_response(400, 'Invalid email address', 'ValidationError', allowed_origin)

        # Get email configuration from environment
        recipient_emails = os.environ.get('RECIPIENT_EMAILS', '').split(',')
        sender = os.environ.get('SENDER_EMAIL')

        if not recipient_emails or not sender:
            print("ERROR: Missing email configuration in environment variables")
            return error_response(500, 'Email service not configured', 'ConfigurationError', allowed_origin)

        # Prepare email content
        email_subject = f"Contact Form: {subject}"
        email_body = f"""
New contact form submission from cindyashleyphotography.com

From: {name}
Email: {sender_email}
Subject: {subject}

Message:
{message}

---
Sent: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
"""

        # Send email via SES
        response = ses.send_email(
            Source=sender,
            Destination={'ToAddresses': recipient_emails},
            Message={
                'Subject': {'Data': email_subject, 'Charset': 'UTF-8'},
                'Body': {'Text': {'Data': email_body, 'Charset': 'UTF-8'}}
            },
            ReplyToAddresses=[sender_email]  # Allow direct reply to submitter
        )

        print(f"Email sent successfully. MessageId: {response['MessageId']}")

        return success_response({
            'message': 'Message sent successfully',
            'messageId': response['MessageId']
        }, allowed_origin)

    except json.JSONDecodeError:
        return error_response(400, 'Invalid JSON in request body', 'ValidationError', allowed_origin)
    except ses.exceptions.MessageRejected as e:
        print(f"SES rejected message: {str(e)}")
        return error_response(500, 'Failed to send email. Please try again later.', 'EmailError', allowed_origin)
    except Exception as e:
        print(f"Error processing contact form: {str(e)}")
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
