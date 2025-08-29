import fs from 'fs';
import path from 'path';

export type Row = {
  player_id: string;
  week: number;
  pos: "WR" | "RB" | "TE" | "QB";
  ppr: number | null;
  [key: string]: string | number | null;
};

export type Coeffs = {
  intercept: number;
  beta: Record<string, number>;
  features: string[];
  r2: number;
  sample: number;
};

// Updated to work with Sleeper normalized data (rate-based metrics)
const POS_FEATURES: Record<string, string[]> = {
  WR: ["routeRate", "tgtShare", "rzTgtShare"],
  TE: ["routeRate", "tgtShare", "rzTgtShare"], 
  RB: ["rushShare", "routeRate", "glRushShare"],
  QB: ["talentScore", "last6wPerf"] // QB uses different approach
};

function zSafe(x: number[]) {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  const v = Math.max(1e-9, x.reduce((a, b) => a + (b - m) * (b - m), 0) / x.length);
  return { m, s: Math.sqrt(v) };
}

export function fitOLS(rows: Row[], pos: "WR" | "RB" | "TE" | "QB"): Coeffs {
  const feats = POS_FEATURES[pos];
  const train = rows.filter(r => r.pos === pos && r.ppr != null && feats.every(f => r[f] != null));
  
  if (train.length < 150) {
    // Fallback to hand weights for insufficient data
    return getFallbackCoeffs(pos);
  }

  const X = train.map(r => feats.map(f => Number(r[f])));
  const y = train.map(r => Number(r.ppr));

  // Standardize columns
  const stats = feats.map((_, j) => zSafe(X.map(row => row[j])));
  const Xz = X.map(row => row.map((x, j) => (x - stats[j].m) / stats[j].s));

  // Closed-form OLS: beta=(X'X)^-1 X'y
  const XT = Xz[0] ? Xz[0].map((_, j) => Xz.map(r => r[j])) : [];
  
  function matMul(A: number[][], B: number[][]) {
    return A.map(r => B[0].map((_, j) => r.reduce((s, _, k) => s + r[k] * B[k][j], 0)));
  }
  
  function matInv2(M: number[][]) {
    // Small ridge for stability
    const n = M.length;
    const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
    const A = M.map((r, i) => r.map((v, j) => v + (i === j ? 1e-6 : 0)));
    
    // Naive Gauss-Jordan (n<=6 here)
    for (let i = 0; i < n; i++) {
      let p = A[i][i];
      if (Math.abs(p) < 1e-9) continue;
      for (let j = 0; j < n; j++) { A[i][j] /= p; I[i][j] /= p; }
      for (let k = 0; k < n; k++) if (k !== i) {
        const f = A[k][i];
        for (let j = 0; j < n; j++) { A[k][j] -= f * A[i][j]; I[k][j] -= f * I[i][j]; }
      }
    }
    return I;
  }

  const Xt = XT;                           // (d x n)
  const XtX = matMul(Xt, Xz);              // (d x d)
  const XtXInv = matInv2(XtX);             // (d x d)
  const Xty = Xt.map(r => [r.reduce((s, v, i) => s + v * y[i], 0)]); // (d x 1)
  const betaZ = matMul(XtXInv, Xty).map(r => r[0]); // standardized betas

  // Un-standardize to original scale: y = a + Σ b_j * x_j
  const yStats = zSafe(y);
  const betaOrig: number[] = betaZ.map((bz, j) => bz * (yStats.s / stats[j].s));
  const intercept = yStats.m - betaOrig.reduce((s, bj, j) => s + bj * stats[j].m, 0);

  // R^2 quick calc
  const yhat = X.map(row => intercept + betaOrig.reduce((s, bj, j) => s + bj * row[j], 0));
  const ssTot = y.reduce((s, yi) => s + (yi - yStats.m) * (yi - yStats.m), 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - yhat[i]) * (yi - yhat[i]), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    intercept,
    beta: Object.fromEntries(feats.map((f, i) => [f, betaOrig[i]])),
    features: feats,
    r2,
    sample: train.length
  };
}

export function predictXfp(r: Row, C: Coeffs): number | null {
  if (!C.features.every(f => r[f] != null)) return null;
  return C.intercept + C.features.reduce((s, f) => s + C.beta[f] * Number(r[f]), 0);
}

function getFallbackCoeffs(pos: "WR" | "RB" | "TE" | "QB"): Coeffs {
  const fallbacks: Record<string, Coeffs> = {
    WR: {
      intercept: 0.0,
      beta: { targets: 0.8, redZoneTargets: 0.15, airYards: 0.05 },
      features: ["targets", "redZoneTargets", "airYards"],
      r2: 0.35,
      sample: 0
    },
    RB: {
      intercept: 0.0,
      beta: { carries: 0.7, targets: 0.2, goalLineRushes: 0.1 },
      features: ["carries", "targets", "goalLineRushes"],
      r2: 0.35,
      sample: 0
    },
    TE: {
      intercept: 0.0,
      beta: { targets: 0.85, redZoneTargets: 0.15 },
      features: ["targets", "redZoneTargets"],
      r2: 0.30,
      sample: 0
    },
    QB: {
      intercept: 0.0,
      beta: { dropbacks: 0.85, designedRushes: 0.15 },
      features: ["dropbacks", "designedRushes"],
      r2: 0.40,
      sample: 0
    }
  };
  
  return fallbacks[pos] || fallbacks.WR;
}

// Load seed coefficients if needed
export function loadSeedCoeffs(): Record<string, Coeffs> {
  try {
    const seedPath = path.join(process.cwd(), 'config', 'xfp.coeffs.seed.json');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    
    return {
      WR: seedData.WR,
      RB: seedData.RB,
      TE: seedData.TE,
      QB: seedData.QB
    };
  } catch (error) {
    console.warn('[xFP] Failed to load seed coefficients, using fallbacks:', error);
    return {
      WR: getFallbackCoeffs("WR"),
      RB: getFallbackCoeffs("RB"), 
      TE: getFallbackCoeffs("TE"),
      QB: getFallbackCoeffs("QB")
    };
  }
}