import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  Save,
  Code,
  FileJson,
  Upload,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  Keyboard,
  Layers,
  X,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AMMBlockPalette from "@/components/labs/AMMBlockPalette";
import AMMBlockCanvas from "@/components/labs/AMMBlockCanvas";
import AMMCurvePreview from "@/components/labs/AMMCurvePreview";
import AMMTradeSimulator from "@/components/labs/AMMTradeSimulator";
import {
  type AMMDesign,
  type AMMBlockInstance,
  createAMMBlockInstance,
  addChildToBlock,
  addInputToBlock,
  removeBlockFromTree,
  updateBlockParam,
  compileAMMDesign,
  getAMMBlockDef,
  duplicateBlockInTree,
  reorderBlock,
} from "@/lib/amm-blocks";
import { downloadSolidity } from "@/lib/codegen-solidity";
import { toast } from "sonner";

const DEFAULT_DESIGN: AMMDesign = {
  id: "default",
  name: "My AMM Design",
  blocks: [],
};

const HISTORY_LIMIT = 40;
const SAVED_DESIGNS_KEY = "amm-builder-saved-designs-v1";

interface DesignSnapshot {
  id: string;
  name: string;
  createdAt: string;
  blocks: AMMBlockInstance[];
}

function cloneBlocks(blocks: AMMBlockInstance[]): AMMBlockInstance[] {
  return JSON.parse(JSON.stringify(blocks));
}

function traverseBlocks(blocks: AMMBlockInstance[], depth = 0): { total: number; maxDepth: number; unresolvedInputs: number } {
  let total = 0;
  let maxDepth = depth;
  let unresolvedInputs = 0;

  for (const block of blocks) {
    total += 1;
    maxDepth = Math.max(maxDepth, depth + 1);
    const def = getAMMBlockDef(block.blockId);
    const neededInputs = Math.max((def?.inputs || 0) - block.inputs.length, 0);
    unresolvedInputs += neededInputs;

    const childStats = traverseBlocks(block.children, depth + 1);
    const inputStats = traverseBlocks(block.inputs, depth + 1);

    total += childStats.total + inputStats.total;
    maxDepth = Math.max(maxDepth, childStats.maxDepth, inputStats.maxDepth);
    unresolvedInputs += childStats.unresolvedInputs + inputStats.unresolvedInputs;
  }

  return { total, maxDepth, unresolvedInputs };
}

const PRESETS: { name: string; description: string; blocks: () => AMMBlockInstance[] }[] = [
  {
    name: "Constant Product",
    description: "Uniswap V2 style x*y=k",
    blocks: () => [createAMMBlockInstance("curve_cp")],
  },
  {
    name: "StableSwap (A=100)",
    description: "Curve-style stableswap",
    blocks: () => [createAMMBlockInstance("curve_stable")],
  },
  {
    name: "80/20 Weighted",
    description: "Balancer-style weighted pool",
    blocks: () => {
      const block = createAMMBlockInstance("curve_weighted");
      block.params.wx = 0.8;
      return [block];
    },
  },
  {
    name: "Concentrated (0.9-1.1)",
    description: "Uniswap V3-style range",
    blocks: () => [createAMMBlockInstance("curve_concentrated")],
  },
  {
    name: "Solidly Stable",
    description: "ve(3,3) x³y+xy³=k",
    blocks: () => [createAMMBlockInstance("curve_solidly")],
  },
  {
    name: "Power Law (n=3)",
    description: "Generalized x³+y³=k",
    blocks: () => {
      const block = createAMMBlockInstance("curve_power");
      block.params.exponent = 3;
      return [block];
    },
  },
  {
    name: "Offset CPMM",
    description: "(x+10)(y+10)=k offset pool",
    blocks: () => [createAMMBlockInstance("curve_xyk_offset")],
  },
  {
    name: "CP + 0.3% Fee",
    description: "Constant product with base fee",
    blocks: () => [
      createAMMBlockInstance("curve_cp"),
      createAMMBlockInstance("fee_base"),
    ],
  },
  {
    name: "StableSwap + Dynamic Fee",
    description: "Stableswap with volatility-scaled fee",
    blocks: () => [
      createAMMBlockInstance("curve_stable"),
      createAMMBlockInstance("fee_dynamic"),
    ],
  },
  {
    name: "Protected CP",
    description: "CP with slippage guard + price band",
    blocks: () => [
      createAMMBlockInstance("curve_cp"),
      createAMMBlockInstance("guard_slippage"),
      createAMMBlockInstance("guard_price_band"),
    ],
  },
  {
    name: "Anti-MEV Pool",
    description: "CP with anti-sandwich + oracle check",
    blocks: () => [
      createAMMBlockInstance("curve_cp"),
      createAMMBlockInstance("fee_base"),
      createAMMBlockInstance("guard_sandwich"),
      createAMMBlockInstance("guard_oracle_check"),
    ],
  },
  {
    name: "Wide Range CL",
    description: "Concentrated liquidity (0.5-2.0)",
    blocks: () => {
      const block = createAMMBlockInstance("curve_cpmm_v3");
      block.params.lower = 0.5;
      block.params.upper = 2.0;
      return [block];
    },
  },
];

