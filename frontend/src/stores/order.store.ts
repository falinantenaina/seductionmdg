import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Article, Unit } from '@/types';
import { numberValue } from '@/lib/utils';

export interface CartLine {
  articleId: string;
  sku: string;
  name: string;
  unit: Unit;
  price: number;
  stockAvailable: number;
  quantity: number;
}

interface OrderDraftState {
  customerId: string | null;
  lines: CartLine[];
  comments: string;
  deliveryAddress: string;
  deliveryPlace: string;
  recipientName: string;
  recipientPhone: string;
  setCustomerId: (id: string | null) => void;
  addArticle: (article: Article) => void;
  setQuantity: (articleId: string, quantity: number) => void;
  removeLine: (articleId: string) => void;
  clear: () => void;
  setField: (field: DraftTextField, value: string) => void;
}

type DraftTextField = 'comments' | 'deliveryAddress' | 'deliveryPlace' | 'recipientName' | 'recipientPhone';

export const useOrderStore = create<OrderDraftState>()(
  persist(
    (set, get) => ({
      customerId: null,
      lines: [],
      comments: '',
      deliveryAddress: '',
      deliveryPlace: '',
      recipientName: '',
      recipientPhone: '',

      setCustomerId: (id) => set({ customerId: id }),

      addArticle: (article) => {
        const existing = get().lines.find((line) => line.articleId === article.id);
        if (existing) {
          set({
            lines: get().lines.map((line) =>
              line.articleId === article.id
                ? { ...line, quantity: Math.min(line.quantity + 1, line.stockAvailable || 1) }
                : line,
            ),
          });
          return;
        }
        set({
          lines: [
            ...get().lines,
            {
              articleId: article.id,
              sku: article.sku,
              name: article.name,
              unit: article.unit,
              price: numberValue(article.price),
              stockAvailable: article.stockAvailable ?? 0,
              quantity: 1,
            },
          ],
        });
      },

      setQuantity: (articleId, quantity) => {
        set({
          lines: get().lines.map((line) =>
            line.articleId === articleId
              ? { ...line, quantity: Math.max(1, Math.min(quantity, line.stockAvailable || quantity)) }
              : line,
          ),
        });
      },

      removeLine: (articleId) => set({ lines: get().lines.filter((line) => line.articleId !== articleId) }),

      clear: () =>
        set({
          customerId: null,
          lines: [],
          comments: '',
          deliveryAddress: '',
          deliveryPlace: '',
          recipientName: '',
          recipientPhone: '',
        }),

      setField: (field, value) => set({ [field]: value } as Pick<OrderDraftState, DraftTextField>),
    }),
    { name: 'seduction.order-draft' },
  ),
);

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}
