'use client';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  variant?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  className?: string;
}

const variantStyles = {
  blue: { icon: 'bg-blue-50 text-blue-600', accent: 'from-blue-500 to-blue-600' },
  green: { icon: 'bg-emerald-50 text-emerald-600', accent: 'from-emerald-500 to-emerald-600' },
  orange: { icon: 'bg-amber-50 text-amber-600', accent: 'from-amber-500 to-amber-600' },
  purple: { icon: 'bg-purple-50 text-purple-600', accent: 'from-purple-500 to-purple-600' },
  red: { icon: 'bg-rose-50 text-rose-600', accent: 'from-rose-500 to-rose-600' },
};

export default function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'blue',
  className,
}: MetricCardProps) {
  const style = variantStyles[variant];

  return (
    <div className={cn('metric-card', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', style.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{title}</p>
    </div>
  );
}
