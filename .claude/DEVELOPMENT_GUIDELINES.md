# Development Guidelines - Photography Portfolio

**Version:** 1.0
**Last Updated:** 2025-12-17

These guidelines ensure consistent, secure, and maintainable code across the project.

---

## 🎯 Core Principles

### 1. YAGNI (You Aren't Gonna Need It)

**Rule:** Only build what is explicitly required RIGHT NOW.

**Examples:**
- ❌ Don't add configuration options "in case we need them later"
- ❌ Don't create abstraction layers for single use cases
- ❌ Don't build admin features for "future users" when there's only one admin
- ✅ Build the simplest solution that solves the current requirement
- ✅ Refactor when you have 2-3 similar patterns (not before)

**Rationale:** Premature abstraction creates complexity, maintenance burden, and makes code harder to understand. Build for today's needs, refactor for tomorrow's patterns.

---

### 2. No Fluff - Code with Purpose

**Rule:** Every line of code must serve a documented purpose.

**Forbidden:**
- ❌ Placeholder comments like `// TODO: implement later`
- ❌ Commented-out code blocks
- ❌ Unused imports, variables, or functions
- ❌ Generic variable names like `data`, `temp`, `foo`
- ❌ Demonstration code or examples in production files
- ❌ Duplicate logic that could be extracted once

**Required:**
- ✅ Descriptive naming that explains intent
- ✅ Comments only when logic is non-obvious
- ✅ Remove dead code immediately
- ✅ One responsibility per function/component
- ✅ Extract repeated code only when used 3+ times

---

### 3. Security First

**Rule:** Security is not optional. Every feature must be secure by design.

#### Authentication & Authorization
- ✅ All API endpoints must validate JWT tokens
- ✅ Never trust client-side data - validate server-side
- ✅ Use AWS Cognito for authentication (no custom auth)
- ✅ Implement proper CORS policies (whitelist only known origins)

#### Data Protection
- ✅ Never log sensitive data (passwords, tokens, personal info)
- ✅ Use environment variables for all secrets
- ✅ Never commit `.env` files or credentials to git
- ✅ Use pre-signed S3 URLs (never expose credentials to frontend)
- ✅ Encrypt data at rest (S3, DynamoDB)

#### Input Validation
- ✅ Validate all user input on backend
- ✅ Sanitize file uploads (check file type, size, content)
- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Escape user content displayed in UI (prevent XSS)

#### Infrastructure Security
- ✅ S3 buckets private by default (use CloudFront OAC for public access)
- ✅ Least privilege IAM policies
- ✅ Enable AWS CloudTrail for audit logging
- ✅ Use HTTPS everywhere (enforce in CloudFront)

#### Dependencies
- ✅ Regular dependency updates for security patches
- ✅ Review dependency licenses before adding
- ✅ Minimize dependency count (fewer attack vectors)

---

## 📝 Code Standards

### TypeScript
- ✅ Use TypeScript for all new code (no `.js` or `.jsx`)
- ✅ Enable strict mode in `tsconfig.json`
- ✅ Define interfaces for all data structures
- ✅ Avoid `any` type (use `unknown` if type is truly unknown)
- ✅ Use type inference where obvious, explicit types for complex cases

### React Components
- ✅ Functional components with hooks (no class components)
- ✅ One component per file (except tightly coupled helper components)
- ✅ Props interface defined above component
- ✅ Use `React.FC` type only when children are part of props, otherwise use function syntax
- ✅ Keep components small (<200 lines - extract if larger)

**Example:**
```typescript
interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
}

const PhotoGallery = ({ photos, onPhotoClick }: PhotoGalleryProps) => {
  // Implementation
};
```

### File Naming
- ✅ Components: PascalCase (e.g., `PhotoGallery.tsx`)
- ✅ Utilities: camelCase (e.g., `formatDate.ts`)
- ✅ Interfaces/Types: PascalCase in `interfaces/` directory
- ✅ CSS files: match component name (e.g., `PhotoGallery.css`)

### CSS
- ✅ Use CSS custom properties (variables) from `tokens.css`
- ✅ Component-specific styles in component's CSS file
- ✅ BEM naming convention for classes (optional but recommended)
- ✅ Mobile-first responsive design
- ✅ Avoid inline styles unless dynamic values required

### Terraform
- ✅ Use modules for reusable infrastructure patterns
- ✅ Variables for all configurable values (no hardcoded values)
- ✅ Descriptive resource names: `{project}-{resource}-{environment}`
- ✅ Tag all resources with: `Project`, `Environment`, `ManagedBy`
- ✅ Use `terraform fmt` before committing
- ✅ Document complex resources with comments

---

## 🔄 Git Workflow

### Branching Strategy
- `main` - Empty/placeholder branch
- `master` - Active development branch (current)
- Feature branches when needed for major changes

### Commit Messages
Follow conventional commit format:

```
<type>: <description>

[optional body]
[optional footer]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style/formatting (no logic change)
- `refactor:` Code restructuring (no behavior change)
- `perf:` Performance improvement
- `test:` Adding or updating tests
- `chore:` Maintenance (dependencies, configs)
- `infra:` Infrastructure/Terraform changes

**Examples:**
```
feat: add photo upload component with drag-and-drop

fix: correct thumbnail aspect ratio in gallery grid

infra: configure CloudFront distribution for static site

