import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ChevronRight, ChevronDown, GripVertical, Puzzle, Search, Layers } from "lucide-react";
import {
  BLOCK_DEFINITIONS, CATEGORY_COLORS, CATEGORY_LABELS,
  type BlockCategory, type BlockDefinition, type BlockInstance, type CustomStrategy,
  getBlockDef, getBlocksByCategory, createBlockInstance, compileBlocksToConfig,
} from "@/lib/strategy-blocks";
import { type StrategyConfig } from "@/lib/strategy-engine";

const STRATEGY_COLORS = ["hsl(0, 0%, 70%)", "hsl(142, 50%, 50%)", "hsl(30, 80%, 55%)"];

interface Props {
  strategies: StrategyConfig[];
  onStrategiesChange: (s: StrategyConfig[]) => void;
  customStrategies: CustomStrategy[];
  onCustomStrategiesChange: (s: CustomStrategy[]) => void;
}

export default function StrategyBlockEditor({ strategies, onStrategiesChange, customStrategies, onCustomStrategiesChange }: Props) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("structural");
  const [selectedStrategyIdx, setSelectedStrategyIdx] = useState(0);
  const [dragOverUid, setDragOverUid] = useState<string | null>(null);

  const grouped = getBlocksByCategory();
  const categories = Object.keys(grouped) as BlockCategory[];

  const addCustomStrategy = () => {
    if (customStrategies.length >= 3) return;
    const newStrat: CustomStrategy = {
      id: `custom_${Date.now()}`,
      name: `Custom Strategy ${customStrategies.length + 1}`,
      color: STRATEGY_COLORS[customStrategies.length % STRATEGY_COLORS.length],
      blocks: [],
    };
    onCustomStrategiesChange([...customStrategies, newStrat]);
    setSelectedStrategyIdx(customStrategies.length);
  };

  const removeCustomStrategy = (idx: number) => {
    const updated = customStrategies.filter((_, i) => i !== idx);
    onCustomStrategiesChange(updated);
    if (selectedStrategyIdx >= updated.length) setSelectedStrategyIdx(Math.max(0, updated.length - 1));
  };

  const updateStrategyName = (idx: number, name: string) => {
    const updated = [...customStrategies];
    updated[idx] = { ...updated[idx], name };
    onCustomStrategiesChange(updated);
  };

  const activeStrategy = customStrategies[selectedStrategyIdx];

  const addBlock = useCallback((blockId: string, parentUid?: string) => {
    if (!activeStrategy) return;
    const instance = createBlockInstance(blockId);
    const updated = [...customStrategies];
    const strat = { ...updated[selectedStrategyIdx] };

    if (parentUid) {
      strat.blocks = addChildBlock(strat.blocks, parentUid, instance);
    } else {
      strat.blocks = [...strat.blocks, instance];
    }
    updated[selectedStrategyIdx] = strat;
    onCustomStrategiesChange(updated);
  }, [activeStrategy, customStrategies, selectedStrategyIdx, onCustomStrategiesChange]);

  const removeBlock = useCallback((uid: string) => {
    if (!activeStrategy) return;
    const updated = [...customStrategies];
    updated[selectedStrategyIdx] = {
      ...updated[selectedStrategyIdx],
      blocks: removeBlockFromTree(updated[selectedStrategyIdx].blocks, uid),
    };
    onCustomStrategiesChange(updated);
  }, [activeStrategy, customStrategies, selectedStrategyIdx, onCustomStrategiesChange]);

  const updateBlockParam = useCallback((uid: string, key: string, value: number | string) => {
    if (!activeStrategy) return;
    const updated = [...customStrategies];
    updated[selectedStrategyIdx] = {
      ...updated[selectedStrategyIdx],
      blocks: updateParamInTree(updated[selectedStrategyIdx].blocks, uid, key, value),
    };
    onCustomStrategiesChange(updated);
  }, [activeStrategy, customStrategies, selectedStrategyIdx, onCustomStrategiesChange]);

  // Compile to engine config
  const compileAndAdd = useCallback(() => {
    if (!activeStrategy || activeStrategy.blocks.length === 0) return;
    if (strategies.length >= 3) return;
    const compiled = compileBlocksToConfig(activeStrategy);
    const config: StrategyConfig = {
      id: activeStrategy.id,
      name: activeStrategy.name,
      presetId: "custom_block",
      rangeWidth: compiled.rangeWidth,
      rebalanceTrigger: compiled.rebalanceTrigger,
      rebalanceCooldown: compiled.rebalanceCooldown,
      stopLoss: compiled.stopLoss,
      maxILTolerance: compiled.stopLoss,
      hedgeRatio: compiled.hedgeRatio,
      color: activeStrategy.color,
    };
    // Replace if already exists, otherwise add
    const existing = strategies.findIndex(s => s.id === activeStrategy.id);
    if (existing >= 0) {
      const updated = [...strategies];
      updated[existing] = config;
      onStrategiesChange(updated);
    } else {
      onStrategiesChange([...strategies, config]);
    }
  }, [activeStrategy, strategies, onStrategiesChange]);

  // Filter blocks by search
  const filteredDefs = search.trim()
    ? BLOCK_DEFINITIONS.filter(b => b.label.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="space-y-4">
      {/* Strategy tabs */}
      <div className="surface-elevated rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Block Strategy Editor</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">{customStrategies.length}/3</span>
            <button onClick={addCustomStrategy} disabled={customStrategies.length >= 3}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-foreground text-[10px] font-medium hover:bg-accent border border-border transition-colors disabled:opacity-40">
              <Plus className="w-3 h-3" /> New Strategy
            </button>
          </div>
        </div>

        {customStrategies.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Puzzle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No custom strategies yet</p>
            <p className="text-[10px] text-muted-foreground">Click "New Strategy" to start building with blocks</p>
          </div>
        ) : (
          <div className="flex gap-1.5">
            {customStrategies.map((s, i) => (
              <button key={s.id} onClick={() => setSelectedStrategyIdx(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all border ${i === selectedStrategyIdx ? "bg-foreground/5 text-foreground border-foreground/20" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                <button onClick={e => { e.stopPropagation(); removeCustomStrategy(i); }} className="ml-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeStrategy && (
        <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[500px]">
          {/* Block Palette */}
          <div className="surface-elevated rounded-xl p-3 overflow-y-auto max-h-[700px]">
            <div className="relative mb-3">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search blocks..."
                className="w-full bg-secondary border border-border rounded-md pl-7 pr-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground" />
            </div>

            {filteredDefs ? (
              <div className="space-y-1">
                {filteredDefs.map(b => (
                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} />
                ))}
                {filteredDefs.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No blocks match</p>}
              </div>
            ) : (
              <div className="space-y-1">
                {categories.map(cat => (
                  <div key={cat}>
                    <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors">
                      {expandedCategory === cat ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                      {CATEGORY_LABELS[cat]}
                      <span className="text-[8px] text-muted-foreground ml-auto">{Object.values(grouped[cat]).flat().length}</span>
                    </button>
                    <AnimatePresence>
                      {expandedCategory === cat && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          {Object.entries(grouped[cat]).map(([sub, blocks]) => (
                            <div key={sub} className="ml-4 mb-2">
                              <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">{sub}</p>
                              <div className="space-y-0.5">
                                {blocks.map(b => (
                                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="surface-elevated rounded-xl p-4 overflow-y-auto max-h-[700px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input value={activeStrategy.name} onChange={e => updateStrategyName(selectedStrategyIdx, e.target.value)}
                  className="bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-foreground transition-colors" />
              </div>
              <button onClick={compileAndAdd} disabled={activeStrategy.blocks.length === 0 || strategies.length >= 3}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
                <Layers className="w-3 h-3" /> Compile & Add to Backtest
              </button>
            </div>

            {activeStrategy.blocks.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <p className="text-[10px] text-muted-foreground">Click blocks from the palette to add them here</p>
                <p className="text-[9px] text-muted-foreground mt-1">Use structural blocks (IF, ON EVENT) to create conditional logic</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activeStrategy.blocks.map((block, i) => (
                  <CanvasBlock key={block.uid} block={block} depth={0}
                    onRemove={removeBlock} onUpdateParam={updateBlockParam}
                    onAddChild={(parentUid, blockId) => addBlock(blockId, parentUid)}
                    dragOverUid={dragOverUid} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Palette Block ──────────────────────────────────────────

function PaletteBlock({ def, onAdd }: { def: BlockDefinition; onAdd: () => void }) {
  return (
    <button onClick={onAdd} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary transition-colors text-left group">
      <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-foreground truncate">{def.label}</p>
        <p className="text-[8px] text-muted-foreground truncate">{def.description}</p>
      </div>
      <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

// ─── Canvas Block (recursive) ───────────────────────────────

function CanvasBlock({ block, depth, onRemove, onUpdateParam, onAddChild, dragOverUid }: {
  block: BlockInstance;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  dragOverUid: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const def = getBlockDef(block.blockId);
  if (!def) return null;

  return (
    <motion.div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: def.color + "40",
        marginLeft: depth * 16,
        backgroundColor: def.color + "08",
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Block header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: `1px solid ${def.color}20` }}>
        <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab shrink-0" />
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
        <span className="text-[10px] font-bold text-foreground">{def.label}</span>
        {def.acceptsChildren && (
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        <div className="flex-1" />

        {/* Inline params */}
        {def.params.map(p => (
          <InlineParam key={p.key} param={p} value={block.params[p.key]} onChange={v => onUpdateParam(block.uid, p.key, v)} />
        ))}

        <button onClick={() => onRemove(block.uid)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Children (for structural blocks) */}
      {def.acceptsChildren && !collapsed && (
        <div className="px-2 py-1.5 space-y-1">
          {block.children.map(child => (
            <CanvasBlock key={child.uid} block={child} depth={0}
              onRemove={onRemove} onUpdateParam={onUpdateParam}
              onAddChild={onAddChild} dragOverUid={dragOverUid} />
          ))}
          <div className="relative">
            <button onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full py-1 rounded border border-dashed border-border text-[9px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
              + Add block inside
            </button>
            <AnimatePresence>
              {showAddMenu && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute z-10 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg p-2 max-h-48 overflow-y-auto">
                  {BLOCK_DEFINITIONS.filter(b => b.category !== "structural" || b.id === "and" || b.id === "or" || b.id === "not").slice(0, 30).map(b => (
                    <button key={b.id} onClick={() => { onAddChild(block.uid, b.id); setShowAddMenu(false); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary text-left text-[9px]">
                      <span className="w-1.5 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-foreground">{b.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Inline Parameter ───────────────────────────────────────

function InlineParam({ param, value, onChange }: { param: BlockDefinition["params"][0]; value: number | string; onChange: (v: number | string) => void }) {
  if (param.type === "select") {
    return (
      <select value={value as string} onChange={e => onChange(e.target.value)}
        className="bg-secondary border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground outline-none">
        {param.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (param.type === "number") {
    return (
      <div className="flex items-center gap-0.5">
        <input type="number" value={value as number} onChange={e => onChange(Number(e.target.value))}
          min={param.min} max={param.max} step={param.step}
          className="w-12 bg-secondary border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground outline-none text-right" />
        {param.unit && <span className="text-[8px] text-muted-foreground">{param.unit}</span>}
      </div>
    );
  }
  return (
    <input type="text" value={value as string} onChange={e => onChange(e.target.value)}
      className="w-20 bg-secondary border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground outline-none" />
  );
}

// ─── Tree helpers ───────────────────────────────────────────

function addChildBlock(blocks: BlockInstance[], parentUid: string, child: BlockInstance): BlockInstance[] {
  return blocks.map(b => {
    if (b.uid === parentUid) {
      return { ...b, children: [...b.children, child] };
    }
    return { ...b, children: addChildBlock(b.children, parentUid, child) };
  });
}

function removeBlockFromTree(blocks: BlockInstance[], uid: string): BlockInstance[] {
  return blocks.filter(b => b.uid !== uid).map(b => ({
    ...b, children: removeBlockFromTree(b.children, uid),
  }));
}

function updateParamInTree(blocks: BlockInstance[], uid: string, key: string, value: number | string): BlockInstance[] {
  return blocks.map(b => {
    if (b.uid === uid) {
      return { ...b, params: { ...b.params, [key]: value } };
    }
    return { ...b, children: updateParamInTree(b.children, uid, key, value) };
  });
}
