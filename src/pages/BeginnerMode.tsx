import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Beaker, Play, Pause, RotateCcw, Info, TrendingDown, DollarSign, BarChart3, AlertTriangle, ChevronRight, ChevronLeft, HelpCircle, CheckCircle2, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";

type Template = "constant_product" | "stable_swap" | "weighted" | "concentrated";

const templates: { id: Template; name: string; formula: string; desc: string; learnMore: string }[] = [
  { id: "constant_product", name: "Constant Product", formula: "x · y = k", desc: "Classic AMM model used by Uniswap V2", learnMore: "The constant product formula ensures that the product of token reserves always equals a constant k. When someone buys token A, they must deposit proportionally more token B. This creates a smooth price curve but distributes liquidity evenly across all prices, making it capital-inefficient." },
  { id: "stable_swap", name: "Stable Swap", formula: "x + y + α·xy = k", desc: "Optimized for correlated asset pairs", learnMore: "Stable swap curves concentrate liquidity around the 1:1 price ratio by combining constant sum and constant product formulas. This dramatically reduces slippage for pegged assets (like stablecoins) while maintaining solvency guarantees." },
  { id: "weighted", name: "Weighted Pool", formula: "x^w₁ · y^w₂ = k", desc: "Balancer-style weighted invariant", learnMore: "Weighted pools use asymmetric reserve ratios (e.g., 80/20) instead of the standard 50/50 split. The majority-weighted token experiences less impermanent loss, making this ideal for projects that want to maintain treasury exposure while still providing liquidity." },
  { id: "concentrated", name: "Concentrated Liquidity", formula: "√x · √y = √k", desc: "Capital-efficient range positions", learnMore: "Concentrated liquidity allows LPs to allocate capital within specific price ranges. This multiplies capital efficiency by 4x or more but introduces the risk of the position going out-of-range, at which point fees stop accruing and the LP holds 100% of the depreciating asset." },
];

const volatilityLevels = ["Low", "Medium", "High"] as const;
const feeTiers = ["0.01%", "0.05%", "0.30%", "1.00%"] as const;

const steps = [
  { num: 1, title: "Choose Template", desc: "Select an AMM model" },
  { num: 2, title: "Set Parameters", desc: "Configure your pool" },
  { num: 3, title: "Analyze Results", desc: "Review projections" },
];

const educationTips: Record<string, { title: string; content: string }> = {
  slippage: { title: "What is Slippage?", content: "Slippage is the difference between the expected price and the actual execution price. Larger trades relative to pool size cause more slippage because they move the price along the invariant curve more dramatically." },
  il: { title: "What is Impermanent Loss?", content: "Impermanent loss (IL) occurs when the price ratio of pooled tokens diverges from the entry ratio. The formula is: IL = 2√r/(1+r) − 1, where r is the price ratio change. It's 'impermanent' because it reverses if prices return to the original ratio." },
  dailyFees: { title: "Estimated Daily Fees", content: "Fee revenue depends on trading volume × fee tier. Higher volatility drives more arbitrage trades, generating more fees but also more impermanent loss. The estimate assumes volume proportional to volatility." },
  maxDrawdown: { title: "Maximum Drawdown", content: "The worst-case percentage decline in your LP position value. Concentrated liquidity positions have higher drawdown risk because all capital is exposed within a narrow price range." },
  capitalEfficiency: { title: "Capital Efficiency", content: "How effectively deposited capital is utilized for trading. Concentrated liquidity at 4.2x means $25k provides the same depth as $100k in a constant product pool within the active range." },
  breakEvenVol: { title: "Break-even Volatility", content: "The minimum annualized volatility needed for fee income to offset impermanent loss. Computed as (feeRate × 365) / volatilityMultiplier. If actual volatility exceeds this threshold, the LP position is expected to be net profitable." },
};

