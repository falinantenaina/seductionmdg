import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

interface DataTableProps {
  /** Lignes uniquement (TableRow) : le composant gère l'en-tête, le corps et les cartes mobiles. */
  children: ReactNode;
  headers: ReactNode[];
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  /** Supprime le cadre extérieur (tableau déjà posé dans une Card). */
  embedded?: boolean;
}

interface CellProps {
  children?: ReactNode;
  className?: string;
}

function headerLabel(header: ReactNode): string {
  return typeof header === 'string' ? header.trim() : '';
}

function isActionsColumn(header: ReactNode, index: number, total: number): boolean {
  const label = headerLabel(header).toLowerCase();
  if (label === 'action' || label === 'actions') return true;
  return label === '' && index === total - 1;
}

function RowCard({ row, headers }: { row: ReactElement<CellProps>; headers: ReactNode[] }) {
  const cells = Children.toArray(row.props.children).filter(isValidElement) as ReactElement<CellProps>[];
  const fields = cells.map((cell, index) => ({
    cell,
    index,
    header: headers[index],
    actions: isActionsColumn(headers[index], index, headers.length),
  }));

  const [title, ...rest] = fields;
  const actionFields = rest.filter((field) => field.actions);
  const valueFields = rest.filter((field) => !field.actions);

  return (
    <li className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-words text-sm font-medium leading-snug [&_.whitespace-nowrap]:whitespace-normal">
          {title?.cell.props.children}
        </div>
        {actionFields.length > 0 && (
          <div className="flex shrink-0 items-center gap-0.5">
            {actionFields.map((field) => (
              <span key={field.index} className="inline-flex">
                {field.cell.props.children}
              </span>
            ))}
          </div>
        )}
      </div>

      {valueFields.length > 0 && (
        <dl className="mt-1.5 space-y-1 text-xs">
          {valueFields.map((field) => (
            <div key={field.index} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{field.header}</dt>
              <dd className="min-w-0 break-words text-right [&_.whitespace-nowrap]:whitespace-normal">
                {field.cell.props.children}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function MobileSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-card p-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 space-y-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  children,
  headers,
  loading = false,
  error = null,
  isEmpty = false,
  emptyTitle = 'Aucun résultat',
  emptyDescription = 'Aucune donnée ne correspond à votre recherche.',
  emptyAction,
  onRetry,
  embedded = false,
}: DataTableProps) {
  const colSpan = headers.length;

  if (error) {
    return (
      <div className={embedded ? '' : 'rounded-xl border bg-card'}>
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title="Impossible de charger les données"
          description={error}
          action={
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Réessayer
              </Button>
            )
          }
        />
      </div>
    );
  }

  const rows = loading ? [] : Children.toArray(children).filter(isValidElement) as ReactElement<CellProps>[];

  return (
    <>
      {/* Desktop : tableau */}
      <div
        className={
          embedded ? 'hidden md:block' : 'hidden overflow-hidden rounded-xl border bg-card md:block'
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((header, index) => (
                <TableHead key={index}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    {Array.from({ length: colSpan }).map((__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : children}
          </TableBody>
        </Table>
        {isEmpty && (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className="py-10" />
        )}
      </div>

      {/* Mobile : lignes transformées en cartes */}
      <div className="md:hidden">
        {loading ? (
          <MobileSkeleton />
        ) : isEmpty ? (
          <div className="rounded-xl border bg-card">
            <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className="py-10" />
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <RowCard key={index} row={row} headers={headers} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
