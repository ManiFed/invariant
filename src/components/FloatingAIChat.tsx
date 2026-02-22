import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import AIChatPanel from "@/components/teaching/AIChatPanel";

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Hide on teaching lab — AI is embedded in sidebar there
  if (location.pathname === "/learn") return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-20 right-4 z-50 w-80 h-[28rem] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
              <span className="text-xs font-semibold text-foreground">AI Assistant</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AIChatPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </motion.button>
    </>
  );
}
