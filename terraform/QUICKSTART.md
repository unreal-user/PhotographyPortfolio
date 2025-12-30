# Quick Start Guide - Photography Project Bootstrap

## Prerequisites Installation

### 1. Install Terraform (if not already installed)

**On Fedora/RHEL:**
```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://rpm.releases.hashicorp.com/fedora/hashicorp.repo
sudo dnf install terraform
```

**On Ubuntu/Debian:**
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**On macOS:**
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Verify installation:**
```bash
terraform --version
# Should show: Terraform v1.x.x
```

### 2. Configure AWS CLI

```bash
aws configure
```

Enter when prompted:
- **AWS Access Key ID**: [Your access key]
- **AWS Secret Access Key**: [Your secret key]
- **Default region name**: us-east-1
- **Default output format**: json

**Verify AWS credentials:**
```bash
aws sts get-caller-identity
```

## Running the Bootstrap

### Step 1: Navigate to bootstrap directory
```bash
cd photography-project/bootstrap
```

### Step 2: Execute the bootstrap script
```bash
./bootstrap.sh
```

### What the script does:
1. ✅ Validates AWS credentials
2. ✅ Checks if state backend already exists
3. ✅ Creates S3 bucket for Terraform state
4. ✅ Creates DynamoDB table for state locking
5. ✅ Generates terraform/backend.tf with remote backend config
6. ✅ Creates terraform directory structure with templates
7. ✅ Initializes Terraform with remote backend

### Expected output:
```
========================================
  Terraform Bootstrap for photography-project
========================================

[INFO] Running pre-flight checks...
[SUCCESS] AWS credentials validated
  Account ID: 123456789012
  User/Role: arn:aws:iam::123456789012:user/your-user
  Region: us-east-1

[INFO] Initializing Terraform in bootstrap directory...
[SUCCESS] Terraform initialized

[INFO] Creating state backend resources...
  S3 Bucket: photography-project-terraform-state
  DynamoDB Table: photography-project-terraform-locks

[SUCCESS] State backend resources created!
[SUCCESS] Main Terraform initialized with remote backend!

========================================
  Bootstrap Complete! 🚀
========================================

State Backend Resources:
  ✓ S3 Bucket: photography-project-terraform-state
  ✓ DynamoDB Table: photography-project-terraform-locks

Next Steps:
  1. cd ../terraform
  2. Edit terraform.tfvars with your configuration
  3. Start building your infrastructure!

[SUCCESS] You're ready to begin Phase 1! 🎉
```

## After Bootstrap

Your project structure will look like this:

```
photography-project/
├── bootstrap/
│   ├── bootstrap.sh
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── README.md
│
├── terraform/
│   ├── backend.tf              ← Auto-generated
│   ├── main.tf                 ← Template
│   ├── variables.tf            ← Template  
│   ├── terraform.tfvars        ← Edit this!
│   ├── outputs.tf              ← Template
│   └── modules/                ← Future modules
│
└── .gitignore                  ← Auto-generated
```

## Next Steps: Phase 1 - DNS & Certificate

Once bootstrap is complete:

```bash
cd ../terraform
```

Edit `terraform.tfvars` and update the domain:
```hcl
domain_name = "youractualdomai.com"  # Change from test.com
```

Then you're ready to begin building the actual infrastructure!

## Troubleshooting

### "Bucket already exists"
This is normal if you've run the bootstrap before. The script is idempotent and will skip resource creation while still setting up the terraform directory.

### "Access Denied" errors
Ensure your AWS user has permissions for:
- s3:CreateBucket
- s3:PutBucketVersioning
- s3:PutBucketEncryption
- dynamodb:CreateTable
- iam:GetUser

### Script permission denied
```bash
chmod +x bootstrap.sh
```

## Verification

After bootstrap completes, verify the resources:

```bash
# Check S3 bucket
aws s3 ls s3://photography-project-terraform-state

# Check DynamoDB table
aws dynamodb describe-table --table-name photography-project-terraform-locks --region us-east-1

# Verify Terraform backend
cd ../terraform
terraform init
# Should show: "Successfully configured the backend "s3"!"
```

---

**Ready to build? Let's go! 🚀**
