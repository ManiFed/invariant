import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import ForecastApp from "@/forecasting/ForecastApp";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <ForecastApp />
  </ThemeProvider>,
);
