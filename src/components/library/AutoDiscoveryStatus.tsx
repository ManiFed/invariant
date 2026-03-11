// Auto-Discovery Status — Shows cron run history and status
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface CronRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  generations_run: number;
  candidates_evaluated: number;
  candidates_published: number;
  best_score: number | null;
  status: string;
  error: string | null;
}

export default function AutoDiscoveryStatus() {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
    const interval = setInterval(loadRuns, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadRuns() {
    const { data } = await supabase
      .from("discovery_cron_runs" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (data) setRuns(data as any);
    setLoading(false);
  }

  const latestRun = runs[0];
  const isRunning = latestRun?.status === "running";
  const totalPublished = runs.reduce((sum, r) => sum + (r.candidates_published || 0), 0);
  const totalEvaluated = runs.reduce((sum, r) => sum + (r.candidates_evaluated || 0), 0);

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/50 rounded-lg p-4 bg-card/50"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium text-foreground">Auto-Discovery Engine</span>
        </div>
        <span className="text-xs text-muted-foreground">runs every 5 min</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{runs.length}</div>
          <div className="text-xs text-muted-foreground">runs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{totalEvaluated.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">evaluated</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-primary">{totalPublished}</div>
          <div className="text-xs text-muted-foreground">published</div>
        </div>
      </div>

      {runs.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {runs.slice(0, 5).map((run) => (
            <div key={run.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  run.status === "completed" ? "bg-green-500" :
                  run.status === "running" ? "bg-yellow-500 animate-pulse" :
                  "bg-red-500"
                }`} />
                <span className="text-muted-foreground">
                  {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{run.generations_run} gen</span>
                <span className="text-muted-foreground">{run.candidates_evaluated} eval</span>
                {run.candidates_published > 0 && (
                  <span className="text-primary font-medium">+{run.candidates_published} published</span>
                )}
                {run.best_score != null && (
                  <span className="text-foreground/70">best: {run.best_score.toFixed(2)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {runs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No cron runs yet. The engine runs automatically every 5 minutes.
        </p>
      )}
    </motion.div>
  );
}
