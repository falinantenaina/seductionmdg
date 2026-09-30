/**
 * Informations de l'émetteur affichées sur les documents PDF (factures).
 * À centraliser ici : elles sont reprises par tous les documents commerciaux.
 */
export const company = {
  name: 'SEDUCTION SARL',
  tagline: 'Vêtements, sacs, bracelets et accessoires — gros et détail',
  address: 'Lot II M 42 Bis, rue Rainandriamampandry — Analakely',
  city: 'Antananarivo',
  country: 'Madagascar',
  phone: '+261 34 12 345 67',
  email: 'commercial@seduction.mg',
  taxNumber: 'IFU 300 512 345 678',
  rccm: 'MAD 2024 B 01987',
} as const;

export const currency = 'MGA';