const BeginnerMode = () => {
  const navigate = useNavigate();
  const colors = useChartColors();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>("constant_product");
  const [tokenAPrice, setTokenAPrice] = useState(2000);
  const [tokenBPrice, setTokenBPrice] = useState(1);
  const [liquidity, setLiquidity] = useState(100000);
  const [volatility, setVolatility] = useState<typeof volatilityLevels[number]>("Medium");
  const [feeTier, setFeeTier] = useState<typeof feeTiers[number]>("0.30%");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [showLearnMore, setShowLearnMore] = useState<Template | null>(null);

  const volMultiplier = volatility === "Low" ? 0.5 : volatility === "Medium" ? 1 : 2;
  const feeRate = parseFloat(feeTier) / 100;

  // Slippage: For constant product, slippage ≈ Δx/(x+Δx) which simplifies to tradeSize/liquidity for small trades
  const slippageData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 20; i++) {
      const tradeSize = (i / 20) * liquidity * 0.1;
      const pct = tradeSize / liquidity;
      let slippage: number;
      switch (selectedTemplate) {
        case "constant_product": slippage = (pct / (1 - pct)) * 100; break; // exact: Δy/y_expected - 1
        case "stable_swap": slippage = pct * pct * 50; break; // quadratic — low near peg
        case "weighted": slippage = pct * 80; break;
        case "concentrated": slippage = pct * 40; break;
      }
      data.push({ tradeSize: Math.round(tradeSize), slippage: parseFloat(Math.min(slippage, 100).toFixed(3)) });
    }
    return data;
  }, [selectedTemplate, liquidity]);

  // Impermanent Loss: IL = 2√r/(1+r) − 1
  const ilData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 30; i++) {
      const priceRatio = 0.5 + (i / 30) * 1.5;
      const sqrtR = Math.sqrt(priceRatio);
      const baseIL = (2 * sqrtR / (1 + priceRatio) - 1) * -100;
      let il: number;
      switch (selectedTemplate) {
        case "constant_product": il = baseIL; break;
        case "stable_swap": il = baseIL * 0.3; break; // reduced IL for correlated assets
        case "weighted": il = baseIL * 0.7; break; // partial IL reduction from weighting
        case "concentrated": il = baseIL * 1.8; break; // amplified IL in range
      }
      data.push({ priceRatio: parseFloat(priceRatio.toFixed(2)), il: parseFloat(il.toFixed(2)) });
    }
    return data;
  }, [selectedTemplate]);

  // Break-even: annualized fee yield / IL sensitivity
  const breakEvenVol = (feeRate * 365 * 100 / volMultiplier).toFixed(1);
  // Daily fees: liquidity × feeRate × volumeMultiplier (vol-proportional)
  const dailyFees = (liquidity * feeRate * volMultiplier * 0.01).toFixed(0);
  // Max drawdown: base vol risk + concentrated premium
  const maxDrawdown = (volMultiplier * 8 + (selectedTemplate === "concentrated" ? 12 : 0)).toFixed(1);
  const capitalEfficiency = selectedTemplate === "concentrated" ? "4.2x" : selectedTemplate === "stable_swap" ? "3.1x" : selectedTemplate === "weighted" ? "1.5x" : "1.0x";

  const canProceed = currentStep < 2;
  const canGoBack = currentStep > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">BEGINNER MODE</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-success/30 text-success bg-success/5">GUIDED</span>
        </div>
        <div className="flex items-center gap-2">
          {currentStep === 2 && (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRunning ? "Pause" : "Simulate"}
            </button>
          )}
          <button onClick={() => { setCurrentStep(0); setIsRunning(false); setWizardComplete(false); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Step indicator — hidden when wizard complete */}
      {!wizardComplete && (
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentStep(i)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all w-full ${
                    i === currentStep ? "bg-primary/5 text-foreground border border-foreground/20"
                    : i < currentStep ? "bg-success/5 text-success border border-success/20"
                    : "bg-secondary text-muted-foreground border border-transparent"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i < currentStep ? "bg-success text-success-foreground" : i === currentStep ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentStep ? <CheckCircle2 className="w-3 h-3" /> : step.num}
                  </span>
                  <div className="text-left hidden sm:block">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-[10px] opacity-70">{step.desc}</p>
                  </div>
                </button>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row h-[calc(100vh-105px)]">
        {/* Sidebar — context-aware */}
        {!wizardComplete && (
          <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border p-5 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={currentStep} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-6">
                {currentStep === 0 && (
                  <Section title="Step 1 — Choose Your AMM Template">
                    <p className="text-[11px] text-muted-foreground mb-3">Each template defines how tokens are priced relative to their reserves.</p>
                    <div className="space-y-2">
                      {templates.map(t => (
                        <div key={t.id}>
                          <button onClick={() => setSelectedTemplate(t.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                              selectedTemplate === t.id ? "border-foreground/30 bg-foreground/5" : "border-border bg-card hover:border-foreground/10"
                            }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{t.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{t.formula}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                          </button>
                          {selectedTemplate === t.id && (
                            <motion.button onClick={() => setShowLearnMore(showLearnMore === t.id ? null : t.id)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 ml-1 hover:text-foreground transition-colors"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <HelpCircle className="w-3 h-3" />
                              {showLearnMore === t.id ? "Hide details" : "Learn more"}
                            </motion.button>
                          )}
                          <AnimatePresence>
                            {showLearnMore === t.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="p-3 mt-1 rounded-lg bg-secondary border border-border text-[11px] text-muted-foreground leading-relaxed">{t.learnMore}</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {currentStep === 1 && (
                  <>
                    <Section title="Step 2 — Configure Your Pool">
                      <p className="text-[11px] text-muted-foreground mb-3">Set token prices, liquidity, volatility, and fee tier.</p>
                      <div className="space-y-3">
                        <ParamInput label="Token A Price" value={tokenAPrice} onChange={setTokenAPrice} prefix="$" hint="e.g., ETH current price" />
                        <ParamInput label="Token B Price" value={tokenBPrice} onChange={setTokenBPrice} prefix="$" hint="e.g., USDC = $1" />
                        <ParamInput label="Total Liquidity" value={liquidity} onChange={setLiquidity} prefix="$" hint="Capital to deposit" />
                      </div>
                    </Section>
                    <Section title="Expected Volatility">
                      <div className="flex gap-2">
                        {volatilityLevels.map(v => (
                          <button key={v} onClick={() => setVolatility(v)}
                            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                              volatility === v ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
                            }`}>{v}</button>
                        ))}
                      </div>
                    </Section>
                    <Section title="Fee Tier">
                      <div className="grid grid-cols-4 gap-1.5">
                        {feeTiers.map(f => (
                          <button key={f} onClick={() => setFeeTier(f)}
                            className={`py-2 rounded-md text-xs font-mono transition-all ${
                              feeTier === f ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
                            }`}>{f}</button>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <Section title="Step 3 — Your Configuration">
                      <div className="space-y-2">
                        <ConfigRow label="Template" value={templates.find(t => t.id === selectedTemplate)?.name || ""} />
                        <ConfigRow label="Token A" value={`$${tokenAPrice.toLocaleString()}`} />
                        <ConfigRow label="Token B" value={`$${tokenBPrice}`} />
                        <ConfigRow label="Liquidity" value={`$${liquidity.toLocaleString()}`} />
                        <ConfigRow label="Volatility" value={volatility} />
                        <ConfigRow label="Fee Tier" value={feeTier} />
                      </div>
                    </Section>
                    <div className="p-3 rounded-lg bg-secondary border border-border">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Review the charts and metrics. Click any <HelpCircle className="w-3 h-3 inline" /> icon to learn what each metric means.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Navigation */}
                <div className="flex gap-2 pt-2">
                  {canGoBack && (
                    <button onClick={() => setCurrentStep(s => s - 1)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-foreground text-xs font-medium hover:bg-secondary transition-colors">
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                  {canProceed && (
                    <button onClick={() => setCurrentStep(s => s + 1)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                      Next <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {currentStep === 2 && (
                    <button onClick={() => setWizardComplete(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-6 space-y-6 ${wizardComplete ? "" : ""}`}>
          {/* Wizard complete banner */}
          {wizardComplete && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-sm text-foreground font-medium">Configuration complete — {templates.find(t => t.id === selectedTemplate)?.name} · ${liquidity.toLocaleString()} · {feeTier}</span>
              </div>
              <button onClick={() => { setWizardComplete(false); setCurrentStep(0); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Restart
              </button>
            </motion.div>
          )}

          {/* Metrics Row */}
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <MetricCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Est. Daily Fees" value={`$${dailyFees}`} color="success" tipKey="dailyFees" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<TrendingDown className="w-3.5 h-3.5" />} label="Max Drawdown" value={`${maxDrawdown}%`} color="destructive" tipKey="maxDrawdown" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<BarChart3 className="w-3.5 h-3.5" />} label="Capital Efficiency" value={capitalEfficiency} color="success" tipKey="capitalEfficiency" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Break-even Vol" value={`${breakEvenVol}%`} color="warning" tipKey="breakEvenVol" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
          </motion.div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">Slippage Curve</h3>
                <TipToggle tipKey="slippage" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">Price impact vs. trade size</p>
              <AnimatePresence>{expandedTip === "slippage" && <ExpandedTip tipKey="slippage" />}</AnimatePresence>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={slippageData}>
                    <defs>
                      <linearGradient id="slippageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.line} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="tradeSize" tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }} labelFormatter={v => `Trade: $${Number(v).toLocaleString()}`} formatter={(v: number) => [`${v}%`, "Slippage"]} />
                    <Area type="monotone" dataKey="slippage" stroke={colors.line} fill="url(#slippageGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">Impermanent Loss</h3>
                <TipToggle tipKey="il" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">IL = 2√r/(1+r) − 1</p>
              <AnimatePresence>{expandedTip === "il" && <ExpandedTip tipKey="il" />}</AnimatePresence>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ilData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="priceRatio" tick={{ fontSize: 10, fill: colors.tick }} label={{ value: "Price Ratio", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: colors.tick } }} />
                    <YAxis tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v}%`, "IL"]} />
                    <Line type="monotone" dataKey="il" stroke={colors.red} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Risk Dashboard */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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

/* ─── Sub-components ─── */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h4>
    {children}
  </div>
);

const ParamInput = ({ label, value, onChange, prefix, hint }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; hint?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    <div className="flex items-center gap-1 rounded-md bg-secondary border border-border px-3 py-2">
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="bg-transparent text-sm font-mono text-foreground w-full outline-none" />
    </div>
    {hint && <p className="text-[10px] text-muted-foreground mt-1 opacity-70">{hint}</p>}
  </div>
);

const ConfigRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-[11px] font-mono-data font-medium text-foreground">{value}</span>
  </div>
);

const MetricCard = ({ icon, label, value, color, tipKey, expandedTip, setExpandedTip }: {
  icon: React.ReactNode; label: string; value: string; color: string;
  tipKey: string; expandedTip: string | null; setExpandedTip: (v: string | null) => void;
}) => {
  const colorMap: Record<string, string> = {
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="surface-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[color] || "text-foreground bg-secondary"}`}>{icon}</div>
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <TipToggle tipKey={tipKey} expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
      </div>
      <span className="text-lg font-semibold font-mono-data text-foreground">{value}</span>
      <AnimatePresence>{expandedTip === tipKey && <ExpandedTip tipKey={tipKey} />}</AnimatePresence>
    </div>
  );
};

const TipToggle = ({ tipKey, expandedTip, setExpandedTip }: { tipKey: string; expandedTip: string | null; setExpandedTip: (v: string | null) => void }) => (
  <button onClick={() => setExpandedTip(expandedTip === tipKey ? null : tipKey)}
    className={`p-1 rounded transition-colors ${expandedTip === tipKey ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
    <HelpCircle className="w-3 h-3" />
  </button>
);

const ExpandedTip = ({ tipKey }: { tipKey: string }) => {
  const tip = educationTips[tipKey];
  if (!tip) return null;
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-2 p-2.5 rounded-lg bg-secondary border border-border">
        <p className="text-[10px] font-semibold text-foreground mb-1">{tip.title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{tip.content}</p>
      </div>
    </motion.div>
  );
};

const RiskMetric = ({ label, value, level }: { label: string; value: string; level: "low" | "medium" | "high" }) => {
  const levelColors = { low: "text-success", medium: "text-warning", high: "text-destructive" };
  const barWidths = { low: "w-1/3", medium: "w-2/3", high: "w-full" };
  const barColors = { low: "bg-success", medium: "bg-warning", high: "bg-destructive" };
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
