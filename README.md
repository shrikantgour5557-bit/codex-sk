# FreeAdSpace

FreeAdSpace is a modern classified and ad-promotion marketplace with free and paid listings.

## Monorepo Structure

- `frontend/` — React + TypeScript responsive UI.
- `backend/` — Node.js + Express + TypeScript API.
- `database/` — PostgreSQL schema and seed data.
- `docs/` — architecture, user flow, and scaling/security notes.

## Quick Start

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3) Database

Run `database/schema.sql` against PostgreSQL.

## Core capabilities included in this scaffold

- User auth-ready backend structure (register/login/verify placeholders)
- Admin moderation workflow for ad approval/rejection
- Free-tier ad posting limits and paid-featured flag support
- Search/filter/listing APIs and responsive homepage/dashboard UI
- Metrics model and endpoints for views/click tracking
