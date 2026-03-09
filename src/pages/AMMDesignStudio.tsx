import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Puzzle, Boxes, Clock, Wrench } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AMMBuilderLab from "./AMMBuilderLab";
import MultiAssetLab from "./MultiAssetLab";
import TimeVarianceLab from "./TimeVarianceLab";
import CompilerLab from "./CompilerLab";

const modes = [
  {
    id: "blocks",
    label: "Block Builder",
    icon: Puzzle,
    desc: "Visual drag-and-drop curve design",
  },
  {
    id: "multi-asset",
    label: "Multi-Asset",
    icon: Boxes,
    desc: "3+ token invariant engineering",
  },
  {
    id: "time-variance",
    label: "Time-Variance",
    icon: Clock,
    desc: "Curves that evolve over time",
  },
  {
    id: "compiler",
    label: "Compiler",
    icon: Wrench,
    desc: "Solidity → compile → deploy",
  },
] as const;

type ModeId = (typeof modes)[number]["id"];

export default function AMMDesignStudio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get("mode") as ModeId) || "blocks";
  const [activeMode, setActiveMode] = useState<ModeId>(
    modes.some((m) => m.id === initialMode) ? initialMode : "blocks"
  );

  const switchMode = (id: ModeId) => {
    setActiveMode(id);
    setSearchParams({ mode: id });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Studio header */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">
            AMM DESIGN STUDIO
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">
            EXPERIMENTAL
          </span>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-1">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => switchMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  isActive
                    ? "bg-foreground/10 text-foreground border border-foreground/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
                title={mode.desc}
              >
                <Icon className="w-3 h-3" />
                {mode.label}
              </button>
            );
          })}
        </div>

        <ThemeToggle />
      </header>

      {/* Active lab content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeMode === "blocks" && <AMMBuilderLab embedded />}
        {activeMode === "multi-asset" && <MultiAssetLab embedded />}
        {activeMode === "time-variance" && <TimeVarianceLab embedded />}
        {activeMode === "compiler" && <CompilerLab embedded />}
      </div>
    </div>
  );
}