docs: update ACTIVE_WORK.md with current session progress
```

### Commit Guidelines
- ✅ Commit early and often (especially in tmpfs environment!)
- ✅ Each commit should be a logical unit of work
- ✅ Never commit secrets, credentials, or `.env` files
- ✅ Run linter before committing (`npm run lint`)
- ✅ Test code before committing (at minimum, ensure app builds)

### What to Commit
- ✅ Source code (`.tsx`, `.ts`, `.css`)
- ✅ Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`)
- ✅ Terraform files (`.tf`)
- ✅ Documentation (`.md`)
- ✅ State tracking files (`.claude/*.md`)
- ❌ Build artifacts (`dist/`, `build/`)
- ❌ Dependencies (`node_modules/`)
- ❌ Environment files (`.env`, `.env.local`)
- ❌ Terraform state files (`.tfstate`)
- ❌ IDE files (`.vscode/`, `.idea/`)

---

## 🧪 Testing Standards

### Current State
- Testing infrastructure not yet set up
- To be implemented in future phase

### Future Requirements (when testing added)
- Unit tests for utility functions
- Component tests for UI logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Minimum 70% code coverage for new code

---

## 🚀 Deployment Standards

### Frontend Build
- ✅ `npm run build` must complete without errors
- ✅ No TypeScript errors (`tsc -b`)
- ✅ No ESLint errors (`npm run lint`)
- ✅ Build output optimized for production
- ✅ Assets properly hashed for cache busting

### Infrastructure Deployment
- ✅ `terraform plan` before every apply
- ✅ Review plan output carefully
- ✅ Never use `-auto-approve` in production
- ✅ Tag releases in git after successful deployment
- ✅ Document infrastructure changes in DECISIONS.md

---

## 📚 Documentation Standards

### Code Documentation
- ✅ Document complex algorithms or business logic
- ✅ Explain WHY, not WHAT (code shows what)
- ✅ Keep comments up-to-date with code changes
- ✅ Use JSDoc for public API functions/components

### Project Documentation
- ✅ Update `.claude/ACTIVE_WORK.md` at start and end of sessions
- ✅ Update `.claude/PROJECT_STATUS.md` when milestones completed
- ✅ Document architectural decisions in `.claude/DECISIONS.md`
- ✅ Keep README files current with project state

---

## 🏗️ Project Structure Standards

### Frontend (`/root-project`)
```
/src
  /components        # Reusable UI components
    /ComponentName
      ComponentName.tsx
      ComponentName.css
  /pages             # Route-level page components
  /interfaces        # TypeScript interfaces/types
  /helpers           # Utility functions
  /assets            # Static assets (images, fonts)
  App.tsx            # Root component with routing
  main.tsx           # Application entry point
  tokens.css         # Design system variables
  index.css          # Global styles
```

### Infrastructure (`/terraform`)
```
/terraform
  main.tf            # Main infrastructure code
  variables.tf       # Input variables
  outputs.tf         # Output values
  backend.tf         # S3 backend configuration
  terraform.tfvars   # Variable values (gitignored)
  /modules           # Reusable infrastructure modules
    /module-name
      main.tf
      variables.tf
      outputs.tf
```

---

## ⚡ Performance Standards

### Frontend Performance
- ✅ Lazy load images (use native `loading="lazy"`)
- ✅ Code splitting for routes (React.lazy)
- ✅ Minimize bundle size (avoid large dependencies)
- ✅ Use production builds for deployment
- ✅ Optimize images before upload (compress, resize)

### API Performance
- ✅ Lambda cold start optimization (<1s)
- ✅ Use CloudFront caching for static assets
- ✅ S3 objects with appropriate cache headers
- ✅ DynamoDB query optimization (use indexes)

---

## 🚨 Error Handling Standards

### Frontend
- ✅ Graceful error messages to users (no stack traces)
- ✅ Try-catch for async operations
- ✅ Error boundaries for React component errors
- ✅ Log errors to console in development
- ✅ (Future) Send errors to monitoring service in production

### Backend
- ✅ Validate input and return 400 for bad requests
- ✅ Return appropriate HTTP status codes
- ✅ Never expose internal error details to client
- ✅ Log errors with context for debugging
- ✅ Handle AWS service errors gracefully

---

## 📱 Responsive Design Standards

### Breakpoints
```css
/* Mobile first approach */
--breakpoint-sm: 640px;   /* Small tablets */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
```

### Requirements
- ✅ Design works on mobile (320px width minimum)
- ✅ Touch targets minimum 44x44px
- ✅ Readable text without zooming
- ✅ Test on multiple devices/screen sizes

---

## 🔍 Code Review Checklist

Before considering code "done":

- [ ] Code follows YAGNI principle (no premature abstraction)
- [ ] No unnecessary comments or dead code
- [ ] Security best practices followed
- [ ] TypeScript types properly defined
- [ ] No linter errors
- [ ] Builds successfully
- [ ] Tested manually in browser
- [ ] Responsive on mobile and desktop
- [ ] Documentation updated if needed
- [ ] Git commit message follows convention
- [ ] Ready to push to repository

---

## 🎓 Learning Resources

### React + TypeScript
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### AWS
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)

---

## 🔄 Guideline Updates

These guidelines are living documents. When updating:

1. Discuss significant changes
2. Update version number and date
3. Document reason for change
4. Notify team (in this case, update ACTIVE_WORK.md)

---

**Remember: These guidelines exist to ensure we ship secure, maintainable, high-quality code. When in doubt, ask!**
