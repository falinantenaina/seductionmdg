import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createCustomer, createOrder, findArticle, login, EMAILS } from './helpers.js';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

describe('notifications', () => {
  let facturierToken = '';
  let notificationId = '';

  it('liste les notifications de l\'utilisateur avec pagination', async () => {
    const commercial = await login('commercial');
    const customer = await createCustomer(commercial, 'ETS NOTIFS');
    const article = await findArticle(commercial, 2);
    await createOrder(commercial, customer.id, article.id, 1);

    facturierToken = await login('facturier');
    const res = await request(app).get('/api/notifications?pageSize=10').set(auth(facturierToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

    const first = res.body.data[0];
    expect(first).toMatchObject({ isRead: false });
    expect(typeof first.title).toBe('string');
    expect(typeof first.message).toBe('string');
    expect(typeof first.createdAt).toBe('string');
    expect(first.order).toHaveProperty('orderNumber');
    notificationId = first.id;
  });

  it('compte les non lues et filtre par type', async () => {
    const count = await request(app).get('/api/notifications/count').set(auth(facturierToken));
    expect(count.status).toBe(200);
    expect(isNumber(count.body.data.unread)).toBe(true);

    const unread = await request(app)
      .get('/api/notifications?unreadOnly=true&pageSize=50')
      .set(auth(facturierToken));
    expect(unread.body.meta.total).toBe(count.body.data.unread);
    expect((unread.body.data as Array<{ isRead: boolean }>).every((notif) => notif.isRead === false)).toBe(true);

    const filtered = await request(app)
      .get('/api/notifications?type=NOUVELLE_COMMANDE&pageSize=50')
      .set(auth(facturierToken));
    expect(filtered.status).toBe(200);
    expect(
      (filtered.body.data as Array<{ type: string }>).every((notif) => notif.type === 'NOUVELLE_COMMANDE'),
    ).toBe(true);

    const invalid = await request(app).get('/api/notifications?type=INCONNUE').set(auth(facturierToken));
    expect(invalid.status).toBe(400);
  });

  it('interdit de lire la notification d\'un autre utilisateur (404)', async () => {
    const admin = await login('admin');
    const res = await request(app).post(`/api/notifications/${notificationId}/read`).set(auth(admin));
    expect(res.status).toBe(404);

    const mine = await request(app)
      .get(`/api/notifications?unreadOnly=true&pageSize=50`)
      .set(auth(facturierToken));
    expect((mine.body.data as Array<{ id: string }>).some((notif) => notif.id === notificationId)).toBe(true);
  });

  it('marque une notification puis toutes comme lues', async () => {
    const before = await request(app).get('/api/notifications/count').set(auth(facturierToken));
    const read = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .set(auth(facturierToken));
    expect(read.status).toBe(200);
    expect(read.body.data.isRead).toBe(true);

    const after = await request(app).get('/api/notifications/count').set(auth(facturierToken));
    expect(after.body.data.unread).toBe(before.body.data.unread - 1);

    const all = await request(app).post('/api/notifications/read-all').set(auth(facturierToken));
    expect([200, 201]).toContain(all.status);
    const final = await request(app).get('/api/notifications/count').set(auth(facturierToken));
    expect(final.body.data.unread).toBe(0);
  });

  it('exige une authentification', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('statistiques', () => {
  const roles = ['admin', 'commercial', 'facturier', 'magasinier', 'dispatcher', 'livreur'] as const;

  it('donne un tableau de bord à chaque rôle avec la structure attendue', async () => {
    for (const role of roles) {
      const token = await login(role);
      const res = await request(app).get('/api/stats/dashboard').set(auth(token));
      expect(res.status, role).toBe(200);

      const data = res.body.data;
      for (const key of ['range', 'scope', 'orders', 'revenue', 'stock', 'deliveries', 'people', 'series', 'recentOrders', 'lowStock']) {
        expect(data, `${role}.${key}`).toHaveProperty(key);
      }
      expect(data.series, role).toHaveLength(14);
      expect((data.series as Array<{ date: string }>).every((point) => isDay(point.date)), role).toBe(true);
      expect(isNumber(data.orders.total), role).toBe(true);
      expect(isNumber(data.revenue.total), role).toBe(true);
      expect(isNumber(data.stock.articles), role).toBe(true);
      const sum = Object.values(data.orders.byStatus as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum).toBe(data.orders.total);
    }
  });

  it('valide le paramètre days', async () => {
    const token = await login('admin');
    expect((await request(app).get('/api/stats/dashboard?days=7').set(auth(token))).body.data.series).toHaveLength(7);
    expect((await request(app).get('/api/stats/dashboard?days=3').set(auth(token))).status).toBe(400);
    expect((await request(app).get('/api/stats/dashboard?days=999').set(auth(token))).status).toBe(400);
    expect((await request(app).get('/api/stats/dashboard?days=abc').set(auth(token))).status).toBe(400);
  });

  it('limite le rapport détaillé à l\'administrateur', async () => {
    const admin = await login('admin');
    const res = await request(app).get('/api/stats/report').set(auth(admin));
    expect(res.status).toBe(200);

    const data = res.body.data;
    for (const key of ['range', 'kpis', 'series', 'topArticles', 'byCategory', 'ordersByStatus', 'deliveriesByStatus', 'movementsByType']) {
      expect(data).toHaveProperty(key);
    }
    expect(data.series).toHaveLength(30);
    expect(data.kpis.orders).toBe(
      (data.ordersByStatus as Array<{ count: number }>).reduce((sum, row) => sum + row.count, 0),
    );
    expect((data.series as Array<{ date: string }>).every((point) => isDay(point.date))).toBe(true);

    expect((await request(app).get('/api/stats/report?from=toto').set(auth(admin))).status).toBe(400);

    for (const role of ['commercial', 'facturier', 'magasinier', 'dispatcher', 'livreur'] as const) {
      const token = await login(role);
      expect((await request(app).get('/api/stats/report').set(auth(token))).status, role).toBe(403);
    }
  });
});

describe('journal d\'audit', () => {
  it('expose les traces avec leur auteur (ADMIN)', async () => {
    const admin = await login('admin');
    const res = await request(app).get('/api/audit?pageSize=10').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

    const entry = res.body.data[0];
    expect(entry).toHaveProperty('action');
    expect(entry).toHaveProperty('entity');
    expect(typeof entry.createdAt).toBe('string');
    expect((res.body.data as Array<{ user: unknown }>).some((row) => row.user !== null)).toBe(true);
  });

  it('filtre par entité, action, utilisateur et période', async () => {
    const admin = await login('admin');

    const byEntity = await request(app).get('/api/audit?entity=Order&pageSize=50').set(auth(admin));
    expect(byEntity.status).toBe(200);
    expect(
      (byEntity.body.data as Array<{ entity: string }>).every((row) => row.entity === 'Order'),
      'filtre entity',
    ).toBe(true);
    expect(byEntity.body.meta.total).toBeGreaterThanOrEqual(1);

    const unknownAction = await request(app).get('/api/audit?action=ACTION_INEXISTANTE').set(auth(admin));
    expect(unknownAction.status).toBe(200);
    expect(unknownAction.body.meta.total).toBe(0);

    const users = await request(app).get('/api/users?pageSize=50').set(auth(admin));
    const commercial = (users.body.data as Array<{ id: string; email: string }>).find(
      (user) => user.email === EMAILS.commercial,
    );
    const byUser = await request(app).get(`/api/audit?userId=${commercial?.id}&pageSize=50`).set(auth(admin));
    expect(byUser.status).toBe(200);
    expect(byUser.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(
      (byUser.body.data as Array<{ user: { id: string } | null }>).every((row) => row.user?.id === commercial?.id),
    ).toBe(true);

    const oldRange = await request(app).get('/api/audit?to=2020-01-01').set(auth(admin));
    expect(oldRange.status).toBe(200);
    expect(oldRange.body.meta.total).toBe(0);

    const badPage = await request(app).get('/api/audit?page=0').set(auth(admin));
    expect(badPage.status).toBe(400);
    const badUser = await request(app).get('/api/audit?userId=pas-un-uuid').set(auth(admin));
    expect(badUser.status).toBe(400);
  });

  it('publie les facettes de filtres et reste réservé à l\'ADMIN', async () => {
    const admin = await login('admin');
    const res = await request(app).get('/api/audit/facets').set(auth(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.actions)).toBe(true);
    expect(Array.isArray(res.body.data.entities)).toBe(true);
    expect(res.body.data.actions.length).toBeGreaterThan(0);
    expect(res.body.data.actions[0]).toMatchObject({ value: expect.any(String), count: expect.any(Number) });

    const commercial = await login('commercial');
    expect((await request(app).get('/api/audit/facets').set(auth(commercial))).status).toBe(403);
    expect((await request(app).get('/api/audit')).status).toBe(401);
  });
});
