import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Beaker, Play, Pause, RotateCcw, Info, TrendingDown, DollarSign, BarChart3, AlertTriangle, ChevronRight, ChevronLeft, HelpCircle, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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
  slippage: { title: "What is Slippage?", content: "Slippage is the difference between the expected price of a trade and the actual price. Larger trades relative to pool size cause more slippage because they move the price along the invariant curve more dramatically." },
  il: { title: "What is Impermanent Loss?", content: "Impermanent loss occurs when the price ratio of pooled tokens changes. LPs would have been better off holding the tokens outright. It's 'impermanent' because it reverses if prices return to the original ratio — but it becomes permanent if you withdraw." },
  dailyFees: { title: "Estimated Daily Fees", content: "Fee revenue depends on trading volume, fee tier, and volatility. Higher volatility typically means more arbitrage trades, which generates more fees — but also more impermanent loss." },
  maxDrawdown: { title: "Maximum Drawdown", content: "The worst-case percentage decline in your LP position value. Concentrated liquidity positions have higher max drawdown because all capital is exposed within a narrow range." },
  capitalEfficiency: { title: "Capital Efficiency", content: "How effectively your deposited capital is utilized for trading. A 4x capital efficiency means $25k of concentrated liquidity provides the same depth as $100k in a constant product pool." },
  breakEvenVol: { title: "Break-even Volatility", content: "The minimum annualized volatility needed for fee income to offset impermanent loss. If actual volatility exceeds this, your LP position is expected to be profitable." },
};

