-- Allow service role (and anon for cron cleanup) to delete library AMMs
CREATE POLICY "Allow delete for deduplication"
ON public.library_amms
FOR DELETE
TO anon, authenticated
USING (true);