type RightPanelTab = "preview" | "simulate" | "compare";

const KEYBOARD_SHORTCUTS = [
  { keys: ["Ctrl", "Z"], action: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], action: "Redo" },
  { keys: ["Ctrl", "Y"], action: "Redo (alt)" },
  { keys: ["Ctrl", "S"], action: "Save snapshot" },
  { keys: ["Ctrl", "E"], action: "Export JSON" },
];

export default function AMMBuilderLab({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [design, setDesign] = useState<AMMDesign>(DEFAULT_DESIGN);
  const [k, setK] = useState(10000);
  const [history, setHistory] = useState<AMMDesign[]>([]);
  const [future, setFuture] = useState<AMMDesign[]>([]);
  const [importJSON, setImportJSON] = useState("");
  const [savedDesigns, setSavedDesigns] = useState<DesignSnapshot[]>([]);
  const [rightTab, setRightTab] = useState<RightPanelTab>("preview");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [comparisonDesigns, setComparisonDesigns] = useState<DesignSnapshot[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_DESIGNS_KEY);
      if (raw) setSavedDesigns(JSON.parse(raw) as DesignSnapshot[]);
    } catch {
      toast.error("Could not load saved designs from local storage");
    }
  }, []);

  const updateDesign = useCallback((updater: (prev: AMMDesign) => AMMDesign) => {
    setDesign((previous) => {
      const next = updater(previous);
      setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), previous]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setFuture((f) => [design, ...f].slice(0, HISTORY_LIMIT));
      setDesign(previous);
      return h.slice(0, -1);
    });
  }, [design]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setHistory((h) => [...h, design].slice(-HISTORY_LIMIT));
      setDesign(next);
      return rest;
    });
  }, [design]);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveSnapshot();
      }
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportJSON();
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [redo, undo]);

  // Block operations
  const addBlock = useCallback((blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    updateDesign((d) => ({
      ...d,
      blocks: [...d.blocks, instance],
    }));
  }, [updateDesign]);

  const removeBlock = useCallback((uid: string) => {
    updateDesign((d) => ({
      ...d,
      blocks: removeBlockFromTree(d.blocks, uid),
    }));
  }, [updateDesign]);

  const handleUpdateParam = useCallback(
    (uid: string, key: string, value: number | string) => {
      updateDesign((d) => ({
        ...d,
        blocks: updateBlockParam(d.blocks, uid, key, value),
      }));
    },
    [updateDesign]
  );

  const addChild = useCallback((parentUid: string, blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    updateDesign((d) => ({
      ...d,
      blocks: addChildToBlock(d.blocks, parentUid, instance),
    }));
  }, [updateDesign]);

  const addInput = useCallback((parentUid: string, blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    updateDesign((d) => ({
      ...d,
      blocks: addInputToBlock(d.blocks, parentUid, instance),
    }));
  }, [updateDesign]);

  const handleDuplicate = useCallback((uid: string) => {
    updateDesign((d) => ({
      ...d,
      blocks: duplicateBlockInTree(d.blocks, uid),
    }));
    toast.success("Block duplicated");
  }, [updateDesign]);

  const handleReorder = useCallback((uid: string, direction: "up" | "down") => {
    updateDesign((d) => ({
      ...d,
      blocks: reorderBlock(d.blocks, uid, direction),
    }));
  }, [updateDesign]);

  const loadPreset = (preset: (typeof PRESETS)[number]) => {
    updateDesign((current) => ({
      ...current,
      blocks: preset.blocks(),
    }));
    toast.success(`Loaded ${preset.name} preset`);
  };

  const saveSnapshot = () => {
    const next: DesignSnapshot = {
      id: `${Date.now()}`,
      name: design.name,
      createdAt: new Date().toISOString(),
      blocks: cloneBlocks(design.blocks),
    };
    const updated = [next, ...savedDesigns].slice(0, 20);
    setSavedDesigns(updated);
    localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(updated));
    toast.success("Saved snapshot locally");
  };

  const loadSnapshot = (snapshot: DesignSnapshot) => {
    updateDesign((current) => ({
      ...current,
      name: snapshot.name,
      blocks: cloneBlocks(snapshot.blocks),
    }));
    toast.success(`Loaded snapshot: ${snapshot.name}`);
  };

  const deleteSnapshot = (id: string) => {
    const updated = savedDesigns.filter((s) => s.id !== id);
    setSavedDesigns(updated);
    localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(updated));
    toast.success("Deleted snapshot");
  };

  const toggleComparison = (snapshot: DesignSnapshot) => {
    const exists = comparisonDesigns.find((c) => c.id === snapshot.id);
    if (exists) {
      setComparisonDesigns(comparisonDesigns.filter((c) => c.id !== snapshot.id));
    } else {
      setComparisonDesigns([...comparisonDesigns, snapshot].slice(0, 4));
    }
  };

  const importFromJSON = () => {
    try {
      const parsed = JSON.parse(importJSON) as { design?: AMMDesign } | AMMDesign;
      const importedDesign = "design" in parsed && parsed.design ? parsed.design : (parsed as AMMDesign);
      if (!Array.isArray(importedDesign.blocks)) throw new Error("Invalid design format");
      updateDesign((current) => ({
        ...current,
        name: importedDesign.name || current.name,
        blocks: cloneBlocks(importedDesign.blocks),
      }));
      setImportJSON("");
      toast.success("Imported design from JSON");
    } catch {
      toast.error("Invalid JSON payload");
    }
  };

  const clearDesign = () => {
    updateDesign((current) => ({ ...current, blocks: [] }));
  };

  const stats = useMemo(() => {
    const tree = traverseBlocks(design.blocks);
    const rootCurves = design.blocks.filter((b) => getAMMBlockDef(b.blockId)?.category === "curve").length;
    const oracleBlocks = design.blocks.filter((b) => getAMMBlockDef(b.blockId)?.category === "oracle").length;
    const securityBlocks = design.blocks.filter((b) => getAMMBlockDef(b.blockId)?.category === "security").length;
    const feeBlocks = design.blocks.filter((b) => getAMMBlockDef(b.blockId)?.category === "fee").length;
    return {
      ...tree,
      rootCurves,
      oracleBlocks,
      securityBlocks,
      feeBlocks,
      warnings: [
        tree.unresolvedInputs > 0 ? `${tree.unresolvedInputs} unresolved operation input(s)` : null,
        rootCurves > 1 ? "Multiple top-level curve templates detected" : null,
        rootCurves === 0 && tree.total > 0 ? "No curve template — add one to define the invariant" : null,
        securityBlocks > 0 && feeBlocks === 0 ? "Security guards active but no fee block defined" : null,
      ].filter(Boolean) as string[],
    };
  }, [design.blocks]);

  const exportJSON = () => {
    const compiled = compileAMMDesign(design);
    const json = JSON.stringify({ design, compiled }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const exportSolidity = () => {
    const compiled = compileAMMDesign(design);
    downloadSolidity({
      name: design.name,
      familyId: compiled.curveType,
      familyParams: compiled.params,
      author: "AMM Block Builder",
    });
    toast.success("Downloaded Solidity file");
  };

  // Prepare comparison curves for the preview overlay
  const comparisonCurves = useMemo(
    () =>
      comparisonDesigns.map((snap) => ({
        name: snap.name,
        blocks: snap.blocks,
      })),
    [comparisonDesigns]
  );

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background flex flex-col flex-1`}>
      {!embedded && (
        <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/labs")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Boxes className="w-4 h-4 text-chart-3" />
            <span className="text-sm font-bold text-foreground tracking-tight">
              AMM Block Builder
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">
              VISUAL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-foreground text-[10px] font-medium hover:bg-accent border border-border transition-colors"
            >
              <FileJson className="w-3 h-3" />
              Export JSON
            </button>
            <button
              onClick={exportSolidity}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition-opacity"
            >
              <Code className="w-3 h-3" />
              Export Solidity
            </button>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Block Palette */}
        <div className="w-64 border-r border-border p-3 flex flex-col overflow-hidden shrink-0">
          <div className="mb-3">
            <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">
              Presets
            </h3>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => loadPreset(p)}
                  className="px-2 py-1 rounded bg-secondary text-[9px] text-foreground hover:bg-accent border border-border transition-colors"
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
              Block Palette
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="Keyboard shortcuts"
              >
                <Keyboard className="w-3 h-3" />
              </button>
              <button
                onClick={clearDesign}
                className="text-[9px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Keyboard shortcuts panel */}
          {showShortcuts && (
            <div className="mb-3 rounded-lg border border-border bg-secondary p-2 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold text-foreground uppercase">Shortcuts</p>
                <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground">{shortcut.action}</span>
                  <div className="flex items-center gap-0.5">
                    {shortcut.keys.map((key) => (
                      <kbd
                        key={key}
                        className="px-1 py-0.5 rounded bg-background border border-border text-[8px] font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <AMMBlockPalette onAddBlock={addBlock} />
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                value={design.name}
                onChange={(e) => updateDesign((current) => ({ ...current, name: e.target.value }))}
                className="bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-foreground transition-colors"
                placeholder="Design name..."
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground">k =</span>
              <input
                type="number"
                value={k}
                onChange={(e) => setK(parseFloat(e.target.value) || 10000)}
                className="w-20 bg-secondary border border-border rounded px-2 py-1 text-[10px] text-foreground outline-none"
              />
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-foreground disabled:opacity-40"
              >
                <Undo2 className="w-3 h-3" /> Undo
              </button>
              <button
                onClick={redo}
                disabled={future.length === 0}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-foreground disabled:opacity-40"
              >
                <Redo2 className="w-3 h-3" /> Redo
              </button>
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-4 min-h-[400px]">
            <AMMBlockCanvas
              blocks={design.blocks}
              onRemoveBlock={removeBlock}
              onUpdateParam={handleUpdateParam}
              onAddChild={addChild}
              onAddInput={addInput}
              onDuplicateBlock={handleDuplicate}
              onReorderBlock={handleReorder}
              onDropBlock={(blockId, targetUid, position) => {
                if (targetUid && position === "child") {
                  addChild(targetUid, blockId);
                } else if (targetUid && position === "input") {
                  addInput(targetUid, blockId);
                } else {
                  addBlock(blockId);
                }
              }}
            />
          </div>
        </div>

        {/* Right: Tabbed Panel */}
        <div className="w-96 border-l border-border flex flex-col overflow-hidden shrink-0">
          {/* Tab bar */}
          <div className="flex items-center border-b border-border px-2 pt-2 gap-1 shrink-0">
            {(
              [
                { id: "preview", label: "Preview", icon: Eye },
                { id: "simulate", label: "Simulate", icon: Layers },
                { id: "compare", label: "Compare", icon: Layers },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-[10px] font-medium transition-all ${
                    rightTab === tab.id
                      ? "bg-background text-foreground border border-b-0 border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {/* Preview Tab */}
            {rightTab === "preview" && (
              <>
                <AMMCurvePreview design={design} k={k} showBaseline comparisons={comparisonCurves} />

                <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide">Builder Insights</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded border border-border p-2">Blocks: <strong>{stats.total}</strong></div>
                    <div className="rounded border border-border p-2">Max Depth: <strong>{stats.maxDepth}</strong></div>
                    <div className="rounded border border-border p-2">Root Curves: <strong>{stats.rootCurves}</strong></div>
                    <div className="rounded border border-border p-2">Unresolved: <strong>{stats.unresolvedInputs}</strong></div>
                    {stats.oracleBlocks > 0 && (
                      <div className="rounded border border-yellow-500/30 p-2 text-yellow-500">Oracle: <strong>{stats.oracleBlocks}</strong></div>
                    )}
                    {stats.securityBlocks > 0 && (
                      <div className="rounded border border-red-500/30 p-2 text-red-400">Guards: <strong>{stats.securityBlocks}</strong></div>
                    )}
                  </div>
                  {stats.warnings.length === 0 ? (
                    <p className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><CheckCircle2 className="w-3 h-3" /> No structural warnings</p>
                  ) : (
                    <div className="space-y-1">
                      {stats.warnings.map((warning) => (
                        <p key={warning} className="inline-flex items-center gap-1 text-[10px] text-warning"><AlertTriangle className="w-3 h-3" /> {warning}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide">Power Tools</p>
                    <button onClick={saveSnapshot} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[10px] border border-border"><Save className="w-3 h-3" /> Snapshot</button>
                  </div>
                  <textarea
                    value={importJSON}
                    onChange={(e) => setImportJSON(e.target.value)}
                    placeholder='Paste exported JSON (e.g. {"design": {...}})'
                    className="h-20 w-full rounded border border-border bg-background p-2 text-[10px] font-mono outline-none"
                  />
                  <button onClick={importFromJSON} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px]"><Upload className="w-3 h-3" /> Import JSON</button>
                  {savedDesigns.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {savedDesigns.map((snapshot) => (
                        <div key={snapshot.id} className="flex items-center gap-1">
                          <button
                            onClick={() => loadSnapshot(snapshot)}
                            className="flex flex-1 items-center justify-between rounded border border-border px-2 py-1 text-[10px] hover:bg-secondary min-w-0"
                          >
                            <span className="truncate">{snapshot.name}</span>
                            <span className="text-muted-foreground shrink-0 ml-1">{new Date(snapshot.createdAt).toLocaleDateString()}</span>
                          </button>
                          <button
                            onClick={() => deleteSnapshot(snapshot.id)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            title="Delete snapshot"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Simulate Tab */}
            {rightTab === "simulate" && (
              <AMMTradeSimulator design={design} k={k} />
            )}

            {/* Compare Tab */}
            {rightTab === "compare" && (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide">
                  Curve Comparison
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Select saved snapshots to overlay on the curve preview. Toggle visibility below, then switch to the Preview tab to see overlays.
                </p>

                {savedDesigns.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[10px] text-muted-foreground">No saved snapshots yet.</p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Save a snapshot first (Preview tab → Snapshot), then compare curves here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {savedDesigns.map((snapshot) => {
                      const isActive = comparisonDesigns.some((c) => c.id === snapshot.id);
                      return (
                        <button
                          key={snapshot.id}
                          onClick={() => toggleComparison(snapshot)}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                            isActive
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {isActive ? <Eye className="w-3 h-3 text-primary shrink-0" /> : <EyeOff className="w-3 h-3 shrink-0" />}
                          <span className="truncate flex-1 text-left">{snapshot.name}</span>
                          <span className="text-[8px] shrink-0">
                            {new Date(snapshot.createdAt).toLocaleDateString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {comparisonDesigns.length > 0 && (
                  <div className="rounded border border-primary/20 bg-primary/5 p-2">
                    <p className="text-[9px] text-primary font-medium">
                      {comparisonDesigns.length} curve{comparisonDesigns.length > 1 ? "s" : ""} selected for overlay.
                      Switch to Preview tab to see them.
                    </p>
                    <button
                      onClick={() => {
                        setComparisonDesigns([]);
                      }}
                      className="text-[9px] text-muted-foreground hover:text-destructive mt-1"
                    >
                      Clear all overlays
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
