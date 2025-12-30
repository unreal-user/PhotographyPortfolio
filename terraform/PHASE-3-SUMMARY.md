# Phase 3: Cognito Authentication - Summary

**Status:** ✅ Code Complete
**Date:** 2025-12-19
**Phase:** 3 of 7

---

## Overview

Phase 3 implements AWS Cognito authentication for admin-only access to the photography portfolio. This includes:
- Cognito User Pool for secure user management
- Custom login UI integrated with the portfolio design
- Session management with automatic token refresh
- Device tracking for future email-based MFA
- Protected route infrastructure for admin features

---

## Resources Created

### AWS Infrastructure

| Resource | Name | Purpose |
|----------|------|---------|
| **Cognito User Pool** | `photography-project-user-pool` | Manages admin user authentication |
| **Cognito User Pool Client** | `photography-project-web-client` | Enables React app to authenticate with Cognito |

### Configuration
- **Password Policy:** 12+ characters, uppercase, lowercase, numbers, symbols required
- **Email Verification:** Enabled for account recovery
- **MFA:** Optional TOTP (software token), email MFA planned for Phase 4
- **Device Tracking:** Enabled for "remember this device" functionality
- **Admin-Only:** Self-signup disabled, admin creates users via CLI

---

## Frontend Components Created

```
/root-project/src
├── /auth
│   ├── AuthContext.tsx          # React Context for auth state
│   ├── AuthProvider.tsx         # Auth state management & Cognito integration
│   ├── useAuth.ts               # Hook to access auth context
│   ├── cognitoConfig.ts         # Amplify configuration
│   └── deviceTracking.ts        # Cookie-based device trust
│
├── /interfaces
│   └── User.ts                  # User & AuthState interfaces
│
├── /pages
│   ├── LoginPage.tsx            # Admin login form
│   └── loginPage.css            # Login page styles
│
└── /components
    ├── /UserMenu
    │   ├── UserMenu.tsx         # Header user menu (login/logout)
    │   └── userMenu.css         # User menu styles
    │
    └── /ProtectedRoute
        └── ProtectedRoute.tsx   # Route guard for admin pages
```

---

## Deployment Steps

### Step 1: Deploy Terraform Infrastructure

```bash
cd /workspace/PhotographyPortfolio/terraform/terraform

# Review changes
terraform plan

# Deploy Cognito resources
terraform apply
```

**Expected Output:**
```
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.

Outputs:

cognito_user_pool_id = "us-east-1_XXXXXXXXX"
cognito_app_client_id = "xxxxxxxxxxxxxxxxxxxx"
aws_region_cognito = "us-east-1"
```

---

### Step 2: Create Admin User

After `terraform apply` completes, create the admin user:

```bash
# Save User Pool ID
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com \
  --user-attributes \
      Name=email,Value=admin@yourdomain.com \
      Name=email_verified,Value=true \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com \
  --password 'YourSecurePassword123!' \
  --permanent
```

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

---

### Step 3: Configure Frontend Environment

```bash
cd /workspace/PhotographyPortfolio/root-project

# Create .env.local with terraform outputs
cat > .env.local << EOF
VITE_AWS_REGION=$(cd ../terraform/terraform && terraform output -raw aws_region_cognito)
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform/terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_APP_CLIENT_ID=$(cd ../terraform/terraform && terraform output -raw cognito_app_client_id)
EOF
```

---

### Step 4: Install Dependencies & Build

```bash
cd /workspace/PhotographyPortfolio/root-project

# Install dependencies
npm install

# Build for production
npm run build
```

---

### Step 5: Deploy to S3

