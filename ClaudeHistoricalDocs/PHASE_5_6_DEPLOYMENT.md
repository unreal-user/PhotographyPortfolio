# Phase 5 & 6 Deployment and Testing Guide

This guide covers deployment and manual testing for Phase 5 (Lambda Functions + API Gateway) and Phase 6 (Admin Dashboard with Photo Management).

---

## Table of Contents

1. [Phase 5: Backend Deployment](#phase-5-backend-deployment)
2. [Phase 6: Frontend Deployment](#phase-6-frontend-deployment)
3. [Manual Testing Checklist](#manual-testing-checklist)
4. [Troubleshooting](#troubleshooting)

---

## Phase 5: Backend Deployment

### Prerequisites

- AWS credentials configured (`~/.aws/credentials`)
- Terraform installed (v1.0+)
- Python 3.9+ installed
- Cognito User Pool and App Client from Phase 3

### Step 1: Build Lambda Packages

```bash
cd terraform/terraform
python3 build_lambdas.py
```

**Expected Output:**
```
Building Lambda deployment packages...

✓ Built create_photo.zip (1.7 KB)
✓ Built delete_photo.zip (1.4 KB)
✓ Built generate_upload_url.zip (1.4 KB)
✓ Built get_photo.zip (0.9 KB)
✓ Built list_photos.zip (1.2 KB)
✓ Built update_photo.zip (1.9 KB)

All 6 Lambda functions built successfully!
```

### Step 2: Deploy Backend Infrastructure

```bash
terraform apply
```

**Review the plan carefully:**
- ✅ 6 Lambda functions
- ✅ API Gateway REST API
- ✅ Lambda permissions for API Gateway
- ✅ Cognito authorizer integration

Type `yes` to confirm.

### Step 3: Get API Gateway URL

```bash
terraform output -raw api_gateway_url
```

**Example Output:**
```
https://pijf9vfkoi.execute-api.us-east-1.amazonaws.com/prod
```

**Save this URL** - you'll need it for Phase 6 frontend configuration.

### Step 4: Verify Lambda Deployment

Check that all 6 Lambda functions are deployed:

```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `photography-portfolio`)].FunctionName'
```

**Expected Output:**
```json
[
    "photography-portfolio-create-photo",
    "photography-portfolio-delete-photo",
    "photography-portfolio-generate-upload-url",
    "photography-portfolio-get-photo",
    "photography-portfolio-list-photos",
    "photography-portfolio-update-photo"
]
```

### Step 5: Test API Gateway Endpoints

**Get a JWT token from Cognito** (requires authenticated user):

```bash
# You'll need this token for API testing
# Get it from browser DevTools after logging in, or use AWS CLI
aws cognito-idp initiate-auth \
  --client-id YOUR_APP_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=your-email@example.com,PASSWORD=YourPassword123!
```

**Test List Photos Endpoint:**

```bash
curl -X GET \
  "https://YOUR_API_URL/prod/photos?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "photos": [],
  "count": 0
}
```

---

## Phase 6: Frontend Deployment

### Prerequisites

- Phase 5 backend deployed
- API Gateway URL from Step 3 above
- Node.js 18+ and npm installed

### Step 1: Configure Environment Variables

Create `.env` file in `root-project/` directory:

```bash
cd root-project
cp .env.example .env
```

**Edit `.env` file** with your actual values:

```bash
# AWS Configuration (from Phase 3)
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx

# API Gateway Configuration (from Phase 5)
VITE_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build Frontend

```bash
npm run build
```

**Expected Output:**
```
vite v5.x.x building for production...
✓ 150 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-abc123.css     12.34 kB
dist/assets/index-xyz789.js     145.67 kB
✓ built in 3.21s
```

### Step 4: Run Development Server (for testing)

```bash
npm run dev
```

**Access the app at:** `http://localhost:5173`

### Step 5: Deploy to Hosting (Optional)

**For AWS Amplify:**
```bash
# Amplify will automatically build and deploy from git
git push origin phase-6
```

**For S3 + CloudFront:**
```bash
cd terraform/terraform
terraform apply  # This will deploy frontend to S3/CloudFront
```

**For other hosting (Netlify, Vercel):**
- Point build command to: `npm run build`
- Point publish directory to: `dist`
- Add environment variables from `.env`

---

## Manual Testing Checklist

### Authentication Testing (Phase 3 - Prerequisite)

- [ ] Navigate to `/login`
- [ ] Log in with valid credentials
- [ ] Verify redirect to homepage after login
- [ ] Verify UserMenu shows email and Dashboard link
- [ ] Log out and verify redirect to login

### Admin Dashboard Access (Phase 6)

- [ ] **Logged out:** Navigate to `/admin` → should redirect to `/login`
- [ ] **Logged in:** Navigate to `/admin` → should show Admin Dashboard
- [ ] Verify three tabs: Pending, Published, Archived
- [ ] Click each tab → should show loading state then empty/populated list

### Photo Upload Workflow (Phase 6)

#### Test 1: Valid Photo Upload

1. [ ] Click "Upload Photo" button
2. [ ] Verify modal opens with drag-drop zone
3. [ ] **Drag and drop** a JPEG file (< 10MB)
4. [ ] Verify preview appears
5. [ ] Fill in metadata:
   - Title: "Test Sunset Photo"
   - Description: "Beautiful sunset over mountains"
   - Alt: "Sunset with orange sky over mountain peaks"
   - Copyright: "© 2025 Your Name"
   - Gallery: "Landscapes"
6. [ ] Click "Upload Photo"
7. [ ] Verify progress indicators:
   - "Generating upload URL..."
   - "Uploading to S3..."
   - "Saving metadata..."
   - "Upload complete!"
8. [ ] Verify modal closes
9. [ ] Verify photo appears in "Pending" tab
10. [ ] Check S3 bucket → file should be in `uploads/` folder

**API Calls to Verify (DevTools Network Tab):**
- POST `/photos/upload-url` → 200 OK
- PUT to S3 pre-signed URL → 200 OK
- POST `/photos` → 201 Created

#### Test 2: File Validation

- [ ] Try uploading `.pdf` file → should show "Invalid file type" error
- [ ] Try uploading 11MB image → should show "File too large" error
- [ ] Try uploading without filling "Title" → should show "Title is required"
- [ ] Try uploading without filling "Alt text" → should show "Alt text is required"

#### Test 3: Click to Select File

1. [ ] Click drag-drop zone (not dragging)
2. [ ] Verify file picker opens
3. [ ] Select PNG file
4. [ ] Verify preview appears
5. [ ] Upload successfully

### Photo Display (Phase 6)

- [ ] Verify PhotoCard shows:
  - Thumbnail preview
  - Title
  - Upload date (formatted)
  - Gallery tag (if present)
  - Status badge (Pending/Published/Archived)
  - Description (truncated)
  - Action buttons (Edit, Publish, Archive)

### Edit Photo Workflow (Phase 6)

1. [ ] Click "Edit" button on a photo
2. [ ] Verify EditPhotoModal opens
3. [ ] Verify form pre-filled with current values
4. [ ] Modify title: "Updated Test Photo"
5. [ ] Modify gallery: "Nature"
6. [ ] Click "Save Changes"
7. [ ] Verify "Saving changes..." indicator
8. [ ] Verify modal closes
9. [ ] Verify updated values appear on PhotoCard
10. [ ] Check DynamoDB → `updatedAt` timestamp should be recent

**API Call to Verify:**
- PATCH `/photos/{photoId}` → 200 OK

### Publish Photo Workflow (Phase 6)

1. [ ] Navigate to "Pending" tab
2. [ ] Click "Publish" button on a photo
3. [ ] Verify ConfirmDialog appears with message:
   - "This will move the photo from uploads/ to originals/ and make it visible on the public portfolio."
4. [ ] Click "Publish"
5. [ ] Verify photo disappears from Pending tab
6. [ ] Navigate to "Published" tab
7. [ ] Verify photo appears with "Published" badge
8. [ ] Check S3 bucket:
   - File should be in `originals/` folder
   - Original file in `uploads/` should still exist (S3 copy, not move)
9. [ ] Verify `publishedAt` timestamp in DynamoDB

**API Call to Verify:**
- PATCH `/photos/{photoId}` with `{"status": "published"}` → 200 OK

### Archive Photo Workflow (Phase 6)

#### Test 1: Archive Published Photo

1. [ ] Navigate to "Published" tab
2. [ ] Click "Archive" button
3. [ ] Verify ConfirmDialog: "This will move the photo to the archive. You can restore it later."
4. [ ] Click "Archive"
5. [ ] Verify photo disappears from Published tab
6. [ ] Navigate to "Archived" tab
7. [ ] Verify photo appears with "Archived" badge
8. [ ] Check S3: File should be in `archive/` folder

#### Test 2: Delete Archived Photo

1. [ ] Navigate to "Archived" tab
2. [ ] Click "Delete" button (same button, different label)
3. [ ] Verify ConfirmDialog: "This will permanently delete the photo."
4. [ ] Click "Archive" (confirm)
5. [ ] Verify photo removed from DynamoDB
6. [ ] File remains in `archive/` folder (soft delete)

**API Calls to Verify:**
- DELETE `/photos/{photoId}` → 200 OK

### View Photo (Phase 6)

1. [ ] Click on photo thumbnail
2. [ ] Verify full-size image loads
3. [ ] (If PhotoModal exists from Phase 2/3, verify modal opens)
4. [ ] Close modal

### Mobile Responsiveness (Phase 6)

**Desktop (> 768px):**
- [ ] Dashboard tabs display horizontally
- [ ] Photo grid: 3 columns
- [ ] Modals: centered, max-width 600px

**Mobile (< 768px):**
- [ ] Dashboard tabs scroll horizontally
- [ ] Photo grid: 1 column
- [ ] Upload button: full width
- [ ] Modals: full-screen
- [ ] Action buttons: stacked vertically

**Test on:**
- [ ] Chrome DevTools mobile view
- [ ] Actual mobile device (iOS/Android)

### Dark Mode Support (Phase 6)

1. [ ] Set OS theme to dark mode
2. [ ] Verify admin dashboard adapts:
   - Background colors inverted
   - Text readable
   - Status badges adjusted
   - Error messages visible
3. [ ] Test all workflows in dark mode

### Error Handling (Phase 6)

#### Test 1: Network Error During Upload

1. [ ] Start upload
2. [ ] Disconnect network mid-upload
3. [ ] Verify error message appears
4. [ ] Verify modal doesn't close
5. [ ] Reconnect network
6. [ ] Retry upload → should succeed

#### Test 2: Unauthorized Access

1. [ ] Log out
2. [ ] Try to access `/admin` directly
3. [ ] Verify redirect to `/login`
4. [ ] After login, verify redirect back to `/admin`

#### Test 3: Invalid Photo ID

1. [ ] Open DevTools Console
2. [ ] Try to fetch non-existent photo:
   ```javascript
   fetch('/api/photos/00000000-0000-0000-0000-000000000000', {
     headers: {'Authorization': 'Bearer YOUR_TOKEN'}
   })
   ```
3. [ ] Verify 404 error response

### Gallery Feature Testing (Phase 6)

1. [ ] Upload photo with gallery: "Portraits"
2. [ ] Upload photo with gallery: "Landscapes"
3. [ ] Upload photo with no gallery (leave blank)
4. [ ] Verify all photos display correctly
5. [ ] Edit photo to change gallery
6. [ ] Verify gallery tag updates on PhotoCard

### Performance Testing

- [ ] Upload 10 photos in succession
- [ ] Navigate between tabs → should load < 1 second
- [ ] Open/close modals → should be instant
- [ ] Image previews should load progressively

---

## Troubleshooting

### Issue: "Not authenticated. Please log in."

**Cause:** JWT token missing or expired.

**Fix:**
1. Log out and log back in
2. Check browser DevTools → Application → Cookies → verify Cognito tokens exist
3. Verify `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_APP_CLIENT_ID` in `.env`

### Issue: "Failed to fetch" or CORS errors

**Cause:** API Gateway CORS not configured or wrong API URL.

**Fix:**
1. Verify `VITE_API_URL` in `.env` matches `terraform output api_gateway_url`
2. Check API Gateway → CORS settings → should allow `*` origin
3. Verify Lambda responses include CORS headers:
   ```python
   'Access-Control-Allow-Origin': '*'
   'Access-Control-Allow-Headers': 'Content-Type,Authorization'
   ```

### Issue: "Uploaded file not found in S3"

**Cause:** S3 upload failed or photoId mismatch.

**Fix:**
1. Check S3 bucket → verify file in `uploads/` folder
2. Check file name matches `{photoId}.{ext}` format
3. Verify pre-signed URL expiration (5 minutes)
4. Check browser console for S3 upload errors

### Issue: Lambda function timeout

**Cause:** Cold start or S3 copy operation slow.

**Fix:**
1. Increase Lambda timeout:
   ```hcl
   timeout = 30  # in lambda.tf
   ```
2. Check CloudWatch Logs for actual error
3. Verify Lambda has permissions to access S3

### Issue: Photos not appearing in tabs

**Cause:** DynamoDB GSI not updated or wrong status value.

**Fix:**
1. Check DynamoDB → verify GSI `status-uploadDate-index` exists
2. Verify photo has `status` field with value: "pending", "published", or "archived"
3. Check API response in DevTools Network tab

### Issue: Image preview not showing

**Cause:** FileReader error or unsupported file format.

**Fix:**
1. Check browser console for errors
2. Verify file is valid image (JPEG/PNG/WebP)
3. Try different browser
4. Check file is not corrupted

### Issue: "Internal server error" on publish

**Cause:** S3 copy permission issue or source file missing.

**Fix:**
1. Check CloudWatch Logs for Lambda error
2. Verify Lambda has `s3:CopyObject` permission
3. Verify source file exists in S3
4. Check S3 bucket permissions

---

## Post-Deployment Verification

After deploying both Phase 5 and Phase 6, run this complete workflow:

### End-to-End Test

1. [ ] **Login:** Navigate to `/login` and authenticate
2. [ ] **Access Admin:** Click "Dashboard" in UserMenu
3. [ ] **Upload Photo:**
   - Click "Upload Photo"
   - Drag-drop landscape.jpg
   - Fill metadata with gallery "Landscapes"
   - Upload successfully
4. [ ] **Verify Pending:** See photo in Pending tab
5. [ ] **Edit Metadata:** Change title and gallery
6. [ ] **Publish:** Move to Published tab
7. [ ] **Verify S3:** File in `originals/` folder
8. [ ] **Archive:** Move to Archived tab
9. [ ] **Verify DynamoDB:** Status = "archived"
10. [ ] **Logout:** Sign out successfully

If all steps pass: ✅ **Phase 5 & 6 deployment successful!**

---

## Next Steps

**Phase 7 (Future):**
- Thumbnail generation (Lambda Layer + Sharp)
- Image optimization
- Gallery management page
- Batch operations
- Search/filter functionality
- EXIF data extraction

**Production Readiness:**
- Set up CloudFront for frontend
- Enable CloudWatch alarms
- Configure DynamoDB auto-scaling
- Set up S3 lifecycle policies for archive/
- Enable S3 versioning
- Set up automated backups
- Configure WAF rules for API Gateway

---

## Support

For issues or questions:
- Check CloudWatch Logs: `/aws/lambda/photography-portfolio-*`
- Review API Gateway logs
- Check S3 access logs
- Review DynamoDB metrics

**Common Log Locations:**
- Lambda: CloudWatch Logs → `/aws/lambda/photography-portfolio-{function-name}`
- API Gateway: CloudWatch Logs → API Gateway execution logs
- Frontend: Browser DevTools → Console/Network tabs

---

**Document Version:** 1.0
**Last Updated:** 2025-12-20
**Phases Covered:** Phase 5 (Backend), Phase 6 (Admin Dashboard)
