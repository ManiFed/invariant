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
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AMMBlockPalette from "@/components/labs/AMMBlockPalette";
import AMMBlockCanvas from "@/components/labs/AMMBlockCanvas";
import AMMCurvePreview from "@/components/labs/AMMCurvePreview";
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

const PRESETS: { name: string; blocks: () => AMMBlockInstance[] }[] = [
  {
    name: "Constant Product",
    blocks: () => [createAMMBlockInstance("curve_cp")],
  },
  {
    name: "StableSwap (A=100)",
    blocks: () => [createAMMBlockInstance("curve_stable")],
  },
  {
    name: "80/20 Weighted",
    blocks: () => {
      const block = createAMMBlockInstance("curve_weighted");
      block.params.wx = 0.8;
      return [block];
    },
  },
  {
    name: "Concentrated (0.9-1.1)",
    blocks: () => [createAMMBlockInstance("curve_concentrated")],
  },
];

export default function AMMBuilderLab({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [design, setDesign] = useState<AMMDesign>(DEFAULT_DESIGN);
  const [k, setK] = useState(10000);
  const [history, setHistory] = useState<AMMDesign[]>([]);
  const [future, setFuture] = useState<AMMDesign[]>([]);
  const [importJSON, setImportJSON] = useState("");
  const [savedDesigns, setSavedDesigns] = useState<DesignSnapshot[]>([]);

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
    const updated = [next, ...savedDesigns].slice(0, 10);
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
    return {
      ...tree,
      rootCurves,
      warnings: [
        tree.unresolvedInputs > 0 ? `${tree.unresolvedInputs} unresolved operation input(s)` : null,
        rootCurves > 1 ? "Multiple top-level curve templates detected" : null,
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
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => loadPreset(p)}
                  className="px-2 py-1 rounded bg-secondary text-[9px] text-foreground hover:bg-accent border border-border transition-colors"
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
            <button
              onClick={clearDesign}
              className="text-[9px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear All
            </button>
          </div>

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

        {/* Right: Curve Preview */}
        <div className="w-96 border-l border-border p-4 overflow-auto shrink-0">
          <AMMCurvePreview design={design} k={k} showBaseline />

          <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Builder Insights</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded border border-border p-2">Blocks: <strong>{stats.total}</strong></div>
              <div className="rounded border border-border p-2">Max Depth: <strong>{stats.maxDepth}</strong></div>
              <div className="rounded border border-border p-2">Root Curves: <strong>{stats.rootCurves}</strong></div>
              <div className="rounded border border-border p-2">Unresolved Inputs: <strong>{stats.unresolvedInputs}</strong></div>
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
              className="h-24 w-full rounded border border-border bg-background p-2 text-[10px] font-mono outline-none"
            />
            <button onClick={importFromJSON} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px]"><Upload className="w-3 h-3" /> Import JSON</button>
            {savedDesigns.length > 0 && (
              <div className="space-y-1">
                {savedDesigns.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    onClick={() => loadSnapshot(snapshot)}
                    className="flex w-full items-center justify-between rounded border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  >
                    <span className="truncate">{snapshot.name}</span>
                    <span className="text-muted-foreground">{new Date(snapshot.createdAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
