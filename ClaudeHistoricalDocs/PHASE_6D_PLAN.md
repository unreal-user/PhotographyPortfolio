# Phase 6d Implementation Plan: Batch Upload & Contact Form

## Overview
Add batch upload capabilities with bulk photo management and integrate SES for contact form email notifications.

**Key Features:**
1. Batch photo upload with progress tracking
2. Bulk actions: assign gallery, publish, archive, delete
3. Contact form email via AWS SES
4. Remove file size upload limit

---

## Part 1: Remove Upload File Size Limit

### Objective
Remove the 10MB file size restriction since files upload directly to S3 (not through Lambda).

### Changes

**File: `terraform/terraform/lambda/generate_upload_url/index.py`**

Current validation (around line 20-25):
```python
# Validate file size (10MB max)
max_size = 10 * 1024 * 1024  # 10MB in bytes
if file_size > max_size:
    return error_response(400, 'File size exceeds 10MB limit', 'FileTooLargeError', allowed_origin)
```

**Action:** Remove or comment out this validation block entirely.

**Why safe:** S3 supports objects up to 5TB. Pre-signed URLs handle the upload directly to S3, bypassing Lambda's payload limits.

---

## Part 2: AWS SES Setup for Contact Form

### Objective
Configure AWS SES to send contact form notifications to verified email addresses.

### Architecture

```
User fills contact form → API Gateway → contact_form Lambda → SES → c.eitutis@gmail.com
                                                              └→ (future: admin emails)
```

### Terraform Resources Needed

**File: `terraform/terraform/main.tf`**

Add after CloudFront resources (~line 620):

```hcl
# ============================================================================
# SES (Simple Email Service) - Contact Form
# ============================================================================

# Verify domain identity for sending from @cindyashleyphotography.com
resource "aws_ses_domain_identity" "main" {
  domain = "cindyashleyphotography.com"
}

# DNS verification record (output for manual Route 53 setup)
resource "aws_ses_domain_identity_verification" "main" {
  domain = aws_ses_domain_identity.main.id

  depends_on = [aws_ses_domain_identity.main]
}

# DKIM records for email authentication
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Verify recipient email (for sandbox mode)
resource "aws_ses_email_identity" "recipient" {
  email = "c.eitutis@gmail.com"
}

# IAM policy for Lambda to send emails via SES
resource "aws_iam_policy" "ses_send_email" {
  name        = "${var.project_name}-ses-send-email"
  description = "Allow Lambda to send emails via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "noreply@cindyashleyphotography.com"
          }
        }
      }
    ]
  })
}
```

**File: `terraform/terraform/outputs.tf`**

Add SES verification outputs:

```hcl
# SES Domain Verification
output "ses_domain_verification_token" {
  description = "Add this TXT record to Route 53 for domain verification"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "Add these CNAME records to Route 53 for DKIM"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "ses_verification_instructions" {
  description = "Manual steps to verify SES"
  value = <<-EOT

  SES Setup Instructions:

  1. Add TXT record to Route 53:
     Name: _amazonses.cindyashleyphotography.com
     Type: TXT
     Value: ${aws_ses_domain_identity.main.verification_token}

  2. Add DKIM CNAME records (3 records):
     ${join("\n     ", [for token in aws_ses_domain_dkim.main.dkim_tokens : "${token}._domainkey.cindyashleyphotography.com"])}

  3. Verify email c.eitutis@gmail.com:
     - Check email inbox for verification link from AWS
     - Click link to confirm

  4. Wait 24-72 hours for DNS propagation and domain verification

  EOT
}
```

### Manual Steps Required

After `terraform apply`:

1. **Verify Recipient Email:**
   - AWS will send verification email to `c.eitutis@gmail.com`
   - Click the verification link (expires in 24hrs)

2. **Add DNS Records to Route 53:**
   - TXT record for domain verification (from `ses_domain_verification_token` output)
   - 3 CNAME records for DKIM (from `ses_dkim_tokens` output)
   - Can use Terraform Route 53 resources or AWS Console

3. **Wait for Verification:**
   - Domain verification: 24-72 hours
   - Check status: `aws ses get-identity-verification-attributes --identities cindyashleyphotography.com`

4. **SES Sandbox Mode:**
   - Stay in sandbox (no production access needed)
   - Can only send TO verified emails (c.eitutis@gmail.com)
   - Can send FROM noreply@cindyashleyphotography.com (after domain verified)

