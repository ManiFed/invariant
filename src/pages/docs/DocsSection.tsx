import { useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ExternalLink, Search } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { documentationSections, type DocSubsection } from "@/lib/documentation-content";
import { useState } from "react";

// ── Interactive Widgets ──

function ILCalculator() {
  const [priceChange, setPriceChange] = useState(2);
  const colors = useChartColors();
  const r = priceChange;
  const il = (2 * Math.sqrt(r)) / (1 + r) - 1;
  const data = Array.from({ length: 50 }, (_, i) => {
    const ratio = 0.2 + (i / 49) * 4.8;
    return { ratio: +ratio.toFixed(2), il: +(((2 * Math.sqrt(ratio)) / (1 + ratio) - 1) * 100).toFixed(2) };
  });
  return (
    <div className="border border-border rounded-xl p-4 my-4 bg-secondary/30">
      <h5 className="text-xs font-bold text-foreground mb-3">Interactive: Impermanent Loss Calculator</h5>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-muted-foreground">Price ratio (P₁/P₀):</label>
        <input type="range" min={0.1} max={5} step={0.05} value={priceChange}
          onChange={(e) => setPriceChange(+e.target.value)} className="flex-1" />
        <span className="text-xs font-mono text-foreground w-12">{priceChange.toFixed(2)}x</span>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-destructive">{(il * 100).toFixed(2)}%</div>
          <div className="text-[10px] text-muted-foreground">Impermanent Loss</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-mono text-foreground">
            {priceChange >= 1 ? "+" : ""}{((priceChange - 1) * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Price Change</div>
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="ratio" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" unit="%" />
            <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
            <Area dataKey="il" stroke={colors.series[0]} fill={colors.series[0]} fillOpacity={0.15} name="IL %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SlippageExplorer() {
  const colors = useChartColors();
  const [reserves, setReserves] = useState(1000000);
  const data = Array.from({ length: 20 }, (_, i) => {
    const tradePct = (i + 1) * 0.5;
    const trade = (reserves * tradePct) / 100;
    const slip = (trade / (reserves + trade)) * 100;
    const stableSlip = Math.pow(tradePct / 100, 2) * 50 * 100;
    return { trade: `${tradePct}%`, cp: +slip.toFixed(3), stable: +Math.min(stableSlip, slip * 0.4).toFixed(3) };
  });
  return (
    <div className="border border-border rounded-xl p-4 my-4 bg-secondary/30">
      <h5 className="text-xs font-bold text-foreground mb-3">Interactive: Slippage Explorer</h5>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-muted-foreground">Pool reserves ($):</label>
        <input type="range" min={100000} max={10000000} step={100000} value={reserves}
          onChange={(e) => setReserves(+e.target.value)} className="flex-1" />
        <span className="text-xs font-mono text-foreground w-16">${(reserves / 1e6).toFixed(1)}M</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="trade" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" unit="%" />
            <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
            <Line dataKey="cp" stroke={colors.series[0]} name="Constant Product" strokeWidth={2} dot={false} />
            <Line dataKey="stable" stroke={colors.series[1]} name="StableSwap" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FeeBreakevenCalc() {
  const [feeRate, setFeeRate] = useState(0.3);
  const [vol, setVol] = useState(60);
  const volMult = vol < 40 ? 0.5 : vol < 80 ? 1 : 2;
  const dailyFees = 1000000 * (feeRate / 100) * volMult * 0.01;
  const breakEven = ((feeRate / 100) * 365 * 100) / volMult;
  const profitable = vol > breakEven;
  return (
    <div className="border border-border rounded-xl p-4 my-4 bg-secondary/30">
      <h5 className="text-xs font-bold text-foreground mb-3">Interactive: Fee Break-even Calculator</h5>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-muted-foreground">Fee Rate</label>
          <div className="flex items-center gap-2">
            <input type="range" min={0.01} max={1} step={0.01} value={feeRate}
              onChange={(e) => setFeeRate(+e.target.value)} className="flex-1" />
            <span className="text-xs font-mono w-12">{feeRate.toFixed(2)}%</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Volatility (ann.)</label>
          <div className="flex items-center gap-2">
            <input type="range" min={10} max={200} step={5} value={vol}
              onChange={(e) => setVol(+e.target.value)} className="flex-1" />
            <span className="text-xs font-mono w-12">{vol}%</span>
          </div>
        </div>
      </div>
      <div className="flex gap-4 text-center">
        <div>
          <div className="text-sm font-bold text-foreground">${dailyFees.toFixed(0)}</div>
          <div className="text-[10px] text-muted-foreground">Est. Daily Fees ($1M pool)</div>
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">{breakEven.toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground">Break-even Vol</div>
        </div>
        <div>
          <div className={`text-sm font-bold ${profitable ? "text-green-500" : "text-destructive"}`}>
            {profitable ? "✓ Profitable" : "✗ Unprofitable"}
          </div>
          <div className="text-[10px] text-muted-foreground">At {vol}% vol</div>
        </div>
      </div>
    </div>
  );
}

function InteractiveWidget({ type }: { type: string }) {
  switch (type) {
    case "il-calculator": return <ILCalculator />;
    case "slippage-explorer": return <SlippageExplorer />;
    case "fee-breakeven": return <FeeBreakevenCalc />;
    default: return null;
  }
}

function CrossLinks({ links }: { links: { label: string; anchor: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {links.map((l) => (
        <Link
          key={l.anchor}
          to={`/docs/math-reference#${l.anchor}`}
          className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" /> {l.label}
        </Link>
      ))}
    </div>
  );
}

function renderContent(content: string) {
  return content.split("\n\n").map((paragraph, j) => {
    if (paragraph.startsWith("**") && paragraph.endsWith("**") && !paragraph.includes("\n")) {
      return <h4 key={j} className="text-xs font-bold text-foreground mt-5 mb-1.5">{paragraph.replace(/\*\*/g, "")}</h4>;
    }
    if (paragraph.startsWith("    ")) {
      return <pre key={j} className="bg-secondary border border-border rounded-lg px-4 py-3 my-3 text-[11px] font-mono text-foreground overflow-x-auto">{paragraph.trim()}</pre>;
    }
    if (paragraph.startsWith("|")) {
      const rows = paragraph.split("\n").filter((r) => !r.startsWith("|---"));
      const headers = rows[0]?.split("|").filter(Boolean).map((h) => h.trim());
      const bodyRows = rows.slice(1);
      return (
        <div key={j} className="overflow-x-auto my-3">
          <table className="w-full text-[11px] border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-secondary">
                {headers?.map((h, hi) => (
                  <th key={hi} className="text-left py-1.5 px-2.5 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.split("|").filter(Boolean).map((cell, ci) => (
                    <td key={ci} className="py-1.5 px-2.5 font-mono text-foreground">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // Inline formatting
    const parts = paragraph.split(/(\*\*[^*]+\*\*|\`[^`]+\`)/g);
    return (
      <p key={j} className="text-xs text-muted-foreground leading-relaxed mb-3">
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={pi} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={pi} className="px-1 py-0.5 rounded bg-secondary text-foreground text-[10px] font-mono">{part.slice(1, -1)}</code>;
          return <span key={pi}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function DocsSection() {
  const { sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const sectionIndex = documentationSections.findIndex((s) => s.id === sectionId);
  const section = documentationSections[sectionIndex];
  const prevSection = sectionIndex > 0 ? documentationSections[sectionIndex - 1] : null;
  const nextSection = sectionIndex < documentationSections.length - 1 ? documentationSections[sectionIndex + 1] : null;

  // Scroll to hash on mount
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  if (!section) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Section not found.</p>
        <button onClick={() => navigate("/docs")} className="mt-4 text-xs text-primary hover:underline">
          ← Back to Documentation
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-6">
          <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{section.title}</span>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-8 border-b border-border pb-3">
          {section.title}
        </h1>

        {/* Mobile search */}
        <div className="lg:hidden mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documentation..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Subsections */}
        <div className="space-y-10">
          {section.subsections.map((sub) => (
            <motion.section
              key={sub.id}
              id={sub.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.03 }}
            >
              <h3 className="text-sm font-bold text-foreground mb-2">{sub.title}</h3>
              {sub.tip && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mb-3 text-xs text-primary">
                  💡 {sub.tip}
                </div>
              )}
              <div className="prose-custom">{renderContent(sub.content)}</div>
              {sub.interactive && <InteractiveWidget type={sub.interactive} />}
              {sub.links && <CrossLinks links={sub.links} />}
            </motion.section>
          ))}
        </div>

        {/* Prev/Next navigation */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
          {prevSection ? (
            <Link
              to={`/docs/${prevSection.id}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <div>
                <div className="text-[9px] text-muted-foreground">Previous</div>
                <div className="font-medium text-foreground">{prevSection.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {nextSection ? (
            <Link
              to={`/docs/${nextSection.id}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group text-right"
            >
              <div>
                <div className="text-[9px] text-muted-foreground">Next</div>
                <div className="font-medium text-foreground">{nextSection.title}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </motion.div>
    </div>
  );
}
