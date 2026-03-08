import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, ExternalLink, Sparkles, MousePointerClick, SlidersHorizontal, FormInput } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ActionButton =
  | { type: "navigate"; path: string; label: string }
  | { type: "click"; selector: string; label: string }
  | { type: "set_value"; selector: string; value: string; label: string }
  | { type: "set_slider"; selector: string; value: number; label: string };

interface AIChatPanelProps {
  context?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ammy-chat`;
const STORAGE_KEY = "ai_chat_messages";

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(msgs: Message[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); } catch { /* */ }
}

function extractActions(content: string): { cleanContent: string; actions: ActionButton[] } {
  const actions: ActionButton[] = [];
  const cleanContent = content.replace(/```action\n([\s\S]*?)\n```/g, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.type === "navigate" && parsed.path && parsed.label) {
        actions.push(parsed);
      } else if (parsed.type === "click" && parsed.selector && parsed.label) {
        actions.push(parsed);
      } else if (parsed.type === "set_value" && parsed.selector && parsed.label) {
        actions.push(parsed);
      } else if (parsed.type === "set_slider" && parsed.selector && parsed.label) {
        actions.push(parsed);
      }
    } catch { /* ignore bad JSON */ }
    return "";
  });
  return { cleanContent: cleanContent.trim(), actions };
}

const THINKING_PHRASES = [
  "Hmm, let me think…",
  "Processing invariants…",
  "Consulting my AMM brain…",
  "Crunching the math…",
  "One sec, thinking…",
];

/** Find an interactive element by selector text, CSS selector, or aria-label */
function findElement(selector: string): HTMLElement | null {
  // 1. Direct CSS selector
  try {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  } catch { /* invalid selector */ }

  // 2. By visible text content on clickable elements
  const clickable = document.querySelectorAll("button, a, [role='button'], [role='tab'], input[type='submit'], label");
  for (const c of clickable) {
    const text = (c as HTMLElement).textContent?.trim().toLowerCase() || "";
    if (text === selector.toLowerCase() || text.includes(selector.toLowerCase())) {
      return c as HTMLElement;
    }
  }

  // 3. Inputs/sliders by associated label text
  const labels = document.querySelectorAll("label");
  for (const label of labels) {
    const text = label.textContent?.trim().toLowerCase() || "";
    if (text.includes(selector.toLowerCase())) {
      const forId = label.getAttribute("for");
      if (forId) {
        const target = document.getElementById(forId);
        if (target) return target as HTMLElement;
      }
      // Check for nested input
      const nested = label.querySelector("input, select, textarea, [role='slider']");
      if (nested) return nested as HTMLElement;
    }
  }

  // 4. Inputs by placeholder
  const inputs = document.querySelectorAll<HTMLInputElement>("input, textarea");
  for (const inp of inputs) {
    if (inp.placeholder?.toLowerCase().includes(selector.toLowerCase())) return inp;
  }

  // 5. Aria-label
  try {
    return document.querySelector<HTMLElement>(`[aria-label="${selector}"]`) ||
           document.querySelector<HTMLElement>(`[aria-label*="${selector}" i]`);
  } catch { return null; }
}

function highlightElement(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  el.style.outline = "2px solid hsl(var(--primary))";
  el.style.outlineOffset = "2px";
  el.style.transition = "outline 0.2s ease";
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.outlineOffset = prevOffset;
  }, 1500);
}

/** Trigger React-compatible value change on an input */
function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AIChatPanel({ context }: AIChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  useEffect(() => {
    if (!isLoading) return;
    setThinkingPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    const t = setInterval(() => {
      setThinkingPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    }, 2500);
    return () => clearInterval(t);
  }, [isLoading]);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, context: context || undefined }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = resp.status === 429 || resp.status === 402
          ? await resp.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Oops, I tripped over a constant product formula! 😅 Try again?";
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
    }

    setIsLoading(false);
  };

  const handleAction = (action: ActionButton) => {
    if (action.type === "navigate") {
      navigate(action.path);
      showFeedback(`🧭 Navigating to ${action.path}`);
      return;
    }

    const el = findElement(action.selector);
    if (!el) {
      showFeedback(`⚠️ Couldn't find "${action.label}" on the page`);
      return;
    }

    highlightElement(el);

    if (action.type === "click") {
      setTimeout(() => el.click(), 300);
      showFeedback(`✅ Clicked "${action.label}"`);
    } else if (action.type === "set_value") {
      const inp = el.tagName === "INPUT" || el.tagName === "TEXTAREA"
        ? el as HTMLInputElement
        : el.querySelector("input, textarea") as HTMLInputElement | null;
      if (inp) {
        setTimeout(() => {
          setNativeValue(inp, action.value);
          inp.focus();
        }, 300);
        showFeedback(`✏️ Set "${action.label}" to ${action.value}`);
      } else {
        showFeedback(`⚠️ Couldn't find input for "${action.label}"`);
      }
    } else if (action.type === "set_slider") {
      const slider = el.tagName === "INPUT" && (el as HTMLInputElement).type === "range"
        ? el as HTMLInputElement
        : el.querySelector("input[type='range']") as HTMLInputElement | null;
      if (slider) {
        setTimeout(() => {
          setNativeValue(slider, String(action.value));
        }, 300);
        showFeedback(`🎚️ Set "${action.label}" to ${action.value}`);
      } else {
        // Try Radix slider - trigger pointer events
        const thumb = el.querySelector("[role='slider']") as HTMLElement | null;
        if (thumb) {
          // For Radix sliders, we click the track area at the proportional position
          setTimeout(() => el.click(), 300);
          showFeedback(`🎚️ Adjusted "${action.label}"`);
        } else {
          showFeedback(`⚠️ Couldn't find slider for "${action.label}"`);
        }
      }
    }
  };

  const quickActions = [
    { label: "🧭 What is this page?", msg: "What can I do on this page?" },
    { label: "👋 I'm new here", msg: "I'm new to AMMs. Where should I start?" },
    { label: "🧪 Show me labs", msg: "What labs are available and what do they do?" },
    { label: "🧹 Clear chat", msg: "__clear__" },
  ];

  const handleQuickAction = (msg: string) => {
    if (msg === "__clear__") {
      setMessages([]);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setInput(msg);
  };

  const actionIcon = (type: string) => {
    switch (type) {
      case "click": return <MousePointerClick className="w-2.5 h-2.5" />;
      case "set_value": return <FormInput className="w-2.5 h-2.5" />;
      case "set_slider": return <SlidersHorizontal className="w-2.5 h-2.5" />;
      default: return <ExternalLink className="w-2.5 h-2.5" />;
    }
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {/* Empty state */}
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-[10px] text-muted-foreground text-center py-4 space-y-3"
            >
              <motion.div
                animate={{ y: [0, -3, 0], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-primary" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-foreground font-medium text-xs">Hey, I'm Ammy! 👋</p>
                <p className="text-muted-foreground">I know this entire site inside out — ask me anything about AMMs, or let me show you around.</p>
              </div>
              <div className="flex flex-wrap gap-1 justify-center mt-2">
                {quickActions.map((qa, i) => (
                  <motion.button
                    key={qa.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    onClick={() => handleQuickAction(qa.msg)}
                    className="px-2 py-1 rounded-full bg-secondary border border-border text-[9px] text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                  >
                    {qa.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        {messages.map((msg, i) => {
          if (msg.role === "assistant") {
            const { cleanContent, actions } = extractActions(msg.content);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex gap-1.5"
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0"
                  whileHover={{ scale: 1.3, rotate: 15 }}
                >
                  <Bot className="w-2.5 h-2.5 text-primary" />
                </motion.div>
                <div className="max-w-[85%] space-y-1.5">
                  <div className="text-[10px] leading-relaxed px-2 py-1.5 rounded-lg rounded-tl-sm bg-secondary text-foreground">
                    <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_code]:text-[9px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:text-[9px] [&_pre]:bg-muted [&_pre]:p-1.5 [&_pre]:rounded [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[10px] [&_strong]:text-foreground [&_a]:text-primary">
                      <ReactMarkdown>{cleanContent}</ReactMarkdown>
                    </div>
                  </div>
                  {actions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-wrap gap-1"
                    >
                      {actions.map((action, j) => (
                        <motion.button
                          key={j}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleAction(action)}
                          className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-medium text-primary hover:bg-primary/20 transition-colors"
                        >
                          {actionIcon(action.type)}
                          {action.label}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          }
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex gap-1.5 justify-end"
            >
              <div className="text-[10px] leading-relaxed max-w-[85%] px-2 py-1.5 rounded-lg rounded-tr-sm bg-primary text-primary-foreground">
                {msg.content}
              </div>
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center mt-0.5 shrink-0">
                <User className="w-2.5 h-2.5 text-muted-foreground" />
              </div>
            </motion.div>
          );
        })}

        {/* Action feedback toast */}
        <AnimatePresence>
          {actionFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[9px] text-center text-muted-foreground bg-muted/50 rounded-md px-2 py-1"
            >
              {actionFeedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-1.5"
            >
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                <Bot className="w-2.5 h-2.5 text-primary" />
              </div>
              <div className="bg-secondary px-2.5 py-1.5 rounded-lg rounded-tl-sm flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(j => (
                    <motion.span
                      key={j}
                      className="w-1 h-1 rounded-full bg-primary/60"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                    />
                  ))}
                </div>
                <motion.span
                  key={thinkingPhrase}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[9px] text-muted-foreground italic"
                >
                  {thinkingPhrase}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-0 w-0" />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border shrink-0">
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Ammy anything…"
            className="flex-1 px-2 py-1.5 text-[10px] bg-secondary rounded-md border border-border min-w-0 focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
          />
          <motion.button
            onClick={send}
            disabled={!input.trim() || isLoading}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="px-2 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 transition-opacity"
          >
            <Send className="w-3 h-3" />
          </motion.button>
        </div>
      </div>
    </>
  );
}