---

## Part 3: Contact Form Lambda Function

### Objective
Create Lambda function to receive contact form submissions and send email via SES.

### New File Structure

```
terraform/terraform/lambda/contact_form/
├── index.py
└── requirements.txt (if needed)
```

**File: `terraform/terraform/lambda/contact_form/index.py`**

```python
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

        # Prepare email content
        recipient = os.environ['RECIPIENT_EMAIL']
        sender = os.environ['SENDER_EMAIL']

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
            Destination={'ToAddresses': [recipient]},
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
```

### Lambda Resource in Terraform

**File: `terraform/terraform/main.tf`**

Add after other Lambda functions:

```hcl
# Contact Form Lambda
resource "aws_lambda_function" "contact_form" {
  filename         = "${path.module}/lambda_packages/contact_form.zip"
  function_name    = "${var.project_name}-contact-form"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.lambda_handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_packages/contact_form.zip")
  runtime         = "python3.12"
  timeout         = 30

  environment {
    variables = {
      SENDER_EMAIL    = "noreply@cindyashleyphotography.com"
      RECIPIENT_EMAIL = "c.eitutis@gmail.com"
      AWS_REGION      = var.aws_region
    }
  }

  tags = {
    Name        = "${var.project_name}-contact-form"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach SES policy to Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_ses" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.ses_send_email.arn
}

# API Gateway resources for contact endpoint
resource "aws_api_gateway_resource" "contact" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  parent_id   = aws_api_gateway_rest_api.photos_api.root_resource_id
  path_part   = "contact"
}

# POST /contact
resource "aws_api_gateway_method" "contact_post" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.contact.id
  http_method   = "POST"
  authorization = "NONE"  # Public endpoint
}

resource "aws_api_gateway_integration" "contact_post" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.contact.id
  http_method             = aws_api_gateway_method.contact_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.contact_form.invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_contact" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact_form.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

# OPTIONS for CORS
resource "aws_api_gateway_method" "contact_options" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.contact.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "contact_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.contact.id
  http_method = aws_api_gateway_method.contact_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "contact_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.contact.id
  http_method = aws_api_gateway_method.contact_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "contact_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.contact.id
  http_method = aws_api_gateway_method.contact_options.http_method
  status_code = aws_api_gateway_method_response.contact_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
```

### Update build_lambdas.py

**File: `terraform/terraform/build_lambdas.py`**

Add `'contact_form'` to the lambdas list:

```python
lambdas = [
    'generate_upload_url',
    'create_photo',
    'list_photos',
    'get_photo',
    'update_photo',
    'delete_photo',
    'contact_form'  # Add this
]
```

---

## Part 4: Frontend Contact Form Integration

### Objective
Update ContactPage to call the new API endpoint.

**File: `root-project/src/pages/ContactPage.tsx`**

