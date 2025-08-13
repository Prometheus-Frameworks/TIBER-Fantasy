import React from "react";
import TierManager from "./TierManager";
import LiveTrainingConsole from "./LiveTrainingConsole";
import type { ConsensusFormat } from "@shared/types/consensus";

export default function TierManagerWrapper() {
  // Switch to redraft format for QB training
  const format: ConsensusFormat = "redraft";
  const season = 2025;
  
  return (
    <div className="space-y-6">
      <LiveTrainingConsole format={format} season={season} />
      <TierManager format={format} season={season} />
    </div>
  );
}