```bash
# Upload built files to S3
aws s3 sync dist/ s3://photography-project-website/ --delete

# Invalidate CloudFront cache
DISTRIBUTION_ID=$(cd ../terraform/terraform && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

---

## Testing Checklist

### Infrastructure Tests
- [ ] Cognito User Pool created successfully
- [ ] User Pool Client configured correctly
- [ ] Admin user created and password set
- [ ] Terraform outputs available

### Frontend Tests
- [ ] Build completes without errors (`npm run build`)
- [ ] No TypeScript errors
- [ ] Login page accessible at `/login`
- [ ] Invalid credentials show error message
- [ ] Valid login succeeds and redirects to home
- [ ] Header shows "Login" button when logged out
- [ ] Header shows user menu when logged in
- [ ] User menu dropdown works
- [ ] Logout button works and clears session
- [ ] Page refresh maintains login state
- [ ] Device cookie set after successful login
- [ ] Mobile responsive design works

### Security Tests
- [ ] Passwords masked in login form
- [ ] No credentials in browser localStorage (check Application tab)
- [ ] JWT tokens stored in sessionStorage only
- [ ] HTTPS enforced on production
- [ ] CloudFront serves site over HTTPS

---

## Authentication Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Navigate to /login
       ▼
┌─────────────────────┐
│   LoginPage.tsx     │
│ - Email input       │
│ - Password input    │
└──────┬──────────────┘
       │ 2. Submit credentials
       ▼
┌─────────────────────┐
│  AuthProvider.tsx   │
│ - Validates inputs  │
│ - Checks device     │
└──────┬──────────────┘
       │ 3. Calls AWS Amplify Auth.signIn()
       ▼
┌─────────────────────┐
│  AWS Cognito        │
│ - Validates user    │
│ - Issues JWT tokens │
└──────┬──────────────┘
       │ 4. Returns tokens (ID, Access, Refresh)
       ▼
┌─────────────────────┐
│  AuthProvider.tsx   │
│ - Stores tokens     │
│ - Sets device cookie│
│ - Updates state     │
└──────┬──────────────┘
       │ 5. Redirect to home
       ▼
┌─────────────────────┐
│   Header.tsx        │
│ - Shows UserMenu    │
│ - Displays email    │
└─────────────────────┘
```

---

## Configuration Details

### Cognito User Pool Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Username** | Email | Easy to remember, unique identifier |
| **Auto-verify** | Email | Required for account recovery |
| **Password Policy** | Strong | 12+ chars, complexity requirements |
| **MFA** | Optional | Admin can enable TOTP if desired |
| **Account Recovery** | Email | Allows password reset via email |
| **Deletion Protection** | Enabled | Prevents accidental user pool deletion |
| **Admin Create Only** | Enabled | No self-signup, admin controls access |

### Token Configuration

| Token Type | Validity | Purpose |
|------------|----------|---------|
| **ID Token** | 1 hour | Contains user identity claims |
| **Access Token** | 1 hour | Authorizes API calls |
| **Refresh Token** | 30 days | Renews expired tokens |

### Device Tracking

| Cookie Name | Value | Expiry | Purpose |
|-------------|-------|--------|---------|
| `device_token` | UUID v4 | 90 days | Identifies trusted devices |

**Security Settings:**
- `Secure`: true (HTTPS only)
- `SameSite`: Strict
- `HttpOnly`: false (JavaScript access needed)

---

## Cost Analysis

### Phase 3 Costs

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Cognito User Pool** | Free Tier (up to 50K MAU) | $0.00 |
| **Cognito App Client** | Included | $0.00 |

**Total Phase 3 Cost:** $0.00/month (within free tier)

**Cumulative Cost (Phases 0-3):** ~$1.80/month
- Phase 0: ~$0.30 (S3 state + DynamoDB locks)
- Phase 1: ~$1.00 (Route53 hosted zone)
- Phase 2: ~$0.50 (S3 website storage, CloudFront in free tier)
- Phase 3: ~$0.00 (Cognito free tier)

---

## Troubleshooting

### Issue: Admin user creation fails

**Error:** `User already exists`

**Solution:**
```bash
# Delete existing user
aws cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com

# Recreate user
# ... (use creation commands from Step 2)
```

---

### Issue: Login fails with "User does not exist"

**Possible Causes:**
1. Email typo (username is case-sensitive)
2. User not created yet
3. User was deleted

**Solution:**
```bash
# List all users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Verify user exists and is CONFIRMED status
```

---

### Issue: "Incorrect username or password" error

