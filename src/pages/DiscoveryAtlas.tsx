import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Square, RotateCcw, Activity, Map, Fingerprint, Compass } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LiveDashboard from "@/components/labs/LiveDashboard";
import AtlasSurface from "@/components/labs/AtlasSurface";
import DesignDetail from "@/components/labs/DesignDetail";
import { useDiscoveryEngine } from "@/hooks/use-discovery-engine";

type View = "dashboard" | "atlas" | "detail";

const DiscoveryAtlas = () => {
  const navigate = useNavigate();
  const { state, start, stop, reset, getCandidate, isRunning } = useDiscoveryEngine();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleSelectCandidate = useCallback((id: string) => {
    setSelectedCandidateId(id);
    setActiveView("detail");
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedCandidateId(null);
    setActiveView("atlas");
  }, []);

  const selectedCandidate = selectedCandidateId ? getCandidate(selectedCandidateId) : undefined;

  const tabs = [
    { id: "dashboard" as const, label: "Live Dashboard", icon: Activity },
    { id: "atlas" as const, label: "Atlas Map", icon: Map },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/labs")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Compass className="w-4 h-4 text-chart-3" />
          <span className="text-sm font-bold text-foreground tracking-tight">INVARIANT ATLAS</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-chart-3/30 text-chart-3">DISCOVERY</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Engine controls */}
          {!isRunning ? (
            <button
              onClick={start}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success border border-success/20 text-xs font-medium hover:bg-success/20 transition-colors"
            >
              <Play className="w-3 h-3" /> Start Engine
            </button>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 text-xs font-medium hover:bg-destructive/20 transition-colors"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          )}
          <button
            onClick={reset}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
            title="Reset engine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {/* Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border">
            <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-[9px] font-mono text-muted-foreground">
              Gen {state.totalGenerations} | {state.archive.length} archived
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Tab navigation (hidden when in detail view) */}
      {activeView !== "detail" && (
        <div className="border-b border-border px-6">
          <div className="flex gap-1">
            {tabs.map(tab => {
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
            {selectedCandidateId && (
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
      )}

      {/* Detail view has its own back navigation */}
      {activeView === "detail" && (
        <div className="border-b border-border px-6">
          <div className="flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
            <button
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 border-foreground text-foreground"
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Design Detail
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeView === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <LiveDashboard state={state} />
            </motion.div>
          )}
          {activeView === "atlas" && (
            <motion.div key="atlas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <AtlasSurface state={state} onSelectCandidate={handleSelectCandidate} />
            </motion.div>
          )}
          {activeView === "detail" && selectedCandidate && (
            <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DesignDetail candidate={selectedCandidate} state={state} onBack={handleBackFromDetail} />
            </motion.div>
          )}
          {activeView === "detail" && !selectedCandidate && (
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
