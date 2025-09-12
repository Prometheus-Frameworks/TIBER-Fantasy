// src/data/normalizers/news.ts
import { NewsSignal } from "../interfaces";

export function normalizeNews(n: NewsSignal): NewsSignal {
  return {
    newsHeat: Math.max(0, Math.min(100, n.newsHeat ?? 50)),
    ecrDelta: Math.max(-15, Math.min(15, n.ecrDelta ?? 0)),
  };
}