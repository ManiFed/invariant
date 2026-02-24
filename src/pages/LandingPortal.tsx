import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, Network } from "lucide-react";

const projects = [
  {
    title: "Invariant Studio",
    description:
      "Design and analyze AMM invariants with educational labs and advanced simulation tooling.",
    href: "/studio",
    icon: Network,
    badge: "Existing project",
  },
  {
    title: "Governance Mechanism Workspace",
    description:
      "A private, single-user lab bench for policy design using conditional prediction markets.",
    href: "/governance-workspace",
    icon: FlaskConical,
    badge: "Phase 1 prototype",
  },
];

const LandingPortal = () => {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Project Portal</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Choose your workspace</h1>
          <p className="max-w-3xl text-lg text-slate-300">
            This repo now hosts two distinct products. Start in Invariant Studio or open the governance mechanism workspace.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {projects.map(({ title, description, href, icon: Icon, badge }) => (
            <Link
              key={title}
              to={href}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-7 transition hover:border-slate-500 hover:bg-slate-900"
            >
              <div className="mb-4 inline-flex rounded-lg bg-slate-800 p-2 text-cyan-300">
                <Icon size={20} />
              </div>
              <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">{badge}</div>
              <h2 className="mb-2 text-2xl font-semibold">{title}</h2>
              <p className="text-slate-300">{description}</p>
              <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-cyan-300">
                Open workspace <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
};

export default LandingPortal;
