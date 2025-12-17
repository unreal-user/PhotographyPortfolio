# Phase 2: S3 + CloudFront Static Site Hosting - Summary

**Date:** 2025-12-17
**Status:** ✅ Code Complete - Ready for Deployment
**Phase:** Static Website Hosting Infrastructure

---

## 🎯 What Was Built

Phase 2 creates the complete static website hosting infrastructure with global CDN:

1. **S3 Bucket** - Private bucket for storing website files
2. **CloudFront Distribution** - Global CDN with HTTPS
3. **Origin Access Control (OAC)** - Secure CloudFront-to-S3 access
4. **DNS Records** - Route53 A/AAAA records for apex and www domains
5. **Security Features** - Encryption, versioning, private bucket

---

## 📦 Resources Created

### S3 Bucket (`photography-project-website`)
- **Purpose:** Store static website files (HTML, CSS, JS, images)
- **Security:**
  - Private bucket (no public access)
  - CloudFront accesses via OAC only
  - Server-side encryption (AES256)
  - Versioning enabled (rollback capability)
- **Cost:** ~$0.023/GB/month storage + data transfer

### CloudFront Distribution
- **Purpose:** Global CDN for fast content delivery
- **Features:**
  - HTTPS enforced (redirect HTTP to HTTPS)
  - Custom domain support (apex + www)
  - IPv4 and IPv6 enabled
  - Gzip compression enabled
  - SPA routing support (404/403 → index.html)
- **SSL:** Uses ACM certificate from Phase 1
- **Caching:**
  - Default TTL: 1 hour
  - Max TTL: 24 hours
  - Compress responses automatically
- **Coverage:** PriceClass_100 (US, Canada, Europe)
- **Cost:** FREE tier likely covers (50GB/month + 2M requests)

### Origin Access Control (OAC)
- **Purpose:** Modern replacement for Origin Access Identity (OAI)
- **Security:** Uses SigV4 signing for S3 access
- **Benefit:** Bucket stays completely private

### Route53 DNS Records
- **A record** (IPv4): `yourdomain.com` → CloudFront
- **AAAA record** (IPv6): `yourdomain.com` → CloudFront
- **A record** (IPv4): `www.yourdomain.com` → CloudFront
- **AAAA record** (IPv6): `www.yourdomain.com` → CloudFront

---

## 🚀 Deployment Instructions

### Prerequisites
- Phase 1 must be deployed (DNS + SSL certificate)
- Terraform initialized
- Domain nameservers updated at registrar
- Certificate status = "ISSUED"

### Step 1: Verify Phase 1
```bash
cd terraform/terraform
terraform output certificate_status
```

Expected: `ISSUED`

If not, wait for DNS propagation and certificate validation.

### Step 2: Review Plan
```bash
terraform plan
```

Review the resources to be created:
- 1 S3 bucket + 3 bucket configs (versioning, encryption, public access block)
- 1 CloudFront OAC
- 1 CloudFront distribution
- 1 S3 bucket policy
- 4 Route53 DNS records (A/AAAA for apex and www)

### Step 3: Apply Configuration
```bash
terraform apply
```

Type `yes` when prompted.

**Deployment time:** ~10-15 minutes (CloudFront distribution takes longest)

### Step 4: Get Outputs
```bash
terraform output
```

You'll see:
- `s3_bucket_name` - Where to upload website files
- `cloudfront_distribution_id` - For cache invalidation
- `website_url` - Your website URL
- Other useful values

---

## 📤 Uploading Website Files

### Build Frontend
```bash
cd ../../root-project
npm install
npm run build
```

This creates a `dist/` folder with production-ready files.

### Upload to S3
```bash
# Upload all files
aws s3 sync dist/ s3://photography-project-website/ --delete

# Verify upload
aws s3 ls s3://photography-project-website/
```

### Invalidate CloudFront Cache
After uploading new files, invalidate the CloudFront cache:

