import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ChevronRight, ChevronDown, GripVertical, Puzzle, Search, Layers, AlertTriangle } from "lucide-react";
import {
  BLOCK_DEFINITIONS, CATEGORY_COLORS, CATEGORY_LABELS,
  type BlockCategory, type BlockDefinition, type BlockInstance, type CustomStrategy,
  getBlockDef, getBlocksByCategory, createBlockInstance, compileBlocksToConfig,
} from "@/lib/strategy-blocks";
import { type StrategyConfig } from "@/lib/strategy-engine";

const STRATEGY_COLORS = ["hsl(0, 0%, 70%)", "hsl(142, 50%, 50%)", "hsl(30, 80%, 55%)"];
const STRUCTURAL_IDS = new Set(["if", "else_if", "else", "and", "or", "not", "on_event"]);

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
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

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

  // Only allow structural (control flow) blocks at root level
  const addBlock = useCallback((blockId: string, parentUid?: string) => {
    if (!activeStrategy) return;
    // Root level: only structural blocks allowed
    if (!parentUid && !STRUCTURAL_IDS.has(blockId)) return;
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

  // Drag-and-drop reorder at root level
  const moveBlock = useCallback((fromUid: string, toIndex: number) => {
    if (!activeStrategy) return;
    const updated = [...customStrategies];
    const strat = { ...updated[selectedStrategyIdx] };
    const blocks = [...strat.blocks];
    const fromIndex = blocks.findIndex(b => b.uid === fromUid);
    if (fromIndex < 0 || fromIndex === toIndex) return;
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
    strat.blocks = blocks;
    updated[selectedStrategyIdx] = strat;
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

  // Only structural blocks for root palette
  const structuralDefs = BLOCK_DEFINITIONS.filter(b => STRUCTURAL_IDS.has(b.id));

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

            {/* Info banner */}
            <div className="flex items-start gap-1.5 px-2 py-1.5 mb-3 rounded-md bg-primary/5 border border-primary/10">
              <AlertTriangle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[9px] text-muted-foreground leading-tight">
                Start with a <strong className="text-foreground">Control Flow</strong> block (IF, ON EVENT) at root level. Add conditions &amp; actions inside.
              </p>
            </div>

            {filteredDefs ? (
              <div className="space-y-1">
                {filteredDefs.map(b => (
                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} disabled={!STRUCTURAL_IDS.has(b.id)} />
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
                      {cat !== "structural" && <span className="text-[8px] text-muted-foreground/50 ml-1">(inside only)</span>}
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
                                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} disabled={!STRUCTURAL_IDS.has(b.id)} />
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
                <Layers className="w-3 h-3" /> Compile &amp; Add to Backtest
              </button>
            </div>

            {activeStrategy.blocks.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <p className="text-[10px] text-muted-foreground">Add a <strong>Control Flow</strong> block (IF, ON EVENT) from the palette to start</p>
                <p className="text-[9px] text-muted-foreground mt-1">Then add conditions &amp; actions inside</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {structuralDefs.map(b => (
                    <button key={b.id} onClick={() => addBlock(b.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-foreground text-[9px] font-medium hover:bg-accent border border-border transition-colors">
                      <Plus className="w-2.5 h-2.5" /> {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {activeStrategy.blocks.map((block, i) => (
                  <DraggableCanvasBlock
                    key={block.uid}
                    block={block}
                    index={i}
                    depth={0}
                    onRemove={removeBlock}
                    onUpdateParam={updateBlockParam}
                    onAddChild={(parentUid, blockId) => addBlock(blockId, parentUid)}
                    draggedUid={draggedUid}
                    dropTargetIdx={dropTargetIdx}
                    onDragStart={setDraggedUid}
                    onDragEnd={() => { setDraggedUid(null); setDropTargetIdx(null); }}
                    onDropTarget={setDropTargetIdx}
                    onDrop={(toIdx) => { if (draggedUid) moveBlock(draggedUid, toIdx); setDraggedUid(null); setDropTargetIdx(null); }}
                    totalCount={activeStrategy.blocks.length}
                  />
                ))}
                {/* Drop zone at end */}
                <div
                  className={`h-2 rounded transition-colors ${dropTargetIdx === activeStrategy.blocks.length ? "bg-primary/30" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDropTargetIdx(activeStrategy.blocks.length); }}
                  onDrop={() => { if (draggedUid) moveBlock(draggedUid, activeStrategy.blocks.length); setDraggedUid(null); setDropTargetIdx(null); }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Palette Block ──────────────────────────────────────────

function PaletteBlock({ def, onAdd, disabled }: { def: BlockDefinition; onAdd: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onAdd}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left group ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary cursor-pointer"}`}
      title={disabled ? "Can only be added inside a control flow block" : def.description}
    >
      <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-foreground truncate">{def.label}</p>
        <p className="text-[8px] text-muted-foreground truncate">{def.description}</p>
      </div>
      {!disabled && <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
    </button>
  );
}

// ─── Draggable Canvas Block ─────────────────────────────────

function DraggableCanvasBlock({ block, index, depth, onRemove, onUpdateParam, onAddChild, draggedUid, dropTargetIdx, onDragStart, onDragEnd, onDropTarget, onDrop, totalCount }: {
  block: BlockInstance;
  index: number;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  draggedUid: string | null;
  dropTargetIdx: number | null;
  onDragStart: (uid: string) => void;
  onDragEnd: () => void;
  onDropTarget: (idx: number) => void;
  onDrop: (idx: number) => void;
  totalCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const def = getBlockDef(block.blockId);
  if (!def) return null;

  const isDragging = draggedUid === block.uid;
  const isDropTarget = dropTargetIdx === index;

  return (
    <>
      {/* Drop indicator above */}
      {depth === 0 && (
        <div
          className={`h-1 rounded transition-colors ${isDropTarget && draggedUid && draggedUid !== block.uid ? "bg-primary/40" : ""}`}
          onDragOver={e => { e.preventDefault(); onDropTarget(index); }}
          onDrop={e => { e.preventDefault(); onDrop(index); }}
        />
      )}
      <motion.div
        className={`rounded-lg border overflow-visible transition-opacity ${isDragging ? "opacity-40" : ""}`}
        style={{
          borderColor: def.color + "40",
          marginLeft: depth * 16,
          backgroundColor: def.color + "08",
        }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        draggable={depth === 0}
        onDragStart={(e: any) => { if (depth === 0) { e.dataTransfer.effectAllowed = "move"; onDragStart(block.uid); } }}
        onDragEnd={onDragEnd}
      >
        {/* Block header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: `1px solid ${def.color}20` }}>
          {depth === 0 && (
            <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab shrink-0 hover:text-foreground/60 active:cursor-grabbing" />
          )}
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
            {block.children.length === 0 && (
              <p className="text-[9px] text-muted-foreground/60 italic text-center py-1">No blocks inside — add conditions or actions below</p>
            )}
            {block.children.map(child => (
              <CanvasBlock key={child.uid} block={child} depth={0}
                onRemove={onRemove} onUpdateParam={onUpdateParam}
                onAddChild={onAddChild} />
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
                    {BLOCK_DEFINITIONS.map(b => (
                      <button key={b.id} onClick={() => { onAddChild(block.uid, b.id); setShowAddMenu(false); }}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary text-left text-[9px]">
                        <span className="w-1.5 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                        <span className="text-foreground">{b.label}</span>
                        <span className="text-[8px] text-muted-foreground ml-auto">{b.category}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Non-draggable Canvas Block (for nested children) ───────

function CanvasBlock({ block, depth, onRemove, onUpdateParam, onAddChild }: {
  block: BlockInstance;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const def = getBlockDef(block.blockId);
  if (!def) return null;

  return (
    <motion.div
      className="rounded-lg border overflow-visible"
      style={{
        borderColor: def.color + "40",
        marginLeft: depth * 16,
        backgroundColor: def.color + "08",
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: `1px solid ${def.color}20` }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
        <span className="text-[10px] font-bold text-foreground">{def.label}</span>
        {def.acceptsChildren && (
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        <div className="flex-1" />
        {def.params.map(p => (
          <InlineParam key={p.key} param={p} value={block.params[p.key]} onChange={v => onUpdateParam(block.uid, p.key, v)} />
        ))}
        <button onClick={() => onRemove(block.uid)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {def.acceptsChildren && !collapsed && (
        <div className="px-2 py-1.5 space-y-1">
          {block.children.map(child => (
            <CanvasBlock key={child.uid} block={child} depth={0}
              onRemove={onRemove} onUpdateParam={onUpdateParam}
              onAddChild={onAddChild} />
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
                  {BLOCK_DEFINITIONS.map(b => (
                    <button key={b.id} onClick={() => { onAddChild(block.uid, b.id); setShowAddMenu(false); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary text-left text-[9px]">
                      <span className="w-1.5 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-foreground">{b.label}</span>
                      <span className="text-[8px] text-muted-foreground ml-auto">{b.category}</span>
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
