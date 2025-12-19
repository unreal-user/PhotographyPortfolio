# Phase 4: Photo Upload S3 Bucket - Summary

**Status:** ✅ Code Complete
**Date:** 2025-12-19
**Phase:** 4 of 7

---

## Overview

Phase 4 implements AWS infrastructure for photo storage, including:
- S3 bucket for photo uploads and storage
- DynamoDB table for photo metadata
- Lifecycle policies for automatic cleanup
- CORS configuration for browser uploads
- Security features (encryption, versioning, HTTPS enforcement)

**Important:** This phase is **infrastructure only**. No Lambda functions, API Gateway, or frontend changes are included (YAGNI principle - those come in Phase 5).

---

## Resources Created

### AWS Infrastructure

| Resource | Name | Purpose |
|----------|------|---------|
| **S3 Bucket** | `photography-project-photos` | Stores photo files (originals, thumbnails, uploads) |
| **S3 Public Access Block** | - | Blocks all public access to photos bucket |
| **S3 Versioning** | - | Enables version control for rollback |
| **S3 Server-Side Encryption** | - | Encrypts all photos at rest (AES256) |
| **S3 CORS Configuration** | - | Allows browser uploads from production domain |
| **S3 Lifecycle Configuration** | - | Auto-cleanup & archival policies |
| **S3 Bucket Policy** | - | Enforces HTTPS-only access |
| **DynamoDB Table** | `photography-project-photos` | Stores photo metadata |

### S3 Bucket Configuration

**Bucket Name:** `photography-project-photos`

**Folder Structure:**
```
photography-project-photos/
├── uploads/        # Temporary staging (auto-deleted after 7 days)
├── originals/      # Published full-resolution photos
└── archive/        # Soft-deleted photos (transitions to IA after 30 days)
```

**CORS Rules:**
- **Allowed Origins:** `https://test.com`, `https://www.test.com`
- **Allowed Methods:** GET, PUT, POST, DELETE, HEAD
- **Allowed Headers:** * (all headers)
- **Exposed Headers:** ETag, x-amz-server-side-encryption, x-amz-request-id, x-amz-id-2
- **Max Age:** 3600 seconds (1 hour)

**Lifecycle Policies:**

1. **Cleanup Uploads** - Delete files in `uploads/` after 7 days
   - Purpose: Remove abandoned/incomplete uploads
   - Prefix: `uploads/`
   - Expiration: 7 days

2. **Archive Transition** - Move archived photos to cheaper storage
   - Purpose: Reduce costs for soft-deleted photos
   - Prefix: `archive/`
   - Transition: Standard → Standard-IA after 30 days

3. **Version Cleanup** - Delete old object versions
   - Purpose: Control storage costs from versioning
   - Expiration: 90 days for noncurrent versions

### DynamoDB Table Schema

**Table Name:** `photography-project-photos`
**Billing Mode:** On-demand (PAY_PER_REQUEST)

**Primary Key:**
- **Partition Key:** `photoId` (String) - UUID v4

**Global Secondary Index (GSI):**
- **Index Name:** `status-uploadDate-index`
- **Hash Key:** `status` (String)
- **Range Key:** `uploadDate` (String)
- **Projection:** ALL

**Schema Attributes:**
```typescript
interface PhotoMetadata {
  // Primary key
  photoId: string;              // UUID v4, partition key

  // Photo information
  title: string;                // Photo title
  description?: string;         // Optional description
  alt: string;                  // Alt text for accessibility
  copyright: string;            // Copyright notice

  // Upload tracking
  uploadedBy: string;           // Cognito username (admin email)
  uploadDate: string;           // ISO 8601 timestamp
  status: string;               // "pending" | "published" | "archived"

  // S3 keys
  originalKey: string;          // S3 key for original file
  thumbnailKey?: string;        // Future: S3 key for thumbnail (Phase 5)
  fullResKey?: string;          // Future: S3 key for web-optimized version (Phase 5)

  // File metadata
  fileSize: number;             // Size in bytes
  mimeType: string;             // e.g., "image/jpeg", "image/png"
  width?: number;               // Image width in pixels
  height?: number;              // Image height in pixels

  // Timestamps
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
  publishedAt?: string;         // ISO 8601 timestamp (when status changed to "published")
  archivedAt?: string;          // ISO 8601 timestamp (when status changed to "archived")
}
```

