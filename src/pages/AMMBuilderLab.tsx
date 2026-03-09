import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  Download,
  Save,
  Trash2,
  Code,
  FileJson,
  Sparkles,
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
} from "@/lib/amm-blocks";
import { generateSolidity, downloadSolidity } from "@/lib/codegen-solidity";
import { toast } from "sonner";

const DEFAULT_DESIGN: AMMDesign = {
  id: "default",
  name: "My AMM Design",
  blocks: [],
};

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

export default function AMMBuilderLab() {
  const navigate = useNavigate();
  const [design, setDesign] = useState<AMMDesign>(DEFAULT_DESIGN);
  const [k, setK] = useState(10000);

  // Block operations
  const addBlock = useCallback((blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    setDesign((d) => ({
      ...d,
      blocks: [...d.blocks, instance],
    }));
  }, []);

  const removeBlock = useCallback((uid: string) => {
    setDesign((d) => ({
      ...d,
      blocks: removeBlockFromTree(d.blocks, uid),
    }));
  }, []);

  const handleUpdateParam = useCallback(
    (uid: string, key: string, value: number | string) => {
      setDesign((d) => ({
        ...d,
        blocks: updateBlockParam(d.blocks, uid, key, value),
      }));
    },
    []
  );

  const addChild = useCallback((parentUid: string, blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    setDesign((d) => ({
      ...d,
      blocks: addChildToBlock(d.blocks, parentUid, instance),
    }));
  }, []);

  const addInput = useCallback((parentUid: string, blockId: string) => {
    const instance = createAMMBlockInstance(blockId);
    setDesign((d) => ({
      ...d,
      blocks: addInputToBlock(d.blocks, parentUid, instance),
    }));
  }, []);

  const loadPreset = (preset: (typeof PRESETS)[number]) => {
    setDesign({
      ...design,
      blocks: preset.blocks(),
    });
    toast.success(`Loaded ${preset.name} preset`);
  };

  const clearDesign = () => {
    setDesign({ ...design, blocks: [] });
  };

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
                onChange={(e) => setDesign({ ...design, name: e.target.value })}
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
            </div>
          </div>

          <div className="surface-elevated rounded-xl p-4 min-h-[400px]">
            <AMMBlockCanvas
              blocks={design.blocks}
              onRemoveBlock={removeBlock}
              onUpdateParam={handleUpdateParam}
              onAddChild={addChild}
              onAddInput={addInput}
            />
          </div>
        </div>

        {/* Right: Curve Preview */}
        <div className="w-96 border-l border-border p-4 overflow-auto shrink-0">
          <AMMCurvePreview design={design} k={k} showBaseline />
        </div>
      </div>
    </div>
  );
}
