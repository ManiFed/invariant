import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Beaker, Play, Pause, RotateCcw, Info, TrendingDown, DollarSign, BarChart3, AlertTriangle, ChevronRight, ChevronLeft, HelpCircle, CheckCircle2, X, Zap, ArrowRightLeft, Sparkles, Target, Droplets } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";

type Template = "constant_product" | "stable_swap" | "weighted" | "concentrated";

const templates: { id: Template; name: string; formula: string; desc: string; learnMore: string; emoji: string }[] = [
  { id: "constant_product", name: "Constant Product", formula: "x · y = k", desc: "Classic AMM model used by Uniswap V2", emoji: "⚖️", learnMore: "The constant product formula ensures that the product of token reserves always equals a constant k. When someone buys token A, they must deposit proportionally more token B. This creates a smooth price curve but distributes liquidity evenly across all prices, making it capital-inefficient." },
  { id: "stable_swap", name: "Stable Swap", formula: "x + y + α·xy = k", desc: "Optimized for correlated asset pairs", emoji: "🔗", learnMore: "Stable swap curves concentrate liquidity around the 1:1 price ratio by combining constant sum and constant product formulas. This dramatically reduces slippage for pegged assets (like stablecoins) while maintaining solvency guarantees." },
  { id: "weighted", name: "Weighted Pool", formula: "x^w₁ · y^w₂ = k", desc: "Balancer-style weighted invariant", emoji: "⚡", learnMore: "Weighted pools use asymmetric reserve ratios (e.g., 80/20) instead of the standard 50/50 split. The majority-weighted token experiences less impermanent loss, making this ideal for projects that want to maintain treasury exposure while still providing liquidity." },
  { id: "concentrated", name: "Concentrated Liquidity", formula: "√x · √y = √k", desc: "Capital-efficient range positions", emoji: "🎯", learnMore: "Concentrated liquidity allows LPs to allocate capital within specific price ranges. This multiplies capital efficiency by 4x or more but introduces the risk of the position going out-of-range, at which point fees stop accruing and the LP holds 100% of the depreciating asset." },
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
  const [swapAmount, setSwapAmount] = useState(1000);
  const [showSwapResult, setShowSwapResult] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

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
        case "constant_product": slippage = (pct / (1 - pct)) * 100; break;
        case "stable_swap": slippage = pct * pct * 50; break;
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
        case "stable_swap": il = baseIL * 0.3; break;
        case "weighted": il = baseIL * 0.7; break;
        case "concentrated": il = baseIL * 1.8; break;
      }
      data.push({ priceRatio: parseFloat(priceRatio.toFixed(2)), il: parseFloat(il.toFixed(2)) });
    }
    return data;
  }, [selectedTemplate]);

  const breakEvenVol = (feeRate * 365 * 100 / volMultiplier).toFixed(1);
  const dailyFees = (liquidity * feeRate * volMultiplier * 0.01).toFixed(0);
  const maxDrawdown = (volMultiplier * 8 + (selectedTemplate === "concentrated" ? 12 : 0)).toFixed(1);
  const capitalEfficiency = selectedTemplate === "concentrated" ? "4.2x" : selectedTemplate === "stable_swap" ? "3.1x" : selectedTemplate === "weighted" ? "1.5x" : "1.0x";

  // Pool health score (0-100)
  const poolHealthScore = useMemo(() => {
    let score = 50;
    // Fee tier bonus
    score += feeRate >= 0.003 ? 15 : feeRate >= 0.0005 ? 10 : 5;
    // Volatility penalty
    score -= volMultiplier > 1 ? 15 : volMultiplier < 1 ? 0 : 5;
    // Template bonus
    if (selectedTemplate === "stable_swap") score += 15;
    if (selectedTemplate === "concentrated") score += 10;
    if (selectedTemplate === "weighted") score += 8;
    // Liquidity bonus
    if (liquidity >= 500000) score += 10;
    else if (liquidity >= 100000) score += 5;
    return Math.max(0, Math.min(100, score));
  }, [feeRate, volMultiplier, selectedTemplate, liquidity]);

  const healthLabel = poolHealthScore >= 80 ? "Excellent" : poolHealthScore >= 60 ? "Good" : poolHealthScore >= 40 ? "Fair" : "Risky";
  const healthColor = poolHealthScore >= 80 ? "text-success" : poolHealthScore >= 60 ? "text-success" : poolHealthScore >= 40 ? "text-warning" : "text-destructive";

  // Try a swap calculation
  const swapSlippage = useMemo(() => {
    const pct = swapAmount / liquidity;
    switch (selectedTemplate) {
      case "constant_product": return (pct / (1 - pct)) * 100;
      case "stable_swap": return pct * pct * 50;
      case "weighted": return pct * 80;
      case "concentrated": return pct * 40;
    }
  }, [swapAmount, liquidity, selectedTemplate]);

  const swapOutput = swapAmount * (1 - swapSlippage / 100) * (tokenBPrice / tokenAPrice);
  const swapFee = swapAmount * feeRate;

  // Token reserves visualization
  const tokenAReserve = liquidity / 2 / tokenAPrice;
  const tokenBReserve = liquidity / 2 / tokenBPrice;

  const handleWizardComplete = () => {
    setWizardComplete(true);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };

  const canProceed = currentStep < 2;
  const canGoBack = currentStep > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Celebration particles */}
      <AnimatePresence>
        {showCelebration && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.div
                key={i}
                className={`absolute w-2 h-2 rounded-full ${i % 3 === 0 ? "bg-success" : i % 3 === 1 ? "bg-destructive" : "bg-foreground"}`}
                initial={{
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                  scale: 0,
                  opacity: 1,
                }}
                animate={{
                  x: window.innerWidth / 2 + (Math.cos(i * 0.5) * (200 + Math.random() * 300)),
                  y: window.innerHeight / 2 + (Math.sin(i * 0.5) * (200 + Math.random() * 300)) - 100,
                  scale: [0, 1.5, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 1.5 + Math.random() * 0.5, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 2 }}
            >
              <span className="text-6xl">🎉</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                          <motion.button onClick={() => setSelectedTemplate(t.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                              selectedTemplate === t.id ? "border-foreground/30 bg-foreground/5" : "border-border bg-card hover:border-foreground/10"
                            }`}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground flex items-center gap-2">
                                <span className="text-base">{t.emoji}</span>
                                {t.name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">{t.formula}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                          </motion.button>
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
                          <motion.button key={v} onClick={() => setVolatility(v)}
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                              volatility === v ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
                            }`}>
                            {v === "Low" ? "🌊" : v === "Medium" ? "🌪️" : "🔥"} {v}
                          </motion.button>
                        ))}
                      </div>
                    </Section>
                    <Section title="Fee Tier">
                      <div className="grid grid-cols-4 gap-1.5">
                        {feeTiers.map(f => (
                          <motion.button key={f} onClick={() => setFeeTier(f)}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className={`py-2 rounded-md text-xs font-mono transition-all ${
                              feeTier === f ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"
                            }`}>{f}</motion.button>
                        ))}
                      </div>
                    </Section>

                    {/* Pool Reserve Preview */}
                    <Section title="Pool Preview">
                      <PoolReserveViz tokenA={tokenAReserve} tokenB={tokenBReserve} tokenAPrice={tokenAPrice} />
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
                    <button onClick={handleWizardComplete} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-6 space-y-6`}>
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

          {/* Pool Health Score + Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Health Gauge */}
            <motion.div
              className="surface-elevated rounded-xl p-4 flex flex-col items-center justify-center col-span-2 md:col-span-1"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: "spring" }}
            >
              <HealthGauge score={poolHealthScore} />
              <p className={`text-xs font-semibold mt-2 ${healthColor}`}>{healthLabel}</p>
              <p className="text-[10px] text-muted-foreground">Pool Health</p>
            </motion.div>

            {/* Metrics */}
            <MetricCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Est. Daily Fees" value={`$${dailyFees}`} color="success" tipKey="dailyFees" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<TrendingDown className="w-3.5 h-3.5" />} label="Max Drawdown" value={`${maxDrawdown}%`} color="destructive" tipKey="maxDrawdown" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<BarChart3 className="w-3.5 h-3.5" />} label="Capital Efficiency" value={capitalEfficiency} color="success" tipKey="capitalEfficiency" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            <MetricCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Break-even Vol" value={`${breakEvenVol}%`} color="warning" tipKey="breakEvenVol" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
          </div>

          {/* Try a Swap — Interactive mini-simulator */}
          <motion.div
            className="surface-elevated rounded-xl p-5"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="w-3.5 h-3.5 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Try a Swap</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">INTERACTIVE</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Input */}
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">You Pay (Token A)</label>
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={swapAmount}
                    onChange={e => { setSwapAmount(Math.max(0, Number(e.target.value))); setShowSwapResult(false); }}
                    className="bg-transparent text-sm font-mono text-foreground w-full outline-none"
                  />
                </div>
              </div>

              {/* Swap button */}
              <motion.button
                onClick={() => setShowSwapResult(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9, rotate: 180 }}
                className="self-end sm:self-center w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
              >
                <Zap className="w-4 h-4" />
              </motion.button>

              {/* Output */}
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">You Receive (Token B)</label>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showSwapResult ? "result" : "placeholder"}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="bg-secondary border border-border rounded-lg px-3 py-2.5"
                  >
                    {showSwapResult ? (
                      <div>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {swapOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Click ⚡ to swap</span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Swap breakdown */}
            <AnimatePresence>
              {showSwapResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3">
                    <SwapStat
                      label="Slippage"
                      value={`${swapSlippage.toFixed(3)}%`}
                      level={swapSlippage > 1 ? "high" : swapSlippage > 0.1 ? "medium" : "low"}
                    />
                    <SwapStat
                      label="Fee Paid"
                      value={`$${swapFee.toFixed(2)}`}
                      level="neutral"
                    />
                    <SwapStat
                      label="Price Impact"
                      value={swapSlippage < 0.05 ? "Negligible" : swapSlippage < 0.5 ? "Low" : swapSlippage < 2 ? "Medium" : "High"}
                      level={swapSlippage > 2 ? "high" : swapSlippage > 0.5 ? "medium" : "low"}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

          {/* Quick Comparison */}
          <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-foreground" />
              <h3 className="text-sm font-semibold text-foreground">How does your pool compare?</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "vs. Uniswap V2", metric: "Capital Efficiency", yours: capitalEfficiency, theirs: "1.0x", win: capitalEfficiency !== "1.0x" },
                { label: "vs. Curve", metric: "Slippage (pegged)", yours: selectedTemplate === "stable_swap" ? "~0.01%" : ">0.5%", theirs: "~0.01%", win: selectedTemplate === "stable_swap" },
                { label: "vs. Balancer", metric: "IL Protection", yours: selectedTemplate === "weighted" ? "Partial" : "None", theirs: "Partial", win: selectedTemplate === "weighted" },
                { label: "vs. Uniswap V3", metric: "Range Concentration", yours: selectedTemplate === "concentrated" ? "4.2x" : "1.0x", theirs: "Up to 4000x", win: false },
              ].map(comp => (
                <motion.div key={comp.label} className="p-3 rounded-lg bg-secondary border border-border" whileHover={{ y: -2 }}>
                  <p className="text-[10px] text-muted-foreground mb-1">{comp.label}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">{comp.metric}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-muted-foreground">You</p>
                      <p className={`text-xs font-mono-data font-semibold ${comp.win ? "text-success" : "text-foreground"}`}>{comp.yours}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">vs</span>
                    <div className="text-right">
                      <p className="text-[9px] text-muted-foreground">Them</p>
                      <p className={`text-xs font-mono-data font-semibold ${!comp.win ? "text-success" : "text-foreground"}`}>{comp.theirs}</p>
                    </div>
                  </div>
                  {comp.win && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-2 text-center">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">✓ You win!</span>
                    </motion.div>
                  )}
                </motion.div>
              ))}
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
    <motion.div className="surface-elevated rounded-lg p-4" whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[color] || "text-foreground bg-secondary"}`}>{icon}</div>
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <TipToggle tipKey={tipKey} expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
      </div>
      <AnimatedValue value={value} />
      <AnimatePresence>{expandedTip === tipKey && <ExpandedTip tipKey={tipKey} />}</AnimatePresence>
    </motion.div>
  );
};

