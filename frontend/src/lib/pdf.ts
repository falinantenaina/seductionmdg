import { api } from '@/lib/api';

async function downloadBlob(path: string, filename: string): Promise<void> {
  const response = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Télécharge le PDF d'une facture (l'authentification passe par l'en-tête Authorization). */
export async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string): Promise<void> {
  await downloadBlob(`/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`);
}

/** Télécharge le PDF d'une fiche de livraison. */
export async function downloadDeliveryPdf(deliveryId: string, deliveryNumber: string): Promise<void> {
  await downloadBlob(`/deliveries/${deliveryId}/pdf`, `${deliveryNumber}.pdf`);
}
