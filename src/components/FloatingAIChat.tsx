import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Sparkles, X, Zap } from "lucide-react";
import AIChatPanel from "@/components/teaching/AIChatPanel";
import { useAmmyContext } from "@/lib/ammy-context";

const ROUTE_CONTEXT: Record<string, string> = {
  "/": "the homepage of Invariant Studio",
  "/beginner": "Beginner Mode — interactive AMM playground with guided tour, reserve sliders, price impact visualization",
  "/advanced": "Advanced Mode — professional invariant engineering with Monte Carlo simulation, fee structure editor, stability analysis",
  "/learn": "the Teaching Lab — structured courses on AMM concepts with embedded AI tutor",
  "/docs": "the Documentation page — technical reference",
  "/library": "the AMM Library — browsing, saving, and comparing community AMM designs with metrics and formulas",
  "/labs": "the Labs hub — listing all experimental tools (Multi-Asset, Time-Variance, Discovery Atlas, Strategy, DNA, Market Replay, MEV Analyzer, Compiler)",
  "/labs/multi-asset": "Multi-Asset Lab — designing AMMs for 3+ token pools",
  "/labs/time-variance": "Time-Variance Lab — AMMs that adapt parameters over time",
  "/labs/discover": "Discovery Atlas — AI-powered evolutionary search through the AMM design space using MAP-Elites",
  "/labs/strategy": "Liquidity Strategy Lab — designing and backtesting LP strategies",
  "/labs/dna": "DNA Lab — comparing genetic fingerprints of AMM designs",
  "/labs/replay": "Market Replay Lab — simulating AMM performance across historical scenarios (LUNA crash, DeFi Summer, etc.) with comparison mode, playback controls, and custom scenarios",
  "/labs/mev": "MEV Analyzer Lab — simulating sandwich attacks, backruns, JIT liquidity to test MEV resistance",
  "/labs/compiler": "Invariant Compiler Lab — a 4-step pipeline: Choose Design → Compile → Review & Test (gas, security, tests) → Deploy & Interact",
  "/challenges": "AMM Challenges — a gamified puzzle mode with 8 challenges across Beginner, Intermediate, and Expert tiers. Users tune AMM parameters (reserves, fees, concentration) to meet specific constraints like slippage targets, IL limits, and fee revenue goals. Scored 0-100 with 1-3 star ratings.",
};

const MOODS = ["✨", "🧠", "⚡", "💡", "🔮"] as const;
const GREETINGS = [
  "Hey! What are we building? 🛠️",
  "I've been thinking about invariants… 🤓",
  "Need a hand? I'm all ears! 👂",
  "Let's explore something cool ✨",
  "Ready when you are! 🚀",
];

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  const location = useLocation();
  const { pageContext } = useAmmyContext();

  // Cycle mood emoji every 8s
  useEffect(() => {
    const t = setInterval(() => setMood(m => (m + 1) % MOODS.length), 8000);
    return () => clearInterval(t);
  }, []);

  // Show "unread" nudge after 12s if user hasn't opened chat
  useEffect(() => {
    if (open) { setHasUnread(false); return; }
    const t = setTimeout(() => setHasUnread(true), 12000);
    return () => clearTimeout(t);
  }, [open, location.pathname]);

  // Hide on teaching lab — AI is embedded in sidebar there
  if (location.pathname === "/learn") return null;

  const context = ROUTE_CONTEXT[location.pathname] || `the page at ${location.pathname}`;
  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  return (
    <>
      {/* Unread nudge bubble */}
      <AnimatePresence>
        {hasUnread && !open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 10 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed bottom-[4.5rem] right-4 z-50 max-w-[11rem] px-2.5 py-1.5 rounded-xl rounded-br-sm bg-primary text-primary-foreground text-[10px] shadow-lg cursor-pointer"
            onClick={() => { setOpen(true); setHasUnread(false); }}
          >
            {greeting}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.92, y: 24, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-20 right-4 z-50 w-80 h-[28rem] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gradient-to-r from-primary/15 via-secondary/80 to-accent/20 relative overflow-hidden">
              {/* Ambient glow */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="flex items-center gap-2 relative z-10">
                {/* Ammy avatar */}
                <motion.div
                  className="relative w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 text-primary flex items-center justify-center"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {/* Breathing ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border border-primary/30"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Status dot */}
                  <motion.div
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-background"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
                <div className="leading-tight">
                  <span className="text-xs font-semibold text-foreground block">
                    Ammy <span className="text-[10px]">{MOODS[mood]}</span>
                  </span>
                  <motion.span
                    key={mood}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] text-muted-foreground"
                  >
                    Your AMM buddy · online
                  </motion.span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors relative z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chat body */}
            <div className="flex-1 min-h-0 flex flex-col">
              <AIChatPanel context={context} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => { setOpen(o => !o); setHasUnread(false); }}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg flex items-center justify-center group"
        animate={open ? {} : { y: [0, -4, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.88 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Ping ring when has unread */}
        {hasUnread && !open && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </motion.button>
    </>
  );
}
