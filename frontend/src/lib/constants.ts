import type {
  DeliveryStatus,
  InvoiceStatus,
  NotificationType,
  OrderStatus,
  Role,
  StockMovementType,
  Unit,
} from '@/types';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Commercial',
  FACTURIER: 'Facturier',
  MAGASINIER: 'Magasinier',
  DISPATCHER: 'Dispatcher',
  LIVREUR: 'Livreur',
};

export const UNIT_LABELS: Record<Unit, string> = {
  PIECE: 'Pièce',
  KG: 'Kg',
  LITRE: 'Litre',
  METRE: 'Mètre',
  CARTON: 'Carton',
  BOITE: 'Boîte',
  PALET: 'Palet',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  BROUILLON: 'Brouillon',
  COMMANDE: 'Commande',
  EN_FACTURATION: 'En facturation',
  FACTUREE: 'Facturée',
  A_PREPARER: 'À préparer',
  SORTIE_MAGASIN: 'Sortie magasin',
  EN_LIVRAISON: 'En livraison',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: 'Brouillon',
  EMISE: 'Émise',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  A_LIVRER: 'À livrer',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  LIVREE: 'Livrée',
  ECHEC: 'Échec',
  ANNULEE: 'Annulée',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  AJUSTEMENT: 'Ajustement',
  RESERVATION: 'Réservation',
  ANNULATION_RESERVATION: 'Annulation réservation',
  RETOUR: 'Retour',
};

export const MOVEMENT_TYPE_VARIANTS: Record<StockMovementType, 'success' | 'destructive' | 'info' | 'warning' | 'muted' | 'secondary'> = {
  ENTREE: 'success',
  SORTIE: 'destructive',
  AJUSTEMENT: 'info',
  RESERVATION: 'warning',
  ANNULATION_RESERVATION: 'muted',
  RETOUR: 'secondary',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  NOUVELLE_COMMANDE: 'Nouvelle commande',
  FACTURE_VALIDE: 'Facture validée',
  SORTIE_MAGASIN: 'Sortie magasin',
  LIVRAISON_AFFECTEE: 'Livraison affectée',
  STATUT_COMMANDE: 'Statut commande',
  STOCK_FAIBLE: 'Stock faible',
  SYSTEME: 'Système',
};
