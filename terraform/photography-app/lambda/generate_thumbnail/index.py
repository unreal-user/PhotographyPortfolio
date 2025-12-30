import boto3
import os
import tempfile
from urllib.parse import unquote_plus
from PIL import Image
from io import BytesIO

s3_client = boto3.client('s3')

# Image size configuration
THUMBNAIL_WIDTH = 400   # Max width for gallery thumbnails
DISPLAY_WIDTH = 1920    # Max width for hero/full-screen display
IMAGE_QUALITY = 85      # JPEG quality (1-100)

def lambda_handler(event, context):
    """
    Generate thumbnails for uploaded images.

    Triggered by S3 upload events (uploads/* prefix).
    Creates two optimized versions:
    - thumbnails/* (400px) - For gallery display
    - display/* (1920px) - For hero images and full-screen viewing

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
        if not source_key.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.avif')):
            print(f"Skipping non-image file: {source_key}")
            return {'statusCode': 200, 'body': 'Not an image file'}

        # Skip if already a processed image
        if source_key.startswith('thumbnails/') or source_key.startswith('display/'):
            print(f"Skipping already processed file: {source_key}")
            return {'statusCode': 200, 'body': 'Already processed'}

        # Generate keys (preserve filename, change prefix)
        # uploads/abc-123.jpg -> thumbnails/abc-123.jpg, display/abc-123.jpg
        filename = os.path.basename(source_key)
        thumbnail_key = f"thumbnails/{filename}"
        display_key = f"display/{filename}"

        # Download original image from S3
        print(f"Downloading original image: {source_key}")
        response = s3_client.get_object(Bucket=bucket_name, Key=source_key)
        image_data = response['Body'].read()
        content_type = response['ContentType']

        image_size_mb = len(image_data) / (1024 * 1024)
        print(f"Image size: {image_size_mb:.2f} MB, Content-Type: {content_type}")

        # Generate thumbnail (400px for galleries)
        print(f"Generating thumbnail (max width: {THUMBNAIL_WIDTH}px)")
        thumbnail_data = resize_image(image_data, content_type, THUMBNAIL_WIDTH)

        # Generate display size (1920px for hero/full-screen)
        print(f"Generating display size (max width: {DISPLAY_WIDTH}px)")
        display_data = resize_image(image_data, content_type, DISPLAY_WIDTH)

        # Upload thumbnail to S3
        print(f"Uploading thumbnail: {thumbnail_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=thumbnail_key,
            Body=thumbnail_data,
            ContentType=content_type,
            CacheControl='max-age=31536000',
        )

        # Upload display size to S3
        print(f"Uploading display size: {display_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=display_key,
            Body=display_data,
            ContentType=content_type,
            CacheControl='max-age=31536000',
        )

        print(f"✓ Images created successfully: {thumbnail_key}, {display_key}")

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

def resize_image(image_data, content_type, max_width):
    """
    Resize image to specified max width.

    Args:
        image_data: Binary image data
        content_type: MIME type of the image
        max_width: Maximum width in pixels

    Returns:
        Binary resized image data
    """
    # Open image with Pillow
    print(f"Opening image with Pillow (content_type: {content_type})")
    img = Image.open(BytesIO(image_data))
    print(f"Image opened: {img.format}, size: {img.size}, mode: {img.mode}")

    # Convert RGBA to RGB if necessary (for JPEG compatibility)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = background

    # Calculate new dimensions (maintain aspect ratio)
    original_width, original_height = img.size

    if original_width <= max_width:
        # Image is already smaller than target size
        new_width = original_width
        new_height = original_height
    else:
        # Resize to max width, maintaining aspect ratio
        aspect_ratio = original_height / original_width
        new_width = max_width
        new_height = int(max_width * aspect_ratio)

    # Resize image with high-quality resampling
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Determine output format based on content type
    # Note: AVIF files are converted to JPEG for broad compatibility
    if content_type == 'image/png':
        output_format = 'PNG'
    elif content_type == 'image/webp':
        output_format = 'WEBP'
    elif content_type == 'image/avif':
        output_format = 'JPEG'  # Convert AVIF to JPEG for compatibility
    else:
        output_format = 'JPEG'

    # Save to bytes buffer
    buffer = BytesIO()
    if output_format == 'JPEG':
        img_resized.save(buffer, format=output_format, quality=IMAGE_QUALITY, optimize=True)
    elif output_format == 'WEBP':
        img_resized.save(buffer, format=output_format, quality=IMAGE_QUALITY)
    else:
        img_resized.save(buffer, format=output_format, optimize=True)

    return buffer.getvalue()
