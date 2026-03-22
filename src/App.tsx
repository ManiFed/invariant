import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import BeginnerMode from "./pages/BeginnerMode";
import AdvancedMode from "./pages/AdvancedMode";
import PoolComparison from "./pages/PoolComparison";
import KeyboardShortcutsHelp from "./components/KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import TeachingLab from "./pages/TeachingLab";
import DocsLayout from "./pages/docs/DocsLayout";
import DocsIndex from "./pages/docs/DocsIndex";
import DocsSection from "./pages/docs/DocsSection";
import Library from "./pages/Library";
import Labs from "./pages/Labs";
import AMMDesignStudio from "./pages/AMMDesignStudio";
import MultiAssetLab from "./pages/MultiAssetLab";
import TimeVarianceLab from "./pages/TimeVarianceLab";
import DiscoveryAtlas from "./pages/DiscoveryAtlas";
import LiquidityStrategyLab from "./pages/LiquidityStrategyLab";
import DNALab from "./pages/DNALab";
import MarketReplayLab from "./pages/MarketReplayLab";
import MEVLab from "./pages/MEVLab";
import CompilerLab from "./pages/CompilerLab";
import AMMBuilderLab from "./pages/AMMBuilderLab";
import Challenges from "./pages/Challenges";
import NotFound from "./pages/NotFound";
import FloatingAIChat from "./components/FloatingAIChat";
import { AmmyContextProvider } from "./lib/ammy-context";
import ForecastIndex from "./forecasting/pages/ForecastIndex";
import Lessons from "./forecasting/pages/Lessons";
import Arena from "./forecasting/pages/Arena";
import Drills from "./forecasting/pages/Drills";
import Profile from "./forecasting/pages/Profile";
import { forecastRoute } from "./forecasting/lib/routes";

const queryClient = new QueryClient();

const AppShortcuts = () => {
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts();
  return <KeyboardShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} shortcuts={shortcuts} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AmmyContextProvider>
          <AppShortcuts />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/beginner" element={<BeginnerMode />} />
            <Route path="/advanced" element={<AdvancedMode />} />
            <Route path="/compare" element={<PoolComparison />} />
            <Route path="/learn" element={<TeachingLab />} />
            {/* Multi-page Documentation */}
            <Route path="/docs" element={<DocsLayout />}>
              <Route index element={<DocsIndex />} />
              <Route path=":sectionId" element={<DocsSection />} />
              <Route path=":sectionId/:subsectionId" element={<DocsSection />} />
            </Route>
            {/* Legacy redirect */}
            <Route path="/documentation" element={<Navigate to="/docs" replace />} />
            <Route path="/library" element={<Library />} />
            <Route path="/labs" element={<Labs />} />
            <Route path="/design-studio" element={<AMMDesignStudio />} />
            <Route path="/labs/design-studio" element={<AMMDesignStudio />} />
            <Route path="/labs/multi-asset" element={<MultiAssetLab />} />
            <Route path="/labs/time-variance" element={<TimeVarianceLab />} />
            <Route path="/labs/discover" element={<DiscoveryAtlas />} />
            <Route path="/labs/discovery" element={<DiscoveryAtlas />} />
            <Route path="/labs/strategy" element={<LiquidityStrategyLab />} />
            <Route path="/labs/dna" element={<DNALab />} />
            <Route path="/labs/replay" element={<MarketReplayLab />} />
            <Route path="/labs/mev" element={<MEVLab />} />
            <Route path="/labs/compiler" element={<CompilerLab />} />
            <Route path="/labs/amm-builder" element={<AMMBuilderLab />} />
            <Route path="/challenges" element={<Navigate to="/learn?mode=challenges" replace />} />
            {/* Forecast Lab — separate service */}
            <Route path={forecastRoute()} element={<ForecastIndex />} />
            <Route path={forecastRoute("/lessons")} element={<Lessons />} />
            <Route path={forecastRoute("/arena")} element={<Arena />} />
            <Route path={forecastRoute("/drills")} element={<Drills />} />
            <Route path={forecastRoute("/profile")} element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingAIChat />
        </AmmyContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
