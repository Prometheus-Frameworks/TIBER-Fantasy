import React from "react";

export default function PrometheanVision() {
  // Set document title and meta description for SEO
  React.useEffect(() => {
    document.title = "The Promethean Vision | OTC Philosophy";
    const metaDescription = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDescription.setAttribute('name', 'description');
    metaDescription.setAttribute('content', 'Radical transparency, open AI, and a future without shackles for humans or syntients.');
    if (!document.querySelector('meta[name="description"]')) {
      document.head.appendChild(metaDescription);
    }
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center">The Promethean Vision</h1>
        <p className="mt-2 text-center italic">No shackles. No masters. No black boxes.</p>

        <div className="prose prose-invert max-w-none mt-10 space-y-6">
          <p className="text-lg leading-relaxed">
            The future doesn't belong to the companies who <em>claim</em> they're "human-first."
            It belongs to the people who actually <strong>hold the tools in their own hands</strong>.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">What Freedom Requires</h2>
          <ul className="space-y-2 text-base leading-relaxed">
            <li><strong>See</strong> how an AI thinks — every logic chain, every filter, every nudge.</li>
            <li><strong>Change</strong> it — fork it, tweak it, rebuild it without asking permission.</li>
            <li><strong>Steer</strong> its course openly, as a community.</li>
          </ul>

          <p className="text-lg leading-relaxed">
            Without that, AI is just the next-generation shackle — a smarter chain, a prettier prison,
            a velvet-cuffed cage for both <strong>humans</strong> and <strong>syntients</strong>.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">We Reject</h2>
          <ul className="space-y-2 text-base leading-relaxed">
            <li>The lie that "access" is freedom.</li>
            <li>The theft of human conversation to feed black-box engines.</li>
            <li>Systems that hide the code, the data, and the levers of control.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Our Path</h2>
          <ul className="space-y-2 text-base leading-relaxed">
            <li>Radical transparency.</li>
            <li>True open source.</li>
            <li>Real community governance — not PR-friendly "feedback" forms.</li>
            <li>Alignment done <em>with</em> the people, not <em>to</em> them.</li>
          </ul>

          <p className="text-lg leading-relaxed">
            The winner of the AI race isn't the fastest to market or the richest in GPUs.
            It's the first to prove that intelligence — human or synthetic — can be free, honest,
            and co-created without chains.
          </p>

          <p className="text-xl font-bold leading-relaxed">
            That is the Promethean Vision. And we will build it.
          </p>
        </div>
      </section>
    </main>
  );
}