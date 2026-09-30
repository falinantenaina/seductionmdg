import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  auth,
  createCustomer,
  createOrder,
  findArticle,
  login,
  orderStatus,
  stocks,
  type StockItem,
} from './helpers.js';

const QTY = 3;

interface Movement {
  type: string;
  quantity: number;
  previousPhysical: number;
  newPhysical: number;
  previousReserved: number;
  newReserved: number;
}

async function movements(token: string, orderId: string): Promise<Movement[]> {
  const res = await request(app).get(`/api/orders/${orderId}/movements`).set(auth(token));
  expect(res.status).toBe(200);
  return res.body.data as Movement[];
}

async function stockOf(token: string, articleId: string): Promise<StockItem> {
  const items = await stocks(token);
  const item = items.find((entry) => entry.id === articleId);
  if (!item) throw new Error('article disparu de la liste des stocks');
  return item;
}

describe('cycle commercial complet', () => {
  const state: {
    customerId: string;
    article: StockItem;
    before: StockItem;
    orderId: string;
    orderNumber: string;
    invoiceId: string;
    afterExit: StockItem;
    deliveryId: string;
  } = {} as never;

  it('1. la commande réserve le stock sans le modifier physiquement', async () => {
    const commercial = await login('commercial');
    const customer = await createCustomer(commercial, 'ETS CYCLE');
    const article = await findArticle(commercial, QTY + 2);
    const before = await stockOf(commercial, article.id);

    const order = await createOrder(commercial, customer.id, article.id, QTY);

    expect(order.status).toBe('COMMANDE');
    expect(order.orderNumber).toMatch(/^CMD-/);
    expect(Number(order.total)).toBeGreaterThan(0);

    const after = await stockOf(commercial, article.id);
    expect(after.stockPhysical).toBe(before.stockPhysical);
    expect(after.stockReserved).toBe(before.stockReserved + QTY);
    expect(after.stockAvailable).toBe(before.stockAvailable - QTY);
    expect(after.stockAvailable).toBeGreaterThanOrEqual(0);

    const moves = await movements(commercial, order.id);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      type: 'RESERVATION',
      quantity: QTY,
      previousPhysical: before.stockPhysical,
      newPhysical: before.stockPhysical,
      previousReserved: before.stockReserved,
      newReserved: before.stockReserved + QTY,
    });

    Object.assign(state, { customerId: customer.id, article, before, orderId: order.id, orderNumber: order.orderNumber });
  });

  it('2. la facturation passe par brouillon → émise → payée', async () => {
    const facturier = await login('facturier');

    const draft = await request(app)
      .post('/api/invoices')
      .set(auth(facturier))
      .send({ orderId: state.orderId, saveAsDraft: true });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('BROUILLON');
    state.invoiceId = draft.body.data.id;
    expect(await orderStatus(facturier, state.orderId)).toBe('EN_FACTURATION');

    const commercial = await login('commercial');
    const forCommercial = await request(app)
      .get(`/api/invoices/${state.invoiceId}`)
      .set(auth(commercial));
    expect(forCommercial.status).toBe(200);

    const pdf = await request(app).get(`/api/invoices/${state.invoiceId}/pdf`).set(auth(facturier));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('FAC-');

    const issued = await request(app).post(`/api/invoices/${state.invoiceId}/issue`).set(auth(facturier));
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe('EMISE');
    expect(await orderStatus(facturier, state.orderId)).toBe('FACTUREE');

    const paid = await request(app).post(`/api/invoices/${state.invoiceId}/pay`).set(auth(facturier));
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('PAYEE');
    expect(await orderStatus(facturier, state.orderId)).toBe('A_PREPARER');
  });

  it('3. la sortie magasin décrémente le stock physique et trace le mouvement', async () => {
    const magasinier = await login('magasinier');

    const exit = await request(app)
      .post(`/api/warehouse/orders/${state.orderId}/exit`)
      .set(auth(magasinier))
      .send({ comment: 'Colis contrôlé' });
    expect([200, 201]).toContain(exit.status);

    expect(await orderStatus(magasinier, state.orderId)).toBe('SORTIE_MAGASIN');

    const after = await stockOf(magasinier, state.article.id);
    expect(after.stockPhysical).toBe(state.before.stockPhysical - QTY);
    expect(after.stockReserved).toBe(state.before.stockReserved);
    // La marchandise quitte l'entrepôt : le disponible baisse d'autant.
    expect(after.stockAvailable).toBe(state.before.stockAvailable - QTY);
    expect(after.stockAvailable).toBeGreaterThanOrEqual(0);
    state.afterExit = after;

    const moves = await movements(magasinier, state.orderId);
    const sortie = moves.find((move) => move.type === 'SORTIE');
    expect(sortie).toBeDefined();
    expect(sortie?.quantity).toBe(QTY);
    expect(sortie?.newPhysical).toBe((sortie?.previousPhysical ?? 0) - QTY);
    expect(sortie?.newReserved).toBe((sortie?.previousReserved ?? 0) - QTY);

    const exits = await request(app).get('/api/warehouse/exits?pageSize=50').set(auth(magasinier));
    expect(exits.status).toBe(200);
    expect(
      (exits.body.data as Array<{ orderNumber: string }>).some((row) => row.orderNumber === state.orderNumber),
    ).toBe(true);
  });

  it('4. la livraison complète la commande sans toucher au stock', async () => {
    const dispatcher = await login('dispatcher');
    const livreur = await login('livreur');

    const created = await request(app)
      .post('/api/deliveries')
      .set(auth(dispatcher))
      .send({ orderId: state.orderId });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('A_LIVRER');
    expect(created.body.data.deliveryNumber).toMatch(/^LIV-/);
    state.deliveryId = created.body.data.id;

    const duplicate = await request(app)
      .post('/api/deliveries')
      .set(auth(dispatcher))
      .send({ orderId: state.orderId });
    expect(duplicate.status).toBe(409);

    const people = await request(app).get('/api/delivery-persons').set(auth(dispatcher));
    expect(people.status).toBe(200);
    const person = (people.body.data as Array<{ id: string; isActive: boolean }>).find((entry) => entry.isActive);
    expect(person).toBeDefined();

    const assigned = await request(app)
      .post(`/api/deliveries/${state.deliveryId}/assign`)
      .set(auth(dispatcher))
      .send({ deliveryPersonId: person?.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.status).toBe('AFFECTEE');
    expect(await orderStatus(dispatcher, state.orderId)).toBe('EN_LIVRAISON');

    const started = await request(app).post(`/api/deliveries/${state.deliveryId}/start`).set(auth(livreur));
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('EN_COURS');

    const detail = await request(app).get(`/api/deliveries/${state.deliveryId}`).set(auth(livreur));
    expect(detail.status).toBe(200);
    const lines = detail.body.data.items as Array<{ id: string; quantity: number }>;
    expect(lines.length).toBeGreaterThan(0);

    const completed = await request(app)
      .post(`/api/deliveries/${state.deliveryId}/complete`)
      .set(auth(livreur))
      .send({
        items: lines.map((line) => ({ deliveryItemId: line.id, quantityDelivered: line.quantity })),
        observations: 'Remis en main propre',
      });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('LIVREE');
    expect(await orderStatus(dispatcher, state.orderId)).toBe('LIVREE');

    const magasinier = await login('magasinier');
    const afterDelivery = await stockOf(magasinier, state.article.id);
    expect(afterDelivery.stockPhysical).toBe(state.afterExit.stockPhysical);
    expect(afterDelivery.stockReserved).toBe(state.afterExit.stockReserved);

    const moves = await movements(magasinier, state.orderId);
    expect(moves.filter((move) => move.type === 'SORTIE')).toHaveLength(1);
  });

  it('5. notifie les acteurs et journalise les opérations', async () => {
    const facturier = await login('facturier');
    const facturierNotifs = await request(app)
      .get('/api/notifications?pageSize=50')
      .set(auth(facturier));
    expect(facturierNotifs.status).toBe(200);
    expect(
      (facturierNotifs.body.data as Array<{ type: string; message: string }>).some(
        (notif) => notif.type === 'NOUVELLE_COMMANDE' && notif.message.includes(state.orderNumber),
      ),
    ).toBe(true);

    const dispatcher = await login('dispatcher');
    const dispatcherNotifs = await request(app)
      .get('/api/notifications?pageSize=50')
      .set(auth(dispatcher));
    expect(
      (dispatcherNotifs.body.data as Array<{ type: string; message: string }>).some(
        (notif) => notif.type === 'SORTIE_MAGASIN' && notif.message.includes(state.orderNumber),
      ),
    ).toBe(true);

    const livreur = await login('livreur');
    const livreurNotifs = await request(app).get('/api/notifications?pageSize=50').set(auth(livreur));
    expect(
      (livreurNotifs.body.data as Array<{ type: string }>).some((notif) => notif.type === 'LIVRAISON_AFFECTEE'),
    ).toBe(true);

    const admin = await login('admin');
    const audit = await request(app)
      .get('/api/audit?entity=Order&pageSize=50')
      .set(auth(admin));
    expect(audit.status).toBe(200);
    const actions = (audit.body.data as Array<{ action: string; entityId: string }>)
      .filter((row) => row.entityId === state.orderId)
      .map((row) => row.action);
    expect(actions).toContain('ORDER_CREATE');

    const facets = await request(app).get('/api/audit/facets').set(auth(admin));
    expect(facets.status).toBe(200);
    const values = (facets.body.data.actions as Array<{ value: string }>).map((entry) => entry.value);
    expect(values).toContain('ORDER_CREATE');
    expect(values).toContain('DELIVERY_ASSIGN');
  });

  it('6. alimente les indicateurs', async () => {
    const admin = await login('admin');
    const today = new Date();
    const from = new Date(today.getTime() - 86_400_000);
    const to = new Date(today.getTime() + 86_400_000);
    const iso = (date: Date) => date.toISOString().slice(0, 10);

    const report = await request(app)
      .get(`/api/stats/report?from=${iso(from)}&to=${iso(to)}`)
      .set(auth(admin));
    expect(report.status).toBe(200);
    expect(report.body.data.kpis.orders).toBeGreaterThanOrEqual(1);
    expect(report.body.data.kpis.delivered).toBeGreaterThanOrEqual(1);
    expect(report.body.data.kpis.avgBasket).toBeGreaterThanOrEqual(0);

    const dashboard = await request(app).get('/api/stats/dashboard').set(auth(admin));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.orders.total).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.data.series).toHaveLength(14);

    const commercial = await login('commercial');
    const mine = await request(app).get('/api/orders?pageSize=1').set(auth(commercial));
    const myDashboard = await request(app).get('/api/stats/dashboard').set(auth(commercial));
    expect(myDashboard.body.data.orders.total).toBe(mine.body.meta.total);
  });
});
