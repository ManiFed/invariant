import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Map, Fingerprint, Radio, Cloud, HardDrive, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import { useDiscoveryEngine, type SyncMode } from "@/hooks/use-discovery-engine";

type View = "dashboard" | "atlas" | "detail";

const SYNC_BADGE: Record<SyncMode, { icon: typeof Cloud; label: string; className: string }> = {
  cloud: {
    icon: Cloud,
    label: "CLOUD SYNC",
    className: "bg-chart-1/5 border-chart-1/20 text-chart-1",
  },
  persisted: {
    icon: HardDrive,
    label: "PERSISTENT",
    className: "bg-chart-4/5 border-chart-4/20 text-chart-4",
  },
  memory: {
    icon: HardDrive,
    label: "IN-MEMORY",
    className: "bg-secondary border-border text-muted-foreground",
  },
  loading: {
    icon: Loader2,
    label: "CONNECTING",
    className: "bg-secondary border-border text-muted-foreground",
  },
};

const DiscoveryAtlas = () => {
  const navigate = useNavigate();
  const { state, selectedCandidate, selectCandidate, clearSelection, syncMode, cloudStatus } = useDiscoveryEngine();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const detailCandidateRef = useRef(selectedCandidate);
  if (selectedCandidate) {
    detailCandidateRef.current = selectedCandidate;
  }

  const handleSelectCandidate = useCallback((id: string) => {
    selectCandidate(id);
    setActiveView("detail");
  }, [selectCandidate]);

  const handleBackFromDetail = useCallback(() => {
    clearSelection();
    detailCandidateRef.current = null;
    setActiveView("atlas");
  }, [clearSelection]);

  const tabs = [
    { id: "dashboard" as const, label: "Live Dashboard", icon: Activity },
    { id: "atlas" as const, label: "Atlas Map", icon: Map },
  ];

  const detailCandidate = activeView === "detail"
    ? (selectedCandidate || detailCandidateRef.current)
    : selectedCandidate;

  const badge = SYNC_BADGE[syncMode];
  const BadgeIcon = badge.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">INVARIANT ATLAS</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync mode badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${badge.className}`}
            title={
              cloudStatus === "no-tables"
                ? "Supabase reachable but atlas tables not found. Run the migration SQL in your Supabase dashboard."
                : cloudStatus === "unreachable"
                ? "Could not reach Supabase. Engine state is saved locally in IndexedDB."
                : syncMode === "cloud"
                ? "Connected to Supabase. Candidates sync across sessions."
                : "Engine state persists in IndexedDB across page reloads."
            }
          >
            <BadgeIcon className={`w-3 h-3 ${syncMode === "loading" ? "animate-spin" : ""}`} />
            <span className="text-[9px] font-medium">{badge.label}</span>
          </div>
          {/* Always-on status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/5 border border-success/20">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            <span className="text-[9px] font-medium text-success">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <span className="text-[9px] font-mono text-muted-foreground">
              Gen {state.totalGenerations} | {state.archive.length.toLocaleString()} archived
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Tab navigation */}
      <div className="border-b border-border px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
          {(selectedCandidate || detailCandidateRef.current) && (
            <button
              onClick={() => setActiveView("detail")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeView === "detail"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Design Detail
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeView === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <LiveDashboard state={state} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "atlas" && (
            <motion.div key="atlas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <AtlasSurface state={state} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "detail" && detailCandidate && (
            <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DesignDetail candidate={detailCandidate} state={state} onBack={handleBackFromDetail} />
            </motion.div>
          )}
          {activeView === "detail" && !detailCandidate && (
            <motion.div key="no-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
              <Fingerprint className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Select a candidate from the Atlas Map to view details.</p>
              <button
                onClick={() => setActiveView("atlas")}
                className="mt-3 px-4 py-2 rounded-md bg-secondary text-foreground text-xs font-medium border border-border hover:bg-accent transition-colors"
              >
                Go to Atlas Map
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default DiscoveryAtlas;
