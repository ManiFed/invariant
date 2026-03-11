
-- Table to track auto-discovery cron runs
CREATE TABLE IF NOT EXISTS public.discovery_cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  generations_run INTEGER NOT NULL DEFAULT 0,
  candidates_evaluated INTEGER NOT NULL DEFAULT 0,
  candidates_published INTEGER NOT NULL DEFAULT 0,
  best_score DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow public read (no auth needed for this app)
ALTER TABLE public.discovery_cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cron runs" ON public.discovery_cron_runs FOR SELECT USING (true);
CREATE POLICY "Service role can insert cron runs" ON public.discovery_cron_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update cron runs" ON public.discovery_cron_runs FOR UPDATE USING (true);

-- Also ensure library_amms has open insert/update for the cron function
-- (RLS policies should already allow this, but let's be safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'library_amms' AND policyname = 'Anyone can insert library amms'
  ) THEN
    CREATE POLICY "Anyone can insert library amms" ON public.library_amms FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'library_amms' AND policyname = 'Anyone can read library amms'
  ) THEN
    CREATE POLICY "Anyone can read library amms" ON public.library_amms FOR SELECT USING (true);
  END IF;
END $$;
