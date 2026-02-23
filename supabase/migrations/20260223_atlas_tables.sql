-- Atlas candidates table: stores all AMM candidates (both active population and archived)
CREATE TABLE IF NOT EXISTS atlas_candidates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  regime TEXT NOT NULL CHECK (regime IN ('low-vol', 'high-vol', 'jump-diffusion')),
  generation INTEGER NOT NULL,
  bins DOUBLE PRECISION[] NOT NULL,
  metrics JSONB NOT NULL,
  features JSONB NOT NULL,
  stability DOUBLE PRECISION NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  is_population BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_atlas_candidates_regime ON atlas_candidates(regime);
CREATE INDEX IF NOT EXISTS idx_atlas_candidates_archived ON atlas_candidates(is_archived);
CREATE INDEX IF NOT EXISTS idx_atlas_candidates_population ON atlas_candidates(is_population);
CREATE INDEX IF NOT EXISTS idx_atlas_candidates_score ON atlas_candidates(score);
CREATE INDEX IF NOT EXISTS idx_atlas_candidates_created ON atlas_candidates(created_at);

-- Atlas global state
CREATE TABLE IF NOT EXISTS atlas_state (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_generations INTEGER NOT NULL DEFAULT 0,
  last_regime TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default global state
INSERT INTO atlas_state (id, total_generations) VALUES ('global', 0) ON CONFLICT DO NOTHING;

-- Enable realtime for atlas_candidates so clients can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE atlas_candidates;

-- RLS policies: allow public read access, edge function writes via service role
ALTER TABLE atlas_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on atlas_candidates"
  ON atlas_candidates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access on atlas_state"
  ON atlas_state FOR SELECT
  TO anon, authenticated
  USING (true);
