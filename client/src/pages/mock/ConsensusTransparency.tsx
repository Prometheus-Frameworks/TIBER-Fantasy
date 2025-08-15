import MockLanding from "../MockLanding";

export default function MockConsensusTransparency() {
  return (
    <MockLanding
      title="Consensus Transparency"
      route="/consensus/transparency"
      status="planned"
      description="Methodology and audit trail for OTC consensus rankings"
      features={[
        "Ranking methodology explanation",
        "Community input weights",
        "Bias detection algorithms",
        "Historical accuracy tracking",
        "Expert contributor profiles",
        "Open-source audit trail"
      ]}
    />
  );
}