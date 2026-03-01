import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Sparkles, X } from "lucide-react";
import AIChatPanel from "@/components/teaching/AIChatPanel";

const ROUTE_CONTEXT: Record<string, string> = {
  "/": "the homepage of Invariant Studio",
  "/beginner": "the Beginner Mode — an interactive AMM playground with guided tour",
  "/advanced": "the Advanced Mode — professional invariant engineering tools",
  "/learn": "the Teaching Lab course",
  "/docs": "the Documentation page",
  "/library": "the AMM Library — browsing famous and community AMM designs",
};

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Hide on teaching lab — AI is embedded in sidebar there
  if (location.pathname === "/learn") return null;

  const context = ROUTE_CONTEXT[location.pathname] || `the page at ${location.pathname}`;

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
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gradient-to-r from-primary/15 via-secondary/80 to-accent/20">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
                  className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </motion.div>
                <div className="leading-tight">
                  <span className="text-xs font-semibold text-foreground block">Ammy</span>
                  <span className="text-[10px] text-muted-foreground">Your AMM buddy</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AIChatPanel context={context} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </motion.button>
    </>
  );
}