```bash
# Get distribution ID
DIST_ID=$(cd ../terraform/terraform && terraform output -raw cloudfront_distribution_id)

# Invalidate all files
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

**Note:** First 1,000 invalidations per month are free, then $0.005 per path.

---

## 🔍 Verification

### Check Website Accessibility
```bash
# Get website URL
terraform output website_url
```

Visit the URL in your browser. You should see:
- ✅ HTTPS (green padlock)
- ✅ Your React app loads
- ✅ Routing works (navigate between pages)
- ✅ www subdomain works

### Test SSL
```bash
curl -I https://yourdomain.com
```

Should show:
- `HTTP/2 200` or `HTTP/2 304`
- `x-amz-cf-id` header (CloudFront)
- `x-cache: Hit from cloudfront` (after first visit)

### Check DNS
```bash
dig yourdomain.com
dig www.yourdomain.com
```

Both should resolve to CloudFront addresses.

### CloudFront Status
AWS Console → CloudFront → Find your distribution

Status should be: **Deployed**

---

## 🔐 Security Features

✅ **Private S3 Bucket** - No public access, OAC only
✅ **HTTPS Only** - HTTP automatically redirects to HTTPS
✅ **Modern TLS** - TLS 1.2+ only
✅ **Server-Side Encryption** - AES256 encryption at rest
✅ **Versioning** - Rollback capability for accidental changes
✅ **OAC (not OAI)** - Modern SigV4 authentication
✅ **Principle of Least Privilege** - Bucket policy allows only CloudFront

---

## 💰 Cost Breakdown

| Resource | Monthly Cost | Notes |
|----------|--------------|-------|
| S3 Storage | ~$0.50 | 20GB photos + website files |
| S3 Requests | ~$0.01 | Minimal (CloudFront caches) |
| CloudFront | FREE | 50GB/month free tier likely covers |
| Route53 Queries | Included | From Phase 1 |
| Data Transfer | FREE | First 100GB/month (CloudFront) |
| **Total Phase 2** | **~$0.50/month** | Low traffic estimate |
| **Cumulative Total** | **~$1.80/month** | Phase 0 + 1 + 2 |

---

## 📊 Performance Features

- **Global CDN** - Edge locations worldwide
- **Gzip Compression** - Smaller file sizes
- **HTTP/2** - Multiplexed connections
- **IPv6 Support** - Future-proof
- **Browser Caching** - Efficient cache headers
- **Edge Caching** - 1 hour default TTL

---

## 🧪 SPA Routing Support

The CloudFront distribution includes custom error responses:

- **404 errors** → Serve `/index.html` with 200 status
- **403 errors** → Serve `/index.html` with 200 status

This ensures client-side routing works properly:
- `/about` → Serves index.html → React Router handles route
- `/portfolio` → Serves index.html → React Router handles route

**No special configuration needed in React!**

---

## 🐛 Troubleshooting

### Website shows 403 Forbidden
**Cause:** Files not uploaded to S3 or CloudFront distribution not fully deployed

**Fix:**
1. Check S3 bucket has files: `aws s3 ls s3://photography-project-website/`
2. Verify `index.html` exists in bucket root
3. Wait for CloudFront status = "Deployed" (can take 15 minutes)

### Certificate errors
**Cause:** CloudFront using wrong certificate or certificate not validated

**Fix:**
1. Verify Phase 1 certificate: `terraform output certificate_status`
2. Check CloudFront settings in AWS Console
3. Ensure domain matches certificate domains

### Website shows old content
**Cause:** CloudFront cache not invalidated

**Fix:**
```bash
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

### DNS not resolving
**Cause:** DNS records not yet propagated or nameservers not updated

**Fix:**
1. Verify nameservers at registrar match Route53
2. Wait 15-30 minutes for DNS propagation
3. Check: `dig yourdomain.com`

---

## 🔄 Updating Website Content

### Development Workflow
1. Make changes to React app
2. Test locally: `npm run dev`
3. Build production: `npm run build`
4. Upload to S3: `aws s3 sync dist/ s3://photography-project-website/ --delete`
5. Invalidate cache: `aws cloudfront create-invalidation ...`
6. Wait ~30-60 seconds for invalidation
7. Refresh browser (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)

### Automated Deployment (Future - Phase 7)
Phase 7 will add GitHub Actions for automated deployment:
- Push to main branch → Trigger build → Upload to S3 → Invalidate CloudFront

---

## 🗑️ Cleanup (Optional)

To destroy Phase 2 resources:

```bash
# Empty S3 bucket first (versioned buckets must be empty)
aws s3 rm s3://photography-project-website/ --recursive

# Then destroy
terraform destroy
```

**Warning:** This will delete:
- All website files
- CloudFront distribution (DNS will break)
- DNS records (domain won't resolve)

---

## 📚 Resources

- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront with S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html)
- [Origin Access Control (OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Terraform CloudFront Distribution](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution)

---

## ⏭️ Next Steps

After Phase 2 is complete:

1. ✅ Website accessible at custom domain with HTTPS
2. ✅ Global CDN delivering content
3. ✅ SPA routing working
4. ⏭️ **Begin Phase 3:** Cognito authentication for admin
5. ⏭️ **Begin Phase 4:** Photo upload S3 bucket

---

**Phase 2 Complete!** 🎉

You now have:
- Fully functional static website hosting
- Global CDN with HTTPS
- Custom domain (apex + www)
- Secure, scalable infrastructure
- Ready to add admin features (Phase 3+)