Replace the placeholder `handleSubmit` function (lines 23-46):

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  setSubmitStatus('idle');

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
      throw new Error(error.error || 'Failed to send message');
    }

    // Success
    setSubmitStatus('success');
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: ''
    });

    // Reset success message after 5 seconds
    setTimeout(() => setSubmitStatus('idle'), 5000);

  } catch (error) {
    console.error('Contact form error:', error);
    setSubmitStatus('error');
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## Part 5: Batch Upload Infrastructure

### Objective
Allow uploading multiple files simultaneously with progress tracking.

### Frontend Architecture

```
User selects multiple files
  → Generate upload URLs for each (parallel)
  → Upload each file to S3 (parallel with progress tracking)
  → Create metadata for each (parallel)
  → Show results: succeeded, failed (with retry)
```

### New Hook: useBatchUpload

**File: `root-project/src/hooks/useBatchUpload.ts`**

```typescript
import { useState, useCallback } from 'react';
import { photoApi } from '../services/photoApi';

export interface UploadProgress {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'failed';
  progress: number; // 0-100
  photoId?: string;
  error?: string;
}

export interface BatchUploadResult {
  succeeded: string[]; // photoIds
  failed: { file: File; error: string }[];
}

export const useBatchUpload = () => {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: File[]): Promise<BatchUploadResult> => {
    setIsUploading(true);

    const uploadMap = new Map<string, UploadProgress>();
    files.forEach(file => {
      uploadMap.set(file.name, {
        file,
        status: 'pending',
        progress: 0
      });
    });
    setUploads(new Map(uploadMap));

    const succeeded: string[] = [];
    const failed: { file: File; error: string }[] = [];

    // Upload all files in parallel
    await Promise.all(
      files.map(async (file) => {
        try {
          // Update status: generating URL
          setUploads(prev => new Map(prev).set(file.name, {
            ...prev.get(file.name)!,
            status: 'pending',
            progress: 10
          }));

          // Step 1: Generate upload URL
          const { uploadUrl, photoId, s3Key } = await photoApi.generateUploadUrl({
            fileType: file.type,
            fileSize: file.size,
            fileName: file.name
          });

          // Update status: uploading to S3
          setUploads(prev => new Map(prev).set(file.name, {
            ...prev.get(file.name)!,
            status: 'uploading',
            progress: 20,
            photoId
          }));

          // Step 2: Upload to S3
          await photoApi.uploadToS3(uploadUrl, file);

          // Update status: creating metadata
          setUploads(prev => new Map(prev).set(file.name, {
            ...prev.get(file.name)!,
            status: 'processing',
            progress: 80
          }));

          // Step 3: Create metadata in DynamoDB
          await photoApi.createPhoto({
            photoId,
            title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
            description: '',
            alt: file.name,
            copyright: `© ${new Date().getFullYear()}`,
            gallery: 'Uncategorized'
          });

          // Success
          setUploads(prev => new Map(prev).set(file.name, {
            ...prev.get(file.name)!,
            status: 'success',
            progress: 100
          }));

          succeeded.push(photoId);

        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          setUploads(prev => new Map(prev).set(file.name, {
            ...prev.get(file.name)!,
            status: 'failed',
            progress: 0,
            error: error instanceof Error ? error.message : 'Upload failed'
          }));

          failed.push({
            file,
            error: error instanceof Error ? error.message : 'Upload failed'
          });
        }
      })
    );

    setIsUploading(false);
    return { succeeded, failed };
  }, []);

  const retryFailed = useCallback(async (files: File[]): Promise<BatchUploadResult> => {
    // Filter to only retry files that exist in uploads map
    const filesToRetry = files.filter(file => {
      const upload = uploads.get(file.name);
      return upload?.status === 'failed';
    });

    return uploadFiles(filesToRetry);
  }, [uploads, uploadFiles]);

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFiles,
    retryFailed,
    clearUploads
  };
};
```

### Batch Upload UI Component

**File: `root-project/src/components/BatchUploadModal/BatchUploadModal.tsx`**

```typescript
import React, { useState, useRef } from 'react';
import { useBatchUpload } from '../../hooks/useBatchUpload';
import './BatchUploadModal.css';

interface BatchUploadModalProps {
  onClose: () => void;
  onComplete: () => void; // Refresh admin page after upload
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({ onClose, onComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, isUploading, uploadFiles, retryFailed } = useBatchUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const result = await uploadFiles(selectedFiles);

    if (result.failed.length === 0) {
      // All succeeded - close modal and refresh
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1000);
    }
  };

  const handleRetry = async () => {
    const failedFiles = uploads
      .filter(u => u.status === 'failed')
      .map(u => u.file);

    await retryFailed(failedFiles);
  };

  const totalFiles = uploads.length || selectedFiles.length;
  const completedFiles = uploads.filter(u => u.status === 'success').length;
  const failedFiles = uploads.filter(u => u.status === 'failed').length;
  const progressPercent = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  return (
    <div className="batch-upload-modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isUploading && onClose()}>
      <div className="batch-upload-modal">
        <div className="batch-upload-header">
          <h2>Batch Upload Photos</h2>
          <button className="batch-upload-close" onClick={onClose} disabled={isUploading}>×</button>
        </div>

        <div className="batch-upload-content">
          {uploads.length === 0 ? (
            // File selection
            <>
              <div className="file-select-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="file-input-hidden"
                  id="batch-file-input"
                />
                <label htmlFor="batch-file-input" className="file-select-button">
                  Choose Photos
                </label>
                {selectedFiles.length > 0 && (
                  <p className="file-count">{selectedFiles.length} file(s) selected</p>
                )}
              </div>

              <div className="batch-upload-actions">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0}
                  className="btn-primary"
                >
                  Upload {selectedFiles.length} Photo(s)
                </button>
              </div>
            </>
          ) : (
            // Upload progress
            <>
              <div className="upload-progress-bar-container">
                <div className="upload-progress-bar" style={{ width: `${progressPercent}%` }} />
                <span className="upload-progress-text">
                  {completedFiles} / {totalFiles} uploaded
                </span>
              </div>

              <div className="upload-list">
                {uploads.map(upload => (
                  <div key={upload.file.name} className={`upload-item upload-${upload.status}`}>
                    <span className="upload-filename">{upload.file.name}</span>
                    <span className="upload-status">
                      {upload.status === 'pending' && 'Preparing...'}
                      {upload.status === 'uploading' && 'Uploading...'}
                      {upload.status === 'processing' && 'Processing...'}
                      {upload.status === 'success' && '✓ Complete'}
                      {upload.status === 'failed' && `✗ ${upload.error}`}
                    </span>
                  </div>
                ))}
              </div>

              {failedFiles > 0 && !isUploading && (
                <div className="upload-failed-actions">
                  <p className="upload-failed-message">
                    {failedFiles} file(s) failed to upload
                  </p>
                  <button onClick={handleRetry} className="btn-retry">
                    Retry Failed
                  </button>
                </div>
              )}

              {!isUploading && (
                <div className="batch-upload-actions">
                  <button onClick={onClose} className="btn-secondary">
                    {failedFiles > 0 ? 'Close' : 'Done'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

**File: `root-project/src/components/BatchUploadModal/BatchUploadModal.css`**

```css
.batch-upload-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.batch-upload-modal {
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-md);
}

