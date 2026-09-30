import pdfmake from 'pdfmake';
import type { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { company } from '../../config/company.js';
import { dateFR, dateTimeFR, ensureFonts, tableGrid, tableHeaderStyle } from '../../lib/pdf.js';
import { DELIVERY_STATUS_LABELS, ORDER_STATUS_LABELS } from '../../lib/labels.js';
import type { DeliveryWithRelations } from './delivery.service.js';

const STATUS_COLORS: Record<string, string> = {
  A_LIVRER: '#64748b',
  AFFECTEE: '#1d4ed8',
  EN_COURS: '#b45309',
  LIVREE: '#15803d',
  ECHEC: '#b91c1c',
  ANNULEE: '#64748b',
};

function buildDoc(delivery: DeliveryWithRelations): TDocumentDefinitions {
  const order = delivery.order;
  const customer = order.customer;
  const person = delivery.deliveryPerson;
  const address = order.deliveryAddress ?? customer.address;
  const place = order.deliveryPlace ?? customer.deliveryPlace;

  const rows: TableCell[][] = delivery.items.map((item, index) => [
    { text: String(index + 1), alignment: 'center', color: '#64748b' },
    { text: item.designation },
    { text: item.article?.unit ? `${item.quantity} ${item.article.unit}` : String(item.quantity), alignment: 'right' },
    {
      text: item.quantityDelivered === null ? '—' : String(item.quantityDelivered),
      alignment: 'right',
      bold: item.quantityDelivered !== null,
      color: item.quantityDelivered === null ? '#94a3b8' : '#0f172a',
    },
  ]);

  const content: NonNullable<TDocumentDefinitions['content']> = [
    // En-tête : émetteur + bloc fiche
    {
      columns: [
        {
          stack: [
            { text: company.name, fontSize: 16, bold: true, color: '#0f172a' },
            { text: company.tagline, fontSize: 8, color: '#64748b', margin: [0, 1, 0, 4] },
            { text: company.address, fontSize: 8.5, color: '#334155' },
            { text: `${company.country} — Tél. ${company.phone}`, fontSize: 8.5, color: '#334155' },
            { text: company.email, fontSize: 8.5, color: '#334155' },
          ],
          width: '55%',
        },
        {
          alignment: 'right',
          stack: [
            { text: 'FICHE DE LIVRAISON', fontSize: 17, bold: true, color: '#0f172a' },
            { text: delivery.deliveryNumber, fontSize: 13, bold: true, color: '#0f172a', margin: [0, 2, 0, 0] },
            {
              text: (DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status).toUpperCase(),
              fontSize: 9,
              bold: true,
              color: STATUS_COLORS[delivery.status] ?? '#0f172a',
              margin: [0, 2, 0, 6],
            },
            { text: `Commande : ${order.orderNumber}`, fontSize: 8.5, color: '#334155' },
            { text: `Prévue le : ${dateFR(delivery.scheduledAt)}`, fontSize: 8.5, color: '#334155' },
            ...(delivery.deliveredAt
              ? [{ text: `Livrée le : ${dateTimeFR(delivery.deliveredAt)}`, fontSize: 8.5, color: '#15803d' }]
              : []),
          ],
          width: '40%',
        },
      ],
      margin: [0, 0, 0, 18],
    },

    // Destinataire / livreur
    {
      table: {
        widths: ['50%', '50%'],
        body: [
          [
            {
              stack: [
                { text: 'DESTINATAIRE', fontSize: 7.5, bold: true, color: '#64748b', margin: [0, 0, 0, 4] },
                { text: customer.name, fontSize: 11, bold: true },
                ...(customer.contactName ? [{ text: `À l'attention de ${customer.contactName}`, fontSize: 8.5 }] : []),
                ...(address ? [{ text: address, fontSize: 8.5 }] : []),
                ...(place ? [{ text: `Lieu : ${place}`, fontSize: 8.5 }] : []),
                ...(customer.city ? [{ text: customer.city, fontSize: 8.5 }] : []),
                { text: `Tél. ${order.recipientPhone ?? customer.phone ?? '—'}`, fontSize: 8.5 },
                ...(order.recipientName ? [{ text: `Destinataire : ${order.recipientName}`, fontSize: 8.5 }] : []),
              ],
              fillColor: '#f8fafc',
            },
            {
              stack: [
                { text: 'LIVREUR', fontSize: 7.5, bold: true, color: '#64748b', margin: [0, 0, 0, 4] },
                { text: person ? person.name : 'Non affecté', fontSize: 11, bold: true },
                ...(person?.phone ? [{ text: `Tél. ${person.phone}`, fontSize: 8.5 }] : []),
                ...(person?.vehicle ? [{ text: `Véhicule : ${person.vehicle}`, fontSize: 8.5 }] : []),
                { text: `Commande : ${order.orderNumber}`, fontSize: 8.5 },
                { text: `Commercial : ${order.commercial.firstName} ${order.commercial.lastName}`, fontSize: 8.5 },
                ...(order.invoice ? [{ text: `Facture : ${order.invoice.invoiceNumber}`, fontSize: 8.5 }] : []),
                { text: `Statut commande : ${ORDER_STATUS_LABELS[order.status] ?? order.status}`, fontSize: 8.5 },
              ],
              fillColor: '#f8fafc',
            },
          ],
        ],
      },
      layout: { ...tableGrid, fillColor: () => '#f8fafc', vLineWidth: () => 0.5 },
      margin: [0, 0, 0, 16],
    },

    // Détail des lignes
    {
      table: {
        headerRows: 1,
        widths: [24, '*', 70, 70],
        body: [
          [
            { text: '#', style: 'tableHeader', alignment: 'center' },
            { text: 'Désignation', style: 'tableHeader' },
            { text: 'Qté prévue', style: 'tableHeader', alignment: 'right' },
            { text: 'Qté livrée', style: 'tableHeader', alignment: 'right' },
          ],
          ...rows,
        ],
      },
      layout: tableGrid,
      margin: [0, 0, 0, 14],
    },

    // Observations
    {
      stack: [
        { text: 'Instructions de livraison', fontSize: 8.5, bold: true, color: '#475569' },
        {
          text: delivery.instructions ?? 'Aucune instruction particulière.',
          fontSize: 8.5,
          color: delivery.instructions ? '#1f2937' : '#94a3b8',
          margin: [0, 2, 0, 8],
        },
        { text: 'Observations du livreur', fontSize: 8.5, bold: true, color: '#475569' },
        {
          text: delivery.observations ?? '—',
          fontSize: 8.5,
          color: delivery.status === 'ECHEC' ? '#b91c1c' : delivery.observations ? '#1f2937' : '#94a3b8',
          margin: [0, 2, 0, 0],
        },
      ],
    },

    // Signatures
    {
      columns: [
        {
          stack: [
            { text: 'Signature du livreur', fontSize: 8.5, bold: true, alignment: 'center' },
            { text: person?.name ?? '', fontSize: 8, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] },
            { text: ' ', margin: [0, 34, 0, 0] },
          ],
          width: '48%',
        },
        {
          stack: [
            { text: 'Signature du destinataire', fontSize: 8.5, bold: true, alignment: 'center' },
            { text: customer.name, fontSize: 8, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] },
            { text: ' ', margin: [0, 34, 0, 0] },
          ],
          width: '48%',
        },
      ],
      columnGap: 12,
      margin: [0, 26, 0, 0],
    },
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 64, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1f2937' },
    styles: { tableHeader: tableHeaderStyle },
    content,
    header: (currentPage: number) =>
      currentPage === 1
        ? null
        : {
            columns: [
              { text: `${company.name} — ${company.address}`, fontSize: 7.5, color: '#94a3b8' },
              { text: `Fiche ${delivery.deliveryNumber}`, fontSize: 7.5, color: '#94a3b8', alignment: 'right' },
            ],
            margin: [40, 24, 40, 0],
          },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${company.name} · ${company.phone}`, fontSize: 7, color: '#cbd5e1' },
        { text: `Page ${currentPage}/${pageCount}`, fontSize: 7, color: '#cbd5e1', alignment: 'center' },
        { text: delivery.deliveryNumber, fontSize: 7, color: '#cbd5e1', alignment: 'right' },
      ],
      margin: [40, 8, 40, 0],
    }),
    info: {
      title: `Fiche de livraison ${delivery.deliveryNumber}`,
      author: company.name,
      subject: `Fiche de livraison ${delivery.deliveryNumber} — commande ${order.orderNumber}`,
    },
  } as TDocumentDefinitions;
}

/** Génère le PDF d'une fiche de livraison et renvoie son buffer. */
export async function buildDeliveryPdf(delivery: DeliveryWithRelations): Promise<Buffer> {
  ensureFonts();
  const pdf = pdfmake.createPdf(buildDoc(delivery));
  return pdf.getBuffer();
}
