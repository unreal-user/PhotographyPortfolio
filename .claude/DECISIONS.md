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
