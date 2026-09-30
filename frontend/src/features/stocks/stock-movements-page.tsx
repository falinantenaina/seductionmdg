import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History, ArrowLeft } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import type { ApiResponse, StockMovement, StockMovementType } from '@/types';
import { MOVEMENT_TYPE_LABELS, UNIT_LABELS } from '@/lib/constants';
import { formatDate, formatNumber, fullName } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { MovementTypeBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TYPES: Array<StockMovementType | 'all'> = [
  'all',
  'ENTREE',
  'SORTIE',
  'AJUSTEMENT',
  'RESERVATION',
  'ANNULATION_RESERVATION',
  'RETOUR',
];

export function StockMovementsPage() {
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [type, setType] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(type !== 'all' ? { type } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    }),
    [page, pageSize, search, type, from, to],
  );

  const movementsQuery = useQuery({
    queryKey: queryKeys.stocks.movements(params),
    queryFn: async () => (await api.get<ApiResponse<StockMovement[]>>('/stocks/movements', { params })).data,
    placeholderData: (previous) => previous,
  });

  const movements = movementsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Historique des mouvements"
        description="Toutes les opérations de stock sont tracées : article, quantité, ancien et nouvel état, utilisateur"
        actions={
          <Button variant="outline" asChild>
            <Link to="/stocks">
              <ArrowLeft className="h-4 w-4" />
              État des stocks
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Article, référence, utilisateur..."
          className="w-full lg:max-w-xs"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-full lg:w-56" aria-label="Type de mouvement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === 'all' ? 'Tous les types' : MOVEMENT_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="h-9 w-full lg:w-40"
            aria-label="Du"
          />
          <span className="text-xs text-muted-foreground">au</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="h-9 w-full lg:w-40"
            aria-label="Au"
          />
        </div>
      </div>

      <DataTable
        loading={movementsQuery.isLoading}
        error={movementsQuery.error ? getErrorMessage(movementsQuery.error) : null}
        onRetry={() => void movementsQuery.refetch()}
        isEmpty={!movementsQuery.isLoading && movements.length === 0}
        emptyTitle="Aucun mouvement"
        emptyDescription="Aucune opération de stock n'a encore été enregistrée pour ces filtres."
        headers={[
          'Date',
          'Type',
          'Article',
          'Quantité',
          'Stock physique',
          'Stock réservé',
          'Utilisateur',
          'Commande',
          'Commentaire',
        ]}
      >
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDate(movement.createdAt)}
            </TableCell>
            <TableCell>
              <MovementTypeBadge type={movement.type} />
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{movement.article.name}</span>
                <span className="text-xs text-muted-foreground">{movement.article.sku}</span>
              </div>
            </TableCell>
            <TableCell
              className={cn(
                'font-medium',
                movement.type === 'ENTREE' || movement.type === 'RETOUR' ? 'text-emerald-600' : '',
                movement.type === 'SORTIE' ? 'text-destructive' : '',
              )}
            >
              {movement.type === 'ENTREE' || movement.type === 'RETOUR' ? '+' : ''}
              {formatNumber(movement.quantity)} {UNIT_LABELS[movement.article.unit]}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">
              {formatNumber(movement.previousPhysical)} → {formatNumber(movement.newPhysical)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">
              {formatNumber(movement.previousReserved)} → {formatNumber(movement.newReserved)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">{fullName(movement.user)}</TableCell>
            <TableCell className="text-xs">
              {movement.order ? (
                <span className="font-mono">{movement.order.orderNumber}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
              {movement.comment ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Historique non modifiable
        </span>
        <Pagination
          meta={movementsQuery.data?.meta}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
