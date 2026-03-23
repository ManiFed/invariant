import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ChevronRight, ChevronDown, GripVertical, Search, AlertTriangle, Copy, Zap } from "lucide-react";
import {
  BOT_BLOCK_DEFINITIONS, BOT_CATEGORY_COLORS, BOT_CATEGORY_LABELS, STRUCTURAL_BOT_IDS,
  getBotBlockDef, getBotBlocksByCategory, createBotBlockInstance,
  addBotChildBlock, removeBotBlock, updateBotParam,
  BOT_TEMPLATES,
  type BotBlockCategory, type BotBlockDefinition, type BotBlockInstance, type BotProgram,
} from "@/lib/bot-blocks";

const BOT_COLORS = [
  "hsl(0, 70%, 55%)", "hsl(210, 70%, 55%)", "hsl(120, 50%, 45%)",
  "hsl(45, 80%, 50%)", "hsl(280, 60%, 55%)", "hsl(180, 60%, 45%)",
];

interface Props {
  bots: BotProgram[];
  onBotsChange: (bots: BotProgram[]) => void;
}

export default function BotBlockEditor({ bots, onBotsChange }: Props) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("structural");
  const [selectedBotIdx, setSelectedBotIdx] = useState(0);

  const grouped = getBotBlocksByCategory();
  const categories = Object.keys(grouped) as BotBlockCategory[];
  const activeBot = bots[selectedBotIdx];

  const addBot = () => {
    const newBot: BotProgram = {
      id: `bot_${Date.now()}`,
      name: `Bot ${bots.length + 1}`,
      color: BOT_COLORS[bots.length % BOT_COLORS.length],
      capital: 10000,
      enabled: true,
      blocks: [],
    };
    onBotsChange([...bots, newBot]);
    setSelectedBotIdx(bots.length);
  };

  const addFromTemplate = (templateIdx: number) => {
    const bot = BOT_TEMPLATES[templateIdx].create();
    onBotsChange([...bots, bot]);
    setSelectedBotIdx(bots.length);
  };

  const removeBot = (idx: number) => {
    const updated = bots.filter((_, i) => i !== idx);
    onBotsChange(updated);
    if (selectedBotIdx >= updated.length) setSelectedBotIdx(Math.max(0, updated.length - 1));
  };

  const duplicateBot = (idx: number) => {
    const src = bots[idx];
    const dup: BotProgram = {
      ...src,
      id: `bot_${Date.now()}`,
      name: `${src.name} (copy)`,
      color: BOT_COLORS[(bots.length) % BOT_COLORS.length],
      blocks: JSON.parse(JSON.stringify(src.blocks)),
    };
    onBotsChange([...bots, dup]);
    setSelectedBotIdx(bots.length);
  };

  const updateBotField = (idx: number, field: Partial<BotProgram>) => {
    const updated = [...bots];
    updated[idx] = { ...updated[idx], ...field };
    onBotsChange(updated);
  };

  const addBlock = useCallback((blockId: string, parentUid?: string) => {
    if (!activeBot) return;
    if (!parentUid && !STRUCTURAL_BOT_IDS.has(blockId)) return;
    const instance = createBotBlockInstance(blockId);
    const updated = [...bots];
    const bot = { ...updated[selectedBotIdx] };
    if (parentUid) {
      bot.blocks = addBotChildBlock(bot.blocks, parentUid, instance);
    } else {
      bot.blocks = [...bot.blocks, instance];
    }
    updated[selectedBotIdx] = bot;
    onBotsChange(updated);
  }, [activeBot, bots, selectedBotIdx, onBotsChange]);

  const removeBlock = useCallback((uid: string) => {
    if (!activeBot) return;
    const updated = [...bots];
    updated[selectedBotIdx] = { ...updated[selectedBotIdx], blocks: removeBotBlock(updated[selectedBotIdx].blocks, uid) };
    onBotsChange(updated);
  }, [activeBot, bots, selectedBotIdx, onBotsChange]);

  const updateBlockParam = useCallback((uid: string, key: string, value: number | string) => {
    if (!activeBot) return;
    const updated = [...bots];
    updated[selectedBotIdx] = { ...updated[selectedBotIdx], blocks: updateBotParam(updated[selectedBotIdx].blocks, uid, key, value) };
    onBotsChange(updated);
  }, [activeBot, bots, selectedBotIdx, onBotsChange]);

  const filteredDefs = search.trim()
    ? BOT_BLOCK_DEFINITIONS.filter(b => b.label.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase()))
    : null;

  const structuralDefs = BOT_BLOCK_DEFINITIONS.filter(b => STRUCTURAL_BOT_IDS.has(b.id));

  return (
    <div className="space-y-3">
      {/* Bot tabs + templates */}
      <div className="surface-elevated rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Trading Bots
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground">{bots.length} bots</span>
            <button onClick={addBot} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-foreground text-[10px] font-medium hover:bg-accent border border-border transition-colors">
              <Plus className="w-3 h-3" /> Empty Bot
            </button>
          </div>
        </div>

        {/* Templates row */}
        <div className="flex flex-wrap gap-1 mb-2">
          {BOT_TEMPLATES.map((t, i) => (
            <button key={t.label} onClick={() => addFromTemplate(i)}
              className="px-2 py-1 rounded-md bg-secondary/50 text-[9px] text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
              title={t.description}>
              + {t.label}
            </button>
          ))}
        </div>

        {/* Bot tabs */}
        {bots.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {bots.map((b, i) => (
              <div key={b.id} onClick={() => setSelectedBotIdx(i)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all border ${i === selectedBotIdx ? "bg-foreground/5 text-foreground border-foreground/20" : "bg-secondary text-muted-foreground border-border hover:text-foreground"}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <span className={`${b.enabled ? "" : "line-through opacity-50"}`}>{b.name}</span>
                <button onClick={e => { e.stopPropagation(); duplicateBot(i); }} className="text-muted-foreground hover:text-foreground" title="Duplicate">
                  <Copy className="w-2.5 h-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); removeBot(i); }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bot editor */}
      {activeBot && (
        <div className="grid grid-cols-[260px_1fr] gap-3 min-h-[400px]">
          {/* Block Palette */}
          <div className="surface-elevated rounded-xl p-3 overflow-y-auto max-h-[600px]">
            <div className="relative mb-2">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search blocks..."
                className="w-full bg-secondary border border-border rounded-md pl-7 pr-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground" />
            </div>

            <div className="flex items-start gap-1.5 px-2 py-1.5 mb-2 rounded-md bg-primary/5 border border-primary/10">
              <AlertTriangle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[9px] text-muted-foreground leading-tight">
                Start with a <strong className="text-foreground">Control Flow</strong> block at root. Add sensors, conditions &amp; actions inside.
              </p>
            </div>

            {filteredDefs ? (
              <div className="space-y-0.5">
                {filteredDefs.map(b => (
                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} disabled={!STRUCTURAL_BOT_IDS.has(b.id)} />
                ))}
                {filteredDefs.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No blocks match</p>}
              </div>
            ) : (
              <div className="space-y-0.5">
                {categories.map(cat => (
                  <div key={cat}>
                    <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors">
                      {expandedCategory === cat ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BOT_CATEGORY_COLORS[cat] }} />
                      {BOT_CATEGORY_LABELS[cat]}
                      {cat !== "structural" && <span className="text-[8px] text-muted-foreground/50 ml-1">(nest)</span>}
                      <span className="text-[8px] text-muted-foreground ml-auto">{Object.values(grouped[cat]).flat().length}</span>
                    </button>
                    <AnimatePresence>
                      {expandedCategory === cat && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          {Object.entries(grouped[cat]).map(([sub, blocks]) => (
                            <div key={sub} className="ml-4 mb-1.5">
                              <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 px-1">{sub}</p>
                              <div className="space-y-0.5">
                                {blocks.map(b => (
                                  <PaletteBlock key={b.id} def={b} onAdd={() => addBlock(b.id)} disabled={!STRUCTURAL_BOT_IDS.has(b.id)} />
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
          <div className="surface-elevated rounded-xl p-3 overflow-y-auto max-h-[600px]">
            {/* Bot settings header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <input value={activeBot.name} onChange={e => updateBotField(selectedBotIdx, { name: e.target.value })}
                className="bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-foreground transition-colors flex-1" />
              <div className="flex items-center gap-1.5">
                <label className="text-[9px] text-muted-foreground">Capital $</label>
                <input type="number" value={activeBot.capital} onChange={e => updateBotField(selectedBotIdx, { capital: Number(e.target.value) })}
                  className="w-20 bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground outline-none text-right" />
              </div>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={activeBot.enabled} onChange={e => updateBotField(selectedBotIdx, { enabled: e.target.checked })}
                  className="rounded border-border" />
                Enabled
              </label>
            </div>

            {/* Block canvas */}
            {activeBot.blocks.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <p className="text-[10px] text-muted-foreground mb-3">Add a <strong>Control Flow</strong> block to start building this bot's strategy</p>
                <div className="flex flex-wrap justify-center gap-1.5">
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
                {activeBot.blocks.map(block => (
                  <CanvasBlock key={block.uid} block={block} depth={0}
                    onRemove={removeBlock} onUpdateParam={updateBlockParam}
                    onAddChild={(parentUid, blockId) => addBlock(blockId, parentUid)} />
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

function PaletteBlock({ def, onAdd, disabled }: { def: BotBlockDefinition; onAdd: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onAdd}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors text-left group ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary cursor-pointer"}`}
      title={disabled ? "Add inside a control flow block" : def.description}>
      <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-foreground truncate">{def.label}</p>
        <p className="text-[8px] text-muted-foreground truncate">{def.description}</p>
      </div>
      {!disabled && <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
    </button>
  );
}

// ─── Canvas Block (recursive) ───────────────────────────────

function CanvasBlock({ block, depth, onRemove, onUpdateParam, onAddChild }: {
  block: BotBlockInstance;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const def = getBotBlockDef(block.blockId);
  if (!def) return null;

  return (
    <motion.div
      className="rounded-lg border overflow-visible"
      style={{ borderColor: def.color + "40", marginLeft: depth * 14, backgroundColor: def.color + "08" }}
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: `1px solid ${def.color}20` }}>
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

      {/* Children */}
      {def.acceptsChildren && !collapsed && (
        <div className="px-2 py-1.5 space-y-0.5">
          {block.children.length === 0 && (
            <p className="text-[9px] text-muted-foreground/60 italic text-center py-1">Add blocks inside</p>
          )}
          {block.children.map(child => (
            <CanvasBlock key={child.uid} block={child} depth={0}
              onRemove={onRemove} onUpdateParam={onUpdateParam} onAddChild={onAddChild} />
          ))}
          <div className="relative">
            <button onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full py-1 rounded border border-dashed border-border text-[9px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
              + Add block inside
            </button>
            <AnimatePresence>
              {showAddMenu && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg p-2 max-h-48 overflow-y-auto">
                  {BOT_BLOCK_DEFINITIONS.map(b => (
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

function InlineParam({ param, value, onChange }: { param: BotBlockDefinition["params"][0]; value: number | string; onChange: (v: number | string) => void }) {
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
          className="w-14 bg-secondary border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground outline-none text-right" />
        {param.unit && <span className="text-[8px] text-muted-foreground">{param.unit}</span>}
      </div>
    );
  }
  return (
    <input type="text" value={value as string} onChange={e => onChange(e.target.value)}
      className="w-20 bg-secondary border border-border rounded px-1 py-0.5 text-[9px] font-mono text-foreground outline-none" />
  );
}
