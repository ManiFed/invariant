import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ChevronRight, ChevronDown, Plus, GripVertical, Puzzle, Link2 } from "lucide-react";
import {
  getAMMBlockDef,
  AMM_BLOCK_DEFINITIONS,
  type AMMBlockInstance,
  type AMMBlockDefinition,
} from "@/lib/amm-blocks";

interface Props {
  blocks: AMMBlockInstance[];
  onRemoveBlock: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  onAddInput: (parentUid: string, blockId: string) => void;
}

export default function AMMBlockCanvas({
  blocks,
  onRemoveBlock,
  onUpdateParam,
  onAddChild,
  onAddInput,
}: Props) {
  if (blocks.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center h-full flex flex-col items-center justify-center">
        <Puzzle className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          Start Building Your AMM
        </p>
        <p className="text-[10px] text-muted-foreground max-w-xs">
          Add a <strong>Curve Template</strong> from the palette to define your base invariant, 
          or build a custom formula from primitives and operations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      {blocks.map((block, i) => (
        <CanvasBlock
          key={block.uid}
          block={block}
          depth={0}
          onRemove={onRemoveBlock}
          onUpdateParam={onUpdateParam}
          onAddChild={onAddChild}
          onAddInput={onAddInput}
        />
      ))}
    </div>
  );
}

function CanvasBlock({
  block,
  depth,
  onRemove,
  onUpdateParam,
  onAddChild,
  onAddInput,
}: {
  block: AMMBlockInstance;
  depth: number;
  onRemove: (uid: string) => void;
  onUpdateParam: (uid: string, key: string, value: number | string) => void;
  onAddChild: (parentUid: string, blockId: string) => void;
  onAddInput: (parentUid: string, blockId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState<"child" | "input" | null>(null);
  const def = getAMMBlockDef(block.blockId);

  if (!def) return null;

  const hasChildren = def.acceptsChildren;
  const hasInputSlots = (def.inputs || 0) > 0;
  const inputsNeeded = (def.inputs || 0) - block.inputs.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative"
      style={{ marginLeft: depth * 16 }}
    >
      {/* Block header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: def.color,
          backgroundColor: `${def.color}10`,
        }}
      >
        {/* Collapse toggle for blocks with children */}
        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Color indicator */}
        <span
          className="w-1.5 h-5 rounded-full shrink-0"
          style={{ backgroundColor: def.color }}
        />

        {/* Label and symbol */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold text-foreground truncate">
            {def.label}
          </span>
          {def.symbol && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {def.symbol}
            </span>
          )}
        </div>

        {/* Parameters */}
        {def.params.length > 0 && (
          <div className="flex items-center gap-2 ml-2">
            {def.params.map((param) => (
              <div key={param.key} className="flex items-center gap-1">
                <span className="text-[8px] text-muted-foreground">
                  {param.label}:
                </span>
                {param.type === "number" ? (
                  <input
                    type="number"
                    value={block.params[param.key] as number}
                    onChange={(e) =>
                      onUpdateParam(block.uid, param.key, parseFloat(e.target.value) || 0)
                    }
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground outline-none focus:border-foreground"
                  />
                ) : (
                  <select
                    value={block.params[param.key] as string}
                    onChange={(e) =>
                      onUpdateParam(block.uid, param.key, e.target.value)
                    }
                    className="bg-background border border-border rounded px-1 py-0.5 text-[9px] text-foreground outline-none"
                  >
                    {param.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {param.unit && (
                  <span className="text-[8px] text-muted-foreground">
                    {param.unit}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* Add input button */}
          {hasInputSlots && inputsNeeded > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(showAddMenu === "input" ? null : "input")}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary text-[8px] text-muted-foreground hover:text-foreground border border-border transition-colors"
              >
                <Link2 className="w-2.5 h-2.5" />
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
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary text-[8px] text-muted-foreground hover:text-foreground border border-border transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
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

          {/* Delete button */}
          <button
            onClick={() => onRemove(block.uid)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Input blocks (connected values) */}
      {block.inputs.length > 0 && (
        <div className="mt-1 ml-4 space-y-1">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider px-2">
            Inputs
          </p>
          {block.inputs.map((input) => (
            <CanvasBlock
              key={input.uid}
              block={input}
              depth={1}
              onRemove={onRemove}
              onUpdateParam={onUpdateParam}
              onAddChild={onAddChild}
              onAddInput={onAddInput}
            />
          ))}
        </div>
      )}

      {/* Child blocks */}
      <AnimatePresence>
        {hasChildren && !collapsed && block.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-1 ml-4 space-y-1 border-l-2 pl-2"
            style={{ borderColor: `${def.color}40` }}
          >
            {block.children.map((child) => (
              <CanvasBlock
                key={child.uid}
                block={child}
                depth={depth + 1}
                onRemove={onRemove}
                onUpdateParam={onUpdateParam}
                onAddChild={onAddChild}
                onAddInput={onAddInput}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg p-2 w-48 max-h-60 overflow-y-auto">
        {defs.map((def) => (
          <button
            key={def.id}
            onClick={() => onSelect(def.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-left transition-colors"
          >
            <span
              className="w-1.5 h-4 rounded-full shrink-0"
              style={{ backgroundColor: def.color }}
            />
            <div className="min-w-0">
              <p className="text-[9px] font-medium text-foreground truncate">
                {def.label}
              </p>
              <p className="text-[7px] text-muted-foreground truncate">
                {def.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
