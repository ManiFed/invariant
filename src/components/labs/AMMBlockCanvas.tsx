import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ChevronRight, ChevronDown, Plus, Link2, Puzzle, GripVertical } from "lucide-react";
import {
  getAMMBlockDef,
  AMM_BLOCK_DEFINITIONS,
  AMM_CATEGORY_COLORS,
  type AMMBlockInstance,
  type AMMBlockDefinition,
  type AMMBlockCategory,
} from "@/lib/amm-blocks";

interface Props {
  blocks: AMMBlockInstance[];
  onRemoveBlock: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  onAddInput: (parentUid: string, blockId: string) => void;
  onReorderBlocks?: (blocks: AMMBlockInstance[]) => void;
  onDropBlock?: (blockId: string, targetUid?: string, position?: "child" | "input" | "after") => void;
}

// Drag data stored globally during drag
let dragData: { blockId?: string; instanceUid?: string } | null = null;

export function setDragData(data: { blockId?: string; instanceUid?: string } | null) {
  dragData = data;
}
export function getDragData() {
  return dragData;
}

export default function AMMBlockCanvas({
  blocks,
  onRemoveBlock,
  onUpdateParam,
  onAddChild,
  onAddInput,
  onReorderBlocks,
  onDropBlock,
}: Props) {
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverCanvas(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCanvas(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCanvas(false);
    const data = getDragData();
    if (data?.blockId && onDropBlock) {
      onDropBlock(data.blockId);
    }
    setDragData(null);
  }, [onDropBlock]);

  if (blocks.length === 0) {
    return (
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center h-full flex flex-col items-center justify-center transition-all duration-200 ${
          dragOverCanvas
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Puzzle className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-semibold text-foreground mb-1.5">
          Drag blocks here to start
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Drag a <strong>Curve Template</strong> from the palette, or click any block to add it.
          Build custom formulas by nesting operations and primitives.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`space-y-1 p-2 min-h-[300px] rounded-xl transition-colors ${
        dragOverCanvas ? "bg-primary/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence mode="popLayout">
        {blocks.map((block) => (
          <ScratchBlock
            key={block.uid}
            block={block}
            depth={0}
            onRemove={onRemoveBlock}
            onUpdateParam={onUpdateParam}
            onAddChild={onAddChild}
            onAddInput={onAddInput}
            onDropBlock={onDropBlock}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Color helpers ─── */
function categoryBg(cat: AMMBlockCategory): string {
  const map: Record<AMMBlockCategory, string> = {
    primitive: "from-blue-500 to-blue-600",
    operation: "from-amber-500 to-orange-500",
    curve: "from-emerald-500 to-green-600",
    modifier: "from-purple-500 to-violet-600",
    conditional: "from-rose-500 to-red-600",
    fee: "from-cyan-500 to-teal-600",
    multiasset: "from-orange-500 to-amber-600",
    timevar: "from-indigo-500 to-purple-600",
  };
  return map[cat] || "from-gray-500 to-gray-600";
}

function categoryBgDarker(cat: AMMBlockCategory): string {
  const map: Record<AMMBlockCategory, string> = {
    primitive: "bg-blue-700",
    operation: "bg-amber-700",
    curve: "bg-emerald-700",
    modifier: "bg-purple-700",
    conditional: "bg-rose-700",
    fee: "bg-cyan-700",
    multiasset: "bg-orange-700",
    timevar: "bg-indigo-700",
  };
  return map[cat] || "bg-gray-700";
}

function categoryBorder(cat: AMMBlockCategory): string {
  const map: Record<AMMBlockCategory, string> = {
    primitive: "border-blue-400/30",
    operation: "border-amber-400/30",
    curve: "border-emerald-400/30",
    modifier: "border-purple-400/30",
    conditional: "border-rose-400/30",
    fee: "border-cyan-400/30",
    multiasset: "border-orange-400/30",
    timevar: "border-indigo-400/30",
  };
  return map[cat] || "border-gray-400/30";
}

/* ─── Scratch-style Block ─── */
function ScratchBlock({
  block,
  depth,
  onRemove,
  onUpdateParam,
  onAddChild,
  onAddInput,
  onDropBlock,
  isInput,
}: {
  block: AMMBlockInstance;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  onAddInput: (parentUid: string, blockId: string) => void;
  onDropBlock?: (blockId: string, targetUid?: string, position?: "child" | "input" | "after") => void;
  isInput?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState<"child" | "input" | null>(null);
  const [dropTarget, setDropTarget] = useState<"child" | "input" | null>(null);
  const def = getAMMBlockDef(block.blockId);
  const blockRef = useRef<HTMLDivElement>(null);

  if (!def) return null;

  const hasChildren = def.acceptsChildren;
  const hasInputSlots = (def.inputs || 0) > 0;
  const inputsNeeded = (def.inputs || 0) - block.inputs.length;
  const cat = def.category;

  const handleDragStart = (e: React.DragEvent) => {
    setDragData({ instanceUid: block.uid });
    e.dataTransfer.effectAllowed = "move";
    if (blockRef.current) {
      blockRef.current.style.opacity = "0.5";
    }
  };

  const handleDragEnd = () => {
    if (blockRef.current) {
      blockRef.current.style.opacity = "1";
    }
    setDragData(null);
  };

  const handleChildDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget("child");
  };

  const handleInputDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget("input");
  };

  const handleDropOnChild = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const data = getDragData();
    if (data?.blockId && onDropBlock) {
      onDropBlock(data.blockId, block.uid, "child");
    }
    setDragData(null);
  };

  const handleDropOnInput = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const data = getDragData();
    if (data?.blockId && onDropBlock) {
      onDropBlock(data.blockId, block.uid, "input");
    }
    setDragData(null);
  };

  return (
    <div
      ref={blockRef}
      className="relative select-none"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* ── Notch connector (top) ── */}
      {depth === 0 && (
        <div className={`ml-6 w-4 h-1.5 rounded-b-sm bg-gradient-to-r ${categoryBg(cat)}`} />
      )}

      {/* ── Block body ── */}
      <div
        className={`relative rounded-lg border-2 overflow-hidden shadow-md hover:shadow-lg transition-shadow ${categoryBorder(cat)}`}
      >
        {/* Main row */}
        <div className={`bg-gradient-to-r ${categoryBg(cat)} px-3 py-2 flex items-center gap-2 text-white`}>
          {/* Drag grip */}
          <GripVertical className="w-3.5 h-3.5 opacity-50 cursor-grab active:cursor-grabbing shrink-0" />

          {/* Collapse */}
          {hasChildren && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hover:bg-white/20 rounded p-0.5 transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Label */}
          <span className="text-xs font-bold tracking-wide truncate">
            {def.label}
          </span>

          {/* Symbol badge */}
          {def.symbol && (
            <span className="text-[10px] font-mono bg-black/20 rounded px-1.5 py-0.5 leading-none">
              {def.symbol}
            </span>
          )}

          {/* Inline parameters */}
          {def.params.length > 0 && (
            <div className="flex items-center gap-1.5 ml-1">
              {def.params.map((param) => (
                <InlineParam
                  key={param.key}
                  param={param}
                  value={block.params[param.key]}
                  onChange={(val) => onUpdateParam(block.uid, param.key, val)}
                  cat={cat}
                />
              ))}
            </div>
          )}

          {/* Spacer + actions */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Input slot button */}
            {hasInputSlots && inputsNeeded > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(showAddMenu === "input" ? null : "input")}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-semibold hover:bg-white/30 transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  +{inputsNeeded}
                </button>
                {showAddMenu === "input" && (
                  <AddBlockMenu
                    onSelect={(id) => {
                      onAddInput(block.uid, id);
                      setShowAddMenu(null);
                    }}
                    onClose={() => setShowAddMenu(null)}
                    filter={(b) => b.output === "number"}
                  />
                )}
              </div>
            )}

            {/* Add child button */}
            {hasChildren && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(showAddMenu === "child" ? null : "child")}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-semibold hover:bg-white/30 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {showAddMenu === "child" && (
                  <AddBlockMenu
                    onSelect={(id) => {
                      onAddChild(block.uid, id);
                      setShowAddMenu(null);
                    }}
                    onClose={() => setShowAddMenu(null)}
                  />
                )}
              </div>
            )}

            {/* Delete */}
            <button
              onClick={() => onRemove(block.uid)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Input blocks (connected values) ── */}
        {block.inputs.length > 0 && (
          <div className={`${categoryBgDarker(cat)} bg-opacity-30 px-3 py-2 space-y-1`}>
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">
              Inputs
            </p>
            {block.inputs.map((input, i) => (
              <div key={input.uid} className="flex items-start gap-2">
                <span className="text-[9px] font-mono text-white/50 mt-2 shrink-0 w-3">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <ScratchBlock
                    block={input}
                    depth={depth + 1}
                    onRemove={onRemove}
                    onUpdateParam={onUpdateParam}
                    onAddChild={onAddChild}
                    onAddInput={onAddInput}
                    onDropBlock={onDropBlock}
                    isInput
                  />
                </div>
              </div>
            ))}
            {inputsNeeded > 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-2 text-center text-[10px] font-medium transition-colors ${
                  dropTarget === "input"
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/20 text-white/40"
                }`}
                onDragOver={handleInputDragOver}
                onDragLeave={() => setDropTarget(null)}
                onDrop={handleDropOnInput}
              >
                Drop input block here ({inputsNeeded} needed)
              </div>
            )}
          </div>
        )}

        {/* Show empty input drop zone when no inputs yet */}
        {hasInputSlots && block.inputs.length === 0 && (
          <div className={`${categoryBgDarker(cat)} bg-opacity-30 px-3 py-2`}>
            <div
              className={`border-2 border-dashed rounded-lg p-2 text-center text-[10px] font-medium transition-colors ${
                dropTarget === "input"
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/20 text-white/40"
              }`}
              onDragOver={handleInputDragOver}
              onDragLeave={() => setDropTarget(null)}
              onDrop={handleDropOnInput}
            >
              Drop {def.inputs} input{(def.inputs || 0) > 1 ? "s" : ""} here
            </div>
          </div>
        )}

        {/* ── C-shaped children container ── */}
        <AnimatePresence>
          {hasChildren && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`relative ml-4 mr-2 my-2 pl-3 border-l-4 rounded-bl-lg space-y-1`}
                style={{ borderColor: AMM_CATEGORY_COLORS[cat] }}
              >
                {block.children.map((child) => (
                  <ScratchBlock
                    key={child.uid}
                    block={child}
                    depth={depth + 1}
                    onRemove={onRemove}
                    onUpdateParam={onUpdateParam}
                    onAddChild={onAddChild}
                    onAddInput={onAddInput}
                    onDropBlock={onDropBlock}
                  />
                ))}

                {/* Drop zone for children */}
                <div
                  className={`border-2 border-dashed rounded-lg p-2 text-center text-[10px] font-medium transition-all ${
                    dropTarget === "child"
                      ? "border-white/60 bg-white/10 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                  onDragOver={handleChildDragOver}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={handleDropOnChild}
                >
                  {block.children.length === 0
                    ? "Drop child blocks here"
                    : "+ Add more"}
                </div>
              </div>

              {/* Bottom cap of C-shape */}
              <div
                className={`h-2 bg-gradient-to-r ${categoryBg(cat)} rounded-b-lg mx-0`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Notch connector (bottom) ── */}
      {depth === 0 && (
        <div className={`ml-6 w-4 h-1.5 rounded-t-sm bg-gradient-to-r ${categoryBg(cat)}`} />
      )}
    </div>
  );
}

/* ─── Inline parameter bubble ─── */
function InlineParam({
  param,
  value,
  onChange,
  cat,
}: {
  param: { key: string; label: string; type: "number" | "select"; default: number | string; min?: number; max?: number; step?: number; options?: { label: string; value: string }[]; unit?: string };
  value: number | string;
  onChange: (val: number | string) => void;
  cat: AMMBlockCategory;
}) {
  if (param.type === "select") {
    return (
      <select
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/25 border border-white/20 rounded-full px-2 py-0.5 text-[10px] text-white font-medium outline-none cursor-pointer hover:bg-black/35 transition-colors appearance-none"
      >
        {param.options?.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-800">
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // Number input with label bubble
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[9px] text-white/70 font-medium">{param.label}</span>
      <input
        type="number"
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={param.min}
        max={param.max}
        step={param.step}
        className="w-16 bg-white/90 text-gray-900 border-none rounded-full px-2 py-0.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-white/40 transition-shadow text-center"
      />
      {param.unit && (
        <span className="text-[8px] text-white/60">{param.unit}</span>
      )}
    </div>
  );
}

/* ─── Add block menu ─── */
function AddBlockMenu({
  onSelect,
  onClose,
  filter,
}: {
  onSelect: (blockId: string) => void;
  onClose: () => void;
  filter?: (def: AMMBlockDefinition) => boolean;
}) {
  const defs = filter
    ? AMM_BLOCK_DEFINITIONS.filter(filter)
    : AMM_BLOCK_DEFINITIONS;

  // Group by category
  const grouped: Record<string, AMMBlockDefinition[]> = {};
  for (const d of defs) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl p-2 w-56 max-h-72 overflow-y-auto">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-2">
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-1">
              {cat}
            </p>
            {items.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-left transition-colors group"
              >
                <span
                  className={`w-2 h-5 rounded-full shrink-0 bg-gradient-to-b ${categoryBg(d.category as AMMBlockCategory)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-foreground truncate">
                    {d.label}
                  </p>
                  <p className="text-[8px] text-muted-foreground truncate">
                    {d.description}
                  </p>
                </div>
                <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