**Example DynamoDB Item:**
```json
{
  "photoId": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  "title": "Sunset over Golden Gate Bridge",
  "description": "A stunning sunset view from Baker Beach",
  "alt": "Golden Gate Bridge silhouetted against orange sunset sky",
  "copyright": "© 2025 YourName Photography. All rights reserved.",
  "uploadedBy": "admin@yourdomain.com",
  "uploadDate": "2025-12-19T15:30:00Z",
  "status": "published",
  "originalKey": "originals/a1b2c3d4-e5f6-4789-a012-3456789abcde.jpg",
  "fileSize": 5242880,
  "mimeType": "image/jpeg",
  "width": 4000,
  "height": 3000,
  "createdAt": "2025-12-19T15:30:00Z",
  "updatedAt": "2025-12-19T15:35:22Z",
  "publishedAt": "2025-12-19T15:35:22Z"
}
```

---

## Deployment Steps

### Step 1: Deploy Terraform Infrastructure

```bash
cd /workspace/PhotographyPortfolio/terraform/terraform

# Format Terraform files
terraform fmt

# Validate configuration
terraform validate

# Review planned changes
terraform plan
# Expected output: Plan: 8 to add, 0 to change, 0 to destroy

# Deploy Phase 4 resources
terraform apply
```

**Expected Output:**
```
Apply complete! Resources: 8 added, 0 changed, 0 destroyed.

Outputs:

photos_s3_bucket_name = "photography-project-photos"
photos_s3_bucket_arn = "arn:aws:s3:::photography-project-photos"
photos_s3_bucket_region = "us-east-1"
photos_dynamodb_table_name = "photography-project-photos"
photos_dynamodb_table_arn = "arn:aws:dynamodb:us-east-1:XXXXXXXXXXXX:table/photography-project-photos"
```

---

### Step 2: Verify S3 Bucket Configuration

```bash
# List S3 buckets
aws s3 ls | grep photography-project-photos

# Check versioning
aws s3api get-bucket-versioning --bucket photography-project-photos

# Check encryption
aws s3api get-bucket-encryption --bucket photography-project-photos

# Check public access block
aws s3api get-bucket-public-access-block --bucket photography-project-photos

# Check CORS configuration
aws s3api get-bucket-cors --bucket photography-project-photos

# Check lifecycle policies
aws s3api get-bucket-lifecycle-configuration --bucket photography-project-photos
```

---

### Step 3: Verify DynamoDB Table

```bash
# List DynamoDB tables
aws dynamodb list-tables | grep photography-project-photos

# Describe table
aws dynamodb describe-table --table-name photography-project-photos

# Check indexes
aws dynamodb describe-table --table-name photography-project-photos \
  --query 'Table.GlobalSecondaryIndexes'

# Check point-in-time recovery
aws dynamodb describe-continuous-backups --table-name photography-project-photos
```

---

### Step 4: Test DynamoDB Write/Read

```bash
# Test write
aws dynamodb put-item --table-name photography-project-photos \
  --item '{
    "photoId": {"S": "test-123"},
    "title": {"S": "Test Photo"},
    "alt": {"S": "Test image"},
    "copyright": {"S": "Test copyright"},
    "uploadedBy": {"S": "admin@test.com"},
    "uploadDate": {"S": "2025-12-19T10:00:00Z"},
    "status": {"S": "pending"},
    "originalKey": {"S": "uploads/test-123.jpg"},
    "fileSize": {"N": "1024"},
    "mimeType": {"S": "image/jpeg"},
    "createdAt": {"S": "2025-12-19T10:00:00Z"},
    "updatedAt": {"S": "2025-12-19T10:00:00Z"}
  }'

# Test read
aws dynamodb get-item --table-name photography-project-photos \
  --key '{"photoId": {"S": "test-123"}}'

# Test GSI query (query by status)
aws dynamodb query --table-name photography-project-photos \
  --index-name status-uploadDate-index \
  --key-condition-expression "status = :status" \
  --expression-attribute-values '{":status": {"S": "pending"}}'

# Clean up test item
aws dynamodb delete-item --table-name photography-project-photos \
  --key '{"photoId": {"S": "test-123"}}'
```

---

## Testing Checklist

### Infrastructure Tests

