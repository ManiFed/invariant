import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, Info, TrendingDown, DollarSign, BarChart3, AlertTriangle, ChevronRight, ChevronLeft, HelpCircle, CheckCircle2, Zap, ArrowRightLeft, Target, Droplets, Activity, SkipForward, SkipBack, Crosshair, Ruler } from "lucide-react";
import { Legend } from "recharts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import ThemeToggle from "@/components/ThemeToggle";
import { useChartColors } from "@/hooks/use-chart-theme";

type Template = "constant_product" | "stable_swap" | "weighted" | "concentrated";

const templates: {id: Template;name: string;formula: string;desc: string;learnMore: string;emoji: string;}[] = [
{ id: "constant_product", name: "Constant Product", formula: "x · y = k", desc: "Classic AMM model used by Uniswap V2", emoji: "⚖️", learnMore: "The constant product formula ensures that the product of token reserves always equals a constant k. When someone buys token A, they must deposit proportionally more token B. This creates a smooth price curve but distributes liquidity evenly across all prices, making it capital-inefficient." },
{ id: "stable_swap", name: "Stable Swap", formula: "x + y + α·xy = k", desc: "Optimized for correlated asset pairs", emoji: "🔗", learnMore: "Stable swap curves concentrate liquidity around the 1:1 price ratio by combining constant sum and constant product formulas. This dramatically reduces slippage for pegged assets (like stablecoins) while maintaining solvency guarantees." },
{ id: "weighted", name: "Weighted Pool", formula: "x^w₁ · y^w₂ = k", desc: "Balancer-style weighted invariant", emoji: "⚡", learnMore: "Weighted pools use asymmetric reserve ratios (e.g., 80/20) instead of the standard 50/50 split. The majority-weighted token experiences less impermanent loss, making this ideal for projects that want to maintain treasury exposure while still providing liquidity." },
{ id: "concentrated", name: "Concentrated Liquidity", formula: "√x · √y = √k", desc: "Capital-efficient range positions", emoji: "🎯", learnMore: "Concentrated liquidity allows LPs to allocate capital within specific price ranges. This multiplies capital efficiency by 4x or more but introduces the risk of the position going out-of-range, at which point fees stop accruing and the LP holds 100% of the depreciating asset." }];


const volatilityLevels = ["Low", "Medium", "High"] as const;
const feeTiers = ["0.01%", "0.05%", "0.30%", "1.00%"] as const;

// Guided tour steps
const guidedSteps = [
{ id: "welcome", title: "Welcome to Beginner Mode", desc: "This tool helps you design and analyze an AMM pool step by step. Let's walk through each section together.", target: null },
{ id: "template", title: "① Choose a Template", desc: "Each template defines a different pricing formula. Start with Constant Product — it's the simplest and most widely used (Uniswap V2). Click one to select it.", target: "template" },
{ id: "params", title: "② Set Your Parameters", desc: "Configure token prices, how much liquidity to provide, expected market volatility, and the fee tier. These affect all the analysis below.", target: "params" },
{ id: "health", title: "③ Pool Health Score", desc: "This gauge summarizes your pool's overall health based on your settings. Higher is better — it factors in fee tier, volatility, liquidity depth, and template choice.", target: "health" },
{ id: "swap", title: "④ Try a Swap", desc: "Enter an amount and click ⚡ to simulate a trade. You'll see slippage, fees, and price impact — the real cost of trading against your pool.", target: "swap" },
{ id: "charts", title: "⑤ Analyze the Charts", desc: "The slippage curve shows how price impact grows with trade size. The IL chart shows how impermanent loss changes with price movement. Click any ❓ for explanations.", target: "charts" },
{ id: "scenario", title: "⑥ Run Scenarios", desc: "Pick a market scenario (trending, crash, etc.) and press Play to watch LP value vs Hold value evolve over 90 days. This is where you see if your pool is actually profitable.", target: "scenario" },
{ id: "done", title: "You're Ready!", desc: "You now know every section. Experiment freely — change templates, adjust parameters, and run different scenarios. Click any ❓ icon for detailed explanations.", target: null }];


const educationTips: Record<string, {title: string;content: string;}> = {
  slippage: { title: "What is Slippage?", content: "Slippage is the difference between the expected price and the actual execution price. Larger trades relative to pool size cause more slippage because they move the price along the invariant curve more dramatically." },
  il: { title: "What is Impermanent Loss?", content: "Impermanent loss (IL) occurs when the price ratio of pooled tokens diverges from the entry ratio. The formula is: IL = 2√r/(1+r) − 1, where r is the price ratio change. It's 'impermanent' because it reverses if prices return to the original ratio." },
  dailyFees: { title: "Estimated Daily Fees", content: "Fee revenue depends on trading volume × fee tier. Higher volatility drives more arbitrage trades, generating more fees but also more impermanent loss. The estimate assumes volume proportional to volatility." },
  maxDrawdown: { title: "Maximum Drawdown", content: "The worst-case percentage decline in your LP position value. Concentrated liquidity positions have higher drawdown risk because all capital is exposed within a narrow price range." },
  capitalEfficiency: { title: "Capital Efficiency", content: "How effectively deposited capital is utilized for trading. Concentrated liquidity at 4.2x means $25k provides the same depth as $100k in a constant product pool within the active range." },
  breakEvenVol: { title: "Break-even Volatility", content: "The minimum annualized volatility needed for fee income to offset impermanent loss. Computed as (feeRate × 365) / volatilityMultiplier. If actual volatility exceeds this threshold, the LP position is expected to be net profitable." }
};

