import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, createCustomer, createOrder, findArticle, login, stocks } from './helpers.js';

async function articleOf(token: string, articleId: string) {
  const items = await stocks(token);
  const item = items.find((entry) => entry.id === articleId);
  if (!item) throw new Error('article introuvable');
  return item;
}

describe('stock : concurrence des réservations', () => {
  it('n\'autorise jamais un disponible négatif sous charge', async () => {
    const commercial = await login('commercial');
    const customer = await createCustomer(commercial, 'ETS CONCURRENCE');
    // Article avec le plus petit disponible (>= 4) : la course reste rapide.
    const candidates = (await stocks(commercial))
      .filter((item) => item.stockAvailable >= 4)
      .sort((a, b) => a.stockAvailable - b.stockAvailable);
    const article = candidates[0];
    expect(article).toBeDefined();
    if (!article) return;
    const available = article.stockAvailable;

    const attempts = available + 3;
    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        request(app)
          .post('/api/orders')
          .set(auth(commercial))
          .send({ customerId: customer.id, items: [{ articleId: article.id, quantity: 1 }] }),
      ),
    );

    const created = results.filter((res) => res.status === 201);
    const rejected = results.filter((res) => res.status === 422);

    expect(created).toHaveLength(available);
    expect(rejected).toHaveLength(3);
    expect(rejected.every((res) => res.body.code === 'UNPROCESSABLE')).toBe(true);

    const after = await articleOf(commercial, article.id);
    expect(after.stockAvailable).toBe(0);
    expect(after.stockAvailable).toBeGreaterThanOrEqual(0);
    expect(after.stockReserved).toBe(after.stockPhysical);

    for (const res of created) {
      const cancel = await request(app)
        .post(`/api/orders/${res.body.data.id}/cancel`)
        .set(auth(commercial))
        .send({ reason: 'Nettoyage du test de concurrence' });
      expect(cancel.status).toBe(200);
    }

    const restored = await articleOf(commercial, article.id);
    expect(restored.stockAvailable).toBe(available);
    expect(restored.stockReserved).toBe(restored.stockPhysical - available);
  });
});

describe('stock : écritures manuelles', () => {
  it('entrée manuelle : augmente le physique et trace le mouvement', async () => {
    const magasinier = await login('magasinier');
    const target = await findArticle(magasinier, 1);
    const delta = 5;

    const entry = await request(app)
      .post('/api/stocks/entry')
      .set(auth(magasinier))
      .send({ articleId: target.id, quantity: delta, comment: 'Réapprovisionnement test' });
    expect([200, 201]).toContain(entry.status);

    const after = await articleOf(magasinier, target.id);
    expect(after.stockPhysical).toBe(target.stockPhysical + delta);
    expect(after.stockAvailable).toBe(target.stockAvailable + delta);

    const movements = await request(app)
      .get(`/api/stocks/movements?articleId=${target.id}&type=ENTREE&pageSize=20`)
      .set(auth(magasinier));
    expect(movements.status).toBe(200);
    const found = (movements.body.data as Array<{ quantity: number; comment: string | null }>).find(
      (row) => row.quantity === delta && row.comment === 'Réapprovisionnement test',
    );
    expect(found).toBeDefined();
  });

  it('ajustement sous le seuil déclenche l\'alerte STOCK_FAIBLE', async () => {
    const magasinier = await login('magasinier');
    const items = await stocks(magasinier);
    const target = items.find(
      (item) => item.stockPhysical > item.alertThreshold && item.stockReserved === 0,
    );
    expect(target).toBeDefined();
    if (!target) return;

    const original = target.stockPhysical;

    const down = await request(app)
      .post('/api/stocks/adjustment')
      .set(auth(magasinier))
      .send({ articleId: target.id, newPhysical: target.alertThreshold, comment: 'Inventaire test' });
    expect([200, 201]).toContain(down.status);

    const alerts = await request(app)
      .get('/api/notifications?type=STOCK_FAIBLE&pageSize=50')
      .set(auth(magasinier));
    expect(alerts.status).toBe(200);
    expect(
      (alerts.body.data as Array<{ message: string }>).some((notif) => notif.message.includes(target.sku)),
    ).toBe(true);

    const up = await request(app)
      .post('/api/stocks/adjustment')
      .set(auth(magasinier))
      .send({ articleId: target.id, newPhysical: original, comment: 'Fin de l\'inventaire test' });
    expect([200, 201]).toContain(up.status);
    expect((await articleOf(magasinier, target.id)).stockPhysical).toBe(original);
  });

  it('refuse de passer sous la quantité réservée (422)', async () => {
    const commercial = await login('commercial');
    const magasinier = await login('magasinier');
    const customer = await createCustomer(commercial, 'ETS RESERVE');
    const article = await findArticle(commercial, 3);
    const order = await createOrder(commercial, customer.id, article.id, 2);

    const blocked = await request(app)
      .post('/api/stocks/adjustment')
      .set(auth(magasinier))
      .send({ articleId: article.id, newPhysical: 0 });
    expect(blocked.status).toBe(422);
    expect(blocked.body.code).toBe('UNPROCESSABLE');

    const cancel = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set(auth(commercial))
      .send({ reason: 'Fin du test de réservation' });
    expect(cancel.status).toBe(200);

    const after = await articleOf(magasinier, article.id);
    expect(after.stockAvailable).toBeGreaterThanOrEqual(2);
  });

  it('valide les saisies (400) et refuse les non-magasiniers (403)', async () => {
    const magasinier = await login('magasinier');
    const article = await findArticle(magasinier, 1);

    const zero = await request(app)
      .post('/api/stocks/entry')
      .set(auth(magasinier))
      .send({ articleId: article.id, quantity: 0 });
    expect(zero.status).toBe(400);

    const negative = await request(app)
      .post('/api/stocks/adjustment')
      .set(auth(magasinier))
      .send({ articleId: article.id, newPhysical: -5 });
    expect(negative.status).toBe(400);

    const badId = await request(app)
      .post('/api/stocks/entry')
      .set(auth(magasinier))
      .send({ articleId: 'pas-un-uuid', quantity: 3 });
    expect(badId.status).toBe(400);

    const commercial = await login('commercial');
    const forbidden = await request(app)
      .post('/api/stocks/entry')
      .set(auth(commercial))
      .send({ articleId: article.id, quantity: 3 });
    expect(forbidden.status).toBe(403);
  });
});
