# FreeAdSpace Architecture Blueprint

## 1) System overview

FreeAdSpace uses a decoupled architecture:

- **Frontend (React + Vite)**
  - Mobile-first UI
  - SEO-friendly pages through semantic markup and route-level metadata strategy
  - API integration via `/api/*`
- **Backend (Express + TypeScript)**
  - Auth, ad CRUD, moderation, and analytics endpoints
  - Spam detection and publishing workflow
  - Role-based access controls
- **Database (PostgreSQL)**
  - Normalized tables for users, ads, moderation, and metrics
  - Indexing for high-volume listing/search performance

## 2) Scalability approach

- Horizontal API scaling with stateless JWT auth
- Use Redis for rate limits and event queues (future)
- Shift ad events (`VIEW`, `CLICK`) into async workers for heavy traffic
- CDN/object storage for ad images (S3/R2/GCS)
- Full-text + faceted search with PostgreSQL FTS or Elasticsearch/OpenSearch

## 3) Security model

- Password hashing (`bcrypt`)
- JWT authentication and role-based authorization middleware
- Email verification before publishing high-risk ads
- Spam detection + moderation queues
- Rate limiting per IP + user account
- Audit logs for moderation actions

## 4) Feature mapping

### User features
- Register/login with verification hooks
- Dashboard for owned ads and stats
- Post, edit, delete ads
- Performance view and click metrics

### Admin features
- Admin dashboard KPIs
- Approve/reject moderation flow
- User block/unblock controls
- Spam triage workflow

### Monetization
- Free plan capped by ad limit (2)
- Featured plan boosts visibility
- Homepage boost for premium placements
- Subscription table supports recurring products
