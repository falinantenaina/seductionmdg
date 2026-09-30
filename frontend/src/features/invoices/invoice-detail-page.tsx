import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Banknote, Download, FileText, Send } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { downloadInvoicePdf } from '@/lib/pdf';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse, InvoiceDetail } from '@/types';
import { formatDate, formatMoney, formatNumber, fullName } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { InvoiceStatusBadge, OrderStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { DataTable } from '@/components/shared/data-table';

const DELIVERY_FIELDS = ['deliveryAddress', 'deliveryPlace', 'recipientName', 'recipientPhone'] as const;
type DeliveryField = (typeof DELIVERY_FIELDS)[number];
type DeliveryValues = Record<DeliveryField, string>;

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canWrite = user?.role === 'FACTURIER' || user?.role === 'ADMIN';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryValues>({
    deliveryAddress: '',
    deliveryPlace: '',
    recipientName: '',
    recipientPhone: '',
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () => (await api.get<ApiResponse<InvoiceDetail>>(`/invoices/${id}`)).data,
    enabled: !!id,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const issueMutation = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/issue`)).data,
    onSuccess: () => {
      toast.success('Facture émise');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const payMutation = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/pay`)).data,
    onSuccess: () => {
      toast.success('Facture encaissée : commande à préparer');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (value: string) => (await api.post(`/invoices/${id}/cancel`, { reason: value })).data,
    onSuccess: () => {
      toast.success('Facture annulée');
      setCancelOpen(false);
      setReason('');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deliveryMutation = useMutation({
    mutationFn: async (values: DeliveryValues) => {
      const order = detailQuery.data?.data?.order;
      if (!order) throw new Error('Facture introuvable');
      // Seuls les champs modifiés sont envoyés.
      const payload: Partial<Record<DeliveryField, string | null>> = {};
      for (const field of DELIVERY_FIELDS) {
        if (values[field] !== (order[field] ?? '')) payload[field] = values[field].trim() || null;
      }
      return (await api.patch(`/orders/${order.id}/delivery`, payload)).data;
    },
    onSuccess: () => {
      toast.success('Informations de livraison mises à jour');
      setDeliveryOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openDeliveryDialog = () => {
    const order = detailQuery.data?.data?.order;
    if (!order) return;
    setDelivery({
      deliveryAddress: order.deliveryAddress ?? '',
      deliveryPlace: order.deliveryPlace ?? '',
      recipientName: order.recipientName ?? '',
      recipientPhone: order.recipientPhone ?? '',
    });
    setDeliveryOpen(true);
  };

  const invoice = detailQuery.data?.data;

  const download = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium">Facture introuvable</p>
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux factures
          </Button>
        </div>
      </div>
    );
  }

  const canCancel = canWrite && (invoice.status === 'BROUILLON' || invoice.status === 'EMISE');
  const deliveryDirty = DELIVERY_FIELDS.some(
    (field) => delivery[field] !== (invoice.order[field] ?? ''),
  );

  return (
    <div>
      <PageHeader
        title={`Facture ${invoice.invoiceNumber}`}
        description={`Émise le ${formatDate(invoice.issueDate)} · commande ${invoice.order.orderNumber}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="h-4 w-4" />
              Factures
            </Button>
            <Button variant="outline" onClick={() => download()} loading={downloading}>
              <Download className="h-4 w-4" />
              Télécharger le PDF
            </Button>
            {canWrite && invoice.status === 'BROUILLON' && (
              <Button onClick={() => issueMutation.mutate()} loading={issueMutation.isPending}>
                <Send className="h-4 w-4" />
                Émettre
              </Button>
            )}
            {canWrite && invoice.status === 'EMISE' && (
              <Button onClick={() => payMutation.mutate()} loading={payMutation.isPending}>
                <Banknote className="h-4 w-4" />
                Marquer payée
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Annuler
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <InvoiceStatusBadge status={invoice.status} />
        <OrderStatusBadge status={invoice.order.status} />
        {invoice.paidAt && <Badge variant="success">Payée le {formatDate(invoice.paidAt)}</Badge>}
        {invoice.dueDate && invoice.status !== 'PAYEE' && (
          <Badge variant="outline">Échéance : {formatDate(invoice.dueDate)}</Badge>
        )}
        {invoice.cancelReason && <Badge variant="destructive">Motif : {invoice.cancelReason}</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{invoice.customer.name}</p>
            {invoice.customer.contactName && (
              <p className="text-muted-foreground">À l'attention de {invoice.customer.contactName}</p>
            )}
            <p className="text-muted-foreground">{invoice.customer.address ?? '—'}</p>
            <p className="text-muted-foreground">
              {[invoice.customer.city, invoice.customer.phone].filter(Boolean).join(' · ') || '—'}
            </p>
            {invoice.customer.email && <p className="text-muted-foreground">{invoice.customer.email}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <button
              className="font-medium hover:underline"
              onClick={() => navigate(`/orders/${invoice.order.id}`)}
              type="button"
            >
              {invoice.order.orderNumber}
            </button>
            <p className="text-muted-foreground">Passée le {formatDate(invoice.order.createdAt)}</p>
            <p className="text-muted-foreground">
              Commercial : {invoice.order.commercial.firstName} {invoice.order.commercial.lastName}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{invoice.status === 'BROUILLON' ? 'Brouillon' : 'Émise'}</p>
            <p className="text-muted-foreground">Émise le {formatDate(invoice.issueDate)}</p>
            <p className="text-muted-foreground">Échéance : {formatDate(invoice.dueDate)}</p>
            <p className="text-muted-foreground">Émetteur : {fullName(invoice.author)}</p>
            {invoice.notes && <p className="text-muted-foreground">Note : {invoice.notes}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Livraison et contact</CardTitle>
            {canWrite && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openDeliveryDialog}>
                Modifier
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{invoice.order.deliveryPlace ?? 'Lieu non renseigné'}</p>
            <p className="text-muted-foreground">{invoice.order.deliveryAddress ?? '—'}</p>
            <p className="text-muted-foreground">
              {[invoice.order.recipientName, invoice.order.recipientPhone].filter(Boolean).join(' · ') || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Détail de la facture</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            embedded
            headers={['#', 'Désignation', 'Quantité', 'Prix unitaire', 'Total']}
            isEmpty={invoice.items.length === 0}
            emptyTitle="Aucune ligne"
            emptyDescription="Cette facture ne contient aucune ligne."
          >
            {invoice.items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{item.designation}</TableCell>
                <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                <TableCell className="text-right">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </DataTable>

          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="flex w-full max-w-xs flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Sous-total</span>
                <span>{formatMoney(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(invoice.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Le PDF reprend ces montants, les coordonnées de la facture et le détail des lignes.
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la facture {invoice.invoiceNumber} ?</DialogTitle>
            <DialogDescription>
              La facture passera au statut « Annulée » et la commande reviendra en statut « Commande ». Le numéro est
              conservé (aucune suppression).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="invoice-cancel-reason">Motif d'annulation *</Label>
            <Textarea
              id="invoice-cancel-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. : erreur de prix, client annulé..."
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
              Annuler la facture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Livraison et contact</DialogTitle>
            <DialogDescription>
              Le lieu de livraison et le contact du destinataire sont repris sur la facture, la fiche de livraison et
              transmis au dispatcher.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-delivery-place">Lieu de livraison</Label>
              <Input
                id="edit-delivery-place"
                value={delivery.deliveryPlace}
                onChange={(event) => setDelivery((prev) => ({ ...prev, deliveryPlace: event.target.value }))}
                placeholder="Quartier, repère, zone..."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-delivery-address">Adresse de livraison</Label>
              <Input
                id="edit-delivery-address"
                value={delivery.deliveryAddress}
                onChange={(event) => setDelivery((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
                placeholder="Lot, rue, avenue..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recipient">Destinataire</Label>
              <Input
                id="edit-recipient"
                value={delivery.recipientName}
                onChange={(event) => setDelivery((prev) => ({ ...prev, recipientName: event.target.value }))}
                placeholder="Nom de la personne à contacter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recipient-phone">Téléphone du destinataire</Label>
              <Input
                id="edit-recipient-phone"
                value={delivery.recipientPhone}
                onChange={(event) => setDelivery((prev) => ({ ...prev, recipientPhone: event.target.value }))}
                placeholder="+261 34 00 000 00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!deliveryDirty}
              loading={deliveryMutation.isPending}
              onClick={() => deliveryMutation.mutate(delivery)}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