**Possible Causes:**
1. Wrong password
2. Password not set to permanent
3. User account disabled

**Solution:**
```bash
# Reset password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com \
  --password 'NewSecurePassword123!' \
  --permanent

# Enable user if disabled
aws cognito-idp admin-enable-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@yourdomain.com
```

---

### Issue: Build errors with TypeScript

**Error:** `Cannot find module 'aws-amplify'` or similar

**Solution:**
```bash
cd /workspace/PhotographyPortfolio/root-project

# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify dependencies
npm list aws-amplify js-cookie
```

---

### Issue: Login page shows blank

**Possible Causes:**
1. Missing environment variables
2. Amplify configuration error
3. Build/deployment issue

**Solution:**
```bash
# Check environment variables
cat .env.local

# Verify values match terraform outputs
cd ../terraform/terraform
terraform output

# Rebuild
cd ../../root-project
npm run build
```

---

## Security Considerations

### ✅ Implemented
1. **Strong Password Policy** - 12+ characters with complexity
2. **Email Verification** - Required for account recovery
3. **Short-lived Tokens** - 1 hour access/ID tokens
4. **Secure Cookies** - HTTPS-only, SameSite=Strict
5. **No Client Secret** - Public SPA client (appropriate for frontend)
6. **Token Revocation** - Enabled for emergency logout
7. **Deletion Protection** - User Pool cannot be accidentally deleted
8. **User Existence Errors Prevented** - Generic error messages
9. **HTTPS Enforcement** - CloudFront redirects HTTP to HTTPS

### 🔄 Future Enhancements (Phase 4+)
1. **Email-based MFA** - Verification codes for new devices
2. **Custom Email Templates** - Branded password reset emails via SES
3. **Advanced Monitoring** - CloudWatch alerts on failed logins
4. **WAF Rules** - Rate limiting, IP allowlisting for admin
5. **Audit Logging** - CloudTrail for compliance

---

## Phase 4 Preparation

Phase 3 authentication enables:
- **Protected Admin Dashboard** (use `ProtectedRoute` component)
- **User-specific Photo Uploads** (track uploads by admin)
- **API Gateway Authorization** (JWT authorizer validates Cognito tokens)
- **Audit Trail** (log admin actions with user identity)

**Next Steps:**
1. Design admin dashboard UI
2. Create photo upload S3 bucket (separate from website bucket)
3. Build Lambda for pre-signed URL generation
4. Add API Gateway with Cognito JWT authorizer
5. Implement email-based MFA flow with Lambda triggers

---

## Rollback Procedure

If Phase 3 needs to be rolled back:

```bash
# Destroy Cognito resources
cd /workspace/PhotographyPortfolio/terraform/terraform
terraform destroy -target=aws_cognito_user_pool_client.web_client
terraform destroy -target=aws_cognito_user_pool.main

# Revert frontend code
cd ../../root-project
git checkout HEAD~1 src/auth
git checkout HEAD~1 src/pages/LoginPage.tsx
git checkout HEAD~1 src/components/UserMenu
git checkout HEAD~1 src/components/ProtectedRoute
git checkout HEAD~1 src/App.tsx
git checkout HEAD~1 package.json
npm install
npm run build

# Redeploy previous version
aws s3 sync dist/ s3://photography-project-website/ --delete
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

**Note:** User data (admin users) will be permanently deleted with User Pool.

---

## Summary

✅ **Completed:**
- Cognito User Pool & Client created
- Custom login UI integrated
- Auth state management implemented
- Device tracking for MFA foundation
- Protected route infrastructure ready
- Documentation complete

📋 **Manual Steps Required:**
1. Deploy Terraform (`terraform apply`)
2. Create admin user via AWS CLI
3. Configure frontend environment (.env.local)
4. Install dependencies (`npm install`)
5. Build & deploy (`npm run build` + S3 sync)

🎯 **What's Next:**
- Phase 4: Photo upload S3 bucket
- Phase 5: API Gateway + Lambda functions
- Phase 6: Frontend admin dashboard
- Phase 7: CI/CD pipeline

---

**Phase 3 is complete and ready for deployment!**
