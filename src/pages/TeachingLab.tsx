import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LabControls, { type LessonTab, type Controls } from "@/components/teaching/LabControls";
import LabSimulation from "@/components/teaching/LabSimulation";
import LabLearning from "@/components/teaching/LabLearning";
import CourseSidebar from "@/components/teaching/CourseSidebar";
import { COURSE_MODULES, getRevealedSections, MODULE_TAB_MAP } from "@/lib/course-content";
import { createPool, executeTrade, executeArbitrage, gbmStep, poolPrice, calcIL, lpValue, hodlValue, type PoolState, type TradeResult, type HistoryPoint } from "@/lib/amm-engine";

export default function TeachingLab() {
  const navigate = useNavigate();

  // Course state
  const [courseActive, setCourseActive] = useState(true);
  const [courseModule, setCourseModule] = useState(0);
  const [courseStep, setCourseStep] = useState(0);
  const [completedModules, setCompletedModules] = useState(0);
  const revealedSections = getRevealedSections(completedModules);
  const courseComplete = completedModules >= COURSE_MODULES.length;

  // Simulation state
  const [tab, setTab] = useState<LessonTab>("slippage");
  const [controls, setControls] = useState<Controls>({
    reserveX: 1000, reserveY: 1000, feeRate: 0.003, volatility: 0.3,
    tradeSize: 50, direction: "buyY", timeSpeed: 0, rangeLower: 0.8,
    rangeUpper: 1.2, arbEnabled: true,
  });
  const [pool, setPool] = useState<PoolState>(() => createPool(1000, 1000, 0.003));
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [lastTrade, setLastTrade] = useState<TradeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [externalPrice, setExternalPrice] = useState(1);

  const initialX = useRef(1000);
  const initialY = useRef(1000);
  const initialPrice = useRef(1);
  const controlsRef = useRef(controls);
  const poolRef = useRef(pool);
  const externalPriceRef = useRef(1);
  const stepRef = useRef(0);

  controlsRef.current = controls;
  poolRef.current = pool;
  externalPriceRef.current = externalPrice;
  stepRef.current = step;

  const handleControlChange = useCallback((partial: Partial<Controls>) => {
    setControls(prev => {
      const next = { ...prev, ...partial };
      if (partial.reserveX !== undefined || partial.reserveY !== undefined || partial.feeRate !== undefined) {
        const newPool = createPool(next.reserveX, next.reserveY, next.feeRate);
        setPool(newPool);
        poolRef.current = newPool;
        initialX.current = next.reserveX;
        initialY.current = next.reserveY;
        initialPrice.current = next.reserveY / next.reserveX;
        setHistory([]);
        setLastTrade(null);
        setExternalPrice(next.reserveY / next.reserveX);
        externalPriceRef.current = next.reserveY / next.reserveX;
        setStep(0);
        stepRef.current = 0;
      }
      return next;
    });
  }, []);

  const addHistoryPoint = useCallback((p: PoolState, extP: number, s: number, arb: boolean) => {
    const price = poolPrice(p);
    const il = calcIL(initialPrice.current, price);
    const lp = lpValue(p, price);
    const hodl = hodlValue(initialX.current, initialY.current, price);
    const point: HistoryPoint = {
      step: s, poolPrice: price, externalPrice: extP, lpValue: lp,
      hodlValue: hodl, ilPct: il, feesAccum: p.totalFees,
      reserveX: p.x, reserveY: p.y, arbEvent: arb,
    };
    setHistory(prev => [...prev, point]);
  }, []);

  const handleExecuteTrade = useCallback(() => {
    const c = controlsRef.current;
    const { pool: newPool, result } = executeTrade(poolRef.current, c.tradeSize, c.direction);
    setPool(newPool);
    poolRef.current = newPool;
    setLastTrade(result);
    const s = stepRef.current + 1;
    setStep(s);
    stepRef.current = s;
    addHistoryPoint(newPool, externalPriceRef.current, s, false);
  }, [addHistoryPoint]);

  const handleReset = useCallback(() => {
    const c = controlsRef.current;
    const newPool = createPool(c.reserveX, c.reserveY, c.feeRate);
    setPool(newPool);
    poolRef.current = newPool;
    initialX.current = c.reserveX;
    initialY.current = c.reserveY;
    initialPrice.current = c.reserveY / c.reserveX;
    setHistory([]);
    setLastTrade(null);
    setExternalPrice(c.reserveY / c.reserveX);
    externalPriceRef.current = c.reserveY / c.reserveX;
    setStep(0);
    stepRef.current = 0;
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning || controls.timeSpeed === 0) return;
    const interval = setInterval(() => {
      const c = controlsRef.current;
      const newExtPrice = gbmStep(externalPriceRef.current, c.volatility, 1 / 252);
      externalPriceRef.current = newExtPrice;
      setExternalPrice(newExtPrice);
      let currentPool = poolRef.current;
      let arbed = false;
      if (c.arbEnabled) {
        const arbResult = executeArbitrage(currentPool, newExtPrice);
        currentPool = arbResult.pool;
        arbed = arbResult.traded;
      }
      setPool(currentPool);
      poolRef.current = currentPool;
      const s = stepRef.current + 1;
      setStep(s);
      stepRef.current = s;
      addHistoryPoint(currentPool, newExtPrice, s, arbed);
    }, Math.max(50, 1000 / controls.timeSpeed));
    return () => clearInterval(interval);
  }, [isRunning, controls.timeSpeed, addHistoryPoint]);

  const handleAdvanceStep = () => setCourseStep(s => s + 1);

  const handleGoBack = () => {
    if (courseStep > 0) {
      setCourseStep(s => s - 1);
    } else if (courseModule > 0) {
      const prevMod = courseModule - 1;
      setCourseModule(prevMod);
      setCourseStep(COURSE_MODULES[prevMod].steps.length - 1);
      // Update tab to match the module we're going back to
      const mappedTab = MODULE_TAB_MAP[COURSE_MODULES[prevMod].id] as LessonTab;
      if (mappedTab) setTab(mappedTab);
    }
  };

  const handleCompleteModule = () => {
    const next = courseModule + 1;
    setCompletedModules(m => Math.max(m, courseModule + 1));
    if (next >= COURSE_MODULES.length) {
      setCourseActive(false);
    } else {
      setCourseModule(next);
      setCourseStep(0);
      const mappedTab = MODULE_TAB_MAP[COURSE_MODULES[next].id] as LessonTab;
      if (mappedTab) setTab(mappedTab);
    }
  };

  const handleSkipCourse = () => {
    setCourseActive(false);
    setCompletedModules(COURSE_MODULES.length);
  };

  const handleNavigateModule = (idx: number) => {
    if (idx < completedModules || courseComplete) {
      setCourseModule(idx);
      setCourseStep(0);
      if (!courseActive && !courseComplete) {
        setCourseActive(true);
      }
    }
  };

  // Determine what to show based on progress
  const showControls = courseComplete || revealedSections.has("controls");
  const showCurve = courseComplete || revealedSections.has("curve");
  const showReserves = courseComplete || revealedSections.has("reserves");
  const showMetrics = courseComplete || revealedSections.has("metrics");
  const showPriceChart = courseComplete || revealedSections.has("price-chart");
  const showLearning = courseComplete || revealedSections.has("learning");

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground tracking-tight">AMM TEACHING LAB</span>
          {!courseComplete && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warning/30 text-warning">
              MODULE {courseModule + 1}/{COURSE_MODULES.length}
            </span>
          )}
          {courseComplete && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-success/30 text-success">
              COMPLETE ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {courseComplete && (
            <button
              onClick={() => { setCourseActive(true); setCourseModule(0); setCourseStep(0); setCompletedModules(0); }}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Restart Course
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Three columns */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Controls */}
        <div className={`w-80 border-r border-border shrink-0 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-20 pointer-events-none"}`}>
          <LabControls
            tab={tab}
            onTabChange={setTab}
            controls={controls}
            onChange={handleControlChange}
            onExecuteTrade={handleExecuteTrade}
            onReset={handleReset}
            isRunning={isRunning}
            onToggleRun={() => setIsRunning(r => !r)}
            courseActive={courseActive}
            courseModule={courseModule}
            completedModules={completedModules}
            onNavigateModule={handleNavigateModule}
          />
        </div>

        {/* Center: Simulation */}
        <div className={`flex-1 min-w-0 transition-opacity duration-500 ${(showCurve || showReserves) ? "opacity-100" : "opacity-20 pointer-events-none"}`}>
          <LabSimulation
            pool={pool}
            history={history}
            lastTrade={lastTrade}
            tab={tab}
            rangeLower={controls.rangeLower}
            rangeUpper={controls.rangeUpper}
            showCurve={showCurve}
            showReserves={showReserves}
            showPriceChart={showPriceChart}
          />
        </div>

        {/* Right: Course sidebar or Learning panel */}
        <div className={`w-72 border-l border-border shrink-0 transition-opacity duration-500 ${
          courseActive || showMetrics || showLearning ? "opacity-100" : "opacity-20 pointer-events-none"
        }`}>
          {courseActive && !courseComplete ? (
            <CourseSidebar
              currentModule={courseModule}
              currentStep={courseStep}
              onAdvanceStep={handleAdvanceStep}
              onGoBack={handleGoBack}
              onCompleteModule={handleCompleteModule}
              onSkipCourse={handleSkipCourse}
              totalModules={COURSE_MODULES.length}
            />
          ) : (
            <LabLearning
              pool={pool}
              history={history}
              lastTrade={lastTrade}
              tab={tab}
              initialX={initialX.current}
              initialY={initialY.current}
              initialPrice={initialPrice.current}
              rangeLower={controls.rangeLower}
              rangeUpper={controls.rangeUpper}
            />
          )}
        </div>
      </div>
    </div>
  );
}