const AnimatedValue = ({ value }: { value: string }) => (
  <AnimatePresence mode="wait">
    <motion.span
      key={value}
      className="text-lg font-semibold font-mono-data text-foreground block"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {value}
    </motion.span>
  </AnimatePresence>
);

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
  const barColors = { low: "bg-success", medium: "bg-warning", high: "bg-destructive" };
  const barPct = { low: 33, medium: 66, high: 100 };
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold font-mono-data ${levelColors[level]}`}>{value}</p>
      <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColors[level]}`}
          initial={{ width: 0 }}
          animate={{ width: `${barPct[level]}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

const HealthGauge = ({ score }: { score: number }) => {
  const gaugeColor = score >= 80 ? "hsl(142, 72%, 40%)" : score >= 60 ? "hsl(142, 72%, 40%)" : score >= 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 50%)";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference * 0.75; // 270 degrees

  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-[135deg]">
        <circle cx="40" cy="40" r="36" fill="none" className="stroke-secondary" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference * 0.25} strokeLinecap="round" />
        <motion.circle
          cx="40" cy="40" r="36" fill="none" stroke={gaugeColor} strokeWidth="6"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <motion.span
        className="absolute inset-0 flex items-center justify-center text-lg font-bold font-mono-data text-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {score}
      </motion.span>
    </div>
  );
};

const PoolReserveViz = ({ tokenA, tokenB, tokenAPrice }: { tokenA: number; tokenB: number; tokenAPrice: number }) => {
  const maxTokens = Math.max(tokenA, tokenB);

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Token A</span>
          <span className="text-[10px] font-mono text-foreground">{tokenA.toFixed(1)} tokens</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-foreground/30"
            initial={{ width: 0 }}
            animate={{ width: `${(tokenA / maxTokens) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Token B</span>
          <span className="text-[10px] font-mono text-foreground">{tokenB.toFixed(1)} tokens</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-foreground/30"
            initial={{ width: 0 }}
            animate={{ width: `${(tokenB / maxTokens) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 pt-1">
        <Droplets className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Ratio: {tokenAPrice > 1 ? "50/50 by value" : "Equal"}</span>
      </div>
    </div>
  );
};

const SwapStat = ({ label, value, level }: { label: string; value: string; level: "low" | "medium" | "high" | "neutral" }) => {
  const colorMap = { low: "text-success", medium: "text-warning", high: "text-destructive", neutral: "text-foreground" };
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xs font-semibold font-mono-data ${colorMap[level]}`}>{value}</p>
    </motion.div>
  );
};

export default BeginnerMode;
