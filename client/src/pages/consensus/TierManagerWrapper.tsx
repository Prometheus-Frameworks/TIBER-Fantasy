import React from "react";
import TierManager from "./TierManager";
import LiveTrainingConsole from "./LiveTrainingConsole";
import type { ConsensusFormat } from "@shared/types/consensus";

export default function TierManagerWrapper() {
  // Default to dynasty format for now
  const format: ConsensusFormat = "dynasty";
  
  return (
    <div className="space-y-6">
      <LiveTrainingConsole format={format} />
      <TierManager format={format} />
    </div>
  );
}