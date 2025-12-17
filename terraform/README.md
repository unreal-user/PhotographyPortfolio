# Photography Portfolio - AWS Infrastructure

**Project**: Static photography portfolio website with admin panel  
**Domain**: test.com (placeholder - update in terraform.tfvars)  
**Target**: Production-ready before Christmas  
**Region**: us-east-1 (Florida-based admin)

---

## 📋 Project Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ **COMPLETE** | Terraform state backend bootstrap |
| Phase 1 | ⏳ Pending | DNS & ACM Certificate |
| Phase 2 | ⏳ Pending | Static site hosting (S3 + CloudFront) |
| Phase 3 | ⏳ Pending | Cognito authentication |
| Phase 4 | ⏳ Pending | Photo upload S3 bucket |
| Phase 5 | ⏳ Pending | API Gateway + Lambda functions |
| Phase 6 | ⏳ Pending | Frontend integration |
| Phase 7 | ⏳ Pending | Deployment pipeline |

---

## 🚀 Quick Start

### Prerequisites
- Terraform >= 1.0
- AWS CLI configured
- AWS account with appropriate permissions

### 1. Extract Project Files
```bash
tar -xzf photography-project-bootstrap.tar.gz
cd photography-project
```

### 2. Run Bootstrap (Phase 0)
```bash
cd bootstrap
./bootstrap.sh
```

This creates:
- S3 bucket for Terraform state
- DynamoDB table for state locking
- Main terraform directory with backend configured

### 3. Verify Bootstrap
```bash
cd ../terraform
terraform init
# Should show: "Successfully configured the backend 's3'!"
```

### 4. Configure Your Domain
Edit `terraform/terraform.tfvars`:
```hcl
domain_name = "yourdomain.com"  # Change from test.com
```

### 5. Ready for Phase 1!
You're now ready to begin building the actual infrastructure.

---

## 📁 Project Structure

```
photography-project/
├── bootstrap/              # Phase 0: State backend setup
│   ├── bootstrap.sh        # Fire-and-forget script
│   ├── main.tf             # S3 + DynamoDB resources
│   └── README.md           # Bootstrap documentation
│
├── terraform/              # Main infrastructure (auto-generated)
│   ├── backend.tf          # Remote S3 backend config
│   ├── main.tf             # Infrastructure code
│   ├── variables.tf        # Project variables
│   ├── terraform.tfvars    # Variable values (gitignored)
│   └── modules/            # Infrastructure modules
│       ├── dns/            # Phase 1
│       ├── static-site/    # Phase 2
│       ├── auth/           # Phase 3
│       ├── storage/        # Phase 4
│       └── api/            # Phase 5
│
├── QUICKSTART.md           # Getting started guide
├── PHASE-0-CHECKLIST.md    # Phase 0 completion tracking
├── PHASE-0-SUMMARY.md      # Phase 0 detailed summary
└── STRUCTURE.txt           # Visual structure reference
```

---

## 🏗️ Architecture Overview

### Public-Facing
- **CloudFront** - CDN for global performance
- **S3** - Hosts React application and photos
- **Route53** - DNS management
- **ACM** - SSL/TLS certificates

### Admin/Backend
- **Cognito** - Admin authentication
- **API Gateway** - REST API endpoints
- **Lambda** - Serverless functions
- **S3** - Photo upload storage

### Security
- Pre-signed S3 URLs for uploads (no credentials in frontend)
- CloudFront OAC (Origin Access Control)
- Cognito JWT authorization
- All resources private by default

---

## 💰 Cost Estimates

### Phase 0 (Current)
- **S3**: ~$0.02/month (state storage)
- **DynamoDB**: ~$0.25/month (state locking)
- **Total**: ~$0.30/month

### Full Production (After All Phases)
- **Route53**: $0.50/hosted zone
- **S3**: ~$0.50 (20GB photos)
- **CloudFront**: FREE tier likely covers (50GB/month)
- **API Gateway**: FREE tier likely covers (1M requests)
- **Lambda**: FREE tier likely covers (1M requests)
- **Cognito**: FREE tier covers (50K MAUs)
- **Total**: ~$1-2/month for low traffic

---

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Step-by-step setup guide
- **[PHASE-0-CHECKLIST.md](PHASE-0-CHECKLIST.md)** - Phase 0 completion checklist
- **[PHASE-0-SUMMARY.md](PHASE-0-SUMMARY.md)** - Detailed Phase 0 summary
- **[STRUCTURE.txt](STRUCTURE.txt)** - Visual project structure
- **[bootstrap/README.md](bootstrap/README.md)** - Bootstrap documentation

---

## 🔐 Security Features

### State Management
✅ State stored in private S3 bucket  
✅ Encrypted at rest (AES256)  
✅ Versioned (rollback capability)  
✅ State locking prevents concurrent modifications  
✅ IAM-controlled access  

### Git Protection
✅ `.gitignore` prevents committing secrets  
✅ `terraform.tfvars` excluded from version control  
✅ State files excluded from version control  

---

## 🎯 Success Criteria

### MVP (Pre-Christmas)
- ✅ Terraform state backend operational (Phase 0 complete)
- ⏳ Website accessible at custom domain with HTTPS
- ⏳ Admin can log in via Cognito
- ⏳ Admin can upload photos
- ⏳ Admin can delete photos
- ⏳ Photos display on public portfolio site
- ⏳ All infrastructure managed by Terraform

---

## 🔄 Reusability

This bootstrap system is designed for reuse. To use for other projects:

1. Copy the `bootstrap/` directory
2. Edit `bootstrap/variables.tf` - change project name and resource names
3. Run `./bootstrap.sh`
4. You now have a complete Terraform state backend!

---

## 🐛 Troubleshooting

### Bootstrap Issues
See `bootstrap/README.md` for detailed troubleshooting.

Common issues:
- **AWS credentials**: Run `aws configure`
- **Permissions**: Ensure S3 and DynamoDB create permissions
- **Bucket exists**: Normal if re-running (idempotent)

### Terraform Issues
```bash
# Refresh state
terraform refresh

# Force unlock (if stuck)
terraform force-unlock <LOCK_ID>

# Validate configuration
terraform validate
```

---

## 📞 Next Steps

1. **Verify Phase 0 complete**: Check `PHASE-0-CHECKLIST.md`
2. **Begin Phase 1**: DNS & Certificate setup
3. **Follow the plan**: See main architecture document for phases 1-7

---

## 🎉 What's Been Built (Phase 0)

✅ **Production-ready Terraform state backend**
- S3 bucket: `photography-project-terraform-state`
- DynamoDB table: `photography-project-terraform-locks`
- Remote backend configured
- Project structure initialized

✅ **Reusable bootstrap system**
- Fire-and-forget automation
- Idempotent (safe to re-run)
- Comprehensive documentation
- Ready for future projects

---

**Let's build this! 🚀**

For questions or issues, refer to the documentation files or the main architecture plan.
