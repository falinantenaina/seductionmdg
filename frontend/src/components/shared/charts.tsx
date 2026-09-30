import { cn, formatNumber } from '@/lib/utils';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  formatValue?: (value: number) => string;
  className?: string;
  /** Hauteur du graphique en pixels */
  height?: number;
}

/** Histogramme vertical simple (sans dépendance de graphique). */
export function TrendChart({ points, formatValue, className, height = 150 }: TrendChartProps) {
  const format = formatValue ?? formatNumber;
  const max = Math.max(...points.map((point) => point.value), 1);
  const labels = points.length
    ? [
        ...new Set(
          [points[0]?.label, points[Math.floor(points.length / 2)]?.label, points[points.length - 1]?.label].filter(
            (label): label is string => Boolean(label),
          ),
        ),
      ]
    : [];

  return (
    <div className={className}>
      <div className="flex items-end gap-1" style={{ height }}>
        {points.map((point, index) => {
          const ratio = point.value / max;
          const pixelHeight = point.value > 0 ? Math.max(ratio * 100, 4) : 0;
          return (
            <div key={`${point.label}-${index}`} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  pixelHeight > 0 ? 'bg-primary/70 group-hover:bg-primary' : 'bg-muted',
                )}
                style={{ height: `${pixelHeight}%` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background group-hover:block">
                {format(point.value)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export interface BreakdownItem {
  label: string;
  value: number;
  hint?: string;
}

interface BreakdownBarsProps {
  items: BreakdownItem[];
  formatValue?: (value: number) => string;
  className?: string;
}

/** Barres horizontales : répartition par article, catégorie, statut... */
export function BreakdownBars({ items, formatValue, className }: BreakdownBarsProps) {
  const format = formatValue ?? formatNumber;
  const max = Math.max(...items.map((item) => item.value), 1);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm">{item.label}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">{format(item.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary/70"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%` }}
            />
          </div>
          {item.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}