const BeginnerMode = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
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
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <Beaker className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Beginner Mode</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/10 text-success border border-success/20">GUIDED</span>
        </div>
        <div className="flex items-center gap-2">
          {currentStep === 2 && (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all"
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRunning ? "Pause" : "Simulate"}
            </button>
          )}
          <button onClick={() => { setCurrentStep(0); setIsRunning(false); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {steps.map((step, i) => (
            <div key={step.num} className="flex items-center flex-1">
              <button
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all w-full ${
                  i === currentStep
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : i < currentStep
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-secondary text-muted-foreground border border-transparent"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  i < currentStep ? "bg-success text-success-foreground" : i === currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

      <div className="flex flex-col lg:flex-row h-[calc(100vh-105px)]">
        {/* Sidebar — context-aware */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border p-5 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-6">
              {currentStep === 0 && (
                <>
                  <Section title="Step 1 — Choose Your AMM Template">
                    <p className="text-[11px] text-muted-foreground mb-3">Each template defines how tokens are priced relative to their reserves. Pick one to start exploring.</p>
                    <div className="space-y-2">
                      {templates.map(t => (
                        <div key={t.id}>
                          <button
                            onClick={() => setSelectedTemplate(t.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                              selectedTemplate === t.id ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{t.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{t.formula}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                          </button>
                          {selectedTemplate === t.id && (
                            <motion.button
                              onClick={() => setShowLearnMore(showLearnMore === t.id ? null : t.id)}
                              className="flex items-center gap-1 text-[10px] text-primary mt-1 ml-1 hover:underline"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            >
                              <HelpCircle className="w-3 h-3" />
                              {showLearnMore === t.id ? "Hide details" : "Learn more about this model"}
                            </motion.button>
                          )}
                          <AnimatePresence>
                            {showLearnMore === t.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 mt-1 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground leading-relaxed">
                                  {t.learnMore}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {currentStep === 1 && (
                <>
                  <Section title="Step 2 — Configure Your Pool">
                    <p className="text-[11px] text-muted-foreground mb-3">Set token prices, liquidity amount, volatility expectation, and fee tier.</p>
                    <div className="space-y-3">
                      <ParamInput label="Token A Price" value={tokenAPrice} onChange={setTokenAPrice} prefix="$" hint="The current market price of token A (e.g., ETH)" />
                      <ParamInput label="Token B Price" value={tokenBPrice} onChange={setTokenBPrice} prefix="$" hint="The current market price of token B (e.g., USDC)" />
                      <ParamInput label="Total Liquidity" value={liquidity} onChange={setLiquidity} prefix="$" hint="Total capital to deposit into the pool" />
                    </div>
                  </Section>

                  <Section title="Expected Volatility">
                    <p className="text-[11px] text-muted-foreground mb-2">How much do you expect prices to move?</p>
                    <div className="flex gap-2">
                      {volatilityLevels.map(v => (
                        <button key={v} onClick={() => setVolatility(v)}
                          className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                            volatility === v ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-secondary-foreground border border-transparent"
                          }`}
                        >{v}</button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Fee Tier">
                    <p className="text-[11px] text-muted-foreground mb-2">Higher fees earn more per trade but attract less volume.</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {feeTiers.map(f => (
                        <button key={f} onClick={() => setFeeTier(f)}
                          className={`py-2 rounded-md text-xs font-mono transition-all ${
                            feeTier === f ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-secondary-foreground border border-transparent"
                          }`}
                        >{f}</button>
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

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Review the charts and metrics on the right. Click on any <HelpCircle className="w-3 h-3 inline text-primary" /> icon to learn what each metric means.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex gap-2 pt-2">
                {canGoBack && (
                  <button onClick={() => setCurrentStep(s => s - 1)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                    <ChevronLeft className="w-3 h-3" /> Back
                  </button>
                )}
                {canProceed && (
                  <button onClick={() => setCurrentStep(s => s + 1)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all">
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metrics Row */}
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <MetricCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Est. Daily Fees" value={`$${dailyFees}`} color="primary" tipKey="dailyFees" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
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
              <AnimatePresence>
                {expandedTip === "slippage" && <ExpandedTip tipKey="slippage" />}
              </AnimatePresence>
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
                    <Tooltip contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 11 }} labelFormatter={v => `Trade: $${Number(v).toLocaleString()}`} formatter={(v: number) => [`${v}%`, "Slippage"]} />
                    <Area type="monotone" dataKey="slippage" stroke="hsl(185, 80%, 55%)" fill="url(#slippageGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">Impermanent Loss</h3>
                <TipToggle tipKey="il" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">Loss vs. holding across price ratios</p>
              <AnimatePresence>
                {expandedTip === "il" && <ExpandedTip tipKey="il" />}
              </AnimatePresence>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ilData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 16%)" />
                    <XAxis dataKey="priceRatio" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} label={{ value: "Price Ratio", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "hsl(215, 15%, 50%)" } }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(225, 20%, 9%)", border: "1px solid hsl(225, 15%, 16%)", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v}%`, "IL"]} />
                    <Line type="monotone" dataKey="il" stroke="hsl(0, 72%, 55%)" strokeWidth={2} dot={false} />
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
    primary: "text-primary bg-primary/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="surface-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[color]}`}>{icon}</div>
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <TipToggle tipKey={tipKey} expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
      </div>
      <span className="text-lg font-semibold font-mono-data text-foreground">{value}</span>
      <AnimatePresence>
        {expandedTip === tipKey && <ExpandedTip tipKey={tipKey} />}
      </AnimatePresence>
    </div>
  );
};

const TipToggle = ({ tipKey, expandedTip, setExpandedTip }: { tipKey: string; expandedTip: string | null; setExpandedTip: (v: string | null) => void }) => (
  <button
    onClick={() => setExpandedTip(expandedTip === tipKey ? null : tipKey)}
    className={`p-1 rounded transition-colors ${expandedTip === tipKey ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
  >
    <HelpCircle className="w-3 h-3" />
  </button>
);

const ExpandedTip = ({ tipKey }: { tipKey: string }) => {
  const tip = educationTips[tipKey];
  if (!tip) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-[10px] font-semibold text-primary mb-1">{tip.title}</p>
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
