import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, FileText, History, PackageCheck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useListState } from '@/hooks/use-list-state';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, OrderDetail, OrderListItem } from '@/types';
import { formatDate, formatMoney, formatNumber, numberValue } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { OrderStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableCell, TableRow } from '@/components/ui/table';

export function WarehousePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canExit = user?.role === 'ADMIN' || user?.role === 'MAGASINIER';
  const { search, page, pageSize, setSearch, setPage, setPageSize } = useListState();
  const [tab, setTab] = useState('queue');
  const [exiting, setExiting] = useState<OrderListItem | null>(null);
  const [comment, setComment] = useState('');

  const params = useMemo(() => ({ page, pageSize, ...(search ? { search } : {}) }), [page, pageSize, search]);

  // File du magasin : facturée ET prête à sortir — payée ou à payer à la livraison.
  const queueParams = useMemo(() => ({ ...params, status: 'FACTUREE,A_PREPARER' }), [params]);

  const queueQuery = useQuery({
    queryKey: queryKeys.orders.list(queueParams),
    queryFn: async () =>
      (await api.get<ApiResponse<OrderListItem[]>>('/orders', { params: queueParams })).data,
  });

  const exitsQuery = useQuery({
    queryKey: queryKeys.warehouse.exits(params),
    queryFn: async () => (await api.get<ApiResponse<OrderListItem[]>>('/warehouse/exits', { params })).data,
    enabled: tab === 'exits',
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.orders.detail(exiting?.id ?? ''),
    queryFn: async () => (await api.get<ApiResponse<{ order: OrderDetail }>>(`/orders/${exiting?.id}`)).data,
    enabled: !!exiting,
  });

  const exitMutation = useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post(`/warehouse/orders/${orderId}/exit`, { comment: comment || null })).data,
    onSuccess: () => {
      toast.success('Sortie magasin validée : stock physique diminué');
      setExiting(null);
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
      void queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      setTab('exits');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const queue = queueQuery.data?.data ?? [];
  const exits = exitsQuery.data?.data ?? [];
  const activeMeta = tab === 'queue' ? queueQuery.data?.meta : exitsQuery.data?.meta;
  const lines = detailQuery.data?.data.order.items ?? [];

  return (
    <div>
      <PageHeader
        title="Magasin"
        description="Préparation des commandes facturées (payées ou à payer à la livraison), sorties et historique"
        actions={
          <Button variant="outline" onClick={() => navigate('/stocks/movements')}>
            <History className="h-4 w-4" />
            Mouvements de stock
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="queue">À préparer ({queueQuery.data?.meta?.total ?? '…'})</TabsTrigger>
          <TabsTrigger value="exits">Sorties ({exitsQuery.data?.meta?.total ?? '…'})</TabsTrigger>
        </TabsList>

        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="N° de commande, client, téléphone..."
            className="w-full sm:max-w-xs"
          />
        </div>

        <TabsContent value="queue">
          <DataTable
            loading={queueQuery.isLoading}
            error={queueQuery.error ? getErrorMessage(queueQuery.error) : null}
            onRetry={() => void queueQuery.refetch()}
            isEmpty={!queueQuery.isLoading && queue.length === 0}
            emptyTitle="Aucune commande à préparer"
            emptyDescription="Les commandes facturées apparaîtront ici : payées, ou à encaisser à la livraison."
            headers={['Commande', 'Client', 'Facture', 'Lignes', 'Montant', 'Action']}
          >
            {queue.map((order) => (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                <TableCell>
                  <span className="font-medium">{order.orderNumber}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.customer?.name ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{order.customer?.phone ?? ''}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {order.invoice ? (
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="secondary">{order.invoice.invoiceNumber}</Badge>
                      {order.invoice.status !== 'PAYEE' && (
                        <Badge variant="outline" className="text-amber-600 ring-amber-300">
                          À payer à la livraison
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{order.items.reduce((sum, item) => sum + item.quantity, 0)} u.</TableCell>
                <TableCell className="whitespace-nowrap font-medium">{formatMoney(order.total)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    disabled={!canExit}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExiting(order);
                    }}
                  >
                    <PackageCheck className="h-4 w-4" />
                    Sortie
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          <div className="mt-4">
            <Pagination meta={activeMeta} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        </TabsContent>

        <TabsContent value="exits">
          <DataTable
            loading={exitsQuery.isLoading}
            error={exitsQuery.error ? getErrorMessage(exitsQuery.error) : null}
            onRetry={() => void exitsQuery.refetch()}
            isEmpty={!exitsQuery.isLoading && exits.length === 0}
            emptyTitle="Aucune sortie"
            emptyDescription="L'historique des sorties de magasin s'affiche ici."
            headers={['Sortie', 'Commande', 'Client', 'Facture', 'Montant', 'Livraison', 'Statut', '']}
          >
            {exits.map((order) => (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(order.releasedAt)}</TableCell>
                <TableCell>
                  <span className="font-medium">{order.orderNumber}</span>
                </TableCell>
                <TableCell className="font-medium">{order.customer?.name ?? '—'}</TableCell>
                <TableCell>
                  {order.invoice ? (
                    <Badge variant="secondary">{order.invoice.invoiceNumber}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{formatMoney(order.total)}</TableCell>
                <TableCell className="text-muted-foreground">{order.delivery?.deliveryNumber ?? '—'}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Ouvrir ${order.orderNumber}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/orders/${order.id}`);
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          <div className="mt-4">
            <Pagination meta={activeMeta} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!exiting}
        onOpenChange={(open) => {
          if (!open) {
            setExiting(null);
            setComment('');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sortie magasin — {exiting?.orderNumber}</DialogTitle>
            <DialogDescription>
              La quantité réservée sera consommée et le stock physique décrémenté. Cette opération est définitive (les
              retours se traitent à la réception).
            </DialogDescription>
          </DialogHeader>

          {exiting?.invoice && exiting.invoice.status !== 'PAYEE' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Facture {exiting.invoice.invoiceNumber} non encaissée — paiement à la livraison (l'encaissement se fera
              ensuite depuis la facture).
            </p>
          )}

          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{exiting?.customer?.name ?? '—'}</span>
              </div>
              {lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between text-muted-foreground">
                  <span className="truncate pr-3">
                    {line.article?.sku} — {line.article?.name}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatNumber(line.quantity)} × {formatMoney(line.unitPrice)}
                  </span>
                </div>
              ))}
              {detailQuery.isLoading && <p className="text-muted-foreground">Chargement des lignes...</p>}
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Total</span>
                <span>{formatMoney(numberValue(exiting?.total))}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="exit-comment">Observation du magasin</Label>
            <Input
              id="exit-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ex. : colis contrôlé, 2 paquets"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExiting(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => exiting && exitMutation.mutate(exiting.id)}
              loading={exitMutation.isPending}
              disabled={lines.length === 0}
            >
              <PackageCheck className="h-4 w-4" />
              Valider la sortie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
