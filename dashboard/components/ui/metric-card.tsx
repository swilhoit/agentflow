import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
  loading = false,
}: MetricCardProps) {
  // Determine trend from change if not explicitly provided
  const actualTrend = trend ?? (change ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-5', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-7 w-28 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <div className="flex items-start justify-between">
        <span className="text-caption uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className="text-muted-foreground">{icon}</span>
        )}
      </div>

      <div className="mt-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>

      {(change !== undefined || changeLabel) && (
        <div className="mt-1 flex items-center gap-1">
          {actualTrend && (
            <span
              className={cn('flex items-center', {
                'text-success': actualTrend === 'up',
                'text-destructive': actualTrend === 'down',
                'text-muted-foreground': actualTrend === 'neutral',
              })}
            >
              {actualTrend === 'up' && <TrendingUp className="h-3 w-3" />}
              {actualTrend === 'down' && <TrendingDown className="h-3 w-3" />}
              {actualTrend === 'neutral' && <Minus className="h-3 w-3" />}
            </span>
          )}
          {change !== undefined && (
            <span
              className={cn('text-xs tabular-nums', {
                'text-success': actualTrend === 'up',
                'text-destructive': actualTrend === 'down',
                'text-muted-foreground': actualTrend === 'neutral' || !actualTrend,
              })}
            >
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
          {changeLabel && (
            <span className="text-xs text-muted-foreground">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
