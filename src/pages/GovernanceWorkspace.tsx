import { ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SectionKey = "policy" | "outcome" | "markets" | "simulation";

const sections: { key: SectionKey; label: string }[] = [
  { key: "policy", label: "Policy" },
  { key: "outcome", label: "Outcome Metric" },
  { key: "markets", label: "Conditional Markets" },
  { key: "simulation", label: "Simulation" },
];

const GovernanceWorkspace = () => {
  const [activeSection, setActiveSection] = useState<SectionKey>("policy");
  const [workspaceName, setWorkspaceName] = useState("Neighborhood Mobility Pilot");
  const [metricType, setMetricType] = useState<"binary" | "scalar">("binary");
  const [resolutionMethod, setResolutionMethod] = useState("manual resolution");
  const [passProbability, setPassProbability] = useState([62]);
  const [failProbability, setFailProbability] = useState([41]);
  const [liquidityDepth, setLiquidityDepth] = useState([450]);
  const [tradingFee, setTradingFee] = useState([2]);
  const [hasRunSimulation, setHasRunSimulation] = useState(false);

  const spread = passProbability[0] - failProbability[0];
  const passLikelihood = Math.max(5, Math.min(95, 50 + spread / 2));

  const simulationSummary = useMemo(
    () => ({
      pass: `${Math.round(passLikelihood)}%`,
      sensitivity: spread > 18 ? "High sensitivity to block trades" : "Moderate sensitivity to block trades",
      capital: `$${(18000 - spread * 210).toLocaleString()}`,
    }),
    [passLikelihood, spread],
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            className="h-10 w-72 bg-slate-50 text-lg font-semibold"
          />
          <Badge className="bg-slate-900 text-slate-100">Private Draft</Badge>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setHasRunSimulation(true)}>
            Run Simulation
          </Button>
          <Button>Export Summary</Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-[220px_1fr_320px]">
        <aside className="border-r border-slate-300 bg-white p-4">
          <p className="mb-4 text-xs uppercase tracking-wider text-slate-500">Mechanism lifecycle</p>
          <div className="space-y-2">
            {sections.map((section, index) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-sm",
                  activeSection === section.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                )}
              >
                <div className="text-xs uppercase tracking-wide opacity-70">Step {index + 1}</div>
                <div className="font-medium">{section.label}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-8 overflow-y-auto p-8">
          <article className="space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Policy</h2>
            <div className="grid gap-4">
              <div>
                <Label>Policy title</Label>
                <Input defaultValue="Subsidize electric bus lanes in district corridors" />
                <p className="mt-1 text-xs text-slate-500">Name the exact policy decision that will pass or fail.</p>
              </div>
              <div>
                <Label>Plain-language description</Label>
                <Textarea
                  defaultValue="Reallocate transit budget to fund electric bus lane deployment beginning Q3, with implementation complete by year end."
                />
                <p className="mt-1 text-xs text-slate-500">Describe the proposed governance change in language non-specialists can verify.</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold">Decision Rule</h3>
              <p className="text-sm text-slate-700">
                Policy passes if <strong>Expected Outcome (Pass)</strong> is greater than <strong>Expected Outcome (Fail)</strong> after a 12-month horizon.
                Decision compares conditional market prices and resolves using the selected outcome metric.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Evaluation horizon</Label>
                  <Input defaultValue="12 months post implementation" />
                </div>
                <div>
                  <Label>Policy parameters</Label>
                  <Input defaultValue="Budget: $2.5M, Implementation date: 2027-07-01" />
                </div>
              </div>
            </div>
          </article>

          <article className="space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Outcome Metric</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Metric name</Label>
                <Input defaultValue="Average peak-hour transit delay reduction" />
              </div>
              <div>
                <Label>Metric type</Label>
                <div className="mt-2 flex gap-2">
                  <Button variant={metricType === "binary" ? "default" : "outline"} onClick={() => setMetricType("binary")}>Binary</Button>
                  <Button variant={metricType === "scalar" ? "default" : "outline"} onClick={() => setMetricType("scalar")}>Scalar</Button>
                </div>
              </div>
              <div>
                <Label>Resolution method</Label>
                <select
                  value={resolutionMethod}
                  onChange={(event) => setResolutionMethod(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                >
                  <option>manual resolution</option>
                  <option>external data feed</option>
                  <option>predefined dataset</option>
                </select>
              </div>
              <div>
                <Label>Evaluation window + units</Label>
                <Input defaultValue="Measure from month 1–12, units: minutes saved per rider" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Resolution Summary</p>
              <p>
                Metric resolves via {resolutionMethod} at the close of the 12-month observation window. Final value is interpreted as a {metricType} signal for market settlement.
              </p>
            </div>
          </article>

          <article className="space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Conditional Markets</h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_260px_1fr]">
              <MarketCard
                title="Outcome if Policy Passes"
                probability={passProbability}
                setProbability={setPassProbability}
                liquidityDepth={liquidityDepth}
                setLiquidityDepth={setLiquidityDepth}
                tradingFee={tradingFee}
                setTradingFee={setTradingFee}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <h3 className="font-semibold">Spread Comparator</h3>
                <p className="mt-2">Current spread: <strong>{spread.toFixed(1)} pts</strong></p>
                <p className="mt-2 text-slate-700">Decision threshold: pass market must remain above fail market at evaluation time.</p>
                <Separator className="my-3" />
                <p className="text-xs text-slate-500">Interpretation: positive spread implies expected improvement under adoption.</p>
              </div>
              <MarketCard
                title="Outcome if Policy Fails"
                probability={failProbability}
                setProbability={setFailProbability}
                liquidityDepth={liquidityDepth}
                setLiquidityDepth={setLiquidityDepth}
                tradingFee={tradingFee}
                setTradingFee={setTradingFee}
              />
            </div>
          </article>

          <article className="space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Simulation</h2>
            <p className="text-sm text-slate-600">Simulates informed and noise traders moving conditional prices over time.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultCard label="Policy pass probability" value={hasRunSimulation ? simulationSummary.pass : "—"} />
              <ResultCard label="Sensitivity to large trades" value={hasRunSimulation ? simulationSummary.sensitivity : "—"} />
              <ResultCard label="Capital to shift decision" value={hasRunSimulation ? simulationSummary.capital : "—"} />
            </div>
          </article>
        </section>

        <aside className="border-l border-slate-300 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Context panel</h3>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected section</p>
            <p className="mt-1 text-base font-semibold">{sections.find((s) => s.key === activeSection)?.label}</p>
            <p className="mt-2 text-sm text-slate-700">
              {activeSection === "policy" && "Define the policy change and plain-English decision rule before configuring markets."}
              {activeSection === "outcome" && "Keep the metric observable and unambiguous so markets resolve predictably."}
              {activeSection === "markets" && "Tune probabilities, liquidity, and fee structure to stress conditional differences."}
              {activeSection === "simulation" && "Run simulations to inspect robustness under informed and noisy trading flows."}
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">Metric preview</p>
            <div className="mt-3 h-40 rounded-lg border border-dashed border-slate-300 bg-white p-3">
              <div className="flex h-full items-end gap-2">
                {[22, 38, 29, 52, 61, 48].map((value, idx) => (
                  <div key={idx} className="flex-1 rounded-t bg-cyan-500/70" style={{ height: `${value}%` }} />
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Preview of expected distribution for chosen metric.</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

type MarketCardProps = {
  title: string;
  probability: number[];
  setProbability: (value: number[]) => void;
  liquidityDepth: number[];
  setLiquidityDepth: (value: number[]) => void;
  tradingFee: number[];
  setTradingFee: (value: number[]) => void;
};

const MarketCard = ({
  title,
  probability,
  setProbability,
  liquidityDepth,
  setLiquidityDepth,
  tradingFee,
  setTradingFee,
}: MarketCardProps) => (
  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="font-semibold">{title}</h3>
    <SliderRow label="Starting probability" value={probability[0]} unit="%">
      <Slider value={probability} onValueChange={setProbability} min={1} max={99} step={1} />
    </SliderRow>
    <SliderRow label="Liquidity depth" value={liquidityDepth[0]} unit="k">
      <Slider value={liquidityDepth} onValueChange={setLiquidityDepth} min={50} max={1000} step={10} />
    </SliderRow>
    <SliderRow label="Trading fee" value={tradingFee[0]} unit="%">
      <Slider value={tradingFee} onValueChange={setTradingFee} min={0.1} max={6} step={0.1} />
    </SliderRow>
  </div>
);

const SliderRow = ({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: number;
  unit: string;
  children: ReactNode;
}) => (
  <div className="space-y-2 text-sm">
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-medium">{value}{unit}</span>
    </div>
    {children}
  </div>
);

const ResultCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold">{value}</p>
  </div>
);

export default GovernanceWorkspace;
