import type { PageMeta } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  meta?: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({ meta, onPageChange, onPageSizeChange }: PaginationProps) {
  if (!meta || meta.total <= meta.pageSize) {
    return meta && meta.total > 0 ? (
      <div className="text-xs text-muted-foreground">{meta.total} résultat(s)</div>
    ) : null;
  }

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="text-xs text-muted-foreground">
        Affichage de {from} à {to} sur {meta.total} résultat(s)
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            value={String(meta.pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[90px] text-xs" aria-label="Par page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPageChange(meta.page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
