import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bot, User, Loader2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ActionButton {
  type: "navigate";
  path: string;
  label: string;
}

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

/** Extract action blocks from message content */
function extractActions(content: string): { cleanContent: string; actions: ActionButton[] } {
  const actions: ActionButton[] = [];
  const cleanContent = content.replace(/```action\n([\s\S]*?)\n```/g, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.type === "navigate" && parsed.path && parsed.label) {
        actions.push(parsed);
      }
    } catch { /* ignore bad JSON */ }
    return "";
  });
  return { cleanContent: cleanContent.trim(), actions };
}

export default function AIChatPanel({ context }: AIChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [messages]);

  useEffect(() => { saveMessages(messages); }, [messages]);

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
      const errMsg = e instanceof Error ? e.message : "Sorry, I couldn't connect.";
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
    }

    setIsLoading(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const quickActions = [
    { label: "What is this page?", msg: "What can I do on this page?" },
    { label: "I'm new here", msg: "I'm new to AMMs. Where should I start?" },
    { label: "Show me labs", msg: "What labs are available and what do they do?" },
  ];

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center py-3 space-y-2">
            <Bot className="w-5 h-5 mx-auto text-muted-foreground/50" />
            <p>Hi! I'm <strong>Ammy</strong> 👋 I know this entire site and can help you navigate, explain concepts, or find the right tool.</p>
            <div className="flex flex-wrap gap-1 justify-center mt-2">
              {quickActions.map(qa => (
                <button key={qa.label} onClick={() => { setInput(qa.msg); }}
                  className="px-2 py-1 rounded-md bg-secondary border border-border text-[9px] text-foreground hover:bg-primary/10 transition-colors">
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "assistant") {
            const { cleanContent, actions } = extractActions(msg.content);
            return (
              <div key={i} className="flex gap-1.5">
                <Bot className="w-3 h-3 text-primary mt-1 shrink-0" />
                <div className="max-w-[85%] space-y-1.5">
                  <div className="text-[10px] leading-relaxed px-2 py-1.5 rounded-lg bg-secondary text-foreground">
                    <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_code]:text-[9px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:text-[9px] [&_pre]:bg-muted [&_pre]:p-1.5 [&_pre]:rounded [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[10px] [&_strong]:text-foreground [&_a]:text-primary">
                      <ReactMarkdown>{cleanContent}</ReactMarkdown>
                    </div>
                  </div>
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {actions.map((action, j) => (
                        <button key={j} onClick={() => handleNavigate(action.path)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-medium text-primary hover:bg-primary/20 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-1.5 justify-end">
              <div className="text-[10px] leading-relaxed max-w-[85%] px-2 py-1.5 rounded-lg bg-primary text-primary-foreground">
                {msg.content}
              </div>
              <User className="w-3 h-3 text-muted-foreground mt-1 shrink-0" />
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-1.5">
            <Bot className="w-3 h-3 text-primary mt-1 shrink-0" />
            <div className="bg-secondary px-2 py-1.5 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Ammy anything..."
            className="flex-1 px-2 py-1.5 text-[10px] bg-secondary rounded-md border border-border min-w-0 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="px-2 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}
