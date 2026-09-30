import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, auth, createCustomer, createOrder, findArticle, login, stocks } from './helpers.js';

/**
 * Paiement à la livraison : le magasinier peut sortir une commande facturée
 * même si elle n'est pas encore encaissée ; l'encaissement reste possible
 * ensuite (sans ramener la commande dans la file de préparation).
 */
describe('Sortie magasin sans encaissement (paiement à la livraison)', () => {
  let commercial = '';
  let facturier = '';
  let magasinier = '';
  let orderId = '';
  let articleId = '';

  beforeAll(async () => {
    [commercial, facturier, magasinier] = await Promise.all([
      login('commercial'),
      login('facturier'),
      login('magasinier'),
    ]);

    const article = await findArticle(commercial, 6);
    const customer = await createCustomer(commercial, 'ETS Paiement Livraison');
    const order = await createOrder(commercial, customer.id, article.id, 2);
    orderId = order.id;
    articleId = article.id;

    const invoice = await request(app)
      .post('/api/invoices')
      .set(auth(facturier))
      .send({ orderId });
    expect([200, 201]).toContain(invoice.status);
    expect(invoice.body.data.status).toBe('EMISE');
    expect(invoice.body.data.order.status).toBe('FACTUREE');
  });

  it('liste la file du magasin avec une liste de statuts et valide les filtres', async () => {
    const queue = await request(app)
      .get('/api/orders')
      .query({ status: 'FACTUREE,A_PREPARER', pageSize: 50 })
      .set(auth(magasinier));

    expect(queue.status).toBe(200);
    expect(queue.body.data.map((order: { id: string }) => order.id)).toContain(orderId);
    expect(queue.body.data.find((order: { id: string }) => order.id === orderId)?.invoice?.status).toBe('EMISE');

    const single = await request(app)
      .get('/api/orders')
      .query({ status: 'A_PREPARER' })
      .set(auth(magasinier));
    expect(single.status).toBe(200);
    expect(single.body.data.map((order: { id: string }) => order.id)).not.toContain(orderId);

    const invalid = await request(app)
      .get('/api/orders')
      .query({ status: 'FACTUREE,ZZZZ' })
      .set(auth(magasinier));
    expect(invalid.status).toBe(400);
  });

  it('sort la commande facturée non payée et décrémente le stock', async () => {
    const before = (await stocks(magasinier)).find((item) => item.id === articleId);
    expect(before).toBeDefined();

    const res = await request(app)
      .post(`/api/warehouse/orders/${orderId}/exit`)
      .set(auth(magasinier))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SORTIE_MAGASIN');

    const after = (await stocks(magasinier)).find((item) => item.id === articleId);
    expect(after?.stockPhysical).toBe(before!.stockPhysical - 2);
    expect(after?.stockReserved).toBe(before!.stockReserved - 2);

    // Commande retirée de la file de préparation.
    const queue = await request(app)
      .get('/api/orders')
      .query({ status: 'FACTUREE,A_PREPARER', pageSize: 50 })
      .set(auth(magasinier));
    expect(queue.body.data.map((order: { id: string }) => order.id)).not.toContain(orderId);

    // Double sortie refusée.
    const again = await request(app)
      .post(`/api/warehouse/orders/${orderId}/exit`)
      .set(auth(magasinier))
      .send({});
    expect(again.status).toBe(409);
  });

  it("encaisse la facture après sortie sans faire régresser la commande", async () => {
    const detail = await request(app).get(`/api/orders/${orderId}`).set(auth(facturier));
    expect(detail.status).toBe(200);
    const invoiceId = detail.body.data.order.invoice.id as string;

    const pay = await request(app).post(`/api/invoices/${invoiceId}/pay`).set(auth(facturier)).send({});
    expect(pay.status).toBe(200);
    expect(pay.body.data.status).toBe('PAYEE');

    const order = await request(app).get(`/api/orders/${orderId}`).set(auth(facturier));
    expect(order.body.data.order.status).toBe('SORTIE_MAGASIN');
    expect(order.body.data.order.invoice.status).toBe('PAYEE');
  });

  it('refuse la sortie d’une commande non facturée', async () => {
    const article = await findArticle(commercial, 3);
    const customer = await createCustomer(commercial, 'ETS Non Facturée');
    const order = await createOrder(commercial, customer.id, article.id, 1);

    const res = await request(app)
      .post(`/api/warehouse/orders/${order.id}/exit`)
      .set(auth(magasinier))
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/facturée/i);
  });
});
