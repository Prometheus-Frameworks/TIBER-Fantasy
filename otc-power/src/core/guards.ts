// small-sample & opponent adjustments can plug here later if needed
export function adjustForOpponent(raw: number, multiplier: number) {
  return Math.max(0, Math.min(100, raw * multiplier));
}