.batch-upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.batch-upload-header h2 {
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  margin: 0;
}

.batch-upload-close {
  background: none;
  border: none;
  font-size: 32px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.batch-upload-close:hover {
  color: var(--color-text-primary);
}

.batch-upload-content {
  padding: var(--space-lg);
  overflow-y: auto;
  flex: 1;
}

.file-select-area {
  text-align: center;
  padding: var(--space-2xl);
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  margin-bottom: var(--space-lg);
}

.file-input-hidden {
  display: none;
}

.file-select-button {
  display: inline-block;
  padding: var(--space-md) var(--space-xl);
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.file-select-button:hover {
  background-color: var(--color-text-primary);
}

.file-count {
  margin-top: var(--space-md);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
}

.upload-progress-bar-container {
  position: relative;
  width: 100%;
  height: 40px;
  background-color: var(--color-bg-primary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--space-lg);
}

.upload-progress-bar {
  height: 100%;
  background-color: var(--color-accent);
  transition: width var(--transition-normal);
}

.upload-progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.upload-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: var(--space-lg);
}

.upload-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-sans);
  font-size: 14px;
}

.upload-item:last-child {
  border-bottom: none;
}

.upload-filename {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: var(--space-md);
}

.upload-status {
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.upload-success .upload-status {
  color: #2d6930;
}

.upload-failed .upload-status {
  color: #c33;
}

.upload-failed-actions {
  text-align: center;
  padding: var(--space-lg);
  background-color: #fee;
  border-radius: 4px;
  margin-bottom: var(--space-lg);
}

.upload-failed-message {
  color: #721c24;
  font-family: var(--font-sans);
  margin-bottom: var(--space-md);
}

.batch-upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}

.btn-primary,
.btn-secondary,
.btn-retry {
  padding: var(--space-sm) var(--space-lg);
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.btn-primary {
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-text-primary);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-bg-primary);
}

.btn-retry {
  background-color: #721c24;
  color: white;
}

