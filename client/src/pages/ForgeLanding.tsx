import { Link } from 'wouter';

const pillars = [
  {
    title: 'Talent',
    value: '91',
    desc: 'Athletic profile, ability markers, and traits that survive beyond short-term noise.',
  },
  {
    title: 'Usage',
    value: '88',
    desc: 'Snaps, routes, targets, carries, leverage, and role stability inside the offense.',
  },
  {
    title: 'Environment',
    value: '84',
    desc: 'Team ecosystem, offensive structure, scoring context, and surrounding support.',
  },
  {
    title: 'Translation',
    value: '90',
    desc: 'The layer that converts raw football information into fantasy-relevant signal.',
  },
];

const flow = [
  {
    step: '01',
    title: 'Ingest',
    desc: 'Raw game, player, and context data enter the engine.',
  },
  {
    step: '02',
    title: 'Normalize',
    desc: 'FORGE adjusts for role, environment, and position-specific interpretation.',
  },
  {
    step: '03',
    title: 'Weight',
    desc: 'Pillars are blended into a unified grade with transparent scoring logic.',
  },
  {
    step: '04',
    title: 'Deploy',
    desc: 'Outputs feed rankings, profiles, comparisons, and agent-facing responses.',
  },
];

const outputs = [
  'Alpha score and tiering',
  'Pillar-level architecture',
  'Role vs efficiency signal',
  'Context-aware player evaluation',
];

