export interface WeekData {
  week: number;
  missing: boolean;
  snapPct: number | null;
  routes: number | null;
  targets: number | null;
  carries: number | null;
  airYards: number | null;
}

export interface PulseComponent {
  name: string;
  delta: number;
  weight: number;
  contribution: number;
}

export interface PulseResult {
  status: 'success' | 'not_enough_weeks' | 'insufficient_data';
  pulseScore: number;
  classification: 'Up' | 'Flat' | 'Down';
  components: PulseComponent[];
  windowAWeeks: number[];
  windowBWeeks: number[];
  fallbackNote: string;
  currentWeek: number;
  priorWeek: number | null;
}

export interface TrendDelta {
  metric: string;
  value: number;
  display: string;
  currentVal: number | null;
  priorVal: number | null;
}

export interface TrendDeltasResult {
  status: 'success' | 'not_enough_data';
  deltas: TrendDelta[];
  currentWeek: number;
  priorWeek: number | null;
  usingFallback: boolean;
  fallbackNote: string;
}

export function formatWeekRange(weeks: number[]): string {
  if (weeks.length === 0) return '—';
  if (weeks.length === 1) return `Wk${weeks[0]}`;
  
  const sorted = [...weeks].sort((a, b) => a - b);
  
  const isContiguous = sorted.every((w, i) => i === 0 || w === sorted[i - 1] + 1);
  
  if (isContiguous) {
    return `Wk${sorted[0]}–${sorted[sorted.length - 1]}`;
  } else {
    return sorted.map(w => `Wk${w}`).join(', ');
  }
}

export function formatWeekList(weeks: number[]): string {
  const sorted = [...weeks].sort((a, b) => a - b);
  return sorted.map(w => `Wk${w}`).join(', ');
}

