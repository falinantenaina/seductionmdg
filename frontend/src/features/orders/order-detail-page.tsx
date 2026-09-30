import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Check, FilePlus2, FileText, PackageCheck, Truck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, InvoiceDetail, OrderDetail, OrderMovement } from '@/types';
import { formatDate, formatMoney, formatNumber, fullName } from '@/lib/utils';
import { UNIT_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { OrderStatusBadge, MovementTypeBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TableCell, TableRow } from '@/components/ui/table';
import { DataTable } from '@/components/shared/data-table';

const CANCELLABLE: Array<OrderDetail['status']> = [
  'BROUILLON',
  'COMMANDE',
  'EN_FACTURATION',
  'FACTUREE',
  'A_PREPARER',
];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const canValidate = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';
  const canCancel = canValidate || user?.role === 'FACTURIER';
  const canInvoice = user?.role === 'ADMIN' || user?.role === 'FACTURIER';
  const canExit = user?.role === 'ADMIN' || user?.role === 'MAGASINIER';
  const canDispatch = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  const detailQuery = useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async () => (await api.get<ApiResponse<{ order: OrderDetail; movements: OrderMovement[] }>>(`/orders/${id}`)).data,
    enabled: !!id,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['articles'] });
    void queryClient.invalidateQueries({ queryKey: ['stocks'] });
  };

  const submitMutation = useMutation({
    mutationFn: async () => (await api.post(`/orders/${id}/submit`)).data,
    onSuccess: () => {
      toast.success('Commande validée : stock réservé');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (value: string) => (await api.post(`/orders/${id}/cancel`, { reason: value })).data,
    onSuccess: () => {
      toast.success('Commande annulée : réservation libérée');
      setCancelOpen(false);
      setReason('');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<InvoiceDetail>>('/invoices', { orderId: id });
      return data.data;
    },
    onSuccess: (invoice) => {
      toast.success(`Facture ${invoice.invoiceNumber} créée`);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      invalidate();
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const exitMutation = useMutation({
    mutationFn: async () => (await api.post(`/warehouse/orders/${id}/exit`, {})).data,
    onSuccess: () => {
      toast.success('Sortie magasin validée : stock physique diminué');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['warehouse'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deliveryMutation = useMutation({
    mutationFn: async () => (await api.post('/deliveries', { orderId: id })).data,
    onSuccess: (delivery: { id: string; deliveryNumber: string }) => {
      toast.success(`Fiche ${delivery.deliveryNumber} créée`);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      navigate(`/deliveries/${delivery.id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const payload = detailQuery.data?.data;
  const order = payload?.order;
  const movements = payload?.movements ?? [];
  const articles = order?.items ?? [];
  const totalItems = articles.reduce((sum, item) => sum + item.quantity, 0);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium">Commande introuvable</p>
          <Button variant="outline" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux commandes
          </Button>
        </div>
      </div>
    );
  }

  const isCancellable = CANCELLABLE.includes(order.status);

  return (
    <div>
      <PageHeader
        title={`${order.orderNumber}`}
        description={`Créée le ${formatDate(order.createdAt)} · ${formatNumber(totalItems)} unité(s)`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/orders')}>
              <ArrowLeft className="h-4 w-4" />
              Commandes
            </Button>
            {order.status === 'BROUILLON' && canValidate && (
              <Button onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
                <Check className="h-4 w-4" />
                Valider la commande
              </Button>
            )}
            {order.invoice && (
              <Button variant="outline" onClick={() => navigate(`/invoices/${order.invoice?.id}`)}>
                <FileText className="h-4 w-4" />
                Voir la facture
              </Button>
            )}
            {canInvoice && !order.invoice && (order.status === 'COMMANDE' || order.status === 'EN_FACTURATION') && (
              <Button onClick={() => invoiceMutation.mutate()} loading={invoiceMutation.isPending}>
                <FilePlus2 className="h-4 w-4" />
                Générer la facture
              </Button>
            )}
            {canExit && (order.status === 'A_PREPARER' || order.status === 'FACTUREE') && (
              <Button onClick={() => exitMutation.mutate()} loading={exitMutation.isPending}>
                <PackageCheck className="h-4 w-4" />
                Valider la sortie magasin
              </Button>
            )}
            {canDispatch && order.status === 'SORTIE_MAGASIN' && !order.delivery && (
              <Button onClick={() => deliveryMutation.mutate()} loading={deliveryMutation.isPending}>
                <Truck className="h-4 w-4" />
                Créer la fiche de livraison
              </Button>
            )}
            {order.delivery && (
              <Button variant="outline" onClick={() => navigate(`/deliveries/${order.delivery?.id}`)}>
                <Truck className="h-4 w-4" />
                Voir la fiche {order.delivery.deliveryNumber}
              </Button>
            )}
            {isCancellable && canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Annuler
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        {order.reservedAt && <Badge variant="outline">Réservé le {formatDate(order.reservedAt)}</Badge>}
        {order.releasedAt && <Badge variant="outline">Réservation libérée</Badge>}
        {order.invoice && (
          <Badge variant="secondary">
            <FileText className="h-3 w-3" />
            {order.invoice.invoiceNumber}
          </Badge>
        )}
        {order.delivery && (
          <Badge variant="secondary">
            <Truck className="h-3 w-3" />
            {order.delivery.deliveryNumber}
          </Badge>
        )}
        {order.cancelReason && (
          <Badge variant="destructive">Motif : {order.cancelReason}</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer?.name ?? '—'}</p>
            <p className="text-muted-foreground">{order.customer?.phone ?? '—'}</p>
            <p className="text-muted-foreground">{order.customer?.address ?? '—'}</p>
            {order.customer?.city && <p className="text-muted-foreground">{order.customer.city}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Livraison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.recipientName ?? order.customer?.name ?? '—'}</p>
            <p className="text-muted-foreground">{order.deliveryAddress ?? order.customer?.address ?? '—'}</p>
            <p className="text-muted-foreground">{order.deliveryPlace ?? order.customer?.deliveryPlace ?? '—'}</p>
            <p className="text-muted-foreground">{order.recipientPhone ?? order.customer?.phone ?? '—'}</p>
            {order.delivery && (
              <div className="mt-2 space-y-1 border-t pt-2">
                <p className="flex items-center gap-1 text-sm font-medium">
                  <Truck className="h-3.5 w-3.5" />
                  {order.delivery.deliveryNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  Livreur : {order.delivery.deliveryPerson?.name ?? 'non affecté'}
                </p>
                <p className="text-xs text-muted-foreground">Prévue : {formatDate(order.delivery.scheduledAt)}</p>
                {order.delivery.deliveredAt && (
                  <p className="text-xs text-muted-foreground">
                    Livrée : {formatDate(order.delivery.deliveredAt)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Commercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{fullName(order.commercial)}</p>
            <p className="text-muted-foreground">{order.comments ?? 'Aucun commentaire'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            embedded
            headers={['Désignation', 'Prix unitaire', 'Quantité', 'Total']}
            isEmpty={articles.length === 0}
            emptyTitle="Aucun article"
            emptyDescription="Cette commande ne contient aucune ligne."
          >
            {articles.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{item.article?.sku}</span>
                    <span className="font-medium">{item.article?.name ?? '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(item.quantity)} {UNIT_LABELS[item.article?.unit ?? 'PIECE']}
                </TableCell>
                <TableCell className="text-right font-medium">{formatMoney(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </DataTable>

          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="flex w-full max-w-xs flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Sous-total</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mouvements de stock liés</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            embedded
            headers={['Date', 'Type', 'Article', 'Quantité', 'Utilisateur']}
            isEmpty={movements.length === 0}
            emptyTitle="Aucun mouvement"
            emptyDescription="La commande n'a pas encore modifié le stock."
          >
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(movement.createdAt)}</TableCell>
                <TableCell>
                  <MovementTypeBadge type={movement.type} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">{movement.article?.sku}</span>
                    <span className="text-sm">{movement.article?.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(movement.type === 'SORTIE' ? -movement.quantity : movement.quantity)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {movement.user ? `${movement.user.firstName} ${movement.user.lastName}` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la commande {order.orderNumber} ?</DialogTitle>
            <DialogDescription>
              La réservation sera libérée et le stock disponible augmentera. Le stock physique n'est pas modifié. Le
              numéro {order.orderNumber} est conservé (jamais supprimé).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motif d'annulation *</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. : client revenu sur sa décision"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Retour
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(reason.trim())}
            >
              Annuler la commande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