export default function ForgeLanding() {
  const scrollToSequence = () => {
    document.getElementById('engine-sequence')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-neutral-100">

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(226,100,13,0.07),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.04),transparent_28%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">

            {/* Left — copy */}
            <div>
              <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-[11px] uppercase tracking-[0.26em] text-slate-400 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                TIBER Core Engine
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                FORGE is the machine behind the grade.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
                Built to process noisy football inputs, stabilize context, and produce explainable player signal. FORGE is not a decorative ranking layer — it is the scoring infrastructure underneath TIBER.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/tiers"
                  className="rounded-xl border border-slate-600 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 hover:scale-[1.02]"
                >
                  Enter FORGE
                </Link>
                <button
                  onClick={scrollToSequence}
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-5 py-2.5 text-sm font-medium text-slate-200 backdrop-blur transition hover:bg-slate-700/80"
                >
                  Inspect Engine Flow
                </button>
              </div>

              {/* Stat cards */}
              <div className="mt-12 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Signal</p>
                  <p className="mt-3 font-mono text-3xl font-semibold text-white">87.4</p>
                  <p className="mt-1 text-xs text-slate-400">FORGE Alpha</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Classification</p>
                  <p className="mt-3 text-sm font-medium text-white">High-conviction asset</p>
                  <p className="mt-1 text-xs text-slate-400">Stable role, strong translation</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Deployment</p>
                  <p className="mt-3 text-sm font-medium text-white">Rankings · Profiles · Agents</p>
                  <p className="mt-1 text-xs text-slate-400">Downstream engine outputs</p>
                </div>
              </div>
            </div>

            {/* Right — schematic panel */}
            <div className="relative">
              <div className="absolute -inset-6 bg-[radial-gradient(circle,rgba(226,100,13,0.1),transparent_50%)] blur-3xl" />
              <div className="relative overflow-hidden rounded-[24px] border border-slate-700 bg-slate-900/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="rounded-[20px] border border-slate-800 bg-[#0a0e1a] p-5">

                  {/* Panel header */}
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Engine Schematic</p>
                      <h2 className="mt-1.5 text-lg font-semibold text-white">FORGE Signal Pipeline</h2>
                    </div>
                    <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-400 whitespace-nowrap">
                      Core Active
                    </div>
                  </div>

                  {/* Grid background panel */}
                  <div className="relative overflow-hidden rounded-[16px] border border-slate-800 bg-black/40 p-4">
                    <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />

                    <div className="relative space-y-3">
                      {/* Row 1 — pipeline */}
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Input</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Raw Data</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Snaps, routes, targets, efficiency, athletic markers, team context</p>
                        </div>
                        <div className="pt-5 text-slate-600 text-sm">→</div>
                        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(226,100,13,0.3)', background: 'rgba(226,100,13,0.07)', boxShadow: '0 0 20px rgba(226,100,13,0.08)' }}>
                          <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(226,100,13,0.7)' }}>Core Process</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Normalization</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-400">Adjusts for role, position, volatility, and environmental distortion</p>
                        </div>
                        <div className="pt-5 text-slate-600 text-sm">→</div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Output</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Alpha Score</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Tiering, ranking placement, engine-readable signal</p>
                        </div>
                      </div>

                      {/* Row 2 — subsystems */}
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Subsystem</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Talent + Usage</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Ability, deployment, volume shape, workload quality</p>
                        </div>
                        <div className="pt-5 text-slate-600 text-sm">↘</div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Weight Engine</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Pillar Blending</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Talent, usage, environment, and translation merged into final grade</p>
                        </div>
                        <div className="pt-5 text-slate-600 text-sm">↙</div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Subsystem</p>
                          <p className="mt-1.5 text-xs font-medium text-white">Environment + Translation</p>
                          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Context insulation, conditions, signal conversion</p>
                        </div>
                      </div>

                      {/* Downstream routing */}
                      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Downstream Routing</p>
                            <p className="mt-1 text-xs font-medium text-slate-200">Rankings · Player Pages · Trade Tools · Agent Responses</p>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {pillars.map((p) => (
                              <div key={p.title} className="rounded-lg border border-slate-800 bg-black/50 px-2 py-1.5 text-center">
                                <p className="text-[8px] uppercase tracking-[0.15em] text-slate-600">{p.title}</p>
                                <p className="mt-0.5 font-mono text-xs font-semibold text-white">{p.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Engine Sequence ──────────────────────────────────────── */}
      <section id="engine-sequence" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Engine Sequence</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Show the mechanism clearly or don't bother showing the engine at all.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            In under ten seconds a user should understand what goes in, what FORGE does to it, and what comes out.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {flow.map((item) => (
            <div
              key={item.step}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:-translate-y-0.5 hover:bg-slate-900/80 hover:border-slate-700"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-600">{item.step}</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pillar detail ────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <p className="mb-6 text-[10px] uppercase tracking-[0.26em] text-slate-500">Scoring Pillars</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-2xl border border-slate-800 bg-[#0a0e1a] p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="font-mono text-2xl font-semibold text-white">{p.value}</p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.value}%`,
                      background: '#e2640d',
                      opacity: 0.8,
                    }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Infrastructure ───────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Infrastructure Layer</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            FORGE should feel expensive, technical, and dependable.
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Not glossy for the sake of it — just deliberate. FORGE is the computation layer underneath rankings, player pages, comparisons, and agent workflows.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {outputs.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-800 bg-[#0a0e1a] px-4 py-3 text-sm text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/forge/inspect"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              Open player inspector →
            </Link>
          </div>
        </div>

        {/* Operational diagram */}
        <div className="rounded-2xl border border-slate-800 bg-[#0a0e1a] p-6">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Operational Diagram</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-white">Inputs</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Usage, efficiency, athleticism, historical production, and surrounding team context.
              </p>
            </div>
            <div className="flex items-center justify-center text-slate-700">↓</div>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'rgba(226,100,13,0.25)', background: 'rgba(226,100,13,0.05)' }}
            >
              <p className="text-sm font-medium text-white">FORGE Core</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Role normalization, pillar blending, weight application, and signal translation into a unified grade.
              </p>
            </div>
            <div className="flex items-center justify-center text-slate-700">↓</div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-white">Products</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Rankings, trade analysis, player pages, comparison workflows, and agent-consumable outputs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Closing CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div
          className="overflow-hidden rounded-2xl border border-slate-800 p-8 lg:p-10"
          style={{ background: 'linear-gradient(135deg, rgba(226,100,13,0.08), rgba(255,255,255,0.02))' }}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Positioning</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Stop presenting FORGE like a feature. Present it like the scoring backbone.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Less dashboard fluff. More system confidence. FORGE is the core machinery that powers the rest of TIBER.
              </p>
            </div>
            <Link
              href="/admin/forge-lab"
              className="whitespace-nowrap rounded-xl border border-slate-600 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 hover:scale-[1.02]"
            >
              Open FORGE Lab
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
