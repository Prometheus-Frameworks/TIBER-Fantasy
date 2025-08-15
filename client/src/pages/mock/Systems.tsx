import MockLanding from "../MockLanding";

export default function Systems() {
  return (
    <MockLanding
      title="Systems Overview"
      route="/systems"
      status="missing"
      description="Comprehensive overview of all OTC analytical systems and tools"
      features={[
        "Player Compass navigation hub",
        "Consensus rankings dashboard", 
        "Draft Command center",
        "Intelligence feed aggregator",
        "Analytics pipeline status"
      ]}
    />
  );
}