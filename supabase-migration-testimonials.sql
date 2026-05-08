-- Migration: Client testimonials and video testimonials
-- Run in Supabase SQL Editor
-- Note: For file uploads, create a "testimonials" bucket in Storage (Dashboard) and paste URLs in admin.

-- =====================================================
-- CLIENT TESTIMONIALS (text + headshot carousel)
-- =====================================================
CREATE TABLE IF NOT EXISTS client_testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headshot_url TEXT NOT NULL,
  quote TEXT NOT NULL,
  attribution TEXT NOT NULL,
  client_label TEXT,
  result_badge TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_testimonials
  ADD COLUMN IF NOT EXISTS client_label TEXT,
  ADD COLUMN IF NOT EXISTS result_badge TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 5;

ALTER TABLE client_testimonials
  DROP CONSTRAINT IF EXISTS client_testimonials_rating_check;

ALTER TABLE client_testimonials
  ADD CONSTRAINT client_testimonials_rating_check CHECK (rating BETWEEN 1 AND 5);

-- =====================================================
-- VIDEO TESTIMONIALS (video carousel)
-- =====================================================
CREATE TABLE IF NOT EXISTS video_testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_url TEXT NOT NULL,
  avatar_url TEXT,
  client_name TEXT NOT NULL,
  quote TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE client_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_testimonials ENABLE ROW LEVEL SECURITY;

-- Public read for visible testimonials
CREATE POLICY "Anyone can read visible client testimonials" ON client_testimonials
  FOR SELECT USING (visible = true);

CREATE POLICY "Anyone can read visible video testimonials" ON video_testimonials
  FOR SELECT USING (visible = true);

-- Admin full access
CREATE POLICY "Admin can manage client testimonials" ON client_testimonials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can manage video testimonials" ON video_testimonials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_client_testimonials_visible_order
  ON client_testimonials(visible, sort_order);

CREATE INDEX IF NOT EXISTS idx_video_testimonials_visible_order
  ON video_testimonials(visible, sort_order);

-- Premium default testimonials for the landing page. Edit or hide them in Admin > Testimonials.
INSERT INTO client_testimonials (
  headshot_url,
  quote,
  attribution,
  client_label,
  result_badge,
  rating,
  sort_order,
  visible
)
SELECT *
FROM (
  VALUES
    ('', 'The onboarding felt personal from day one. My account manager helped me compare opportunities and move with more confidence.', 'Elena V.', 'Private Investor', '+38% ROI', 5, 0, TRUE),
    ('', 'Clear reporting, quick answers, and a private investment flow I can review between meetings without feeling rushed.', 'Marcus L.', 'Apartment Investor', 'Passive Monthly Income', 5, 1, TRUE),
    ('', 'The team explained the risk profile clearly and kept me updated through each step. It felt structured and transparent.', 'Ari N.', 'Early Investor', 'Project Fully Funded', 5, 2, TRUE),
    ('', 'I wanted something more hands-off. The process was simple, the updates were consistent, and the experience felt premium.', 'Sophia R.', 'Private Investor', 'Priority Access', 5, 3, TRUE)
) AS defaults(headshot_url, quote, attribution, client_label, result_badge, rating, sort_order, visible)
WHERE NOT EXISTS (SELECT 1 FROM client_testimonials);