.btn-retry:hover {
  background-color: #5a1419;
}
```

---

## Part 6: Bulk Actions Backend

### Objective
Create Lambda function to handle bulk operations on multiple photos.

**File: `terraform/terraform/lambda/bulk_update_photos/index.py`**

```python
import boto3
import json
import os
from decimal import Decimal

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

        # Limit batch size (DynamoDB BatchWriteItem max is 25)
        if len(photo_ids) > 100:
            return error_response(400, 'Maximum 100 photos per batch', 'ValidationError', allowed_origin)

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
        from datetime import datetime
        update_expression_parts.append("#updatedAt = :updatedAt")
        expression_attribute_names["#updatedAt"] = "updatedAt"
        expression_attribute_values[":updatedAt"] = datetime.utcnow().isoformat() + 'Z'

        # Handle publishedAt for status changes
        if 'status' in updates and updates['status'] == 'published':
            update_expression_parts.append("#publishedAt = :publishedAt")
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
```

### Lambda + API Gateway Resources

Add to `main.tf`:

```hcl
# Bulk Update Photos Lambda
resource "aws_lambda_function" "bulk_update_photos" {
  filename         = "${path.module}/lambda_packages/bulk_update_photos.zip"
  function_name    = "${var.project_name}-bulk-update-photos"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.lambda_handler"
  source_code_hash = filebase64sha256("${path.module}/lambda_packages/bulk_update_photos.zip")
  runtime         = "python3.12"
  timeout         = 60  # Longer timeout for batch operations

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
    }
  }

  tags = {
    Name        = "${var.project_name}-bulk-update-photos"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_permission" "api_gateway_bulk_update" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bulk_update_photos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

# API Gateway: POST /photos/bulk
resource "aws_api_gateway_resource" "photos_bulk" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  parent_id   = aws_api_gateway_resource.photos.id
  path_part   = "bulk"
}

resource "aws_api_gateway_method" "bulk_update_post" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photos_bulk.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "bulk_update_post" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photos_bulk.id
  http_method             = aws_api_gateway_method.bulk_update_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.bulk_update_photos.invoke_arn
}

# OPTIONS for CORS
resource "aws_api_gateway_method" "bulk_update_options" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photos_bulk.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "bulk_update_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos_bulk.id
  http_method = aws_api_gateway_method.bulk_update_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "bulk_update_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos_bulk.id
  http_method = aws_api_gateway_method.bulk_update_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "bulk_update_options" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos_bulk.id
  http_method = aws_api_gateway_method.bulk_update_options.http_method
  status_code = aws_api_gateway_method_response.bulk_update_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
```

Update `build_lambdas.py` to include `'bulk_update_photos'`.

---

## Part 7: Bulk Actions Frontend

### Objective
Add checkbox selection and bulk action buttons to Admin page.

**File: `root-project/src/services/photoApi.ts`**

Add bulk update method:

```typescript
/**
 * Bulk update multiple photos
 */
