import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, auth, createCustomer, createOrder, findArticle, login } from './helpers.js';

/**
 * Le facturier renseigne (ou corrige) le lieu de livraison et les contacts du
 * destinataire au moment de facturer, puis peut les modifier ensuite.
 * Le commercial crée lui-même son client depuis la création de commande.
 */
describe('Livraison et contacts saisis à la facturation', () => {
  let commercial = '';
  let facturier = '';
  let admin = '';
  let magasinier = '';
  let orderId = '';

  beforeAll(async () => {
    [commercial, facturier, admin, magasinier] = await Promise.all([
      login('commercial'),
      login('facturier'),
      login('admin'),
      login('magasinier'),
    ]);

    const article = await findArticle(commercial, 5);
    const customer = await createCustomer(commercial, 'ETS Livraison Test');
    const order = await createOrder(commercial, customer.id, article.id, 2);
    orderId = order.id;
  });

  it('le commercial crée le client sans passer par la page Clients', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth(commercial))
      .send({
        name: 'Client créé en commande',
        phone: '+261 34 12 345 67',
        address: 'Lot II M 12, Analakely',
        city: 'Antananarivo',
        deliveryPlace: 'Analakely, face à la Grande Poste',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(res.body.data.city).toBe('Antananarivo');
  });

  it("la facture reprend le lieu de livraison et les contacts saisis par le facturier", async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(auth(facturier))
      .send({
        orderId,
        saveAsDraft: false,
        deliveryPlace: 'Analakely, face à la Grande Poste',
        deliveryAddress: 'Lot II M 12, rue Rainandriamampandry',
        recipientName: 'Hanitra Rasoanaivo',
        recipientPhone: '+261 34 11 222 33',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.data.order.deliveryPlace).toBe('Analakely, face à la Grande Poste');
    expect(res.body.data.order.deliveryAddress).toBe('Lot II M 12, rue Rainandriamampandry');
    expect(res.body.data.order.recipientPhone).toBe('+261 34 11 222 33');

    const order = await request(app).get(`/api/orders/${orderId}`).set(auth(facturier));
    expect(order.status).toBe(200);
    expect(order.body.data.order.status).toBe('FACTUREE');
    expect(order.body.data.order.deliveryPlace).toBe('Analakely, face à la Grande Poste');
    expect(order.body.data.order.recipientName).toBe('Hanitra Rasoanaivo');
  });

  it('le facturier modifie ensuite les informations de livraison', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/delivery`)
      .set(auth(facturier))
      .send({ recipientName: 'Tiana Rakotoarisoa', recipientPhone: '+261 32 45 678 90' });

    expect(res.status).toBe(200);
    expect(res.body.data.recipientName).toBe('Tiana Rakotoarisoa');
    expect(res.body.data.recipientPhone).toBe('+261 32 45 678 90');
    // Les champs non fournis sont conservés.
    expect(res.body.data.deliveryPlace).toBe('Analakely, face à la Grande Poste');

    const audit = await request(app)
      .get('/api/audit')
      .query({ action: 'ORDER_DELIVERY_UPDATE', pageSize: 5 })
      .set(auth(admin));
    expect(audit.status).toBe(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('refuse la modification aux autres rôles et aux payloads vides', async () => {
    const forbidden = await request(app)
      .patch(`/api/orders/${orderId}/delivery`)
      .set(auth(magasinier))
      .send({ recipientName: 'Intrus' });
    expect(forbidden.status).toBe(403);

    const empty = await request(app)
      .patch(`/api/orders/${orderId}/delivery`)
      .set(auth(facturier))
      .send({});
    expect(empty.status).toBe(400);

    const notFound = await request(app)
      .patch('/api/orders/11111111-1111-4111-8111-111111111111/delivery')
      .set(auth(facturier))
      .send({ recipientName: 'Personne' });
    expect(notFound.status).toBe(404);
  });

  it('refuse de modifier une commande annulée', async () => {
    const article = await findArticle(commercial, 3);
    const customer = await createCustomer(commercial, 'ETS Annulation Livraison');
    const order = await createOrder(commercial, customer.id, article.id, 1);

    const cancel = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set(auth(commercial))
      .send({ reason: 'Test modification livraison après annulation' });
    expect(cancel.status).toBe(200);

    const res = await request(app)
      .patch(`/api/orders/${order.id}/delivery`)
      .set(auth(facturier))
      .send({ recipientName: 'Trop tard' });
    expect(res.status).toBe(422);
  });
});
