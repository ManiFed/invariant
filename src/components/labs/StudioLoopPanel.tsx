import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, GitCompare } from "lucide-react";
import type { Candidate, EngineState, RegimeId } from "@/lib/discovery-engine";
import { REGIMES, candidateToMechanism, mechanismToCandidate, type MechanismObject } from "@/lib/discovery-engine";

interface StudioLoopPanelProps {
  state: EngineState;
  onImportStudioCandidate: (candidate: Candidate) => void;
}

const StudioLoopPanel = ({ state, onImportStudioCandidate }: StudioLoopPanelProps) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedRegime, setSelectedRegime] = useState<RegimeId>("low-vol");
  const [draft, setDraft] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const ranked = useMemo(() => [...state.archive].sort((a, b) => a.score - b.score).slice(0, 30), [state.archive]);
  const selected = ranked.find((candidate) => candidate.id === selectedId) ?? ranked[0] ?? null;

  const exportSelected = () => {
    if (!selected) return;
    const mechanism = candidateToMechanism(selected);
    setDraft(JSON.stringify(mechanism, null, 2));
    setStatus(`Exported ${selected.id} from Atlas into a Studio mechanism object.`);
  };

  const importDraft = () => {
    try {
      const parsed = JSON.parse(draft) as MechanismObject;
      const withStudioOrigin: MechanismObject = { ...parsed, origin: "studio", id: parsed.id || `studio-${Date.now().toString(36)}` };
      const candidate = mechanismToCandidate(withStudioOrigin, selectedRegime, state.totalGenerations + 1);
      onImportStudioCandidate(candidate);
      setStatus(`Imported Studio design ${candidate.id} into Atlas for ${selectedRegime}.`);
    } catch {
      setStatus("Invalid JSON. Please provide a valid mechanism object.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-elevated rounded-xl p-4 border border-border/50">
        <h3 className="text-sm font-semibold mb-2">Studio ↔ Atlas Closed Loop</h3>
        <p className="text-xs text-muted-foreground">Export discovered mechanisms into Studio and import hand-crafted Studio designs back into Atlas map coordinates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="surface-elevated rounded-xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold"><ArrowDownToLine className="w-3.5 h-3.5" /> Export Atlas design</div>
          <select className="w-full px-2 py-2 rounded border border-border bg-background text-xs" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
            {ranked.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.id} · {candidate.familyId} · {candidate.score.toFixed(3)}</option>
            ))}
          </select>
          <button onClick={exportSelected} className="px-3 py-1.5 rounded-md bg-secondary border border-border text-xs hover:bg-accent">Export to mechanism JSON</button>
        </div>

        <div className="surface-elevated rounded-xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold"><ArrowUpFromLine className="w-3.5 h-3.5" /> Import Studio design</div>
          <select className="w-full px-2 py-2 rounded border border-border bg-background text-xs" value={selectedRegime} onChange={(event) => setSelectedRegime(event.target.value as RegimeId)}>
            {REGIMES.map((regime) => <option key={regime.id} value={regime.id}>{regime.label}</option>)}
          </select>
          <button onClick={importDraft} className="px-3 py-1.5 rounded-md bg-secondary border border-border text-xs hover:bg-accent">Evaluate and place on Atlas</button>
        </div>
      </div>

      <div className="surface-elevated rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 text-xs font-semibold mb-2"><GitCompare className="w-3.5 h-3.5" /> Mechanism object editor</div>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="w-full h-72 p-3 rounded border border-border bg-background text-[11px] font-mono" placeholder='{"id":"studio-x","origin":"studio",...}' />
        {status && <p className="text-[11px] text-muted-foreground mt-2">{status}</p>}
      </div>
    </div>
  );
};

export default StudioLoopPanel;
