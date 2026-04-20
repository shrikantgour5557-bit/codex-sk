-- FreeAdSpace PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'MODERATOR');
CREATE TYPE ad_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE plan_type AS ENUM ('FREE', 'FEATURED', 'HOMEPAGE_BOOST');
CREATE TYPE moderation_reason AS ENUM ('SPAM', 'POLICY_VIOLATION', 'DUPLICATE', 'OTHER');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(80) UNIQUE NOT NULL,
  slug VARCHAR(80) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  external_link TEXT,
  image_url TEXT,
  plan plan_type NOT NULL DEFAULT 'FREE',
  status ad_status NOT NULL DEFAULT 'PENDING',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_until TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ad_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  click_count BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) GENERATED ALWAYS AS (
    CASE WHEN view_count = 0 THEN 0 ELSE click_count::NUMERIC / view_count::NUMERIC END
  ) STORED,
  last_event_at TIMESTAMPTZ
);

CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('VIEW', 'CLICK')),
  ip_hash VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES users(id),
  action ad_status NOT NULL,
  reason moderation_reason,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan plan_type NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payment_provider VARCHAR(60),
  payment_reference VARCHAR(140)
);

CREATE INDEX idx_ads_status_created ON ads(status, created_at DESC);
CREATE INDEX idx_ads_featured_status ON ads(is_featured, status);
CREATE INDEX idx_ads_user ON ads(user_id, created_at DESC);
CREATE INDEX idx_events_ad_event ON ad_events(ad_id, event_type);

INSERT INTO categories (name, slug)
VALUES
  ('Business', 'business'),
  ('Jobs', 'jobs'),
  ('Services', 'services'),
  ('Digital', 'digital'),
  ('Local Ads', 'local-ads')
ON CONFLICT DO NOTHING;
