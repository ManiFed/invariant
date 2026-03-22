import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

interface ShortcutEntry {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutEntry[];
}

function formatKey(shortcut: ShortcutEntry): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key === "/" ? "/" : shortcut.key.toUpperCase());
  return parts.join(" + ");
}

const KeyboardShortcutsHelp = ({ open, onClose, shortcuts }: KeyboardShortcutsHelpProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-background border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-foreground" />
                <h2 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {shortcuts.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">{shortcut.description}</span>
                  <kbd className="text-[10px] font-mono px-2 py-1 rounded bg-secondary border border-border text-foreground">
                    {formatKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border bg-secondary/30">
              <p className="text-[10px] text-muted-foreground text-center">
                Press <kbd className="font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground">/</kbd> to toggle this dialog
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;
