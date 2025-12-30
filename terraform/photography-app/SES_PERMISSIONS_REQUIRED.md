# SES IAM Permissions Required

Your IAM user `PhotographyProject` needs additional permissions to create SES resources.

## Error

```
User: arn:aws:iam::321375765934:user/PhotographyProject is not authorized to perform:
ses:VerifyDomainIdentity and ses:VerifyEmailIdentity
```

## Solution

Add the following SES permissions to your IAM user in the AWS Console:

### Option 1: AWS Console (Recommended)

1. Go to **IAM Console** → **Users** → **PhotographyProject**
2. Click **Add permissions** → **Attach policies directly**
3. Search for **AWSSESFullAccess** and attach it

### Option 2: Custom Policy (Minimal Permissions)

If you prefer minimal permissions, create a custom policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:VerifyDomainIdentity",
        "ses:VerifyEmailIdentity",
        "ses:GetIdentityVerificationAttributes",
        "ses:DeleteIdentity",
        "ses:VerifyDomainDkim",
        "ses:GetIdentityDkimAttributes",
        "ses:SetIdentityDkimEnabled",
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

**Steps:**
1. Go to **IAM Console** → **Policies** → **Create policy**
2. Click **JSON** tab and paste the policy above
3. Name it `PhotographyProjectSESPolicy`
4. Go to **Users** → **PhotographyProject** → **Add permissions**
5. Attach the `PhotographyProjectSESPolicy` you just created

### Option 3: AWS CLI

```bash
aws iam attach-user-policy \
  --user-name PhotographyProject \
  --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
```

## After Adding Permissions

Run terraform apply again:

```bash
cd terraform/terraform
terraform apply
```

The SES resources should now be created successfully.
