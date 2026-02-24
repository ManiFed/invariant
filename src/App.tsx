import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LandingPortal from "./pages/LandingPortal";
import GovernanceWorkspace from "./pages/GovernanceWorkspace";
import BeginnerMode from "./pages/BeginnerMode";
import AdvancedMode from "./pages/AdvancedMode";
import TeachingLab from "./pages/TeachingLab";
import Documentation from "./pages/Documentation";
import Library from "./pages/Library";
import Labs from "./pages/Labs";
import MultiAssetLab from "./pages/MultiAssetLab";
import TimeVarianceLab from "./pages/TimeVarianceLab";
import DiscoveryAtlas from "./pages/DiscoveryAtlas";
import LiquidityStrategyLab from "./pages/LiquidityStrategyLab";
import NotFound from "./pages/NotFound";
import FloatingAIChat from "./components/FloatingAIChat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPortal />} />
          <Route path="/studio" element={<Index />} />
          <Route path="/governance-workspace" element={<GovernanceWorkspace />} />
          <Route path="/beginner" element={<BeginnerMode />} />
          <Route path="/advanced" element={<AdvancedMode />} />
          <Route path="/learn" element={<TeachingLab />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/library" element={<Library />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/labs/multi-asset" element={<MultiAssetLab />} />
          <Route path="/labs/time-variance" element={<TimeVarianceLab />} />
          <Route path="/labs/discovery" element={<DiscoveryAtlas />} />
          <Route path="/labs/strategy" element={<LiquidityStrategyLab />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingAIChat />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
