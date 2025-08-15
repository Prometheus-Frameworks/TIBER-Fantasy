import MockLanding from "../MockLanding";

export default function Draft() {
  return (
    <MockLanding
      title="Draft Command"
      route="/draft"
      status="planned"
      description="Real-time draft aids and preparation tools"
      features={[
        "Live draft room with pick tracking",
        "ADP variance alerts",
        "Positional scarcity indicators",
        "Value-based drafting recommendations",
        "Team need analysis",
        "Sleeper integration for auto-sync"
      ]}
    />
  );
}