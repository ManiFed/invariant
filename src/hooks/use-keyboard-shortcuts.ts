import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ShortcutEntry {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: ShortcutEntry[] = [
    { key: "h", ctrl: true, description: "Go Home", action: () => navigate("/") },
    { key: "b", ctrl: true, shift: true, description: "Beginner Mode", action: () => navigate("/beginner") },
    { key: "a", ctrl: true, shift: true, description: "Advanced Mode", action: () => navigate("/advanced") },
    { key: "d", ctrl: true, shift: true, description: "Design Studio", action: () => navigate("/design-studio") },
    { key: "l", ctrl: true, shift: true, description: "Labs", action: () => navigate("/labs") },
    { key: "c", ctrl: true, shift: true, description: "Pool Comparison", action: () => navigate("/compare") },
    { key: "/", description: "Show keyboard shortcuts", action: () => setShowHelp(prev => !prev) },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, shortcuts };
}
