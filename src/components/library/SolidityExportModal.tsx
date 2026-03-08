import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Copy, Download, Check } from "lucide-react";
import { generateSolidity, downloadSolidity } from "@/lib/codegen-solidity";

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  familyId?: string;
  familyParams?: Record<string, number>;
  bins?: number[];
  score?: number;
  regime?: string;
  author?: string;
}

export default function SolidityExportModal({ open, onClose, name, familyId, familyParams, bins, score, regime, author }: Props) {
  const [copied, setCopied] = useState(false);

  const { code, filename, contractName } = useMemo(() =>
    generateSolidity({ name, familyId, familyParams, bins, score, regime, author }),
    [name, familyId, familyParams, bins, score, regime, author]
  );

  if (!open) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">{filename}</h2>
            <p className="text-[10px] text-muted-foreground">
              {contractName} — {familyId || "piecewise-bands"} variant
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary text-foreground text-[10px] font-medium hover:bg-accent transition-colors border border-border">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => downloadSolidity({ name, familyId, familyParams, bins, score, regime, author })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition-opacity">
              <Download className="w-3 h-3" /> Download .sol
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="text-[10px] leading-relaxed font-mono text-foreground whitespace-pre overflow-x-auto bg-secondary rounded-lg p-4 border border-border">
            {code}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  );
}
