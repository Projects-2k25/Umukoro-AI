import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 55) return 'score-average';
  return 'score-poor';
}

export function getScoreBgColor(score: number): string {
  if (score >= 85) return 'score-bg-excellent';
  if (score >= 70) return 'score-bg-good';
  if (score >= 55) return 'score-bg-average';
  return 'score-bg-poor';
}

export function getRecommendationStyle(rec: string) {
  switch (rec) {
    case 'STRONG_YES': return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Strong Yes' };
    case 'YES': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Yes' };
    case 'MAYBE': return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Maybe' };
    case 'NO': return { bg: 'bg-rose-100', text: 'text-rose-800', label: 'No' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: rec };
  }
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
