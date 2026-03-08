
CREATE TABLE public.library_amms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  formula TEXT NOT NULL DEFAULT 'x * y = k',
  author TEXT NOT NULL DEFAULT 'Anonymous',
  category TEXT NOT NULL DEFAULT 'community',
  
  -- Discovery engine candidate data
  candidate_id TEXT,
  regime TEXT,
  generation INTEGER,
  family_id TEXT,
  family_params JSONB DEFAULT '{}',
  bins JSONB,
  score REAL,
  stability REAL,
  metrics JSONB,
  features JSONB,
  
  -- Simple AMM params for curve rendering (fallback)
  params JSONB NOT NULL DEFAULT '{"wA": 0.5, "wB": 0.5, "k": 10000}',
  
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read access, anyone can insert (no auth required for community submissions)
ALTER TABLE public.library_amms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read library AMMs"
  ON public.library_amms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert library AMMs"
  ON public.library_amms FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update upvotes"
  ON public.library_amms FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
