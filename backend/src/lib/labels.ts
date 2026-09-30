import type { DeliveryStatus, OrderStatus, Role, StockMovementType, Unit } from '@prisma/client';

/** Libellés français réutilisés par les notifications et les documents PDF. */
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

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  AJUSTEMENT: 'Ajustement',
  RESERVATION: 'Réservation',
  ANNULATION_RESERVATION: 'Annulation réservation',
  RETOUR: 'Retour',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  A_LIVRER: 'À livrer',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  LIVREE: 'Livrée',
  ECHEC: 'Échec',
  ANNULEE: 'Annulée',
};