async bulkUpdatePhotos(photoIds: string[], updates: Partial<UpdatePhotoRequest>): Promise<{ succeeded: string[]; failed: any[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/photos/bulk`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ photoIds, updates }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to bulk update photos' }));
    throw new Error(error.error || 'Failed to bulk update photos');
  }

  return response.json();
},
```

**File: `root-project/src/components/PhotoCard/PhotoCard.tsx`**

Add checkbox selection (update existing component):

```typescript
import React from 'react';
import type { Photo } from '../../interfaces/Photo';
import './PhotoCard.css';

interface PhotoCardProps {
  photo: Photo;
  onPublish?: (photoId: string) => void;
  onArchive?: (photoId: string) => void;
  onDelete?: (photoId: string) => void;
  isSelected?: boolean;
  onSelect?: (photoId: string) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onPublish,
  onArchive,
  onDelete,
  isSelected = false,
  onSelect
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle selection if clicking on a button
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onSelect?.(photo.photoId);
  };

  return (
    <div
      className={`photo-card ${isSelected ? 'photo-card-selected' : ''}`}
      onClick={handleCardClick}
    >
      {onSelect && (
        <div className="photo-card-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(photo.photoId)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="photo-card-image-wrapper">
        <img
          src={photo.thumbnailUrl || photo.fullResUrl}
          alt={photo.alt}
          className="photo-card-image"
          loading="lazy"
        />
      </div>

      <div className="photo-card-content">
        <h3 className="photo-card-title">{photo.title}</h3>
        <p className="photo-card-description">{photo.description}</p>
        <div className="photo-card-meta">
          <span className="photo-card-status">{photo.status}</span>
          {photo.gallery && <span className="photo-card-gallery">{photo.gallery}</span>}
        </div>
      </div>

      <div className="photo-card-actions">
        {photo.status === 'pending' && onPublish && (
          <button onClick={(e) => { e.stopPropagation(); onPublish(photo.photoId); }} className="btn-publish">
            Publish
          </button>
        )}
        {photo.status === 'published' && onArchive && (
          <button onClick={(e) => { e.stopPropagation(); onArchive(photo.photoId); }} className="btn-archive">
            Archive
          </button>
        )}
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(photo.photoId); }} className="btn-delete">
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
```

**File: `root-project/src/components/PhotoCard/PhotoCard.css`**

Add checkbox styles:

```css
.photo-card {
  position: relative;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.photo-card-selected {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
}

.photo-card-checkbox {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  padding: 4px;
}

.photo-card-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}
```

**File: `root-project/src/pages/AdminPage.tsx`**

Add selection state and bulk actions:

```typescript
import React, { useState, useEffect } from 'react';
import { photoApi } from '../services/photoApi';
import { PhotoCard } from '../components/PhotoCard/PhotoCard';
import { BatchUploadModal } from '../components/BatchUploadModal/BatchUploadModal';
import type { Photo } from '../interfaces/Photo';
import './AdminPage.css';

const AdminPage: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const response = await photoApi.listPhotos('pending', 100);
      setPhotos(response.photos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.photoId)));
    }
  };

  const handleBulkPublish = async () => {
    if (selectedPhotoIds.size === 0) return;

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { status: 'published' });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (error) {
      console.error('Bulk publish failed:', error);
      alert('Failed to publish selected photos');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedPhotoIds.size === 0) return;

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { status: 'archived' });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (error) {
      console.error('Bulk archive failed:', error);
      alert('Failed to archive selected photos');
    }
  };

  const handleBulkAssignGallery = async () => {
    if (selectedPhotoIds.size === 0) return;

    const galleryName = prompt('Enter gallery name:');
    if (!galleryName) return;

    try {
      await photoApi.bulkUpdatePhotos(Array.from(selectedPhotoIds), { gallery: galleryName });
      setSelectedPhotoIds(new Set());
      loadPhotos();
    } catch (error) {
      console.error('Bulk gallery assignment failed:', error);
      alert('Failed to assign gallery');
    }
  };

  const hasSelection = selectedPhotoIds.size > 0;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>

        <div className="admin-actions">
          {hasSelection ? (
            <>
              <span className="selection-count">{selectedPhotoIds.size} selected</span>
              <button onClick={handleSelectAll} className="btn-select-all">
                {selectedPhotoIds.size === photos.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleBulkPublish} className="btn-bulk-action">
                Publish Selected
              </button>
              <button onClick={handleBulkArchive} className="btn-bulk-action">
                Archive Selected
              </button>
              <button onClick={handleBulkAssignGallery} className="btn-bulk-action">
                Assign Gallery
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSelectAll} className="btn-select-all">Select All</button>
              <button onClick={() => setShowBatchUpload(true)} className="btn-primary">
                Batch Upload
              </button>
            </>
          )}
        </div>
      </header>

      {isLoading ? (
        <p>Loading photos...</p>
      ) : photos.length > 0 ? (
        <div className="admin-photo-grid">
          {photos.map(photo => (
            <PhotoCard
              key={photo.photoId}
              photo={photo}
              isSelected={selectedPhotoIds.has(photo.photoId)}
              onSelect={handleSelect}
              onPublish={async (id) => {
                await photoApi.updatePhoto(id, { status: 'published' });
                loadPhotos();
              }}
              onArchive={async (id) => {
                await photoApi.updatePhoto(id, { status: 'archived' });
                loadPhotos();
              }}
              onDelete={async (id) => {
                if (confirm('Delete this photo?')) {
                  await photoApi.deletePhoto(id);
                  loadPhotos();
                }
              }}
            />
          ))}
        </div>
      ) : (
        <p>No pending photos</p>
      )}

      {showBatchUpload && (
        <BatchUploadModal
          onClose={() => setShowBatchUpload(false)}
          onComplete={loadPhotos}
        />
      )}
    </div>
  );
};

export default AdminPage;
```

**File: `root-project/src/pages/AdminPage.css`**

Add bulk action styles:

```css
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
}

.admin-actions {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.selection-count {
  font-family: var(--font-sans);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.btn-select-all,
.btn-bulk-action,
.btn-primary {
  padding: var(--space-sm) var(--space-md);
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.btn-select-all {
  background-color: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-bulk-action {
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
}

.btn-primary {
  background-color: var(--color-text-primary);
  color: var(--color-bg-primary);
}

.btn-select-all:hover,
.btn-bulk-action:hover,
.btn-primary:hover {
  opacity: 0.8;
}

.admin-photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
  padding: var(--space-lg);
}
```

---

## Implementation Checklist

### Backend - Infrastructure

- [ ] **Remove file size limit:**
  - [ ] Edit `lambda/generate_upload_url/index.py`
  - [ ] Remove 10MB validation
  - [ ] Rebuild and deploy

- [ ] **SES Setup:**
  - [ ] Add SES resources to `main.tf`
  - [ ] Add outputs to `outputs.tf`
  - [ ] Run `terraform apply`
  - [ ] Verify c.eitutis@gmail.com email
  - [ ] Add DNS records to Route 53
  - [ ] Wait for domain verification

- [ ] **Contact Form Lambda:**
  - [ ] Create `lambda/contact_form/index.py`
  - [ ] Add to `build_lambdas.py`
  - [ ] Add Lambda resource to `main.tf`
  - [ ] Add API Gateway endpoint `/contact`
  - [ ] Test with curl/Postman

- [ ] **Bulk Update Lambda:**
  - [ ] Create `lambda/bulk_update_photos/index.py`
  - [ ] Add to `build_lambdas.py`
  - [ ] Add Lambda resource to `main.tf`
  - [ ] Add API Gateway endpoint `/photos/bulk`

### Frontend - Batch Upload

- [ ] **Batch Upload Hook:**
  - [ ] Create `hooks/useBatchUpload.ts`
  - [ ] Test upload flow

- [ ] **Batch Upload Modal:**
  - [ ] Create `components/BatchUploadModal/BatchUploadModal.tsx`
  - [ ] Create `components/BatchUploadModal/BatchUploadModal.css`
  - [ ] Integrate with AdminPage

### Frontend - Bulk Actions

- [ ] **Photo Card Selection:**
  - [ ] Update `PhotoCard.tsx` with checkbox
  - [ ] Update `PhotoCard.css` with selected styles

- [ ] **Admin Page Bulk UI:**
  - [ ] Add selection state to `AdminPage.tsx`
  - [ ] Add "Select All" button
  - [ ] Add bulk action buttons
  - [ ] Update `AdminPage.css`

- [ ] **API Integration:**
  - [ ] Add `bulkUpdatePhotos` to `photoApi.ts`
  - [ ] Test bulk operations

### Frontend - Contact Form

- [ ] **Contact Page:**
  - [ ] Update `ContactPage.tsx` with real API call
  - [ ] Test form submission
  - [ ] Verify email received

---

## Testing Plan

### SES Email
1. Submit contact form
2. Check c.eitutis@gmail.com inbox
3. Verify email format, reply-to address

### Batch Upload
1. Select 5 images (various sizes)
2. Upload and watch progress bar
3. Verify all appear in pending state
4. Test retry with failed upload (disconnect wifi mid-upload)

### Bulk Actions
1. Upload 10 photos
2. Select 5 photos (click cards)
3. Click "Select All" → verify all selected
4. Click "Publish Selected" → verify status changes
5. Select 3 photos, assign to gallery "Test Gallery"
6. Verify gallery appears in portfolio page

### File Size
1. Upload a 50MB+ image
2. Verify it completes without file size error

---

## Deployment Steps

```bash
# 1. Create branch
git checkout phase-6b
git pull
git checkout -b phase-6d

# 2. Backend changes
cd terraform/terraform

# Edit files as per plan
# - Remove file size limit
# - Add SES resources
# - Add contact_form Lambda
# - Add bulk_update_photos Lambda

python3 build_lambdas.py
terraform plan
terraform apply

# Note SES verification token and DKIM tokens from outputs

# 3. Verify SES email
# Check c.eitutis@gmail.com for verification link

# 4. Add DNS records to Route 53
# Use terraform or AWS Console

# 5. Frontend changes
cd ../../root-project

# Create new files:
# - hooks/useBatchUpload.ts
# - components/BatchUploadModal/*

# Update files:
# - services/photoApi.ts
# - components/PhotoCard/*
# - pages/AdminPage.tsx
# - pages/ContactPage.tsx

npm run dev  # Test locally

# 6. Commit and push
git add -A
git commit -m "Phase 6d: Batch upload, bulk actions, contact form email"
git push -u origin phase-6d
```

---

## Future Enhancements (Out of Scope)

- Free captcha (reCAPTCHA v3 or hCaptcha)
- Drag-and-drop bulk gallery assignment
- Bulk edit modal with shared metadata
- Email templates with HTML formatting
- SES production access for unrestricted sending
- Admin email management UI (add/remove recipients)
