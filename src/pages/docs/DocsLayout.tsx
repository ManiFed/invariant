import { useState } from "react";
import { Outlet, useNavigate, useParams, NavLink } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search, BookOpen } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { documentationSections } from "@/lib/documentation-content";

export default function DocsLayout() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(documentationSections.map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredSections = searchQuery.trim()
    ? documentationSections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.subsections.some(
            (sub) =>
              sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              sub.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : documentationSections;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">Invariant Docs</span>
          </div>

          <div className="hidden md:block w-full max-w-lg px-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/40 pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <ThemeToggle />
        </div>

        <div className="border-t border-border/70 px-4 sm:px-6">
          <div className="flex overflow-x-auto scrollbar-none gap-5 py-2 text-sm">
            <NavLink
              to="/docs"
              end
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 pb-2 transition-colors ${
                  isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              Welcome
            </NavLink>
            {documentationSections.map((section) => (
              <NavLink
                key={section.id}
                to={`/docs/${section.id}`}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 pb-2 transition-colors ${
                    isActive || sectionId === section.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {section.title}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-80 border-r border-border/70 sticky top-[89px] h-[calc(100vh-89px)] flex-col bg-background/60">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            <nav className="space-y-1">
              <NavLink
                to="/docs"
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 text-xs font-semibold py-2 px-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:text-primary hover:bg-secondary/70"
                  }`
                }
              >
                Overview
              </NavLink>

              {filteredSections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight
                        className={`w-3 h-3 transition-transform ${
                          expandedSections.has(section.id) ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    <NavLink
                      to={`/docs/${section.id}`}
                      className={({ isActive }) =>
                        `flex-1 text-xs font-semibold py-1.5 transition-colors truncate ${
                          isActive
                            ? "text-primary"
                            : "text-foreground hover:text-primary"
                        }`
                      }
                    >
                      {section.title}
                    </NavLink>
                  </div>
                  {expandedSections.has(section.id) && (
                    <div className="ml-6 space-y-0.5 mb-1">
                      {section.subsections.map((sub) => (
                        <NavLink
                          key={sub.id}
                          to={`/docs/${section.id}#${sub.id}`}
                          className="block text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5 truncate"
                        >
                          {sub.title}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
