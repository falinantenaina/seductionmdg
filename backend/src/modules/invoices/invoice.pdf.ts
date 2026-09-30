import pdfmake from 'pdfmake';
import type { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { company } from '../../config/company.js';
import { dateFR, ensureFonts, money } from '../../lib/pdf.js';
import { ORDER_STATUS_LABELS } from '../../lib/labels.js';
import type { InvoiceWithRelations } from './invoice.service.js';

const INVOICE_STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EMISE: 'Émise',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: '#64748b',
  EMISE: '#1d4ed8',
  PAYEE: '#15803d',
  ANNULEE: '#b91c1c',
};

function buildDoc(invoice: InvoiceWithRelations): TDocumentDefinitions {
  const rows: TableCell[][] = invoice.items.map((item, index) => [
    { text: String(index + 1), alignment: 'center', color: '#64748b' },
    { text: item.designation },
    {
      text: new Intl.NumberFormat('fr-FR').format(item.quantity),
      alignment: 'right',
    },
    { text: money(item.unitPrice), alignment: 'right' },
    { text: money(item.lineTotal), alignment: 'right', bold: true },
  ]);

  const customer = invoice.customer;
  const order = invoice.order;

  const tableLayout = {
    hLineColor: () => '#e2e8f0',
    vLineColor: () => '#e2e8f0',
    hLineWidth: () => 0.5,
    vLineWidth: () => 0,
  };

  const content: NonNullable<TDocumentDefinitions['content']> = [
    // En-tête : émetteur + bloc facture
    {
      columns: [
        {
          stack: [
            { text: company.name, fontSize: 16, bold: true, color: '#0f172a' },
            { text: company.tagline, fontSize: 8, color: '#64748b', margin: [0, 1, 0, 4] },
            { text: company.address, fontSize: 8.5, color: '#334155' },
            { text: company.country, fontSize: 8.5, color: '#334155' },
            { text: `Tél. ${company.phone} — ${company.email}`, fontSize: 8.5, color: '#334155' },
            { text: `${company.taxNumber} · ${company.rccm}`, fontSize: 7.5, color: '#94a3b8', margin: [0, 3, 0, 0] },
          ],
          width: '55%',
        },
        {
          alignment: 'right',
          stack: [
            { text: 'FACTURE', fontSize: 20, bold: true, color: '#0f172a' },
            {
              text: invoice.invoiceNumber,
              fontSize: 13,
              bold: true,
              color: '#0f172a',
              margin: [0, 2, 0, 0],
            },
            {
              text: `${INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}`.toUpperCase(),
              fontSize: 9,
              bold: true,
              color: STATUS_COLORS[invoice.status] ?? '#0f172a',
              margin: [0, 2, 0, 6],
            },
            { text: `Date d'émission : ${dateFR(invoice.issueDate)}`, fontSize: 8.5, color: '#334155' },
            { text: `Échéance : ${dateFR(invoice.dueDate)}`, fontSize: 8.5, color: '#334155' },
            { text: `Commande : ${order.orderNumber}`, fontSize: 8.5, color: '#334155' },
          ],
          width: '40%',
        },
      ],
      margin: [0, 0, 0, 18],
    },

    // Bloc client / commande
    {
      table: {
        widths: ['50%', '50%'],
        body: [
          [
            {
              stack: [
                { text: 'FACTURÉ À', fontSize: 7.5, bold: true, color: '#64748b', margin: [0, 0, 0, 4] },
                { text: customer.name, fontSize: 11, bold: true },
                ...(customer.contactName ? [{ text: `À l'attention de ${customer.contactName}`, fontSize: 8.5 }] : []),
                ...(customer.address ? [{ text: customer.address, fontSize: 8.5 }] : []),
                ...(customer.city ? [{ text: customer.city, fontSize: 8.5 }] : []),
                ...(customer.phone ? [{ text: `Tél. ${customer.phone}`, fontSize: 8.5 }] : []),
                ...(customer.email ? [{ text: customer.email, fontSize: 8.5 }] : []),
              ],
              fillColor: '#f8fafc',
            },
            {
              stack: [
                { text: 'RÉFÉRENCES', fontSize: 7.5, bold: true, color: '#64748b', margin: [0, 0, 0, 4] },
                { text: `Commande ${order.orderNumber}`, fontSize: 9.5, bold: true },
                { text: `Date de commande : ${dateFR(order.createdAt)}`, fontSize: 8.5 },
                { text: `Statut : ${ORDER_STATUS_LABELS[order.status] ?? order.status}`, fontSize: 8.5 },
                { text: `Commercial : ${order.commercial.firstName} ${order.commercial.lastName}`, fontSize: 8.5 },
                ...(order.deliveryPlace ? [{ text: `Lieu de livraison : ${order.deliveryPlace}`, fontSize: 8.5 }] : []),
                ...(order.deliveryAddress ? [{ text: `Adresse : ${order.deliveryAddress}`, fontSize: 8.5 }] : []),
                ...(order.recipientName ? [{ text: `Destinataire : ${order.recipientName}`, fontSize: 8.5 }] : []),
                ...(order.recipientPhone ? [{ text: `Tél. destinataire : ${order.recipientPhone}`, fontSize: 8.5 }] : []),
              ],
              fillColor: '#f8fafc',
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        fillColor: () => '#f8fafc',
      },
      margin: [0, 0, 0, 16],
    },

    // Détail des lignes
    {
      table: {
        headerRows: 1,
        widths: [24, '*', 50, 70, 80],
        body: [
          [
            { text: '#', style: 'tableHeader', alignment: 'center' },
            { text: 'Désignation', style: 'tableHeader' },
            { text: 'Qté', style: 'tableHeader', alignment: 'right' },
            { text: 'Prix unitaire', style: 'tableHeader', alignment: 'right' },
            { text: 'Total', style: 'tableHeader', alignment: 'right' },
          ],
          ...rows,
        ],
      },
      layout: tableLayout,
      margin: [0, 0, 0, 10],
    },

    // Totaux
    {
      columns: [
        { text: '' },
        {
          width: 220,
          table: {
            widths: ['*', 90],
            body: [
              [
                { text: 'Sous-total', alignment: 'right', color: '#475569' },
                { text: money(invoice.subtotal), alignment: 'right' },
              ],
              [
                { text: 'TOTAL', alignment: 'right', bold: true },
                { text: money(invoice.total), alignment: 'right', bold: true, color: '#0f172a' },
              ],
            ],
          },
          layout: {
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            fillColor: (rowIndex: number) => (rowIndex === 1 ? '#f1f5f9' : null),
          },
        },
      ],
      columnGap: 0,
      margin: [0, 0, 0, 18],
    },

    // Mentions
    {
      stack: [
        { text: 'Arrêtée la présente facture à la somme de :', fontSize: 8.5, color: '#64748b' },
        { text: `Montant total : ${money(invoice.total)}`, fontSize: 10, bold: true, margin: [0, 2, 0, 6] },
        ...(invoice.notes ? [{ text: `Note : ${invoice.notes}`, fontSize: 8.5, color: '#475569' }] : []),
        ...(invoice.cancelReason
          ? [{ text: `Facture annulée : ${invoice.cancelReason}`, fontSize: 8.5, color: '#b91c1c' }]
          : []),
        {
          text: 'Règlement par espèces, mobile money ou virement bancaire. Tout retard de paiement pourra entraîner la suspension des commandes en cours.',
          fontSize: 7.5,
          color: '#94a3b8',
          margin: [0, 4, 0, 0],
        },
      ],
    },

    // Signature
    {
      columns: [
        { text: `Fait à ${company.city}, le ${dateFR(invoice.issueDate)}`, fontSize: 8.5, color: '#475569' },
        {
          stack: [
            { text: 'Signature et cachet', fontSize: 8.5, bold: true, alignment: 'center' },
            { text: ' ', margin: [0, 28, 0, 0] },
            { text: company.name, fontSize: 8, color: '#64748b', alignment: 'center' },
          ],
          width: 160,
        },
      ],
      margin: [0, 24, 0, 0],
    },
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 64, 40, 56],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1f2937' },
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: '#475569',
        fillColor: '#f1f5f9',
        margin: [0, 5, 0, 5],
      },
    },
    content,
    header: (currentPage: number) =>
      currentPage === 1
        ? null
        : {
            columns: [
              { text: `${company.name} — ${company.address}`, fontSize: 7.5, color: '#94a3b8' },
              { text: `Facture ${invoice.invoiceNumber}`, fontSize: 7.5, color: '#94a3b8', alignment: 'right' },
            ],
            margin: [40, 24, 40, 0],
          },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${company.name} · ${company.phone}`, fontSize: 7, color: '#cbd5e1' },
        { text: `Page ${currentPage}/${pageCount}`, fontSize: 7, color: '#cbd5e1', alignment: 'center' },
        { text: invoice.invoiceNumber, fontSize: 7, color: '#cbd5e1', alignment: 'right' },
      ],
      margin: [40, 8, 40, 0],
    }),
    info: {
      title: `Facture ${invoice.invoiceNumber}`,
      author: company.name,
      subject: `Facture ${invoice.invoiceNumber} — commande ${order.orderNumber}`,
    },
  } as TDocumentDefinitions;
}

/** Génère le PDF d'une facture et renvoie son buffer. */
export async function buildInvoicePdf(invoice: InvoiceWithRelations): Promise<Buffer> {
  ensureFonts();
  const pdf = pdfmake.createPdf(buildDoc(invoice));
  return pdf.getBuffer();
}
