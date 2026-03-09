import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronDown, Plus } from "lucide-react";
import {
  AMM_BLOCK_DEFINITIONS,
  AMM_CATEGORY_COLORS,
  AMM_CATEGORY_LABELS,
  getAMMBlocksByCategory,
  type AMMBlockCategory,
  type AMMBlockDefinition,
} from "@/lib/amm-blocks";

interface Props {
  onAddBlock: (blockId: string) => void;
  allowedAtRoot?: string[]; // Block IDs allowed at root level
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
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          className="w-full bg-secondary border border-border rounded-md pl-7 pr-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Scrollable block list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredDefs ? (
          <div className="space-y-1">
            {filteredDefs.map((b) => (
              <PaletteBlock
                key={b.id}
                def={b}
                onAdd={() => onAddBlock(b.id)}
                disabled={allowedAtRoot && !allowedAtRoot.includes(b.id)}
              />
            ))}
            {filteredDefs.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                No blocks match
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {categories.map((cat) => (
              <div key={cat}>
                <button
                  onClick={() =>
                    setExpandedCategory(expandedCategory === cat ? null : cat)
                  }
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  {expandedCategory === cat ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: AMM_CATEGORY_COLORS[cat] }}
                  />
                  {AMM_CATEGORY_LABELS[cat]}
                  <span className="text-[8px] text-muted-foreground ml-auto">
                    {Object.values(grouped[cat]).flat().length}
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
                      {Object.entries(grouped[cat]).map(([sub, blocks]) => (
                        <div key={sub} className="ml-4 mb-2">
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            {sub}
                          </p>
                          <div className="space-y-0.5">
                            {blocks.map((b) => (
                              <PaletteBlock
                                key={b.id}
                                def={b}
                                onAdd={() => onAddBlock(b.id)}
                              />
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
    </div>
  );
}

function PaletteBlock({
  def,
  onAdd,
  disabled,
}: {
  def: AMMBlockDefinition;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onAdd}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left group ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-secondary cursor-pointer"
      }`}
      title={disabled ? "Not allowed at root level" : def.description}
    >
      <span
        className="w-1.5 h-6 rounded-full shrink-0"
        style={{ backgroundColor: def.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-medium text-foreground truncate">
            {def.label}
          </p>
          {def.symbol && (
            <span className="text-[8px] font-mono text-muted-foreground">
              {def.symbol}
            </span>
          )}
        </div>
        <p className="text-[8px] text-muted-foreground truncate">
          {def.description}
        </p>
      </div>
      {!disabled && (
        <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}
