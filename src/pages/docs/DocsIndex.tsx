import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GraduationCap, Gauge, Wrench, Puzzle, FlaskConical,
  Library, Calculator, AlertTriangle, Compass, Rocket
} from "lucide-react";
import { documentationSections } from "@/lib/documentation-content";

const SECTION_ICONS: Record<string, React.ElementType> = {
  about: Compass,
  "getting-started": Rocket,
  "teaching-lab": GraduationCap,
  "beginner-mode": Gauge,
  "advanced-mode": Wrench,
  "design-studio": Puzzle,
  labs: FlaskConical,
  library: Library,
  "math-reference": Calculator,
  limitations: AlertTriangle,
};

const SECTION_COLORS: Record<string, string> = {
  about: "text-primary",
  "getting-started": "text-chart-2",
  "teaching-lab": "text-chart-3",
  "beginner-mode": "text-chart-4",
  "advanced-mode": "text-chart-5",
  "design-studio": "text-chart-1",
  labs: "text-warning",
  library: "text-primary",
  "math-reference": "text-chart-2",
  limitations: "text-destructive",
};

export default function DocsIndex() {
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Platform Documentation
        </h1>
        <p className="text-base text-muted-foreground mb-10 max-w-2xl">
          Comprehensive reference for every feature, formula, and tool in
          Invariant Studio. Select a section below to dive in.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentationSections.map((section, i) => {
            const Icon = SECTION_ICONS[section.id] || Compass;
            const colorClass = SECTION_COLORS[section.id] || "text-primary";
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/docs/${section.id}/${section.subsections[0]?.id}`}
                  className="block p-5 rounded-2xl border border-border hover:border-primary/40 bg-card hover:bg-secondary/40 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${colorClass}`} />
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {section.title}
                    </h3>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {section.subsections.length} sections ·{" "}
                    {section.subsections
                      .slice(0, 3)
                      .map((s) => s.title)
                      .join(", ")}
                    {section.subsections.length > 3 ? "…" : ""}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          Invariant Studio — Platform Documentation v4.0 —{" "}
          {documentationSections.reduce((n, s) => n + s.subsections.length, 0)}{" "}
          sections across {documentationSections.length} chapters
        </footer>
      </motion.div>
    </div>
  );
}
