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
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
