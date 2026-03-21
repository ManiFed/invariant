import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronDown, Plus, GripVertical } from "lucide-react";
import {
  AMM_BLOCK_DEFINITIONS,
  AMM_CATEGORY_COLORS,
  AMM_CATEGORY_LABELS,
  getAMMBlocksByCategory,
  type AMMBlockCategory,
  type AMMBlockDefinition,
} from "@/lib/amm-blocks";
import { setDragData } from "./AMMBlockCanvas";

interface Props {
  onAddBlock: (blockId: string) => void;
  allowedAtRoot?: string[];
}

/* ── Category gradient backgrounds ── */
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

export default function AMMBlockPalette({ onAddBlock, allowedAtRoot }: Props) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("curve");

  const grouped = getAMMBlocksByCategory();
  const categories = Object.keys(grouped) as AMMBlockCategory[];

  const filteredDefs = search.trim()
    ? AMM_BLOCK_DEFINITIONS.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-shadow"
        />
      </div>

      {/* Scrollable block list */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {filteredDefs ? (
          <div className="space-y-1">
            {filteredDefs.map((b) => (
              <DraggablePaletteBlock
                key={b.id}
                def={b}
                onAdd={() => onAddBlock(b.id)}
                disabled={allowedAtRoot ? !allowedAtRoot.includes(b.id) : false}
              />
            ))}
            {filteredDefs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No blocks match "{search}"
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const subcats = grouped[cat];
              const blockCount = Object.values(subcats).flat().length;
              if (blockCount === 0) return null;
              return (
                <div key={cat}>
                  <button
                    onClick={() =>
                      setExpandedCategory(expandedCategory === cat ? null : cat)
                    }
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-secondary transition-colors"
                  >
                    {expandedCategory === cat ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 bg-gradient-to-br ${categoryBg(cat)}`}
                    />
                    <span className="flex-1 text-left">{AMM_CATEGORY_LABELS[cat]}</span>
                    <span className="text-[9px] text-muted-foreground font-mono bg-secondary rounded-full px-1.5 py-0.5">
                      {blockCount}
                    </span>
                  </button>
                  <AnimatePresence>
                    {expandedCategory === cat && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {Object.entries(subcats).map(([sub, blocks]) => (
                          <div key={sub} className="ml-3 mb-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-2">
                              {sub}
                            </p>
                            <div className="space-y-0.5">
                              {blocks.map((b) => (
                                <DraggablePaletteBlock
                                  key={b.id}
                                  def={b}
                                  onAdd={() => onAddBlock(b.id)}
                                  disabled={allowedAtRoot ? !allowedAtRoot.includes(b.id) : false}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggablePaletteBlock({
  def,
  onAdd,
  disabled,
}: {
  def: AMMBlockDefinition;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    setDragData({ blockId: def.id });
    e.dataTransfer.effectAllowed = "copy";
    // Ghost image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 16);
  };

  const handleDragEnd = () => {
    setDragData(null);
  };

  return (
    <button
      onClick={disabled ? undefined : onAdd}
      draggable={!disabled}
      onDragStart={disabled ? undefined : handleDragStart}
      onDragEnd={handleDragEnd}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left group ${
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "hover:shadow-md hover:scale-[1.02] cursor-grab active:cursor-grabbing active:scale-[0.98]"
      }`}
      title={disabled ? "Not allowed at root level" : `Drag or click to add: ${def.description}`}
    >
      {/* Mini block preview */}
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r ${categoryBg(def.category as AMMBlockCategory)} text-white shadow-sm min-w-0 flex-1`}
      >
        <GripVertical className="w-3 h-3 opacity-40 shrink-0" />
        <span className="text-[10px] font-bold truncate">{def.label}</span>
        {def.symbol && (
          <span className="text-[8px] font-mono bg-black/20 rounded px-1 py-0.5 shrink-0 leading-none ml-auto">
            {def.symbol}
          </span>
        )}
      </div>
      {!disabled && (
        <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}
