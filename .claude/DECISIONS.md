# Architectural Decision Records (ADR)

This file documents key architectural and technical decisions made during the project.

---

## Decision Log

### ADR-001: Frontend Framework Selection
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted
**Context:** Need a modern, performant frontend framework for photography portfolio

**Decision:** React 19 + TypeScript + Vite

**Rationale:**
- React 19 provides modern features and excellent ecosystem
- TypeScript adds type safety and better developer experience
- Vite offers fast development with HMR and optimized production builds
- Easy static site generation for S3 deployment
- Large community support and extensive libraries

**Alternatives Considered:**
- Next.js (more complex than needed for static site)
- Vue.js (team preference for React)
- Plain HTML/CSS/JS (too limited for complex interactions)

**Consequences:**
- Build process required for deployment
- Node.js needed for local development
- Bundle size to monitor for performance

---

### ADR-002: Routing Library
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** React Router v7

**Rationale:**
- Industry standard for React routing
- Client-side routing for SPA experience
- Works seamlessly with static site hosting on S3
- Type-safe with TypeScript

**Consequences:**
- All routes handled client-side
- Need proper 404 handling in CloudFront/S3 configuration

---

### ADR-003: Infrastructure as Code
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** Terraform for AWS infrastructure management

**Rationale:**
- Declarative infrastructure definition
- Version control for infrastructure changes
- Reusable modules
- State management with S3 + DynamoDB locking
- Industry standard with strong AWS provider support

**Alternatives Considered:**
- AWS CloudFormation (more verbose, AWS-specific)
- AWS CDK (requires additional language knowledge)
- Manual AWS Console (not repeatable, error-prone)

**Consequences:**
- Learning curve for Terraform syntax
- State file must be carefully managed
- Changes require terraform apply workflow

---

### ADR-004: AWS Region Selection
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** us-east-1 (N. Virginia)

**Rationale:**
- Admin user located in Florida (closest region)
- Required for CloudFront ACM certificates (must be us-east-1)
- Lowest latency for admin operations
- Most AWS services available first in us-east-1

**Consequences:**
- All resources deployed to single region
- CloudFront provides global CDN regardless of origin region

---

### ADR-005: Authentication Strategy
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** AWS Cognito for admin authentication

**Rationale:**
- Fully managed authentication service
- JWT token-based auth integrates with API Gateway
- No database or user management infrastructure needed
- Free tier covers expected usage (50K MAUs)
- Built-in security features (MFA, password policies)

**Alternatives Considered:**
- Custom auth with Lambda (reinventing the wheel)
- Third-party (Auth0, Firebase) (vendor lock-in, cost)

**Consequences:**
- AWS-specific authentication
- Limited customization of auth UI
- Must handle Cognito token refresh in frontend

---

### ADR-006: Photo Storage Strategy
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** S3 with pre-signed URLs for uploads

**Rationale:**
- Direct browser-to-S3 uploads (no Lambda proxy for large files)
- Pre-signed URLs keep credentials out of frontend
- Cost-effective storage
- Integrates with CloudFront for delivery
- Automatic versioning and lifecycle policies available

**Consequences:**
- Must implement pre-signed URL generation API
- Frontend needs upload progress tracking
- CORS configuration required on S3 bucket

---

### ADR-007: Design System Approach
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** CSS Variables (Custom Properties) in tokens.css

**Rationale:**
- Simple, no build-time complexity
- Native browser support for theming
- Easy light/dark mode implementation
- No CSS-in-JS runtime overhead
- Minimal bundle size impact

**Alternatives Considered:**
- Tailwind CSS (additional build complexity)
- Styled Components (runtime overhead)
- CSS Modules (more complex setup)

**Consequences:**
- Manual class naming conventions needed
- No automatic CSS purging (must be mindful of unused styles)
- Component-specific CSS files for organization

---

### ADR-008: Photo Data Interface
**Date:** Prior to 2025-12-17
**Status:** ✅ Accepted

**Decision:** Photo interface with thumbnailUrl + fullResUrl separation

**Rationale:**
- Performance optimization (load thumbnails first, full-res on demand)
- Bandwidth optimization
- Better user experience with progressive loading
- Supports responsive images

**Interface:**
```typescript
interface Photo {
  id: string;
  thumbnailUrl: string;
  fullResUrl: string;
  alt: string;
  copyright: string;
}
```

**Consequences:**
- Must generate/store multiple image sizes
- S3 storage costs for multiple versions
- Need image processing pipeline (future)

---

### ADR-009: State Tracking in tmpfs Environment
**Date:** 2025-12-17
**Status:** ✅ Accepted

