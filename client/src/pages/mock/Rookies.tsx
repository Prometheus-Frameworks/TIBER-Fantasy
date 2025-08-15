import MockLanding from "../MockLanding";

export default function MockRookies() {
  return (
    <MockLanding
      title="2025 Rookies"
      route="/rookies"
      status="building"
      description="2025 rookie class preview with player comparisons and draft analysis"
      features={[
        "Rookie evaluation with S/A/B/C/D tiers",
        "NFL Draft capital analysis",
        "Landing spot scenarios",
        "College production metrics",
        "Pro comparison database",
        "Dynasty rookie draft prep"
      ]}
    />
  );
}