- [ ] S3 bucket created successfully
- [ ] S3 bucket is private (all public access blocked)
- [ ] S3 versioning enabled
- [ ] S3 encryption enabled (AES256)
- [ ] S3 CORS configured for production domains
- [ ] S3 lifecycle policies active (3 rules)
- [ ] S3 bucket policy enforces HTTPS
- [ ] DynamoDB table created successfully
- [ ] DynamoDB on-demand billing mode
- [ ] DynamoDB GSI created (status-uploadDate-index)
- [ ] DynamoDB point-in-time recovery enabled
- [ ] DynamoDB encryption enabled
- [ ] Terraform outputs available

### Functional Tests

- [ ] Can write item to DynamoDB
- [ ] Can read item from DynamoDB by photoId
- [ ] Can query DynamoDB by status using GSI
- [ ] Test item can be deleted
- [ ] S3 bucket is accessible via AWS CLI
- [ ] S3 lifecycle rules are correct

---

## Cost Analysis

### Phase 4 Monthly Costs

| Service | Usage Estimate | Monthly Cost |
|---------|----------------|--------------|
| **S3 Storage** | 500 MB (100 photos) | ~$0.012 |
| **S3 Requests** | 1,000 PUT + 10,000 GET | ~$0.001 |
| **DynamoDB** | On-demand, 100 reads/writes | ~$0.002 |
| **Data Transfer** | Minimal (CloudFront serves) | ~$0.005 |

**Total Phase 4 Cost:** ~$0.02/month

**Cumulative Cost (Phases 0-4):** ~$1.82/month
- Phase 0: ~$0.30 (S3 state + DynamoDB locks)
- Phase 1: ~$1.00 (Route53 hosted zone)
- Phase 2: ~$0.50 (S3 website storage, CloudFront free tier)
- Phase 3: ~$0.00 (Cognito free tier)
- Phase 4: ~$0.02 (S3 photos + DynamoDB on-demand)

---

## Security Features

### ✅ Implemented

1. **Private S3 Bucket** - All public access blocked
2. **Server-Side Encryption** - AES256 encryption at rest
3. **HTTPS Enforcement** - Bucket policy denies non-HTTPS requests
4. **Versioning** - Rollback capability for accidental deletions
5. **DynamoDB Encryption** - Encryption at rest enabled
6. **Point-in-Time Recovery** - DynamoDB backup for data protection
7. **CORS Restriction** - Only production domains allowed
8. **Lifecycle Policies** - Auto-cleanup prevents data accumulation

### 🔄 Deferred to Phase 5

1. **Pre-signed URL Authentication** - Lambda generates time-limited upload URLs
2. **File Validation** - Lambda checks file type, size, dimensions
3. **Malware Scanning** - Integration with AWS S3 antivirus
4. **IAM Policies** - Least-privilege Lambda execution roles

---

## Phase 5 Preparation

Phase 4 provides the storage foundation for Phase 5's serverless backend:

**What Phase 5 Needs:**
- S3 bucket name (`photography-project-photos`)
- DynamoDB table name (`photography-project-photos`)
- Folder conventions (`uploads/`, `originals/`, `archive/`)
- DynamoDB schema contract

**What Phase 5 Will Add:**
- Lambda function: Generate pre-signed S3 URLs
- Lambda function: Process uploaded photos (resize, thumbnails)
- API Gateway with Cognito JWT authorizer
- CRUD API endpoints for photo management
- Admin dashboard frontend integration

**Phase 5 Lambda Functions:**
1. `generateUploadUrl` - Returns pre-signed URL for S3 upload
2. `processPhoto` - Triggered by S3 upload, creates thumbnails
3. `listPhotos` - Query DynamoDB by status
4. `getPhoto` - Get photo metadata by ID
5. `updatePhoto` - Update photo metadata
6. `deletePhoto` - Soft delete (move to archive/)

---

## Folder Usage Patterns

### `uploads/` Folder
- **Purpose:** Temporary staging for new uploads
- **Lifecycle:** Auto-deleted after 7 days
- **Usage:** Admin uploads directly here via pre-signed URL
- **Example:** `uploads/a1b2c3d4-e5f6-4789-a012-3456789abcde.jpg`

