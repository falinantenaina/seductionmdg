import type { OrderStatus, StockMovementType, DeliveryStatus, InvoiceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  DELIVERY_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_VARIANTS,
  ORDER_STATUS_LABELS,
} from '@/lib/constants';
import type { VariantProps } from 'class-variance-authority';
import { badgeVariants } from '@/components/ui/badge';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  BROUILLON: 'muted',
  COMMANDE: 'info',
  EN_FACTURATION: 'info',
  FACTUREE: 'secondary',
  A_PREPARER: 'warning',
  SORTIE_MAGASIN: 'warning',
  EN_LIVRAISON: 'info',
  LIVREE: 'success',
  ANNULEE: 'destructive',
};

const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  BROUILLON: 'muted',
  EMISE: 'info',
  PAYEE: 'success',
  ANNULEE: 'destructive',
};

const DELIVERY_STATUS_VARIANTS: Record<DeliveryStatus, BadgeVariant> = {
  A_LIVRER: 'warning',
  AFFECTEE: 'info',
  EN_COURS: 'info',
  LIVREE: 'success',
  ECHEC: 'destructive',
  ANNULEE: 'muted',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={INVOICE_STATUS_VARIANTS[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge variant={DELIVERY_STATUS_VARIANTS[status]}>{DELIVERY_STATUS_LABELS[status]}</Badge>;
}

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  return <Badge variant={MOVEMENT_TYPE_VARIANTS[type]}>{MOVEMENT_TYPE_LABELS[type]}</Badge>;
}
