// src/data/normalizers/usage.ts
import { SleeperUsage } from "../interfaces";

/** RB weighted touches: targets are ~1.5x carries for fantasy utility */
export function calcWeightedTouches(u: SleeperUsage): number {
  const carries = u.carries ?? 0;
  const targets = u.targets ?? 0;
  return targets * 1.5 + carries;
}