function mean(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function isMetricUsable(valuesA: (number | null)[], valuesB: (number | null)[]): boolean {
  const all = [...valuesA, ...valuesB];
  const nonNull = all.filter(v => v !== null).length;
  return nonNull >= 4;
}

const WEIGHTS = {
  targets: 1.0,
  routes: 0.6,
  carries: 0.8,
  snapPct: 0.05,
  airYards: 0.04,
};

export function computePulse(
  weeks: WeekData[],
  position: string,
  effectiveWeek: number
): PulseResult {
  const selectedWeekData = weeks.find(w => w.week === effectiveWeek && !w.missing);
  let pulseCurrentWeek = effectiveWeek;
  let usingPulseFallback = false;
  
  if (!selectedWeekData) {
    const availableBeforeSelected = weeks.filter(w => w.week <= effectiveWeek && !w.missing);
    if (availableBeforeSelected.length > 0) {
      pulseCurrentWeek = availableBeforeSelected[availableBeforeSelected.length - 1].week;
      usingPulseFallback = true;
    }
  }
  
  const usableWeeks = weeks
    .filter(w => !w.missing && w.week <= pulseCurrentWeek)
    .sort((a, b) => b.week - a.week);
  
  const windowA = usableWeeks.slice(0, 3);
  const windowB = usableWeeks.slice(3, 6);
  
  const fallbackNote = usingPulseFallback ? `(Wk${effectiveWeek} missing, using Wk${pulseCurrentWeek})` : '';
  
  const windowAWeeks = windowA.map(w => w.week).sort((a, b) => a - b);
  const windowBWeeks = windowB.map(w => w.week).sort((a, b) => a - b);
  
  if (windowA.length < 3 || windowB.length < 3) {
    return {
      status: 'not_enough_weeks',
      pulseScore: 0,
      classification: 'Flat',
      components: [],
      windowAWeeks,
      windowBWeeks,
      fallbackNote,
      currentWeek: pulseCurrentWeek,
      priorWeek: null,
    };
  }
  
  const targetsA = windowA.map(w => w.targets);
  const targetsB = windowB.map(w => w.targets);
  const routesA = windowA.map(w => w.routes);
  const routesB = windowB.map(w => w.routes);
  const carriesA = windowA.map(w => w.carries);
  const carriesB = windowB.map(w => w.carries);
  const snapPctA = windowA.map(w => w.snapPct);
  const snapPctB = windowB.map(w => w.snapPct);
  const airYardsA = windowA.map(w => w.airYards);
  const airYardsB = windowB.map(w => w.airYards);
  
  const components: PulseComponent[] = [];
  
  if (isMetricUsable(targetsA, targetsB)) {
    const avgA = mean(targetsA);
    const avgB = mean(targetsB);
    if (avgA !== null && avgB !== null) {
      const delta = avgA - avgB;
      components.push({ name: 'Targets', delta, weight: WEIGHTS.targets, contribution: delta * WEIGHTS.targets });
    }
  }
  
  if ((position === 'WR' || position === 'TE') && isMetricUsable(routesA, routesB)) {
    const avgA = mean(routesA);
    const avgB = mean(routesB);
    if (avgA !== null && avgB !== null) {
      const delta = avgA - avgB;
      components.push({ name: 'Routes', delta, weight: WEIGHTS.routes, contribution: delta * WEIGHTS.routes });
    }
  }
  
  if ((position === 'RB' || position === 'QB') && isMetricUsable(carriesA, carriesB)) {
    const avgA = mean(carriesA);
    const avgB = mean(carriesB);
    if (avgA !== null && avgB !== null) {
      const delta = avgA - avgB;
      components.push({ name: 'Carries', delta, weight: WEIGHTS.carries, contribution: delta * WEIGHTS.carries });
    }
  }
  
  if ((position === 'WR' || position === 'TE') && isMetricUsable(airYardsA, airYardsB)) {
    const avgA = mean(airYardsA);
    const avgB = mean(airYardsB);
    if (avgA !== null && avgB !== null) {
      const delta = avgA - avgB;
      components.push({ name: 'AirYards', delta, weight: WEIGHTS.airYards, contribution: delta * WEIGHTS.airYards });
    }
  }
  
  if (isMetricUsable(snapPctA, snapPctB)) {
    const avgA = mean(snapPctA);
    const avgB = mean(snapPctB);
    if (avgA !== null && avgB !== null) {
      const delta = avgA - avgB;
      components.push({ name: 'Snap%', delta, weight: WEIGHTS.snapPct, contribution: delta * WEIGHTS.snapPct });
    }
  }
  
  if (components.length === 0) {
    return {
      status: 'insufficient_data',
      pulseScore: 0,
      classification: 'Flat',
      components: [],
      windowAWeeks,
      windowBWeeks,
      fallbackNote,
      currentWeek: pulseCurrentWeek,
      priorWeek: null,
    };
  }
  
  const pulseScore = components.reduce((sum, c) => sum + c.contribution, 0);
  
  let classification: 'Up' | 'Flat' | 'Down';
  if (pulseScore >= 1.0) {
    classification = 'Up';
  } else if (pulseScore <= -1.0) {
    classification = 'Down';
  } else {
    classification = 'Flat';
  }
  
  return {
    status: 'success',
    pulseScore,
    classification,
    components,
    windowAWeeks,
    windowBWeeks,
    fallbackNote,
    currentWeek: pulseCurrentWeek,
    priorWeek: windowB.length > 0 ? windowB[0].week : null,
  };
}

export function getTopDrivers(components: PulseComponent[]): PulseComponent[] {
  const sortedByContrib = [...components].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  
  const drivers: PulseComponent[] = [];
  if (sortedByContrib.length >= 1) drivers.push(sortedByContrib[0]);
  if (sortedByContrib.length >= 2) drivers.push(sortedByContrib[1]);
  if (sortedByContrib.length >= 3) {
    const thirdAbs = Math.abs(sortedByContrib[2].contribution);
    const secondAbs = Math.abs(sortedByContrib[1].contribution);
    if (secondAbs > 0 && thirdAbs >= 0.5 * secondAbs) {
      drivers.push(sortedByContrib[2]);
    }
  }
  
  return drivers;
}

export function computeTrendDeltas(
  weeks: WeekData[],
  position: string,
  effectiveWeek: number
): TrendDeltasResult {
  const selectedWeekData = weeks.find(w => w.week === effectiveWeek && !w.missing);
  let currentWeekData = selectedWeekData;
  let usingFallback = false;
  
  if (!selectedWeekData) {
    const availableBeforeSelected = weeks.filter(w => w.week <= effectiveWeek && !w.missing);
    if (availableBeforeSelected.length > 0) {
      currentWeekData = availableBeforeSelected[availableBeforeSelected.length - 1];
      usingFallback = true;
    }
  }
  
  if (!currentWeekData) {
    return {
      status: 'not_enough_data',
      deltas: [],
      currentWeek: effectiveWeek,
      priorWeek: null,
      usingFallback: false,
      fallbackNote: '',
    };
  }
  
  const currentWeek = currentWeekData.week;
  const priorWeeks = weeks.filter(w => w.week < currentWeek && !w.missing);
  const priorWeekData = priorWeeks.length > 0 ? priorWeeks[priorWeeks.length - 1] : null;
  
  if (!priorWeekData) {
    return {
      status: 'not_enough_data',
      deltas: [],
      currentWeek,
      priorWeek: null,
      usingFallback,
      fallbackNote: usingFallback ? `Wk${effectiveWeek} missing, using Wk${currentWeek}` : '',
    };
  }
  
  const deltas: TrendDelta[] = [];
  
  const computeDelta = (metric: string, currentVal: number | null, priorVal: number | null) => {
    if (currentVal === null || priorVal === null) return null;
    const diff = currentVal - priorVal;
    const sign = diff >= 0 ? '+' : '';
    return {
      metric,
      value: diff,
      display: `${sign}${diff.toFixed(1)}`,
      currentVal,
      priorVal,
    };
  };
  
  const snapDelta = computeDelta('Snap%', currentWeekData.snapPct, priorWeekData.snapPct);
  if (snapDelta) deltas.push(snapDelta);
  
  if (position === 'WR' || position === 'TE') {
    const routesDelta = computeDelta('Routes', currentWeekData.routes, priorWeekData.routes);
    if (routesDelta) deltas.push(routesDelta);
  }
  
  const targetsDelta = computeDelta('Targets', currentWeekData.targets, priorWeekData.targets);
  if (targetsDelta) deltas.push(targetsDelta);
  
  if (position === 'RB' || position === 'QB') {
    const carriesDelta = computeDelta('Carries', currentWeekData.carries, priorWeekData.carries);
    if (carriesDelta) deltas.push(carriesDelta);
  }
  
  return {
    status: 'success',
    deltas,
    currentWeek,
    priorWeek: priorWeekData.week,
    usingFallback,
    fallbackNote: usingFallback ? `Wk${effectiveWeek} missing, using Wk${currentWeek}` : '',
  };
}

export function getDeltaColor(value: number): string {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function getDeltaArrow(value: number): { arrow: string; color: string } {
  if (value > 0) return { arrow: '↑', color: 'text-green-400' };
  if (value < 0) return { arrow: '↓', color: 'text-red-400' };
  return { arrow: '→', color: 'text-gray-400' };
}

export function getPulseColor(classification: 'Up' | 'Flat' | 'Down'): string {
  if (classification === 'Up') return 'text-green-400';
  if (classification === 'Down') return 'text-red-400';
  return 'text-gray-400';
}
