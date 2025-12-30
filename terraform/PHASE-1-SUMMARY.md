# Phase 1: DNS & SSL Certificate - Summary

**Date:** 2025-12-17
**Status:** ✅ Code Complete - Ready for Deployment
**Phase:** DNS & ACM Certificate Setup

---

## 🎯 What Was Built

Phase 1 establishes the foundation for HTTPS-enabled domain access:

1. **Route53 Hosted Zone** - DNS management for your domain
2. **ACM Certificate** - SSL/TLS certificate for HTTPS (validated via DNS)
3. **Automated DNS Validation** - Certificate auto-validates using Route53 records

---

## 📦 Resources Created

### Route53 Hosted Zone
- **Resource:** `aws_route53_zone.main`
- **Domain:** As configured in `terraform.tfvars` (default: test.com)
- **Purpose:** Manage all DNS records for the domain
- **Cost:** $0.50/month per hosted zone

### ACM Certificate
- **Resource:** `aws_acm_certificate.main`
- **Domains Covered:**
  - Primary domain (e.g., test.com)
  - www subdomain (e.g., www.test.com)
- **Validation:** DNS (automated via Route53)
- **Region:** us-east-1 (required for CloudFront)
- **Cost:** FREE

### DNS Validation Records
- **Resource:** `aws_route53_record.cert_validation`
- **Purpose:** Automatically prove domain ownership to AWS for certificate issuance
- **Automation:** Created and destroyed by Terraform as needed

---

## 🚀 Deployment Instructions

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0 installed
- Access to domain registrar (to update nameservers)

### Step 1: Update Domain Name
Edit `terraform/terraform.tfvars` (create if doesn't exist):

```hcl
domain_name = "your-actual-domain.com"  # Replace test.com
```

### Step 2: Initialize Terraform
```bash
cd terraform/terraform
terraform init
```

You should see: "Successfully configured the backend 's3'!"

### Step 3: Review Plan
```bash
terraform plan
```

Review the resources to be created:
- 1 Route53 hosted zone
- 1 ACM certificate
- ~2 Route53 validation records (one per domain)
- 1 certificate validation waiter

### Step 4: Apply Configuration
```bash
terraform apply
```

Type `yes` when prompted. This will:
1. Create the Route53 hosted zone (~30 seconds)
2. Request ACM certificate (~1 minute)
3. Create DNS validation records (~30 seconds)
4. Wait for certificate validation (~5-10 minutes)

**Total time:** ~10-15 minutes

### Step 5: Configure Domain Registrar
After apply completes, get the nameservers:

```bash
terraform output hosted_zone_name_servers
```

You'll see output like:
```
[
  "ns-123.awsdns-45.com",
  "ns-678.awsdns-90.net",
  "ns-1234.awsdns-56.org",
  "ns-5678.awsdns-12.co.uk"
]
```

**Action Required:** Update your domain registrar's nameserver settings with these values.

**Where to do this:**
- GoDaddy: Domain Settings → Nameservers → Custom
- Namecheap: Domain List → Manage → Nameservers → Custom DNS
- Route53 (if registered): Hosted zone already linked
- Others: Look for "DNS" or "Nameservers" in domain settings

**Propagation time:** 24-48 hours (but often much faster)

---

## 🔍 Verification

### Check Certificate Status
```bash
terraform output certificate_status
```

Expected: `ISSUED` (after validation completes)

### Check DNS Propagation
```bash
# Check nameservers
dig NS your-domain.com

# Or use online tools
# https://www.whatsmydns.net/
```

### Verify Certificate in AWS Console
1. Go to AWS Console → Certificate Manager (us-east-1)
2. Find certificate for your domain
3. Status should be "Issued"
4. Domains should show your domain and www subdomain

---

## 📤 Outputs

After successful deployment:

```bash
terraform output
```

You'll see:
- `certificate_arn` - Use in CloudFront (Phase 2)
- `certificate_status` - Should be "ISSUED"
- `domain_name` - Your configured domain
- `hosted_zone_id` - Route53 zone ID
- `hosted_zone_name_servers` - Nameservers for domain registrar

**Save the certificate_arn** - you'll need it for Phase 2 (CloudFront).

---

## 🔐 Security Features

✅ **HTTPS-ready** - Certificate supports TLS 1.2+
✅ **Multi-domain** - Covers both apex and www subdomain
✅ **Auto-renewal** - AWS automatically renews before expiration
✅ **DNS validation** - No manual verification needed
✅ **Encrypted DNS** - Route53 supports DNSSEC (can be enabled)

---

## 💰 Cost Breakdown

| Resource | Monthly Cost | Notes |
|----------|--------------|-------|
| Route53 Hosted Zone | $0.50 | Per hosted zone |
| DNS Queries | ~$0.40 | First 1B queries/month (low traffic) |
| ACM Certificate | FREE | No charge for public certificates |
| **Total** | **~$1/month** | Very low traffic estimate |

---

## 🧪 Testing DNS

Once nameservers are updated:

```bash
# Test DNS resolution
nslookup your-domain.com

# Check specific nameserver
nslookup your-domain.com ns-123.awsdns-45.com
```

---

## 🐛 Troubleshooting

### Certificate Stuck in "Pending Validation"
**Cause:** DNS records not propagated or nameservers not updated

**Fix:**
1. Verify nameservers updated at registrar
2. Wait 15-30 minutes for DNS propagation
3. Check Route53 validation records exist:
   ```bash
   terraform state list | grep cert_validation
   ```

### "Zone already exists" Error
**Cause:** Hosted zone for domain already exists in AWS account

**Fix:**
1. Import existing zone:
   ```bash
   terraform import aws_route53_zone.main EXISTING_ZONE_ID
   ```
2. Or delete old zone if not needed

### Certificate Validation Timeout
**Cause:** DNS propagation slower than expected

**Fix:**
1. Check validation records in Route53 console
2. Verify nameservers point to AWS Route53
3. Re-run `terraform apply` - validation will resume

---

## 🔄 Next Steps

After Phase 1 is complete:

1. ✅ Nameservers updated at domain registrar
2. ✅ Certificate status = "ISSUED"
3. ⏭️ **Begin Phase 2:** S3 + CloudFront static site hosting
4. ⏭️ Use `certificate_arn` output in CloudFront configuration

---

## 🗑️ Cleanup (Optional)

To destroy Phase 1 resources:

```bash
terraform destroy
```

**Warning:** This will:
- Delete the hosted zone (DNS will stop working)
- Delete the certificate (HTTPS will break)
- Remove all DNS records

Only do this if you're sure you want to tear down the infrastructure.

---

## 📚 Resources

- [AWS Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [AWS Certificate Manager (ACM)](https://docs.aws.amazon.com/acm/)
- [Terraform AWS Provider - Route53](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/route53_zone)
- [Terraform AWS Provider - ACM](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/acm_certificate)

---

**Phase 1 Complete!** 🎉

You now have:
- DNS management via Route53
- Valid SSL certificate for HTTPS
- Foundation for CloudFront CDN (Phase 2)
