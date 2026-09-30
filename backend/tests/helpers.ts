import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const PASSWORD = 'Demo1234!';

export const EMAILS = {
  admin: 'admin@seduction.cd',
  commercial: 'commercial@seduction.cd',
  facturier: 'facturier@seduction.cd',
  magasinier: 'magasinier@seduction.cd',
  dispatcher: 'dispatcher@seduction.cd',
  livreur: 'livreur@seduction.cd',
} as const;

export type ActorName = keyof typeof EMAILS;

const tokens = new Map<ActorName, string>();

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function login(actor: ActorName): Promise<string> {
  const cached = tokens.get(actor);
  if (cached) return cached;

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAILS[actor], password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Échec de connexion ${actor} : ${res.status} ${JSON.stringify(res.body)}`);
  }
  const token = res.body.data.token as string;
  tokens.set(actor, token);
  return token;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  stockPhysical: number;
  stockReserved: number;
  stockAvailable: number;
  alertThreshold: number;
  price: string | number;
}

export async function stocks(token: string): Promise<StockItem[]> {
  const res = await request(app).get('/api/stocks?pageSize=50').set(auth(token));
  if (res.status !== 200) throw new Error(`stocks → ${res.status}`);
  return res.body.data as StockItem[];
}

export async function findArticle(token: string, minAvailable = 5): Promise<StockItem> {
  const items = await stocks(token);
  const match = items.find((item) => item.stockAvailable >= minAvailable);
  if (!match) throw new Error(`Aucun article avec ${minAvailable} disponibles`);
  return match;
}

export async function createCustomer(token: string, name = 'ETS TEST'): Promise<{ id: string; name: string }> {
  const res = await request(app)
    .post('/api/customers')
    .set(auth(token))
    .send({ name, phone: '+261 34 00 000 00', address: 'Lot I A 1, Analakely', city: 'Antananarivo' });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`création client → ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { id: string; name: string };
}

export interface OrderBody {
  id: string;
  orderNumber: string;
  status: string;
  total: string | number;
  items?: Array<{ id: string; quantity: number; lineTotal: string | number }>;
}

export async function createOrder(
  token: string,
  customerId: string,
  articleId: string,
  quantity = 1,
): Promise<OrderBody> {
  const res = await request(app)
    .post('/api/orders')
    .set(auth(token))
    .send({ customerId, items: [{ articleId, quantity }] });
  if (res.status !== 201) {
    throw new Error(`création commande → ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as OrderBody;
}

export async function orderStatus(token: string, orderId: string): Promise<string> {
  const res = await request(app).get(`/api/orders/${orderId}`).set(auth(token));
  return res.body.data.order.status as string;
}
