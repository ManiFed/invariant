import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ForecastIndex from "@/forecasting/pages/ForecastIndex";
import Lessons from "@/forecasting/pages/Lessons";
import Arena from "@/forecasting/pages/Arena";
import Drills from "@/forecasting/pages/Drills";
import Profile from "@/forecasting/pages/Profile";
import NotFound from "@/pages/NotFound";
import { forecastRoute } from "@/forecasting/lib/routes";

const queryClient = new QueryClient();

const ForecastApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path={forecastRoute()} element={<ForecastIndex />} />
          <Route path={forecastRoute("/lessons")} element={<Lessons />} />
          <Route path={forecastRoute("/arena")} element={<Arena />} />
          <Route path={forecastRoute("/drills")} element={<Drills />} />
          <Route path={forecastRoute("/profile")} element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default ForecastApp;