**Decision:** `.claude/` directory with markdown files for project state tracking

**Rationale:**
- tmpfs filesystem is ephemeral (lost on restart)
- Need git-tracked state for persistence
- Markdown files are human-readable and git-friendly
- Structured approach for multiple files (status, active work, decisions, guidelines)

**Files Created:**
- `PROJECT_STATUS.md` - Overall project progress
- `ACTIVE_WORK.md` - Current session tasks
- `DECISIONS.md` - This file
- `DEVELOPMENT_GUIDELINES.md` - Project rules and standards

**Consequences:**
- Must commit changes regularly
- Need discipline to keep files updated
- Git becomes source of truth for project state

---

### ADR-012: Phase 5 Lambda Functions + API Gateway Architecture
**Date:** 2025-12-19
**Status:** ✅ Accepted

**Decision:** One Lambda function per endpoint (6 functions) + REST API Gateway + Cognito authorizer

**Context:** Phase 5 adds serverless backend API for photo management. Key questions:
1. Lambda architecture (monolithic vs one-per-endpoint)
2. API Gateway type (REST API vs HTTP API)
3. Authorization method (Cognito authorizer vs Lambda authorizer)
4. Lambda runtime and deployment strategy
5. IAM policy structure

**Decisions Made:**

**1. One Lambda per Endpoint (over monolithic Lambda)**
- Rationale: Better debugging, error isolation, least-privilege IAM policies
- Approach: 6 Lambda functions (generate-upload-url, create-photo, list-photos, get-photo, update-photo, delete-photo)
- YAGNI principle: No shared code, no frameworks, simple Python functions
- Trade-off: More Terraform resources (~60 vs ~20), but better maintainability and debugging

**2. REST API Gateway (over HTTP API)**
- Rationale: Full feature set, Cognito authorizer support (HTTP API requires JWT authorizer)
- Features: Request validation, CORS, stage management, throttling
- Trade-off: Slightly higher cost (~$3.50/million vs $1/million), but negligible for low traffic

**3. Cognito User Pool Authorizer (over Lambda authorizer)**
- Rationale: Simpler implementation, no custom auth code, integrates with Phase 3 Cognito
- Security: JWT validation handled by API Gateway automatically
- Trade-off: Coupled to AWS Cognito, but already committed in Phase 3

**4. Python 3.12 Runtime (over Node.js/inline code)**
- Rationale: Team familiarity, boto3 (AWS SDK) included by default, simple deployment
- Deployment: ZIP files (no layers needed for simple functions)
- Trade-off: Cold start slightly slower than Node.js, but acceptable for admin-only API

**5. Separate IAM Policies by Permission Type**
- Approach: 3 policies (S3 upload, S3 copy, DynamoDB) attached per-function as needed
- Rationale: Least-privilege security, clear separation of concerns
- Trade-off: More policy resources, but better security posture

**Lambda Functions Implemented:**

