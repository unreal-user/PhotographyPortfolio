# Phase 5 Summary: Lambda Functions + API Gateway

**Status**: ✅ Complete
**Date**: 2025-12-19
**Purpose**: Serverless backend API for photo management using AWS Lambda + API Gateway

---

## Overview

Phase 5 implements a complete serverless backend API with 6 Lambda functions and REST API Gateway. This provides full CRUD operations for photo management with Cognito JWT authentication (admin-only access).

**Key Features**:
- 6 Lambda functions (Python 3.12)
- REST API Gateway with Cognito authorizer
- Pre-signed S3 URLs for direct browser uploads
- Photo lifecycle management (pending → published → archived)
- CORS support for frontend integration
- CloudWatch logging (14-day retention)

---

## Resources Created

### Lambda Functions (6)
1. **generate-upload-url** - Generate pre-signed S3 URLs for photo uploads
2. **create-photo** - Create photo metadata in DynamoDB after S3 upload
3. **list-photos** - Query photos by status using DynamoDB GSI
4. **get-photo** - Retrieve single photo metadata by photoId
5. **update-photo** - Update metadata and handle status transitions
6. **delete-photo** - Soft delete photos (move to archive/)

### CloudWatch Log Groups (6)
- `/aws/lambda/photography-project-generate-upload-url`
- `/aws/lambda/photography-project-create-photo`
- `/aws/lambda/photography-project-list-photos`
- `/aws/lambda/photography-project-get-photo`
- `/aws/lambda/photography-project-update-photo`
- `/aws/lambda/photography-project-delete-photo`

**Retention**: 14 days