### `originals/` Folder
- **Purpose:** Published full-resolution photos
- **Lifecycle:** Permanent storage
- **Usage:** Photos moved here when status changes to "published"
- **Example:** `originals/a1b2c3d4-e5f6-4789-a012-3456789abcde.jpg`

### `archive/` Folder
- **Purpose:** Soft-deleted photos (recoverable)
- **Lifecycle:** Transitions to Standard-IA after 30 days
- **Usage:** Photos moved here when status changes to "archived"
- **Example:** `archive/a1b2c3d4-e5f6-4789-a012-3456789abcde.jpg`

---

## Troubleshooting

### Issue: S3 bucket creation fails with "BucketAlreadyExists"

**Cause:** Bucket name is globally unique across AWS

**Solution:**
```bash
# Option 1: Use a unique bucket name
# Edit terraform.tfvars and add a unique suffix
project_name = "photography-project-yourname"

# Option 2: Delete existing bucket (if you own it)
aws s3 rb s3://photography-project-photos --force
```

---

### Issue: DynamoDB table creation fails

**Error:** `ResourceInUseException: Table already exists`

**Solution:**
```bash
# Delete existing table
aws dynamodb delete-table --table-name photography-project-photos

# Wait for deletion to complete
aws dynamodb wait table-not-exists --table-name photography-project-photos

# Re-run terraform apply
terraform apply
```

---

### Issue: CORS errors when testing uploads

**Cause:** Domain mismatch in CORS configuration

**Solution:**
Ensure `terraform.tfvars` has the correct domain:
```hcl
domain_name = "yourdomain.com"
```

Then re-apply:
```bash
terraform apply
```

---

### Issue: Lifecycle policies not appearing

**Cause:** Terraform may take a few minutes to apply lifecycle policies

**Solution:**
```bash
# Wait 5 minutes, then check again
aws s3api get-bucket-lifecycle-configuration --bucket photography-project-photos
```

---

## Rollback Procedure

If Phase 4 needs to be rolled back:

```bash
# Destroy Phase 4 resources
cd /workspace/PhotographyPortfolio/terraform/terraform

# Target specific resources
terraform destroy -target=aws_dynamodb_table.photos
terraform destroy -target=aws_s3_bucket_policy.photos
terraform destroy -target=aws_s3_bucket_lifecycle_configuration.photos
terraform destroy -target=aws_s3_bucket_cors_configuration.photos
terraform destroy -target=aws_s3_bucket_server_side_encryption_configuration.photos
terraform destroy -target=aws_s3_bucket_versioning.photos
terraform destroy -target=aws_s3_bucket_public_access_block.photos
terraform destroy -target=aws_s3_bucket.photos

# Or destroy all Phase 4 resources at once
terraform state list | grep photos | xargs -I {} terraform destroy -target={}
```

**Warning:** This will permanently delete the S3 bucket and DynamoDB table. Ensure you have backups.

---

## Performance Considerations

### S3 Performance
- **Read Performance:** Unlimited (CloudFront caches)
- **Write Performance:** 3,500 PUT/COPY/POST/DELETE per second per prefix
- **Folder Strategy:** Use UUIDs for unique prefixes, avoiding hotspots

### DynamoDB Performance
- **On-Demand Billing:** Scales automatically, no capacity planning needed
- **Read Performance:** Unlimited with on-demand
- **Write Performance:** Unlimited with on-demand
- **GSI Performance:** Eventually consistent reads (slight delay after write)

### Cost Optimization
- **On-Demand Pricing:** Perfect for low, unpredictable traffic
- **Switch to Provisioned:** Consider if traffic exceeds 100 requests/day consistently
- **Lifecycle Policies:** Automatically reduce storage costs

---

## Summary

✅ **Completed:**
- S3 bucket with 7 configuration resources
- DynamoDB table with GSI
- Lifecycle policies for auto-cleanup
- CORS for browser uploads
- Security features (encryption, versioning, HTTPS)
- Comprehensive outputs for Phase 5
- Testing & validation steps documented

📋 **Manual Steps Required:**
1. Deploy Terraform (`terraform apply`)
2. Verify S3 bucket configuration
3. Verify DynamoDB table
4. Run functional tests

🎯 **What's Next:**
- Phase 5: Lambda functions + API Gateway
- Phase 6: Admin dashboard frontend
- Phase 7: CI/CD deployment pipeline

---

**Phase 4 is complete and ready for deployment!**
