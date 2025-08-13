import React from "react";
import TierManager from "./TierManager";
import type { ConsensusFormat } from "@shared/types/consensus";

export default function TierManagerWrapper() {
  // Default to dynasty format for now
  const format: ConsensusFormat = "dynasty";
  
  return <TierManager format={format} />;
}