1. **generate-upload-url** (POST /photos/upload-url)
   - Generate pre-signed S3 URLs for browser uploads
   - Validation: File type (JPEG/PNG/WebP), size (max 10MB)
   - IAM: s3:PutObject on uploads/*
   - Output: {uploadUrl, photoId, s3Key, expiresAt}

2. **create-photo** (POST /photos)
   - Save photo metadata to DynamoDB after S3 upload
   - Validation: Required fields (photoId, title, alt, copyright), UUID format
   - IAM: dynamodb:PutItem, s3:HeadObject
   - Creates with status="pending"

3. **list-photos** (GET /photos?status={status})
   - Query photos by status using DynamoDB GSI
   - Supports pagination with limit parameter
   - IAM: dynamodb:Query on table + GSI
   - Returns array sorted by uploadDate (newest first)

4. **get-photo** (GET /photos/{photoId})
   - Retrieve single photo metadata by photoId
   - IAM: dynamodb:GetItem
   - Returns full photo object or 404

5. **update-photo** (PATCH /photos/{photoId})
   - Update metadata and handle status transitions
   - Workflow: If status changes to "published", copy from uploads/ to originals/
   - IAM: dynamodb:GetItem + UpdateItem, s3:CopyObject
   - Updates publishedAt/archivedAt timestamps

6. **delete-photo** (DELETE /photos/{photoId})
   - Soft delete (move to archive/, set status="archived")
   - Workflow: Copy from originals/ to archive/, update DynamoDB
   - IAM: dynamodb:GetItem + UpdateItem, s3:CopyObject
   - Preserves data for potential recovery

**API Gateway Configuration:**
- REST API: `photography-project-api`
- Stage: `prod`
- CORS: Enabled for production domains (*.test.com)
- Resources: 3 paths (/photos, /photos/upload-url, /photos/{photoId})
- Methods: POST, GET, PATCH, DELETE + OPTIONS (CORS)
- Integration: Lambda proxy integration (AWS_PROXY type)
- Authorization: Cognito JWT on all endpoints (except OPTIONS)

**CloudWatch Configuration:**
- Log groups: 6 (one per function)
- Retention: 14 days (balance cost vs debugging needs)
- Naming: `/aws/lambda/photography-project-{function-name}`

**Photo Lifecycle Workflow:**
```
1. Generate Upload URL (pre-signed S3 URL for uploads/)
   ↓
2. Upload to S3 (browser direct upload)
   ↓
3. Create Metadata (DynamoDB with status="pending")
   ↓
4. Publish (PATCH status → "published", S3 copy: uploads/ → originals/)
   ↓
5. Archive (DELETE, S3 copy: originals/ → archive/, status → "archived")
```

**Validation Rules:**
- File types: JPEG, PNG, WebP only
- File size: Max 10MB
- photoId: UUID v4 format (RFC 4122)
- Required fields: title, alt, copyright
- Status values: "pending", "published", "archived"

**Error Handling:**
- 400 Bad Request: Invalid input, validation errors
- 401 Unauthorized: Missing/invalid JWT (API Gateway handles)
- 404 Not Found: Photo doesn't exist
- 500 Internal Server Error: Lambda errors

**Alternatives Considered:**

1. **Monolithic Lambda with routing** - Single function, router logic
   - Pros: Fewer resources, shared code
   - Cons: Harder debugging, all-or-nothing IAM, complex error isolation
   - Rejected: YAGNI, debugging complexity not worth it

2. **HTTP API Gateway** - Simpler, cheaper API type
   - Pros: Lower cost, faster
   - Cons: No Cognito authorizer, must use JWT authorizer with custom Lambda
   - Rejected: Cost savings negligible, Cognito integration important

3. **Lambda authorizer** - Custom auth logic
   - Pros: More control, can add custom claims
   - Cons: Extra code, more complexity, reinventing Cognito JWT validation
   - Rejected: Cognito authorizer simpler and built-in

4. **Node.js runtime** - JavaScript Lambda functions
   - Pros: Faster cold starts, smaller bundle
   - Cons: Must install AWS SDK, team less familiar
   - Rejected: Python simpler, boto3 included by default

5. **Inline Lambda code in Terraform** - No ZIP files
   - Pros: Simpler deployment (no build step)
   - Cons: Limited to simple functions, hard to test locally, no dependencies
   - Rejected: Python files easier to test and maintain

6. **Lambda layers** - Shared dependencies
   - Pros: Smaller function packages, shared code
   - Cons: More complexity, not needed for simple functions
   - Rejected: YAGNI, no shared dependencies

**Consequences:**
- 6 Lambda functions provide clear separation and debugging
- ~60 Terraform resources (vs ~20 for monolithic), but better maintainability
- CloudWatch logs per function enable targeted debugging
- Least-privilege IAM policies improve security posture
- Pre-signed URLs enable direct browser-to-S3 uploads (no Lambda proxy)
- Photo lifecycle workflow enforced at API layer
- API Gateway + Cognito handle all auth (no custom auth code)

**Security Features:**
- Cognito JWT authorizer on all endpoints
- Pre-signed URLs expire after 5 minutes
- Least-privilege IAM policies per function type
- CORS restricted to production domains
- HTTPS-only (enforced by API Gateway + S3 bucket policy)
- CloudWatch logging for audit trail
- No credentials in frontend code

**Cost Impact:**
- Lambda: $0.00/month (free tier: 1M requests, 400K GB-seconds)
- API Gateway: ~$0.01/month (3,000 requests @ $3.50/million after free tier)
- CloudWatch Logs: ~$0.01/month (10MB logs @ $0.50/GB)
- **Total: ~$0.02/month** (cumulative: ~$1.84/month for Phases 0-5)

**Phase 6 Preparation:**
- API Gateway base URL available via Terraform output
- JWT tokens from Cognito ready for authorization
- API client service can be built in frontend
- Environment variables for frontend (VITE_API_URL)
- Upload workflow ready:
  1. Call generateUploadUrl()
  2. Upload file to S3 using pre-signed URL
  3. Call createPhoto() with metadata
  4. Photo appears in admin dashboard

**Resources Created:**
- 6 Lambda functions (Python 3.12, 128MB, 10s timeout)
- 6 CloudWatch log groups (14-day retention)
- 1 IAM execution role + 3 policies + 4 attachments
- 1 REST API Gateway + 1 stage
- 1 Cognito authorizer
- 3 API resources + 6 methods + 6 integrations
- 6 Lambda permissions
- 3 CORS OPTIONS methods (9 resources)
- 1 deployment

---

## Decision Template

```markdown
### ADR-XXX: [Title]
**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Deprecated | Superseded]

**Decision:** [What was decided]

**Context:** [What problem are we solving]

**Rationale:**
- [Why this decision makes sense]
- [Key benefits]

**Alternatives Considered:**
- [Other option 1] (why not chosen)
- [Other option 2] (why not chosen)

**Consequences:**
- [Impact of this decision]
- [Trade-offs accepted]
```

---

**Instructions:**
- Add new ADRs as decisions are made
- Number sequentially (ADR-001, ADR-002, etc.)
- Never delete old ADRs - mark as "Superseded" if replaced
- Keep rationale clear and concise
- Document alternatives considered

---

### ADR-010: Phase 3 Authentication Implementation
**Date:** 2025-12-19
**Status:** ✅ Accepted

**Decision:** Custom login UI + Optional MFA + Client-side device tracking

**Context:** Phase 3 requires admin authentication with Cognito. Key questions:
1. Custom login UI vs Cognito Hosted UI
2. MFA configuration (required, optional, or disabled)
3. Device tracking approach (email MFA for new devices)
4. Frontend library (AWS Amplify vs amazon-cognito-identity-js)

**Decisions Made:**

**1. Custom Login UI (over Cognito Hosted UI)**
- Rationale: Matches portfolio design, better UX, more control over styling
- Trade-off: More code upfront, but better long-term branding

**2. Optional MFA (not required or disabled)**
- Rationale: YAGNI for single admin user, can be enabled via Cognito console if desired
- Trade-off: Slightly less secure initially, but adequate for single-admin use case
- Future: Email-based MFA for new devices to be implemented with Lambda triggers

**3. Client-side Device Tracking (cookie-based)**
- Rationale: Simple implementation, no backend required for MVP
- Approach: UUID cookie (90-day expiry, HTTPS-only, SameSite=Strict)
- Trade-off: Client-side only (can be cleared), but sufficient for trusted device tracking
- Future: Backend device tracking with DynamoDB for Phase 4+

**4. AWS Amplify Library (over raw cognito-identity-js)**
- Rationale: Official AWS library, handles token refresh automatically, good TypeScript support
- Trade-off: ~100KB bundle impact, but saves significant implementation complexity

**Key Features Implemented:**
- Admin-only access (no self-signup)
- Strong password policy (12+ chars, complexity required)
- Email verification for account recovery
- Device cookie for trusted devices (foundation for future email MFA)
- JWT-based authentication (1h access, 30d refresh)
- Secure session management with auto token refresh
- ProtectedRoute component for future admin pages

**Alternatives Considered:**
1. **Cognito Hosted UI** - Faster but disconnected from site design
2. **Required MFA** - More secure but adds friction for single user
3. **Disabled MFA** - Simpler but no MFA capability at all (less secure)
4. **Server-side device tracking** - More robust but requires backend infrastructure (Phase 4+)
5. **Raw cognito-identity-js** - Lighter bundle but more manual token management

**Consequences:**
- Custom UI requires maintenance but provides better UX
- Optional MFA allows flexibility without forcing complexity
- Device tracking prepares for future email MFA implementation
- Amplify adds bundle size but reduces implementation time
- Admin user must be created manually via AWS CLI (no passwords in Terraform)

**Security Considerations:**
- Password policy: 12+ characters with complexity requirements
- Short-lived access tokens (1 hour)
- Secure cookies (HTTPS-only, SameSite=Strict)
- Token revocation enabled for emergency logout
- User existence errors prevented (generic error messages)
- Deletion protection on User Pool (prevents accidental deletion)

**Cost Impact:**
- $0/month (Cognito free tier covers up to 50K MAU)

**Phase 4 Preparation:**
- ProtectedRoute component ready for admin dashboard
- Auth state available globally via AuthContext
- Device tracking foundation for email MFA Lambda triggers
- JWT tokens ready for API Gateway authorization

---

### ADR-011: Phase 4 Photo Storage Architecture
**Date:** 2025-12-19
**Status:** ✅ Accepted

**Decision:** S3 + DynamoDB infrastructure-only (no Lambda, API Gateway, or frontend in Phase 4)

**Context:** Phase 4 needs photo storage infrastructure. Key questions:
1. Storage solution (S3 vs third-party CDN)
2. Metadata storage (DynamoDB vs RDS)
3. Scope (infrastructure-only vs full backend implementation)
4. Billing mode (on-demand vs provisioned)
5. Folder structure and lifecycle policies

**Decisions Made:**

**1. S3 for Photo Storage (over third-party CDN)**
- Rationale: Native AWS integration, cost-effective, scales automatically
- Cost: ~$0.012/month for 500MB storage
- Trade-off: AWS lock-in, but acceptable for this use case

**2. DynamoDB for Metadata (over RDS)**
- Rationale: Serverless, scales to zero, simple schema, fast queries
- Cost: ~$0.002/month on-demand billing
- Trade-off: NoSQL limitations, but sufficient for photo metadata

**3. Infrastructure-Only Scope (defer Lambda/API to Phase 5)**
- Rationale: YAGNI principle - build only what's needed now
- Approach: Create storage foundation, add functionality later
- Trade-off: No photo upload capability yet, but cleaner separation of concerns

**4. On-Demand Billing (over provisioned capacity)**
- Rationale: Low, unpredictable traffic for admin-only app
- Cost: Pay only for actual usage, scales automatically
- Trade-off: Slightly higher cost per request, but much lower total cost

**5. Folder Structure with Lifecycle Policies**
- `uploads/` - Temporary staging (7-day auto-delete)
- `originals/` - Published photos (permanent)
- `archive/` - Soft-deleted photos (transition to IA after 30 days)
- Rationale: Clear separation, automatic cleanup, cost optimization

**Resources Implemented:**
- S3 bucket (`photography-project-photos`)
- S3 public access block (all public access blocked)
- S3 versioning (rollback capability)
- S3 server-side encryption (AES256)
- S3 CORS configuration (browser uploads from production domain)
- S3 lifecycle policies (3 rules: cleanup, archival, version management)
- S3 bucket policy (HTTPS-only enforcement)
- DynamoDB table with GSI (`status-uploadDate-index`)
- Point-in-time recovery (data protection)
- DynamoDB encryption at rest

**DynamoDB Schema Design:**
- Primary key: `photoId` (String) - UUID v4
- GSI: `status-uploadDate-index` for querying photos by status + date
- Attributes: title, description, alt, copyright, uploadedBy, uploadDate, status, S3 keys, file metadata, timestamps

**CORS Configuration:**
- Allowed origins: Production domains only (`https://test.com`, `https://www.test.com`)
- Allowed methods: GET, PUT, POST, DELETE, HEAD
- Purpose: Enable direct browser-to-S3 uploads via pre-signed URLs (Phase 5)

**Lifecycle Policies:**
1. **Cleanup Uploads** - Delete `uploads/*` after 7 days (abandoned uploads)
2. **Archive Transition** - Move `archive/*` to Standard-IA after 30 days (cost optimization)
3. **Version Cleanup** - Delete old versions after 90 days (control versioning costs)

**Alternatives Considered:**
1. **Third-party CDN (Cloudinary, Imgix)** - Faster implementation but monthly costs, vendor lock-in
2. **RDS for metadata** - More familiar SQL but higher costs, requires instance management
3. **Provisioned DynamoDB** - Predictable costs but higher for low traffic, capacity planning required
4. **Full Phase 4 (Lambda + API)** - Complete backend but violates YAGNI, more complex deployment
5. **No lifecycle policies** - Simpler but manual cleanup required, higher costs

**Consequences:**
- S3 provides scalable, cost-effective photo storage
- DynamoDB scales to zero when not in use (minimal costs)
- Infrastructure ready for Phase 5 Lambda functions
- No photo upload capability until Phase 5 (API Gateway + Lambda)
- Lifecycle policies reduce storage costs automatically
- CORS enables future browser uploads via pre-signed URLs
- Folder structure provides clear organization and cleanup

**Security Features:**
- Private S3 bucket (no public access)
- Server-side encryption (AES256)
- HTTPS-only enforcement
- Versioning for rollback
- DynamoDB encryption at rest
- Point-in-time recovery enabled
- CORS restricted to production domains

**Cost Impact:**
- S3 storage (500MB): ~$0.012/month
- S3 requests: ~$0.001/month
- DynamoDB on-demand: ~$0.002/month
- **Total: ~$0.02/month** (cumulative: ~$1.82/month for Phases 0-4)

**Phase 5 Preparation:**
- S3 bucket ready for pre-signed URL uploads
- DynamoDB schema contract defined
- Folder conventions established
- CORS configured for browser uploads
- Outputs available for Lambda IAM policies
- Lifecycle policies handle cleanup automatically

---
