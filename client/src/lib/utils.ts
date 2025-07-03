import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPositionColor(status: string) {
  switch (status) {
    case "critical":
      return "bg-red-50 border-red-200";
    case "warning":
      return "bg-yellow-50 border-yellow-200";
    case "good":
      return "bg-green-50 border-green-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

export function getPositionIcon(status: string) {
  switch (status) {
    case "critical":
      return "fas fa-exclamation-triangle text-red-500";
    case "warning":
      return "fas fa-exclamation-circle text-yellow-500";
    case "good":
      return "fas fa-check-circle text-green-500";
    default:
      return "fas fa-info-circle text-gray-500";
  }
}

export function getPositionBadgeColor(position: string, status: string) {
  switch (status) {
    case "critical":
      return "bg-weakness-red";
    case "warning":
      return "bg-warning-yellow";
    case "good":
      return "bg-strength-green";
    default:
      return "bg-gray-500";
  }
}

export function calculatePotentialGain(currentAvg: number, recommendedAvg: number): number {
  return Math.max(0, recommendedAvg - currentAvg);
}

export function formatRecord(record: string): string {
  return record;
}

export function formatPoints(points: number): string {
  return points.toFixed(1);
}