### IAM Resources (5)
- **Lambda Execution Role** (`photography-project-lambda-execution-role`)
- **S3 Upload Policy** - Pre-signed URL generation (uploads/*)
- **S3 Copy Policy** - Move files between folders (uploads/, originals/, archive/)
- **DynamoDB Policy** - Read/write photo metadata
- **CloudWatch Logs Policy** - Write logs (via AWSLambdaBasicExecutionRole)

### API Gateway Resources
- **REST API**: `photography-project-api`
- **Cognito Authorizer**: JWT-based authentication using Phase 3 user pool
- **Stage**: `prod`
- **Paths**:
  - `/photos`
  - `/photos/upload-url`
  - `/photos/{photoId}`
- **Methods**: POST, GET, PATCH, DELETE + OPTIONS (CORS)

---

## API Endpoints

| Method | Path | Lambda | Auth | Purpose |
|--------|------|--------|------|---------|
| POST | `/photos/upload-url` | generate-upload-url | Required | Generate pre-signed S3 URL |
| POST | `/photos` | create-photo | Required | Create photo metadata |
| GET | `/photos` | list-photos | Required | List photos (query by status) |
| GET | `/photos/{photoId}` | get-photo | Required | Get single photo |
| PATCH | `/photos/{photoId}` | update-photo | Required | Update metadata, publish |
| DELETE | `/photos/{photoId}` | delete-photo | Required | Soft delete photo |

**Base URL**: Available via `terraform output api_gateway_url`
**Authentication**: All endpoints require Cognito JWT token in `Authorization` header

---

## Deployment Steps

### 1. Build Lambda Packages

```bash
cd /workspace/PhotographyPortfolio/terraform/terraform
python3 build_lambdas.py
```

**Output**: 6 .zip files in `/workspace/PhotographyPortfolio/terraform/terraform/`
- `generate_upload_url.zip`
- `create_photo.zip`
- `list_photos.zip`
- `get_photo.zip`
- `update_photo.zip`
- `delete_photo.zip`

### 2. Validate Terraform Configuration

```bash
terraform fmt
terraform validate
```

### 3. Review Planned Changes

```bash
terraform plan
```

**Expected**: ~60 resources to add
- 6 Lambda functions
- 6 CloudWatch log groups
- 1 IAM role + 3 policies + 4 attachments
- 1 API Gateway REST API
- 1 Cognito authorizer
- 3 API Gateway resources (paths)
- 6 methods + 6 integrations
- 6 Lambda permissions
- 3 CORS OPTIONS methods (9 resources)
- 1 deployment + 1 stage

### 4. Deploy

```bash
terraform apply
```

### 5. Get API URL

```bash
terraform output api_gateway_url
```

---

## Testing Checklist

### Prerequisites

1. **Get JWT Token** (from Phase 3 Cognito admin user):

```bash
# Get user pool ID and app client ID
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
APP_CLIENT_ID=$(terraform output -raw cognito_app_client_id)

# Login and get JWT token
JWT_TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $APP_CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin@test.com,PASSWORD=YourPassword123! \
  --query 'AuthenticationResult.IdToken' \
  --output text)

echo "JWT Token: $JWT_TOKEN"
```

2. **Get API Base URL**:

```bash
API_URL=$(terraform output -raw api_gateway_url)
echo "API URL: $API_URL"
```

### Test 1: Generate Upload URL

```bash
curl -X POST "$API_URL/photos/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileType": "image/jpeg",
    "fileSize": 2048000,
    "fileName": "test-photo.jpg"
  }'
```

**Expected Response**:
```json
{
  "uploadUrl": "https://...",
  "photoId": "uuid-v4",
  "s3Key": "uploads/uuid-v4.jpg",
  "expiresAt": "2025-12-19T10:05:00Z"
}
```

**Validation**:
- ✅ Returns 200 status code
- ✅ uploadUrl is valid pre-signed URL
- ✅ photoId is UUID v4 format
- ✅ s3Key starts with "uploads/"
- ✅ expiresAt is ~5 minutes from now

### Test 2: Upload File to S3

```bash
# Save photoId and uploadUrl from previous response
PHOTO_ID="<photoId-from-test-1>"
UPLOAD_URL="<uploadUrl-from-test-1>"

# Upload a test JPEG file
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --upload-file test-photo.jpg
```

**Expected**: 200 OK (empty body)

**Validation**:
- ✅ File appears in S3 bucket under uploads/
- ✅ File size matches uploaded file
- ✅ Content-Type is image/jpeg

### Test 3: Create Photo Metadata

```bash
curl -X POST "$API_URL/photos" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"photoId\": \"$PHOTO_ID\",
    \"title\": \"Test Photo\",
    \"description\": \"A test photo for Phase 5 validation\",
    \"alt\": \"Test photo showing successful upload\",
    \"copyright\": \"© 2025 Test User\"
  }"
```

**Expected Response**:
```json
{
  "photoId": "uuid-v4",
  "status": "pending",
  "createdAt": "2025-12-19T10:00:00Z"
}
```

**Validation**:
- ✅ Returns 201 status code
- ✅ DynamoDB item created with correct photoId
- ✅ Status is "pending"
- ✅ uploadedBy contains Cognito username

### Test 4: List Photos (Pending)

```bash
curl -X GET "$API_URL/photos?status=pending&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**:
```json
{
  "photos": [
    {
      "photoId": "uuid-v4",
      "title": "Test Photo",
      "description": "...",
      "status": "pending",
      "uploadDate": "2025-12-19T10:00:00Z",
      ...
    }
  ],
  "count": 1
}
```

**Validation**:
- ✅ Returns 200 status code
- ✅ Photo from Test 3 appears in list
- ✅ Photos sorted by uploadDate (newest first)

### Test 5: Get Single Photo

```bash
curl -X GET "$API_URL/photos/$PHOTO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected**: Full photo object with all metadata

**Validation**:
- ✅ Returns 200 status code
- ✅ photoId matches
- ✅ All fields present (title, description, alt, copyright, etc.)

### Test 6: Publish Photo

```bash
curl -X PATCH "$API_URL/photos/$PHOTO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "published",
    "title": "Updated Test Photo"
  }'
```

**Expected Response**:
```json
{
  "photoId": "uuid-v4",
  "status": "published",
  "updatedAt": "2025-12-19T10:30:00Z"
}
```

**Validation**:
- ✅ Returns 200 status code
- ✅ Status changed to "published"
- ✅ File moved from uploads/ to originals/ in S3
- ✅ DynamoDB item updated with new status
- ✅ publishedAt timestamp added

### Test 7: List Published Photos

```bash
curl -X GET "$API_URL/photos?status=published" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Validation**:
- ✅ Photo from Test 6 appears with status="published"
- ✅ originalKey points to originals/ folder

### Test 8: Soft Delete Photo

```bash
curl -X DELETE "$API_URL/photos/$PHOTO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**:
```json
{
  "photoId": "uuid-v4",
  "status": "archived",
  "archivedAt": "2025-12-19T10:45:00Z"
}
```

**Validation**:
- ✅ Returns 200 status code
- ✅ Status changed to "archived"
- ✅ File moved from originals/ to archive/ in S3
- ✅ DynamoDB item updated with archived status

### Test 9: Error Handling

**Test 9a: Unauthorized Access (No JWT)**
```bash
curl -X GET "$API_URL/photos?status=published"
```
**Expected**: 401 Unauthorized

**Test 9b: Invalid JWT**
```bash
curl -X GET "$API_URL/photos?status=published" \
  -H "Authorization: Bearer invalid-token"
```
**Expected**: 401 Unauthorized

**Test 9c: Invalid File Type**
```bash
curl -X POST "$API_URL/photos/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileType": "application/pdf",
    "fileSize": 1024000
  }'
```
**Expected**: 400 Bad Request (Invalid file type)

**Test 9d: File Too Large**
```bash
curl -X POST "$API_URL/photos/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileType": "image/jpeg",
    "fileSize": 20971520
  }'
```
**Expected**: 400 Bad Request (File too large)

**Test 9e: Photo Not Found**
```bash
curl -X GET "$API_URL/photos/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $JWT_TOKEN"
```
**Expected**: 404 Not Found

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Photo metadata created |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Photo doesn't exist |
| 500 | Internal Server Error | Lambda error, AWS service issue |

### Error Response Format

```json
{
  "error": "Error message",
  "errorType": "ValidationError"
}
```

### Common Error Types

- **ValidationError**: Invalid input (400)
- **NotFoundError**: Resource not found (404)
- **InternalError**: Server-side error (500)

---

## Validation Rules

### File Upload
- **Allowed Types**: JPEG, PNG, WebP (`image/jpeg`, `image/png`, `image/webp`)
- **Max Size**: 10MB (10,485,760 bytes)

### Photo Metadata
- **photoId**: UUID v4 format (RFC 4122)
- **title**: Required, string
- **alt**: Required, string
- **copyright**: Required, string
- **description**: Optional, string
- **status**: One of: "pending", "published", "archived"

---

## Photo Lifecycle Workflow

```
1. Generate Upload URL
   └─> Pre-signed S3 URL for uploads/

2. Upload to S3
   └─> File stored in uploads/{photoId}.{ext}

3. Create Metadata
   └─> DynamoDB item with status="pending"

4. Publish Photo (Update)
   └─> S3 copy: uploads/ → originals/
   └─> DynamoDB update: status="published"

5. Archive Photo (Delete)
   └─> S3 copy: originals/ → archive/
   └─> DynamoDB update: status="archived"
```

---

## Troubleshooting

### Issue: Lambda returns 500 error

**Causes**:
- Missing environment variables
- IAM permissions insufficient
- DynamoDB/S3 resource not accessible

**Debug**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/photography-project-<function-name> --follow

# Verify environment variables
aws lambda get-function-configuration \
  --function-name photography-project-<function-name> \
  --query 'Environment.Variables'
```

### Issue: 401 Unauthorized on all requests

**Causes**:
- JWT token expired (tokens expire after 1 hour)
- Wrong user pool or app client ID
- Cognito authorizer misconfigured

**Fix**:
```bash
# Regenerate JWT token
JWT_TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $APP_CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin@test.com,PASSWORD=YourPassword123! \
  --query 'AuthenticationResult.IdToken' \
  --output text)
```

### Issue: File not found in S3 after upload

**Causes**:
- Pre-signed URL expired (5 min)
- Wrong Content-Type header
- Network interruption

**Debug**:
```bash
# List files in S3 bucket
aws s3 ls s3://$(terraform output -raw photos_s3_bucket_name)/uploads/

# Check if file exists
aws s3api head-object \
  --bucket $(terraform output -raw photos_s3_bucket_name) \
  --key "uploads/$PHOTO_ID.jpg"
```

### Issue: CORS errors in browser

**Causes**:
- Missing OPTIONS preflight response
- CORS headers not configured

**Verify**:
```bash
# Test CORS preflight
curl -X OPTIONS "$API_URL/photos" \
  -H "Origin: https://test.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v
```

**Expected**: `Access-Control-Allow-*` headers in response

---

## Cost Analysis

**Monthly Estimate** (Phase 5 only):
- **Lambda**: $0.00 (free tier: 1M requests, 400K GB-seconds)
- **API Gateway**: $0.01 (3,000 requests @ $3.50/million after free tier)
- **CloudWatch Logs**: $0.01 (10MB logs @ $0.50/GB)
- **Total Phase 5**: ~$0.02/month

**Cumulative Cost** (Phases 0-5): ~$1.84/month

---

## Security Features

- ✅ Cognito JWT authorizer on all endpoints
- ✅ Pre-signed URLs expire after 5 minutes
- ✅ Least-privilege IAM policies per function type
- ✅ CORS restricted to production domains
- ✅ HTTPS-only (enforced by API Gateway)
- ✅ CloudWatch logging for audit trail

---

## Next Steps

### Phase 6: Admin Dashboard (Frontend Integration)

**What Phase 6 will add**:
- Admin UI for photo management (`/admin` route)
- Photo upload form with preview
- Photo list/grid view
- Publish/archive workflow
- API client service integration

**Frontend API Integration**:
```typescript
// src/config/api.ts
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL, // From terraform output
  endpoints: {
    generateUploadUrl: '/photos/upload-url',
    createPhoto: '/photos',
    listPhotos: '/photos',
    getPhoto: (photoId) => `/photos/${photoId}`,
    updatePhoto: (photoId) => `/photos/${photoId}`,
    deletePhoto: (photoId) => `/photos/${photoId}`,
  },
};

// src/services/photoApi.ts
async function getAuthHeaders() {
  const session = await Auth.currentSession();
  const token = session.getIdToken().getJwtToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
```

**Environment Variables** (add to frontend):
```
VITE_API_URL=<api_gateway_url from terraform output>
```

---

## Files Modified/Created

### Created
- `terraform/terraform/lambda/generate_upload_url/index.py`
- `terraform/terraform/lambda/create_photo/index.py`
- `terraform/terraform/lambda/list_photos/index.py`
- `terraform/terraform/lambda/get_photo/index.py`
- `terraform/terraform/lambda/update_photo/index.py`
- `terraform/terraform/lambda/delete_photo/index.py`
- `terraform/terraform/build_lambdas.py`
- `terraform/PHASE-5-SUMMARY.md` (this file)

### Modified
- `terraform/terraform/main.tf` (added ~60 Phase 5 resources)
- `terraform/terraform/outputs.tf` (added Phase 5 outputs)
- `.claude/PROJECT_STATUS.md` (updated phase status)
- `.claude/DECISIONS.md` (added ADR-012)

---

## References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway REST API Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-rest-api.html)
- [Cognito User Pool Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)
- [Pre-signed S3 URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
