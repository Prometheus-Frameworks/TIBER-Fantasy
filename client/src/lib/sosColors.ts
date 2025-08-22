export function tierColor(score: number) {
  if (score >= 67) return "bg-green-100 text-green-900 border-green-300";
  if (score >= 33) return "bg-yellow-100 text-yellow-900 border-yellow-300";
  return "bg-red-100 text-red-900 border-red-300";
}