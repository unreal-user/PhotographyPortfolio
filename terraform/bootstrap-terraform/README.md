# Terraform Bootstrap - Photography Project

This bootstrap system sets up the Terraform state backend infrastructure for the photography portfolio project.

## What This Does

The bootstrap process creates:

1. **S3 Bucket** (`photography-project-terraform-state`)
   - Stores Terraform state files
   - Versioning enabled (allows rollback)
   - Server-side encryption (AES256)
   - All public access blocked

2. **DynamoDB Table** (`photography-project-terraform-locks`)
   - Prevents concurrent Terraform operations
   - Pay-per-request billing (cost-effective)

3. **Main Terraform Directory** (`../terraform/`)
   - Pre-configured with remote backend
   - Template files ready for Phase 1+
   - Proper .gitignore to avoid committing secrets

## Prerequisites

- AWS CLI configured with valid credentials
- Terraform >= 1.0 installed
- Appropriate AWS permissions:
  - S3: CreateBucket, PutBucketVersioning, PutBucketEncryption
  - DynamoDB: CreateTable
  - IAM: GetUser/GetCallerIdentity (for validation)

## Usage

### First-Time Setup

```bash
cd /home/claude/photography-project/bootstrap
./bootstrap.sh
```

That's it! The script is fully automated and will:
- ✅ Validate AWS credentials
- ✅ Check if resources already exist (idempotent)
- ✅ Create S3 bucket and DynamoDB table
- ✅ Generate backend configuration
- ✅ Initialize main Terraform directory
- ✅ Create template files (main.tf, variables.tf, etc.)

### For Future Projects

To reuse this bootstrap for other projects:

1. Copy the `bootstrap/` directory
2. Edit `bootstrap/variables.tf` - change default values:
   ```hcl
   variable "project_name" {
     default = "your-new-project"
   }
   
   variable "state_bucket_name" {
     default = "your-new-project-terraform-state"
   }
   
   variable "lock_table_name" {
     default = "your-new-project-terraform-locks"
   }
   ```
3. Run `./bootstrap.sh`

**Tip**: The script is idempotent - you can run it multiple times safely.

## What Gets Created

### Directory Structure
```
photography-project/
├── bootstrap/
│   ├── bootstrap.sh          ← The magic script
│   ├── main.tf               ← Creates state backend
│   ├── variables.tf          ← Bootstrap configuration
│   └── outputs.tf            ← Backend details
│
├── terraform/
│   ├── backend.tf            ← Auto-generated backend config
│   ├── main.tf               ← Your infrastructure (template)
│   ├── variables.tf          ← Project variables (template)
│   ├── terraform.tfvars      ← Variable values (gitignored)
│   ├── outputs.tf            ← Output values (template)
│   └── modules/              ← Future modules go here
│
└── .gitignore                ← Protects secrets
```

### AWS Resources

**S3 Bucket**: `photography-project-terraform-state`
- Region: us-east-1
- Versioning: Enabled
- Encryption: AES256
- Public Access: Blocked

**DynamoDB Table**: `photography-project-terraform-locks`
- Region: us-east-1
- Hash Key: LockID (String)
- Billing: Pay-per-request

## Cost

The state backend infrastructure costs approximately:
- **S3**: ~$0.02/month (state files are tiny)
- **DynamoDB**: ~$0.25/month (minimal operations)
- **Total**: ~$0.30/month

## Security

### State File Security
- ✅ Stored in private S3 bucket
- ✅ Encrypted at rest (AES256)
- ✅ Versioned (can rollback)
- ✅ State locking prevents corruption
- ✅ Access controlled by IAM

### Gitignore Protection
The generated `.gitignore` prevents committing:
- `terraform.tfstate` (local state)
- `terraform.tfvars` (may contain secrets)
- `.terraform/` directory
- `.env` files

## Troubleshooting

### "Bucket already exists"
If you see this warning, it means the state backend was previously created. The script will skip creation and proceed to configure the main Terraform directory. This is safe.

### "AWS credentials not configured"
Run `aws configure` and provide:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: us-east-1
- Output format: json

### "Permission denied" when running script
Make the script executable:
```bash
chmod +x bootstrap.sh
```

### State locking errors
If Terraform operations fail with state locking errors:
1. Check DynamoDB table exists: `aws dynamodb describe-table --table-name photography-project-terraform-locks`
2. If a lock is stuck, you can manually release it (dangerous - only if you're sure no other operation is running):
   ```bash
   terraform force-unlock <LOCK_ID>
   ```

## After Bootstrap

Once bootstrap completes, you're ready for **Phase 1: DNS & Certificate**!

Next steps:
```bash
cd ../terraform
# Edit terraform.tfvars with your actual domain
vim terraform.tfvars

# Begin Phase 1 infrastructure
# (Follow the main project plan)
```

## Cleanup (Danger Zone)

⚠️ **WARNING**: This will delete all Terraform state! Only do this if you want to completely reset the project.

```bash
# Delete DynamoDB table
aws dynamodb delete-table \
  --table-name photography-project-terraform-locks \
  --region us-east-1

# Delete S3 bucket (must be empty first)
aws s3 rm s3://photography-project-terraform-state --recursive
aws s3api delete-bucket \
  --bucket photography-project-terraform-state \
  --region us-east-1
```

## Notes

- The bootstrap Terraform config uses **local state** (no backend block)
- Main project Terraform uses **remote state** (S3 + DynamoDB backend)
- The `prevent_destroy` lifecycle rule protects state resources from accidental deletion
- State bucket versioning allows you to recover from state corruption

## Questions?

This bootstrap system is designed to be:
- ✅ Fire-and-forget (run once, works forever)
- ✅ Idempotent (safe to run multiple times)
- ✅ Reusable (copy for new projects)
- ✅ Secure (follows AWS best practices)

---

Ready to build your infrastructure! 🚀
