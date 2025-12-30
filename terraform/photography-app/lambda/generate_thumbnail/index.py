import boto3
import os
import tempfile
from urllib.parse import unquote_plus
from PIL import Image
from io import BytesIO

s3_client = boto3.client('s3')

# Thumbnail configuration
THUMBNAIL_WIDTH = 400  # Max width in pixels
THUMBNAIL_QUALITY = 85  # JPEG quality (1-100)

def lambda_handler(event, context):
    """
    Generate thumbnails for uploaded images.

    Triggered by S3 upload events (uploads/* prefix).
    Creates resized thumbnails in thumbnails/* prefix.

    Event format:
    {
        "Records": [{
            "s3": {
                "bucket": {"name": "bucket-name"},
                "object": {"key": "uploads/photo-id.jpg"}
            }
        }]
    }
    """
    try:
        # Parse S3 event
        record = event['Records'][0]
        bucket_name = record['s3']['bucket']['name']
        source_key = unquote_plus(record['s3']['object']['key'])

        print(f"Processing thumbnail for: s3://{bucket_name}/{source_key}")

        # Skip if not an image file
        if not source_key.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            print(f"Skipping non-image file: {source_key}")
            return {'statusCode': 200, 'body': 'Not an image file'}

        # Skip if already a thumbnail
        if source_key.startswith('thumbnails/'):
            print(f"Skipping thumbnail file: {source_key}")
            return {'statusCode': 200, 'body': 'Already a thumbnail'}

        # Generate thumbnail key (preserve filename, change prefix)
        # uploads/abc-123.jpg -> thumbnails/abc-123.jpg
        # originals/abc-123.jpg -> thumbnails/abc-123.jpg
        filename = os.path.basename(source_key)
        thumbnail_key = f"thumbnails/{filename}"

        # Download original image from S3
        print(f"Downloading original image: {source_key}")
        response = s3_client.get_object(Bucket=bucket_name, Key=source_key)
        image_data = response['Body'].read()
        content_type = response['ContentType']

        # Generate thumbnail
        print(f"Generating thumbnail (max width: {THUMBNAIL_WIDTH}px)")
        thumbnail_data = generate_thumbnail(image_data, content_type)

        # Upload thumbnail to S3
        print(f"Uploading thumbnail: {thumbnail_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=thumbnail_key,
            Body=thumbnail_data,
            ContentType=content_type,
            CacheControl='max-age=31536000',  # Cache for 1 year
        )

        print(f"✓ Thumbnail created successfully: {thumbnail_key}")

        return {
            'statusCode': 200,
            'body': f'Thumbnail created: {thumbnail_key}'
        }

    except Exception as e:
        print(f"Error generating thumbnail: {str(e)}")
        # Don't raise - we don't want to retry on permanent failures
        return {
            'statusCode': 500,
            'body': f'Error: {str(e)}'
        }

def generate_thumbnail(image_data, content_type):
    """
    Resize image to thumbnail size.

    Args:
        image_data: Binary image data
        content_type: MIME type of the image

    Returns:
        Binary thumbnail data
    """
    # Open image with Pillow
    img = Image.open(BytesIO(image_data))

    # Convert RGBA to RGB if necessary (for JPEG compatibility)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background

    # Calculate new dimensions (maintain aspect ratio)
    original_width, original_height = img.size

    if original_width <= THUMBNAIL_WIDTH:
        # Image is already smaller than thumbnail size
        new_width = original_width
        new_height = original_height
    else:
        # Resize to thumbnail width, maintaining aspect ratio
        aspect_ratio = original_height / original_width
        new_width = THUMBNAIL_WIDTH
        new_height = int(THUMBNAIL_WIDTH * aspect_ratio)

    # Resize image with high-quality resampling
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Determine output format
    if content_type == 'image/png':
        output_format = 'PNG'
    elif content_type == 'image/webp':
        output_format = 'WEBP'
    else:
        output_format = 'JPEG'

    # Save to bytes buffer
    buffer = BytesIO()
    if output_format == 'JPEG':
        img_resized.save(buffer, format=output_format, quality=THUMBNAIL_QUALITY, optimize=True)
    elif output_format == 'WEBP':
        img_resized.save(buffer, format=output_format, quality=THUMBNAIL_QUALITY)
    else:
        img_resized.save(buffer, format=output_format, optimize=True)

    return buffer.getvalue()
