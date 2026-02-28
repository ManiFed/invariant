import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  context?: string;
}

const CHAT_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "") + "/api/ai/chat";
const STORAGE_KEY = "ai_chat_messages";

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {return [];}
}

function saveMessages(msgs: Message[]) {
  try {sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)));} catch { /* ignore storage errors */ }
}

export default function AIChatPanel({ context }: AIChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

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
        },
        body: JSON.stringify({ messages: allMessages, context: context || undefined })
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Failed to get response");
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
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Make sure the AI assistant is set up." }]);
    }

    setIsLoading(false);
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {messages.length === 0 &&
        <div className="text-[10px] text-muted-foreground text-center py-4 space-y-1">
            
            <Bot className="w-5 h-5 mx-auto text-muted-foreground/50" />
            <p>hi, i'm ammy! i'm here to answer any questions you might have about AMMs!</p>
            <p className="text-[9px]">Try: "What is slippage?" or "How do fees work?"</p>
          </div>
        }
        {messages.map((msg, i) =>
        <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && <Bot className="w-3 h-3 text-primary mt-1 shrink-0" />}
            <div className={`text-[10px] leading-relaxed max-w-[85%] px-2 py-1.5 rounded-lg ${
          msg.role === "user" ?
          "bg-primary text-primary-foreground" :
          "bg-secondary text-foreground"}`
          }>
              {msg.role === "assistant" ?
            <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0 [&_code]:text-[9px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:text-[9px] [&_pre]:bg-muted [&_pre]:p-1.5 [&_pre]:rounded [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[10px] [&_strong]:text-foreground [&_a]:text-primary">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div> :
            msg.content}
            </div>
            {msg.role === "user" && <User className="w-3 h-3 text-muted-foreground mt-1 shrink-0" />}
          </div>
        )}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" &&
        <div className="flex gap-1.5">
            <Bot className="w-3 h-3 text-primary mt-1 shrink-0" />
            <div className="bg-secondary px-2 py-1.5 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          </div>
        }
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Ammy about AMMs..."
            className="flex-1 px-2 py-1.5 text-[10px] bg-secondary rounded-md border border-border min-w-0 focus:outline-none focus:ring-1 focus:ring-primary" />

          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="px-2 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity">

            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}