import path from 'node:path';
import fs from 'node:fs';
import pdfmake from 'pdfmake';
import type { TFontDictionary } from 'pdfmake/interfaces';
import { currency } from '../config/company.js';

let fontsInitialized = false;

function robotoDir(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'node_modules', 'pdfmake', 'fonts', 'Roboto'),
    path.resolve(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto'),
  ];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'Roboto-Regular.ttf')));
  if (!found) throw new Error('Police Roboto introuvable (pdfmake/fonts/Roboto)');
  return found;
}

/** Initialise pdfmake une seule fois (polices locales, accès réseau bloqué). */
export function ensureFonts(): void {
  if (fontsInitialized) return;
  const dir = robotoDir();
  const fonts: TFontDictionary = {
    Roboto: {
      normal: path.join(dir, 'Roboto-Regular.ttf'),
      bold: path.join(dir, 'Roboto-Medium.ttf'),
      italics: path.join(dir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(dir, 'Roboto-MediumItalic.ttf'),
    },
  };
  pdfmake.setFonts(fonts);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => true);
  fontsInitialized = true;
}

/** Montant formaté en unité de la société (Ar pour MGA, sinon la devise avec 2 décimales). */
export function money(value: unknown): string {
  const amount = Number(value);
  const isAriary = currency === 'MGA';
  const digits = isAriary ? 0 : 2;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  if (isAriary) return `${formatted} Ar`;
  return `${formatted} ${currency}`;
}

/** Date au format long français (« 29 septembre 2026 »). */
export function dateFR(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

/** Date et heure au format français. */
export function dateTimeFR(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** Grille commune des tableaux des documents commerciaux. */
export const tableGrid = {
  hLineColor: () => '#e2e8f0',
  vLineColor: () => '#e2e8f0',
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
};

/** En-tête récurrent des documents (tableaux). */
export const tableHeaderStyle = {
  bold: true,
  fontSize: 8,
  color: '#475569',
  fillColor: '#f1f5f9',
  margin: [0, 5, 0, 5] as [number, number, number, number],
};
