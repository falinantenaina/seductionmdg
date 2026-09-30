import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, login } from './helpers.js';

describe('sécurité HTTP', () => {
  it('ne divulgue pas X-Powered-By et interdit la mise en cache des réponses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('pose les en-têtes de sécurité Helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['cross-origin-resource-policy']).toBeDefined();
  });

  it('n\'autorise que les origines CORS déclarées', async () => {
    const refused = await request(app).get('/api/health').set('Origin', 'http://evil.test');
    expect(refused.headers['access-control-allow-origin']).toBeUndefined();

    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('refuse l\'accès sans jeton (401)', async () => {
    for (const path of [
      '/api/orders',
      '/api/stocks',
      '/api/deliveries',
      '/api/notifications',
      '/api/stats/dashboard',
      '/api/audit',
    ]) {
      const res = await request(app).get(path);
      expect(res.status, `${path} sans jeton`).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('refuse un jeton invalide ou altéré (401)', async () => {
    const res = await request(app).get('/api/orders').set(auth('jeton.totalement.invalide'));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalide|expiré/i);
  });

  it('renvoie 400 sur un corps JSON malformé', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "admin@seduction.cd"');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('renvoie 413 sur un corps trop volumineux', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@seduction.cd', password: 'x'.repeat(1_100_000) });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('publie les limites de débit sur l\'ouverture de session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@seduction.cd', password: 'Demo1234!' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(Number(res.headers['ratelimit-limit'])).toBeGreaterThanOrEqual(1000);
  });
});

describe('contrôle d\'accès (RBAC)', () => {
  it('ADMIN accède au journal d\'audit', async () => {
    const token = await login('admin');
    const res = await request(app).get('/api/audit?pageSize=1').set(auth(token));
    expect(res.status).toBe(200);
  });

  it('interdit le journal d\'audit aux autres rôles', async () => {
    for (const actor of ['commercial', 'facturier', 'magasinier', 'dispatcher', 'livreur'] as const) {
      const token = await login(actor);
      const res = await request(app).get('/api/audit').set(auth(token));
      expect(res.status, actor).toBe(403);
    }
  });

  it('interdit la création d\'utilisateur aux non-administrateurs', async () => {
    const token = await login('commercial');
    const res = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ email: 'x@seduction.cd', password: 'MotDePasse1!', firstName: 'X', lastName: 'Y', role: 'COMMERCIAL' });
    expect(res.status).toBe(403);
  });

  it('interdit les écritures de stock aux non-magasiniers', async () => {
    const token = await login('commercial');
    const res = await request(app)
      .post('/api/stocks/entry')
      .set(auth(token))
      .send({ articleId: '11111111-1111-4111-8111-111111111111', quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('interdit l\'historique des mouvements aux non-magasiniers', async () => {
    const token = await login('facturier');
    const res = await request(app).get('/api/stocks/movements').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('interdit le rapport statistique aux non-administrateurs', async () => {
    const token = await login('dispatcher');
    const res = await request(app).get('/api/stats/report').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('interdit la création de fiche de livraison aux non-dispatcheurs', async () => {
    const token = await login('livreur');
    const res = await request(app)
      .post('/api/deliveries')
      .set(auth(token))
      .send({ orderId: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(403);
  });

  it('interdit la sortie magasin aux non-magasiniers', async () => {
    const token = await login('dispatcher');
    const res = await request(app)
      .post('/api/warehouse/orders/11111111-1111-4111-8111-111111111111/exit')
      .set(auth(token))
      .send({});
    expect(res.status).toBe(403);
  });
});
