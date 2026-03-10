import { useState } from "react";
import { Outlet, useNavigate, useParams, NavLink } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search, BookOpen } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { documentationSections } from "@/lib/documentation-content";

export default function DocsLayout() {
  const navigate = useNavigate();
  const { sectionId, subsectionId } = useParams();
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

  const activeSection = documentationSections.find((s) => s.id === sectionId);

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
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-80 border-r border-border/70 sticky top-14 h-[calc(100vh-56px)] flex-col bg-background/60">
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
            <nav className="space-y-1.5">
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

              <div className="px-2.5 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Chapters</p>
              </div>

              {filteredSections.map((section) => (
                <div key={section.id} className="rounded-lg">
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
                      to={`/docs/${section.id}/${section.subsections[0].id}`}
                      className={({ isActive }) =>
                        `flex-1 text-xs font-semibold py-1.5 transition-colors truncate ${
                          isActive || sectionId === section.id
                            ? "text-primary"
                            : "text-foreground hover:text-primary"
                        }`
                      }
                    >
                      {section.title}
                    </NavLink>
                  </div>
                  {expandedSections.has(section.id) && (
                    <div className="ml-6 space-y-0.5 mb-1 overflow-hidden transition-all duration-200 ease-out">
                      {section.subsections.map((sub) => (
                        <NavLink
                          key={sub.id}
                          to={`/docs/${section.id}/${sub.id}`}
                          className={({ isActive }) =>
                            `block rounded-md px-2 py-1 text-[11px] truncate transition-colors ${
                              isActive || subsectionId === sub.id
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                            }`
                          }
                        >
                          {sub.title}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {activeSection && (
                <div className="px-2.5 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    In this chapter
                  </p>
                  <div className="space-y-1">
                    {activeSection.subsections.map((sub) => (
                      <NavLink
                        key={sub.id}
                        to={`/docs/${activeSection.id}/${sub.id}`}
                        className={({ isActive }) =>
                          `block rounded-md px-2 py-1 text-[11px] transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`
                        }
                      >
                        {sub.title}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
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
