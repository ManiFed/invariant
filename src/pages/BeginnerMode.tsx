import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Beaker, Play, Pause, RotateCcw, Info, TrendingDown, DollarSign, BarChart3, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type Template = "constant_product" | "stable_swap" | "weighted" | "concentrated";

const templates: { id: Template; name: string; formula: string; desc: string }[] = [
  { id: "constant_product", name: "Constant Product", formula: "x · y = k", desc: "Classic AMM model used by Uniswap V2" },
  { id: "stable_swap", name: "Stable Swap", formula: "x + y + α·xy = k", desc: "Optimized for correlated asset pairs" },
  { id: "weighted", name: "Weighted Pool", formula: "x^w₁ · y^w₂ = k", desc: "Balancer-style weighted invariant" },
  { id: "concentrated", name: "Concentrated Liquidity", formula: "√x · √y = √k", desc: "Capital-efficient range positions" },
];

const volatilityLevels = ["Low", "Medium", "High"] as const;
const feeTiers = ["0.01%", "0.05%", "0.30%", "1.00%"] as const;

const BeginnerMode = () => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<Template>("constant_product");
  const [tokenAPrice, setTokenAPrice] = useState(2000);
  const [tokenBPrice, setTokenBPrice] = useState(1);
  const [liquidity, setLiquidity] = useState(100000);
  const [volatility, setVolatility] = useState<typeof volatilityLevels[number]>("Medium");
  const [feeTier, setFeeTier] = useState<typeof feeTiers[number]>("0.30%");
  const [isRunning, setIsRunning] = useState(false);

  const volMultiplier = volatility === "Low" ? 0.5 : volatility === "Medium" ? 1 : 2;
  const feeRate = parseFloat(feeTier) / 100;

  // Generate simulation data
  const slippageData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 20; i++) {
      const tradeSize = (i / 20) * liquidity * 0.1;
      const pct = tradeSize / liquidity;
      let slippage: number;
      switch (selectedTemplate) {
        case "constant_product": slippage = pct * 100; break;
        case "stable_swap": slippage = pct * 20; break;
        case "weighted": slippage = pct * 80; break;
        case "concentrated": slippage = pct * 40; break;
      }
      data.push({ tradeSize: Math.round(tradeSize), slippage: parseFloat(slippage.toFixed(3)) });
    }
    return data;
  }, [selectedTemplate, liquidity]);

  const ilData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 30; i++) {
      const priceRatio = 0.5 + (i / 30) * 1.5;
      let il: number;
      switch (selectedTemplate) {
        case "constant_product": il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * -100; break;
        case "stable_swap": il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * -30; break;
        case "weighted": il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * -70; break;
        case "concentrated": il = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * -180; break;
      }
      data.push({ priceRatio: parseFloat(priceRatio.toFixed(2)), il: parseFloat(il.toFixed(2)) });
    }
    return data;
  }, [selectedTemplate]);

  const breakEvenVol = (feeRate * 365 * 100 / volMultiplier).toFixed(1);
  const dailyFees = (liquidity * feeRate * volMultiplier * 0.01).toFixed(0);
  const maxDrawdown = (volMultiplier * 8 + (selectedTemplate === "concentrated" ? 12 : 0)).toFixed(1);
  const capitalEfficiency = selectedTemplate === "concentrated" ? "4.2x" : selectedTemplate === "stable_swap" ? "3.1x" : selectedTemplate === "weighted" ? "1.5x" : "1.0x";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <Beaker className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Beginner Mode</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/10 text-success border border-success/20">GUIDED</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all"
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isRunning ? "Pause" : "Simulate"}
          </button>
          <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-49px)]">
        {/* Sidebar — Parameters */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border p-5 overflow-y-auto">
          <div className="space-y-6">
            {/* Template Selection */}
            <Section title="AMM Template">
              <div className="space-y-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                      selectedTemplate === t.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{t.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{t.formula}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            {/* Parameters */}
            <Section title="Parameters">
              <div className="space-y-3">
                <ParamInput label="Token A Price" value={tokenAPrice} onChange={setTokenAPrice} prefix="$" />
                <ParamInput label="Token B Price" value={tokenBPrice} onChange={setTokenBPrice} prefix="$" />
                <ParamInput label="Total Liquidity" value={liquidity} onChange={setLiquidity} prefix="$" />
              </div>
            </Section>

            {/* Volatility */}
            <Section title="Expected Volatility">
              <div className="flex gap-2">
                {volatilityLevels.map(v => (
                  <button
                    key={v}
                    onClick={() => setVolatility(v)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                      volatility === v
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary text-secondary-foreground border border-transparent"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Section>

            {/* Fee Tier */}
            <Section title="Fee Tier">
              <div className="grid grid-cols-4 gap-1.5">
                {feeTiers.map(f => (
                  <button
                    key={f}
                    onClick={() => setFeeTier(f)}
                    className={`py-2 rounded-md text-xs font-mono transition-all ${
                      feeTier === f
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary text-secondary-foreground border border-transparent"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Section>

            {/* Education tip */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {selectedTemplate === "constant_product" && "Constant product pools distribute liquidity evenly across all prices. Simple but capital-inefficient."}
                  {selectedTemplate === "stable_swap" && "Stable swap concentrates liquidity around the 1:1 price ratio, ideal for pegged assets."}
                  {selectedTemplate === "weighted" && "Weighted pools allow unequal token ratios, reducing impermanent loss for the majority token."}
                  {selectedTemplate === "concentrated" && "Concentrated liquidity focuses capital in a range, increasing efficiency but also risk if price exits the range."}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metrics Row */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <MetricCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Est. Daily Fees" value={`$${dailyFees}`} color="primary" />
            <MetricCard icon={<TrendingDown className="w-3.5 h-3.5" />} label="Max Drawdown" value={`${maxDrawdown}%`} color="destructive" />
            <MetricCard icon={<BarChart3 className="w-3.5 h-3.5" />} label="Capital Efficiency" value={capitalEfficiency} color="success" />
            <MetricCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Break-even Vol" value={`${breakEvenVol}%`} color="warning" />
          </motion.div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div
              className="surface-elevated rounded-xl p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">Slippage Curve</h3>
              <p className="text-[11px] text-muted-foreground mb-4">Price impact vs. trade size</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={slippageData}>
                    <defs>
                      <linearGradient id="slippageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(185, 80%, 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(185, 80%, 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" />
                    <XAxis dataKey="tradeSize" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 11 }}
                      labelFormatter={v => `Trade: $${Number(v).toLocaleString()}`}
                      formatter={(v: number) => [`${v}%`, "Slippage"]}
                    />
                    <Area type="monotone" dataKey="slippage" stroke="hsl(185, 80%, 55%)" fill="url(#slippageGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              className="surface-elevated rounded-xl p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-1">Impermanent Loss</h3>
              <p className="text-[11px] text-muted-foreground mb-4">Loss vs. holding across price ratios</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ilData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" />
                    <XAxis dataKey="priceRatio" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} label={{ value: "Price Ratio", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "hsl(215, 15%, 50%)" } }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => [`${v}%`, "IL"]}
                    />
                    <Line type="monotone" dataKey="il" stroke="hsl(0, 72%, 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Risk Dashboard */}
          <motion.div
            className="surface-elevated rounded-xl p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Risk Dashboard</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RiskMetric label="Downside Deviation" value={`${(volMultiplier * 4.2).toFixed(1)}%`} level={volMultiplier > 1.5 ? "high" : volMultiplier > 0.8 ? "medium" : "low"} />
              <RiskMetric label="Inventory Imbalance" value={selectedTemplate === "weighted" ? "Low" : "Medium"} level={selectedTemplate === "weighted" ? "low" : "medium"} />
              <RiskMetric label="Volatility Sensitivity" value={selectedTemplate === "concentrated" ? "High" : "Medium"} level={selectedTemplate === "concentrated" ? "high" : "medium"} />
              <RiskMetric label="Rebalance Frequency" value={selectedTemplate === "concentrated" ? "High" : "Low"} level={selectedTemplate === "concentrated" ? "high" : "low"} />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h4>
    {children}
  </div>
);

const ParamInput = ({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    <div className="flex items-center gap-1 rounded-md bg-secondary border border-border px-3 py-2">
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="bg-transparent text-sm font-mono text-foreground w-full outline-none"
      />
    </div>
  </div>
);

const MetricCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) => {
  const colorMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="surface-elevated rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[color]}`}>{icon}</div>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold font-mono-data text-foreground">{value}</span>
    </div>
  );
};

const RiskMetric = ({ label, value, level }: { label: string; value: string; level: "low" | "medium" | "high" }) => {
  const levelColors = {
    low: "text-success",
    medium: "text-warning",
    high: "text-destructive",
  };
  const barWidths = { low: "w-1/3", medium: "w-2/3", high: "w-full" };
  const barColors = {
    low: "bg-success",
    medium: "bg-warning",
    high: "bg-destructive",
  };
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold font-mono-data ${levelColors[level]}`}>{value}</p>
      <div className="mt-2 h-1 rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barColors[level]} ${barWidths[level]}`} />
      </div>
    </div>
  );
};

export default BeginnerMode;
