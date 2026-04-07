'use client';
import { cn } from '@/lib/utils';
import { getRecommendationStyle } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  type?: 'job' | 'screening' | 'recommendation';
  className?: string;
}

const jobStatusStyles: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  OPEN: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  SCREENING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const screeningStatusStyles: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  FAILED: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

export default function StatusBadge({ status, type = 'job', className }: StatusBadgeProps) {
  let style: { bg: string; text: string; label?: string };

  if (type === 'recommendation') {
    style = getRecommendationStyle(status);
  } else if (type === 'screening') {
    style = screeningStatusStyles[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  } else {
    style = jobStatusStyles[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  }

  const label = (style as any).label || status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
        style.bg,
        style.text,
        className
      )}
    >
      {label.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
    </span>
  );
}