const BeginnerMode = () => {
  const navigate = useNavigate();
  const colors = useChartColors();
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

  // Guided tour state
  const [guideStep, setGuideStep] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [showBanner, setShowBanner] = useState(true);

  // Refs for auto-scroll targets
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll when guide step changes
  useEffect(() => {
    if (!showGuide) return;
    const target = guidedSteps[guideStep]?.target;
    if (target && sectionRefs.current[target]) {
      sectionRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [guideStep, showGuide]);

  // Plain-english scenario & risk controls
  const [riskLevel, setRiskLevel] = useState<"conservative" | "moderate" | "aggressive">("moderate");

  const riskDescriptions = {
    conservative: { label: "Conservative", emoji: "🛡️", desc: "You prefer safety over returns. Tight ranges, lower volatility exposure.", volLabel: "Calm markets", feeLabel: "Standard (0.30%)" },
    moderate: { label: "Moderate", emoji: "⚖️", desc: "You're comfortable with some risk for better returns.", volLabel: "Normal markets", feeLabel: "Balanced (0.30%)" },
    aggressive: { label: "Aggressive", emoji: "🔥", desc: "You chase maximum returns and can handle big swings.", volLabel: "Wild markets", feeLabel: "High volume (0.05%)" }
  };

  // Auto-map risk level to parameters
  useEffect(() => {
    switch (riskLevel) {
      case "conservative":setVolatility("Low");setFeeTier("0.30%");break;
      case "moderate":setVolatility("Medium");setFeeTier("0.30%");break;
      case "aggressive":setVolatility("High");setFeeTier("0.05%");break;
    }
  }, [riskLevel]);

  const volMultiplier = volatility === "Low" ? 0.5 : volatility === "Medium" ? 1 : 2;
  const feeRate = parseFloat(feeTier) / 100;

  const slippageData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 20; i++) {
      const tradeSize = i / 20 * liquidity * 0.1;
      const pct = tradeSize / liquidity;
      let slippage: number;
      switch (selectedTemplate) {
        case "constant_product":slippage = pct / (1 - pct) * 100;break;
        case "stable_swap":slippage = pct * pct * 50;break;
        case "weighted":slippage = pct * 80;break;
        case "concentrated":slippage = pct * 40;break;
      }
      data.push({ tradeSize: Math.round(tradeSize), slippage: parseFloat(Math.min(slippage, 100).toFixed(3)) });
    }
    return data;
  }, [selectedTemplate, liquidity]);

  const ilData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 30; i++) {
      const priceRatio = 0.5 + i / 30 * 1.5;
      const sqrtR = Math.sqrt(priceRatio);
      const baseIL = (2 * sqrtR / (1 + priceRatio) - 1) * -100;
      let il: number;
      switch (selectedTemplate) {
        case "constant_product":il = baseIL;break;
        case "stable_swap":il = baseIL * 0.3;break;
        case "weighted":il = baseIL * 0.7;break;
        case "concentrated":il = baseIL * 1.8;break;
      }
      data.push({ priceRatio: parseFloat(priceRatio.toFixed(2)), il: parseFloat(il.toFixed(2)) });
    }
    return data;
  }, [selectedTemplate]);

  const breakEvenVol = (feeRate * 365 * 100 / volMultiplier).toFixed(1);
  const dailyFees = (liquidity * feeRate * volMultiplier * 0.01).toFixed(0);
  const maxDrawdown = (volMultiplier * 8 + (selectedTemplate === "concentrated" ? 12 : 0)).toFixed(1);
  const capitalEfficiency = selectedTemplate === "concentrated" ? "4.2x" : selectedTemplate === "stable_swap" ? "3.1x" : selectedTemplate === "weighted" ? "1.5x" : "1.0x";

  const poolHealthScore = useMemo(() => {
    let score = 50;
    score += feeRate >= 0.003 ? 15 : feeRate >= 0.0005 ? 10 : 5;
    score -= volMultiplier > 1 ? 15 : volMultiplier < 1 ? 0 : 5;
    if (selectedTemplate === "stable_swap") score += 15;
    if (selectedTemplate === "concentrated") score += 10;
    if (selectedTemplate === "weighted") score += 8;
    if (liquidity >= 500000) score += 10;else
    if (liquidity >= 100000) score += 5;
    return Math.max(0, Math.min(100, score));
  }, [feeRate, volMultiplier, selectedTemplate, liquidity]);

  const healthLabel = poolHealthScore >= 80 ? "Excellent" : poolHealthScore >= 60 ? "Good" : poolHealthScore >= 40 ? "Fair" : "Risky";
  const healthColor = poolHealthScore >= 80 ? "text-success" : poolHealthScore >= 60 ? "text-success" : poolHealthScore >= 40 ? "text-warning" : "text-destructive";

  const swapSlippage = useMemo(() => {
    const pct = swapAmount / liquidity;
    switch (selectedTemplate) {
      case "constant_product":return pct / (1 - pct) * 100;
      case "stable_swap":return pct * pct * 50;
      case "weighted":return pct * 80;
      case "concentrated":return pct * 40;
    }
  }, [swapAmount, liquidity, selectedTemplate]);

  const swapOutput = swapAmount * (1 - swapSlippage / 100) * (tokenBPrice / tokenAPrice);
  const swapFee = swapAmount * feeRate;

  const tokenAReserve = liquidity / 2 / tokenAPrice;
  const tokenBReserve = liquidity / 2 / tokenBPrice;

  const currentGuide = guidedSteps[guideStep];

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
          <button onClick={() => setIsRunning(!isRunning)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isRunning ? "Pause" : "Simulate"}
          </button>
          <button onClick={() => {setShowGuide(true);setGuideStep(0);}} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Teaching Lab banner — dismissible */}
      {showBanner &&
      <div className="border-b border-border px-6 py-2 bg-secondary/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Have questions about how AMMs work? Want more features?</p>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/learn")} className="text-xs font-medium text-foreground hover:underline inline-flex items-center gap-1">
              Teaching Lab <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => navigate("/advanced")} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
              Advanced Mode <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={() => setShowBanner(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-xs">✕</span>
            </button>
          </div>
        </div>
      }

      {/* Guided Tour Overlay — collapsible */}
      <AnimatePresence>
        {showGuide && currentGuide &&
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-6 mt-4 mb-2 p-4 rounded-xl bg-primary/5 border border-primary/20 relative">

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {guideStep + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">{currentGuide.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{currentGuide.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowGuide(false)} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded-md hover:bg-secondary transition-colors">
                  Hide
                </button>
                <button onClick={() => setShowGuide(false)} className="text-muted-foreground hover:text-foreground text-xs">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <div className="flex gap-1">
                {guidedSteps.map((_, i) =>
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === guideStep ? "bg-primary w-4" : i < guideStep ? "bg-primary/40" : "bg-muted"}`} />
              )}
              </div>
              <div className="flex gap-2">
                {guideStep > 0 &&
              <button onClick={() => setGuideStep((s) => s - 1)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    <ChevronLeft className="w-3 h-3" /> Back
                  </button>
              }
                <button
                onClick={() => {
                  if (guideStep < guidedSteps.length - 1) setGuideStep((s) => s + 1);else
                  setShowGuide(false);
                }}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5">

                  {guideStep < guidedSteps.length - 1 ? <>Next <ChevronRight className="w-3 h-3" /></> : "Start Exploring →"}
                </button>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Collapsed guide bar when hidden */}
      {!showGuide &&
      <div className="mx-6 mt-3 mb-1">
          <button onClick={() => setShowGuide(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
            <HelpCircle className="w-3 h-3" /> Show Guide
          </button>
        </div>
      }

      <div className="flex flex-col lg:flex-row h-[calc(100vh-105px)]">
        {/* Sidebar — always visible */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border p-5 overflow-y-auto space-y-6">
          {/* Section: Template */}
          <div ref={(el) => {sectionRefs.current["template"] = el;}}>
          <GuidedSection
              number="1"
              title="Choose Your AMM Template"
              desc="Each template defines how tokens are priced relative to their reserves."
              highlight={showGuide && currentGuide?.target === "template"}>

            <div className="space-y-2">
              {templates.map((t) =>
                <div key={t.id}>
                  <motion.button onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                  selectedTemplate === t.id ? "border-foreground/30 bg-foreground/5" : "border-border bg-card hover:border-foreground/10"}`
                  }
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
                  {selectedTemplate === t.id &&
                  <motion.button onClick={() => setShowLearnMore(showLearnMore === t.id ? null : t.id)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 ml-1 hover:text-foreground transition-colors"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <HelpCircle className="w-3 h-3" />
                      {showLearnMore === t.id ? "Hide details" : "Learn more"}
                    </motion.button>
                  }
                  <AnimatePresence>
                    {showLearnMore === t.id &&
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="p-3 mt-1 rounded-lg bg-secondary border border-border text-[11px] text-muted-foreground leading-relaxed">{t.learnMore}</div>
                      </motion.div>
                    }
                  </AnimatePresence>
                </div>
                )}
            </div>
          </GuidedSection>
          </div>

          {/* Section: Parameters */}
          <div ref={(el) => {sectionRefs.current["params"] = el;}}>
          <GuidedSection
              number="2"
              title="Configure Your Pool"
              desc="Set token prices, liquidity depth, expected volatility, and fee tier."
              highlight={showGuide && currentGuide?.target === "params"}>

            <div className="space-y-3">
              <ParamInput label="Token A Price" value={tokenAPrice} onChange={setTokenAPrice} prefix="$" hint="e.g., ETH current price" />
              <ParamInput label="Token B Price" value={tokenBPrice} onChange={setTokenBPrice} prefix="$" hint="e.g., USDC = $1" />
              <ParamInput label="Total Liquidity" value={liquidity} onChange={setLiquidity} prefix="$" hint="Capital to deposit" />
            </div>

            {/* Plain-English Risk Profile Selector */}
            



























            {/* Advanced overrides (collapsed) */}
            <details className="mt-3">
              <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Advanced: Override volatility & fee tier manually</summary>
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-border">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Volatility</label>
                  <div className="flex gap-1.5">
                    {volatilityLevels.map((v) =>
                      <button key={v} onClick={() => setVolatility(v)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      volatility === v ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`
                      }>{v === "Low" ? "🌊" : v === "Medium" ? "🌪️" : "🔥"} {v}</button>
                      )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Fee Tier</label>
                  <div className="grid grid-cols-4 gap-1">
                    {feeTiers.map((f) =>
                      <button key={f} onClick={() => setFeeTier(f)}
                      className={`py-1.5 rounded-md text-[9px] font-mono transition-all ${
                      feeTier === f ? "bg-foreground/5 text-foreground border border-foreground/20" : "bg-secondary text-secondary-foreground border border-transparent"}`
                      }>{f}</button>
                      )}
                  </div>
                </div>
              </div>
            </details>

            {/* Pool Reserve Preview */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Pool Preview</label>
              <PoolReserveViz tokenA={tokenAReserve} tokenB={tokenBReserve} tokenAPrice={tokenAPrice} />
            </div>
          </GuidedSection>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Pool Health Score + Metrics */}
          <div ref={(el) => {sectionRefs.current["health"] = el;}}>
          <GuidedSection
              number="3"
              title="Pool Health & Key Metrics"
              desc="A summary of your pool's risk and reward profile based on current settings."
              highlight={showGuide && currentGuide?.target === "health"}
              inline>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <motion.div
                  className="surface-elevated rounded-xl p-4 flex flex-col items-center justify-center col-span-2 md:col-span-1"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: "spring" }}>

                <HealthGauge score={poolHealthScore} />
                <p className={`text-xs font-semibold mt-2 ${healthColor}`}>{healthLabel}</p>
                <p className="text-[10px] text-muted-foreground">Pool Health</p>
              </motion.div>
              <MetricCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Est. Daily Fees" value={`$${dailyFees}`} color="success" tipKey="dailyFees" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              <MetricCard icon={<TrendingDown className="w-3.5 h-3.5" />} label="Max Drawdown" value={`${maxDrawdown}%`} color="destructive" tipKey="maxDrawdown" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              <MetricCard icon={<BarChart3 className="w-3.5 h-3.5" />} label="Capital Efficiency" value={capitalEfficiency} color="success" tipKey="capitalEfficiency" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
              <MetricCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Break-even Vol" value={`${breakEvenVol}%`} color="warning" tipKey="breakEvenVol" expandedTip={expandedTip} setExpandedTip={setExpandedTip} />
            </div>
          </GuidedSection>
          </div>

          {/* Try a Swap */}
          <div ref={(el) => {sectionRefs.current["swap"] = el;}}>
          <GuidedSection
              number="4"
              title="Try a Swap"
              desc="Simulate a trade to see slippage, fees, and price impact."
              highlight={showGuide && currentGuide?.target === "swap"}
              inline>

            <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">You Pay (Token A)</label>
                  <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">$</span>
                    <input type="number" value={swapAmount} onChange={(e) => {setSwapAmount(Math.max(0, Number(e.target.value)));setShowSwapResult(false);}}
                      className="bg-transparent text-sm font-mono text-foreground w-full outline-none" />
                  </div>
                </div>
                <motion.button onClick={() => setShowSwapResult(true)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9, rotate: 180 }}
                  className="self-end sm:self-center w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </motion.button>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">You Receive (Token B)</label>
                  <AnimatePresence mode="wait">
                    <motion.div key={showSwapResult ? "result" : "placeholder"} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="bg-secondary border border-border rounded-lg px-3 py-2.5">
                      {showSwapResult ?
                        <span className="text-sm font-mono font-semibold text-foreground">{swapOutput.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens</span> :

                        <span className="text-sm text-muted-foreground">Click ⚡ to swap</span>
                        }
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <AnimatePresence>
                {showSwapResult &&
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3">
                      <SwapStat label="Slippage" value={`${swapSlippage.toFixed(3)}%`} level={swapSlippage > 1 ? "high" : swapSlippage > 0.1 ? "medium" : "low"} />
                      <SwapStat label="Fee Paid" value={`$${swapFee.toFixed(2)}`} level="neutral" />
                      <SwapStat label="Price Impact" value={swapSlippage < 0.05 ? "Negligible" : swapSlippage < 0.5 ? "Low" : swapSlippage < 2 ? "Medium" : "High"}
                      level={swapSlippage > 2 ? "high" : swapSlippage > 0.5 ? "medium" : "low"} />
                    </div>
                  </motion.div>
                  }
              </AnimatePresence>
            </motion.div>
          </GuidedSection>
          </div>

          {/* Charts */}
          <div ref={(el) => {sectionRefs.current["charts"] = el;}}>
          <GuidedSection
              number="5"
              title="Slippage & Impermanent Loss Analysis"
              desc="See how trade size affects price impact and how price divergence creates IL."
              highlight={showGuide && currentGuide?.target === "charts"}
              inline>

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
                      <XAxis dataKey="tradeSize" tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }} labelFormatter={(v) => `Trade: $${Number(v).toLocaleString()}`} formatter={(v: number) => [`${v}%`, "Slippage"]} />
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
                      <YAxis tick={{ fontSize: 10, fill: colors.tick }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v}%`, "IL"]} />
                      <Line type="monotone" dataKey="il" stroke={colors.red} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </GuidedSection>
          </div>

          {/* Plain-English Scenario Simulator */}
          <div ref={(el) => {sectionRefs.current["scenario"] = el;}}>
          <GuidedSection
              number="6"
              title="What If...? Scenario Simulator"
              desc="Pick a real-world scenario in plain English and see what happens to your liquidity."
              highlight={showGuide && currentGuide?.target === "scenario"}
              inline>

            <PlainEnglishScenarios
                selectedTemplate={selectedTemplate}
                liquidity={liquidity}
                feeRate={feeRate}
                volMultiplier={volMultiplier}
                colors={colors} />

          </GuidedSection>
          </div>

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
              { label: "vs. Uniswap V3", metric: "Range Concentration", yours: selectedTemplate === "concentrated" ? "4.2x" : "1.0x", theirs: "Up to 4000x", win: false }].
              map((comp) =>
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
                  {comp.win &&
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-2 text-center">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">✓ You win!</span>
                    </motion.div>
                }
                </motion.div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>);

};

/* ─── Guided Section Wrapper ─── */

const GuidedSection = ({ number, title, desc, highlight, inline, children

}: {number: string;title: string;desc: string;highlight?: boolean;inline?: boolean;children: React.ReactNode;}) =>
<motion.div
  className={`${highlight ? "ring-2 ring-primary/30 rounded-xl" : ""} transition-all`}
  animate={highlight ? { scale: [1, 1.005, 1] } : {}}
  transition={highlight ? { duration: 1.5, repeat: Infinity } : {}}>

    {!inline &&
  <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{number}</span>
        <div>
          <h4 className="text-xs font-semibold text-foreground">{title}</h4>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
  }
    {inline &&
  <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{number}</span>
        <div>
          <h4 className="text-xs font-semibold text-foreground">{title}</h4>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
  }
    {children}
  </motion.div>;


/* ─── Sub-components ─── */

const ParamInput = ({ label, value, onChange, prefix, hint }: {label: string;value: number;onChange: (v: number) => void;prefix?: string;hint?: string;}) =>
<div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    <div className="flex items-center gap-1 rounded-md bg-secondary border border-border px-3 py-2">
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-transparent text-sm font-mono text-foreground w-full outline-none" />
    </div>
    {hint && <p className="text-[10px] text-muted-foreground mt-1 opacity-70">{hint}</p>}
  </div>;


const MetricCard = ({ icon, label, value, color, tipKey, expandedTip, setExpandedTip


}: {icon: React.ReactNode;label: string;value: string;color: string;tipKey: string;expandedTip: string | null;setExpandedTip: (v: string | null) => void;}) => {
  const colorMap: Record<string, string> = {
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10"
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
    </motion.div>);

};

const AnimatedValue = ({ value }: {value: string;}) =>
<AnimatePresence mode="wait">
    <motion.span key={value} className="text-lg font-semibold font-mono-data text-foreground block"
  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
      {value}
    </motion.span>
  </AnimatePresence>;


const TipToggle = ({ tipKey, expandedTip, setExpandedTip }: {tipKey: string;expandedTip: string | null;setExpandedTip: (v: string | null) => void;}) =>
<button onClick={() => setExpandedTip(expandedTip === tipKey ? null : tipKey)}
className={`p-1 rounded transition-colors ${expandedTip === tipKey ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
    <HelpCircle className="w-3 h-3" />
  </button>;


const ExpandedTip = ({ tipKey }: {tipKey: string;}) => {
  const tip = educationTips[tipKey];
  if (!tip) return null;
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-2 p-2.5 rounded-lg bg-secondary border border-border">
        <p className="text-[10px] font-semibold text-foreground mb-1">{tip.title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{tip.content}</p>
      </div>
    </motion.div>);

};

const RiskMetric = ({ label, value, level }: {label: string;value: string;level: "low" | "medium" | "high";}) => {
  const levelColors = { low: "text-success", medium: "text-warning", high: "text-destructive" };
  const barColors = { low: "bg-success", medium: "bg-warning", high: "bg-destructive" };
  const barPct = { low: 33, medium: 66, high: 100 };
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold font-mono-data ${levelColors[level]}`}>{value}</p>
      <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div className={`h-full rounded-full ${barColors[level]}`} initial={{ width: 0 }} animate={{ width: `${barPct[level]}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
    </div>);

};

const HealthGauge = ({ score }: {score: number;}) => {
  const gaugeColor = score >= 80 ? "hsl(142, 72%, 40%)" : score >= 60 ? "hsl(142, 72%, 40%)" : score >= 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 50%)";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - score / 100 * circumference * 0.75;

  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-[135deg]">
        <circle cx="40" cy="40" r="36" fill="none" className="stroke-secondary" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference * 0.25} strokeLinecap="round" />
        <motion.circle cx="40" cy="40" r="36" fill="none" stroke={gaugeColor} strokeWidth="6"
        strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }} strokeLinecap="round" />
      </svg>
      <motion.span className="absolute inset-0 flex items-center justify-center text-lg font-bold font-mono-data text-foreground"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        {score}
      </motion.span>
    </div>);

};

const PoolReserveViz = ({ tokenA, tokenB, tokenAPrice }: {tokenA: number;tokenB: number;tokenAPrice: number;}) => {
  const maxTokens = Math.max(tokenA, tokenB);
  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Token A</span>
          <span className="text-[10px] font-mono text-foreground">{tokenA.toFixed(1)} tokens</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div className="h-full rounded-full bg-foreground/30" initial={{ width: 0 }} animate={{ width: `${tokenA / maxTokens * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Token B</span>
          <span className="text-[10px] font-mono text-foreground">{tokenB.toFixed(1)} tokens</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div className="h-full rounded-full bg-foreground/30" initial={{ width: 0 }} animate={{ width: `${tokenB / maxTokens * 100}%` }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 pt-1">
        <Droplets className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Ratio: {tokenAPrice > 1 ? "50/50 by value" : "Equal"}</span>
      </div>
    </div>);

};

const SwapStat = ({ label, value, level }: {label: string;value: string;level: "low" | "medium" | "high" | "neutral";}) => {
  const colorMap = { low: "text-success", medium: "text-warning", high: "text-destructive", neutral: "text-foreground" };
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xs font-semibold font-mono-data ${colorMap[level]}`}>{value}</p>
    </motion.div>);

};

/* ─── Plain-English Scenario Simulator ─── */

type ScenarioId = "trending" | "mean_revert" | "chop" | "crash" | "new_listing" | "stablecoin";

const scenariosList: {id: ScenarioId;label: string;emoji: string;desc: string;plainDesc: string;}[] = [
{ id: "trending", label: "Bull Run", emoji: "📈", desc: "Token A steadily rises 40% over 90 days", plainDesc: "\"The market is pumping and my token keeps going up.\"" },
{ id: "mean_revert", label: "Sideways Churn", emoji: "🔄", desc: "Price bounces around but ends near where it started", plainDesc: "\"Nothing exciting happens — the price just wiggles around.\"" },
{ id: "chop", label: "Rollercoaster", emoji: "🎢", desc: "Violent swings up and down with no clear direction", plainDesc: "\"Crypto Twitter is panicking every other day.\"" },
{ id: "crash", label: "Rug Pull / Crash", emoji: "💥", desc: "Token A drops 70% over 90 days", plainDesc: "\"The worst case: your token dumps hard and doesn't recover.\"" },
{ id: "new_listing", label: "New Token Hype", emoji: "🚀", desc: "Spikes 3x then slowly bleeds back down", plainDesc: "\"A new memecoin goes viral, then fades.\"" },
{ id: "stablecoin", label: "Stablecoin Pair", emoji: "🏦", desc: "Both tokens stay within 1% of each other", plainDesc: "\"Like USDC/USDT — boring but profitable with fees.\"" }];


const generateScenarioData = (scenario: ScenarioId, template: Template, liq: number, fRate: number, _volMult: number, days: number): {day: number;price: number;lpValue: number;holdValue: number;fees: number;il: number;}[] => {
  const data: {day: number;price: number;lpValue: number;holdValue: number;fees: number;il: number;}[] = [];
  const startPrice = 100;
  let price = startPrice;
  let cumulativeFees = 0;

  for (let d = 0; d <= days; d++) {
    const t = d / days;
    switch (scenario) {
      case "trending":price = startPrice * (1 + 0.4 * t + Math.sin(d * 0.15) * 0.05);break;
      case "mean_revert":price = startPrice * (1 + Math.sin(d * 0.08) * 0.15 + Math.cos(d * 0.03) * 0.05);break;
      case "chop":price = startPrice * (1 + Math.sin(d * 0.3) * 0.2 + Math.cos(d * 0.7) * 0.1);break;
      case "crash":price = startPrice * (1 - 0.7 * t * t + Math.sin(d * 0.1) * 0.03);break;
      case "new_listing":price = startPrice * (1 + 2 * Math.exp(-3 * t) * Math.sin(d * 0.2) + 2 * Math.exp(-2 * t));break;
      case "stablecoin":price = startPrice * (1 + Math.sin(d * 0.5) * 0.005 + Math.cos(d * 0.3) * 0.003);break;
    }
    price = Math.max(price, 1);

    const r = price / startPrice;
    const sqrtR = Math.sqrt(r);
    const baseIL = 2 * sqrtR / (1 + r) - 1;
    let ilMult = 1;
    if (template === "stable_swap") ilMult = 0.3;else
    if (template === "weighted") ilMult = 0.7;else
    if (template === "concentrated") ilMult = 1.8;
    const il = baseIL * ilMult;

    const dailyVol = Math.abs(d > 0 ? price / (data[d - 1]?.price || startPrice) - 1 : 0);
    const dailyFee = liq * fRate * (0.5 + dailyVol * 10) * 0.001;
    cumulativeFees += dailyFee;

    const holdValue = liq * (0.5 * (price / startPrice) + 0.5);
    const lpValue = holdValue * (1 + il) + cumulativeFees;

    data.push({
      day: d,
      price: parseFloat(price.toFixed(2)),
      lpValue: parseFloat(lpValue.toFixed(0)),
      holdValue: parseFloat(holdValue.toFixed(0)),
      fees: parseFloat(cumulativeFees.toFixed(0)),
      il: parseFloat((il * 100).toFixed(2))
    });
  }
  return data;
};

const PlainEnglishScenarios = ({ selectedTemplate, liquidity: liq, feeRate: fRate, volMultiplier: vMult, colors

}: {selectedTemplate: Template;liquidity: number;feeRate: number;volMultiplier: number;colors: ReturnType<typeof useChartColors>;}) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("trending");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalDays = 90;

  const fullData = useMemo(() => generateScenarioData(activeScenario, selectedTemplate, liq, fRate, vMult, totalDays), [activeScenario, selectedTemplate, liq, fRate, vMult]);
  const visibleData = fullData.slice(0, currentDay + 1);
  const currentPoint = visibleData[visibleData.length - 1];

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentDay((prev) => {if (prev >= totalDays) {setIsPlaying(false);return totalDays;}return prev + 1;});
      }, 100 / speed);
    }
    return () => {if (timerRef.current) clearInterval(timerRef.current);};
  }, [isPlaying, speed]);

  useEffect(() => {setCurrentDay(0);setIsPlaying(false);}, [activeScenario, selectedTemplate, liq]);

  const pnlPct = currentPoint ? ((currentPoint.lpValue / liq - 1) * 100).toFixed(1) : "0";
  const holdPnl = currentPoint ? ((currentPoint.holdValue / liq - 1) * 100).toFixed(1) : "0";
  const lpBeatsHold = currentPoint ? currentPoint.lpValue > currentPoint.holdValue : false;
  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };

  return (
    <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {scenariosList.map((s) =>
        <motion.button key={s.id} onClick={() => setActiveScenario(s.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className={`p-2.5 rounded-lg border text-left transition-all ${activeScenario === s.id ? "border-foreground/30 bg-foreground/5" : "border-border bg-card hover:border-foreground/10"}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{s.emoji}</span>
              <span className="text-[11px] font-medium text-foreground">{s.label}</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-snug italic">{s.plainDesc}</p>
            <p className="text-[8px] text-muted-foreground/70 mt-0.5">{s.desc}</p>
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 p-2.5 rounded-lg bg-secondary border border-border">
        <button onClick={() => {setCurrentDay(0);setIsPlaying(false);}} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <motion.button onClick={() => {if (currentDay >= totalDays) setCurrentDay(0);setIsPlaying(!isPlaying);}} whileTap={{ scale: 0.9 }}
        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </motion.button>
        <button onClick={() => {setCurrentDay(totalDays);setIsPlaying(false);}} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <input type="range" min={0} max={totalDays} value={currentDay} onChange={(e) => {setCurrentDay(Number(e.target.value));setIsPlaying(false);}} className="flex-1 accent-foreground h-1" />
          <span className="text-[10px] font-mono text-foreground w-14 text-right">Day {currentDay}</span>
        </div>
        <div className="flex items-center gap-1 border-l border-border pl-3">
          {[1, 2, 4].map((s) =>
          <button key={s} onClick={() => setSpeed(s)} className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${speed === s ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{s}x</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <LiveStat label="LP Value" value={`$${currentPoint?.lpValue.toLocaleString() || "—"}`} />
        <LiveStat label="LP P&L" value={`${Number(pnlPct) >= 0 ? "+" : ""}${pnlPct}%`} color={Number(pnlPct) >= 0 ? "text-success" : "text-destructive"} />
        <LiveStat label="Hold P&L" value={`${Number(holdPnl) >= 0 ? "+" : ""}${holdPnl}%`} color={Number(holdPnl) >= 0 ? "text-success" : "text-destructive"} />
        <LiveStat label="Fees Earned" value={`$${currentPoint?.fees.toLocaleString() || "0"}`} color="text-success" />
        <LiveStat label="LP vs Hold" value={lpBeatsHold ? "LP Wins 🏆" : "Hold Wins"} color={lpBeatsHold ? "text-success" : "text-warning"} />
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData}>
            <defs>
              <linearGradient id="lpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.green} stopOpacity={0.2} />
                <stop offset="100%" stopColor={colors.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="holdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.gray} stopOpacity={0.1} />
                <stop offset="100%" stopColor={colors.gray} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={(v) => `D${v}`} domain={[0, totalDays]} />
            <YAxis tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Day ${v}`} formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === "lpValue" ? "LP Position" : "Hold Only"]} />
            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v === "lpValue" ? "LP Position" : "Hold Only"} />
            <Area type="monotone" dataKey="holdValue" stroke={colors.gray} fill="url(#holdGrad)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            <Area type="monotone" dataKey="lpValue" stroke={colors.green} fill="url(#lpGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Price: <span className="font-mono text-foreground">${currentPoint?.price.toFixed(2) || "—"}</span></span>
        <span className="text-muted-foreground">IL: <span className={`font-mono ${(currentPoint?.il || 0) < -2 ? "text-destructive" : "text-foreground"}`}>{currentPoint?.il.toFixed(2) || "0"}%</span></span>
        <span className="text-muted-foreground">Fees: <span className="font-mono text-success">${currentPoint?.fees.toLocaleString() || "0"}</span></span>
      </div>
    </motion.div>);

};

const LiveStat = ({ label, value, color }: {label: string;value: string;color?: string;}) =>
<div className="p-2 rounded-lg bg-secondary border border-border text-center">
    <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
    <AnimatePresence mode="wait">
      <motion.p key={value} className={`text-xs font-semibold font-mono-data ${color || "text-foreground"}`}
    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
        {value}
      </motion.p>
    </AnimatePresence>
  </div>;


/* ─── Liquidity Range Assistant ─── */

const riskProfiles = [
{ label: "Conservative", emoji: "🛡️", rangePct: 0.15, desc: "Tight range, high fees, frequent rebalancing" },
{ label: "Moderate", emoji: "⚖️", rangePct: 0.35, desc: "Balanced risk and reward" },
{ label: "Aggressive", emoji: "🔥", rangePct: 0.6, desc: "Wide range, lower fees, less maintenance" }];


const LiquidityRangeAssistant = ({ selectedTemplate, tokenAPrice, liquidity: liq, volMultiplier: vMult, feeRate: fRate, colors

}: {selectedTemplate: Template;tokenAPrice: number;liquidity: number;volMultiplier: number;feeRate: number;colors: ReturnType<typeof useChartColors>;}) => {
  const [capital, setCapital] = useState(liq);
  const [riskTolerance, setRiskTolerance] = useState(1);
  const profile = riskProfiles[riskTolerance];

  const rangePct = profile.rangePct * (1 + (vMult - 1) * 0.3);
  const priceLower = tokenAPrice * (1 - rangePct);
  const priceUpper = tokenAPrice * (1 + rangePct);
  const efficiencyMultiplier = (1 / rangePct).toFixed(1);
  const dailyFeesInRange = (capital * fRate * vMult * 0.01 * parseFloat(efficiencyMultiplier)).toFixed(0);
  const outOfRangeDays = Math.round((1 - rangePct) * 30 * vMult);

  const rangeData = useMemo(() => {
    const data: {price: number;density: number;inRange: boolean;}[] = [];
    const center = tokenAPrice;
    const spread = tokenAPrice * 0.8;
    for (let i = 0; i <= 60; i++) {
      const price = center - spread / 2 + spread / 60 * i;
      const z = (price - center) / (tokenAPrice * vMult * 0.15);
      const density = Math.exp(-0.5 * z * z) * 100;
      const inRange = price >= priceLower && price <= priceUpper;
      data.push({ price: parseFloat(price.toFixed(0)), density: parseFloat(density.toFixed(1)), inRange });
    }
    return data;
  }, [tokenAPrice, priceLower, priceUpper, vMult]);

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10 };
  const isConcentrated = selectedTemplate === "concentrated";

  return (
    <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
          <Crosshair className="w-3.5 h-3.5 text-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Liquidity Range Assistant</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">{isConcentrated ? "CONCENTRATED" : "ALL MODELS"}</span>
      </div>

      {!isConcentrated &&
      <div className="mb-4 p-3 rounded-lg bg-secondary border border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            💡 Range positioning is most impactful with <strong className="text-foreground">Concentrated Liquidity</strong>. Switch to the Concentrated template for maximum capital efficiency.
          </p>
        </div>
      }

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Capital to Deploy</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <input type="number" value={capital} onChange={(e) => setCapital(Math.max(100, Number(e.target.value)))}
            className="w-full bg-secondary border border-border rounded-md pl-6 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex gap-1 mt-1.5">
            {[10000, 50000, 100000, 500000].map((v) =>
            <button key={v} onClick={() => setCapital(v)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${capital === v ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                ${(v / 1000).toFixed(0)}k
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Risk Tolerance</label>
          <input type="range" min={0} max={2} step={1} value={riskTolerance} onChange={(e) => setRiskTolerance(Number(e.target.value))} className="w-full accent-foreground h-1 mb-2" />
          <div className="flex justify-between text-[9px] text-muted-foreground -mt-1">
            <span>Conservative</span><span>Moderate</span><span>Aggressive</span>
          </div>
          <div className="mt-2 p-2 rounded-md bg-secondary border border-border">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{profile.emoji}</span>
              <span className="text-[11px] font-medium text-foreground">{profile.label}</span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">{profile.desc}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Suggested Range</label>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center p-2 rounded-md bg-secondary border border-border">
              <span className="text-[10px] text-muted-foreground">Lower</span>
              <span className="text-xs font-mono font-semibold text-foreground">${priceLower.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/5 border border-border">
                <Ruler className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] font-mono text-foreground">±{(rangePct * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-2 rounded-md bg-secondary border border-border">
              <span className="text-[10px] text-muted-foreground">Upper</span>
              <span className="text-xs font-mono font-semibold text-foreground">${priceUpper.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-secondary border border-border text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <p className="text-[9px] text-muted-foreground">Capital Efficiency</p>
            <TipToggle tipKey="capitalEfficiency" expandedTip={null} setExpandedTip={() => {}} />
          </div>
          <p className="text-xs font-semibold font-mono-data text-foreground">{efficiencyMultiplier}x</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary border border-border text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <p className="text-[9px] text-muted-foreground">Daily Fees (est.)</p>
            <TipToggle tipKey="dailyFees" expandedTip={null} setExpandedTip={() => {}} />
          </div>
          <p className="text-xs font-semibold font-mono-data text-success">${dailyFeesInRange}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary border border-border text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <p className="text-[9px] text-muted-foreground">Out-of-Range Risk</p>
            <HelpCircle className="w-2.5 h-2.5 text-muted-foreground/50" />
          </div>
          <p className={`text-xs font-semibold font-mono-data ${outOfRangeDays > 15 ? "text-destructive" : outOfRangeDays > 8 ? "text-warning" : "text-success"}`}>~{outOfRangeDays}d / 30d</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary border border-border text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <p className="text-[9px] text-muted-foreground">Effective Liquidity</p>
            <HelpCircle className="w-2.5 h-2.5 text-muted-foreground/50" />
          </div>
          <p className="text-xs font-semibold font-mono-data text-foreground">${(capital * parseFloat(efficiencyMultiplier)).toLocaleString()}</p>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rangeData}>
            <defs>
              <linearGradient id="rangeInGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.green} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.green} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="price" tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={(v) => `$${v}`} />
            <YAxis tick={{ fontSize: 9, fill: colors.tick }} hide />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Price: $${v}`}
            formatter={(v: number, _name: string, entry: any) => [`${v.toFixed(1)}%`, entry.payload.inRange ? "In Range ✓" : "Out of Range"]} />
            <Area type="monotone" dataKey="density" stroke={colors.green} fill="url(#rangeInGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>);

};

export default BeginnerMode;