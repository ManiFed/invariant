import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, FileText } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { documentationSections, type DocSection } from "@/lib/documentation-content";

const Documentation = () => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(documentationSections.map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 bg-background z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">DOCUMENTATION</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-72 border-r border-border sticky top-[49px] h-[calc(100vh-49px)]">
          <ScrollArea className="h-full p-5">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Contents</h4>
            <nav className="space-y-1">
              {documentationSections.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-foreground hover:text-primary transition-colors py-1.5"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform shrink-0 ${
                        expandedSections.has(section.id) ? "rotate-90" : ""
                      }`}
                    />
                    <a href={`#${section.id}`} onClick={(e) => e.stopPropagation()} className="truncate">
                      {section.title}
                    </a>
                  </button>
                  {expandedSections.has(section.id) && (
                    <div className="ml-4 space-y-0.5 mb-1">
                      {section.subsections.map((sub) => (
                        <a
                          key={sub.id}
                          href={`#${sub.id}`}
                          className="block text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5 truncate"
                        >
                          {sub.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto px-8 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-foreground mb-2">Platform Documentation</h1>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              Complete reference for Invariant Studio — features, workflows, and mathematical models.
            </p>
          </motion.div>

          <div className="space-y-16">
            {documentationSections.map((section) => (
              <div key={section.id} id={section.id}>
                <motion.h2
                  className="text-2xl font-bold text-foreground mb-6 border-b border-border pb-3"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  {section.title}
                </motion.h2>

                <div className="space-y-10">
                  {section.subsections.map((sub) => (
                    <motion.section
                      key={sub.id}
                      id={sub.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.05 }}
                    >
                      <h3 className="text-base font-semibold text-foreground mb-3">{sub.title}</h3>
                      <div className="prose-custom">
                        {renderContent(sub.content)}
                      </div>
                    </motion.section>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
            Invariant Studio — Platform Documentation v2.0
          </footer>
        </main>
      </div>
    </div>
  );
};

function renderContent(content: string) {
  return content.split("\n\n").map((paragraph, j) => {
    // Subheading (bold-only line)
    if (paragraph.startsWith("**") && paragraph.endsWith("**") && !paragraph.includes("\n")) {
      return (
        <h4 key={j} className="text-sm font-semibold text-foreground mt-6 mb-2">
          {paragraph.replace(/\*\*/g, "")}
        </h4>
      );
    }
    // Code block
    if (paragraph.startsWith("    ")) {
      return (
        <pre
          key={j}
          className="bg-secondary border border-border rounded-lg px-4 py-3 my-3 text-xs font-mono text-foreground overflow-x-auto"
        >
          {paragraph.trim()}
        </pre>
      );
    }
    // Table
    if (paragraph.startsWith("|")) {
      const rows = paragraph.split("\n").filter((r) => !r.startsWith("|---"));
      const headers = rows[0]?.split("|").filter(Boolean).map((h) => h.trim());
      const bodyRows = rows.slice(1);
      return (
        <table key={j} className="w-full text-xs my-3 border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-secondary">
              {headers?.map((h, hi) => (
                <th key={hi} className="text-left py-2 px-3 text-muted-foreground font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} className="border-t border-border">
                {row
                  .split("|")
                  .filter(Boolean)
                  .map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 font-mono text-foreground">
                      {cell.trim()}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // List block
    if (paragraph.startsWith("- ") || paragraph.startsWith("1. ")) {
      const items = paragraph.split("\n");
      return (
        <ul key={j} className="space-y-1 my-2">
          {items.map((item, k) => (
            <li key={k} className="text-sm text-muted-foreground leading-relaxed pl-1">
              {renderInlineBold(item)}
            </li>
          ))}
        </ul>
      );
    }
    // Regular paragraph with inline bold
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={j} className="text-sm text-muted-foreground leading-relaxed mb-3">
        {parts.map((part, k) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={k} className="text-foreground font-semibold">
              {part.replace(/\*\*/g, "")}
            </strong>
          ) : (
            <span key={k}>{part}</span>
          )
        )}
      </p>
    );
  });
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, k) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={k} className="text-foreground font-semibold">
        {part.replace(/\*\*/g, "")}
      </strong>
    ) : (
      <span key={k}>{part}</span>
    )
  );
}

export default Documentation;
