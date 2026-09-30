import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, login, EMAILS, PASSWORD } from './helpers.js';

describe('authentification', () => {
  it('connecte les six comptes de démonstration avec le bon rôle', async () => {
    const expectedRoles: Record<string, string> = {
      admin: 'ADMIN',
      commercial: 'COMMERCIAL',
      facturier: 'FACTURIER',
      magasinier: 'MAGASINIER',
      dispatcher: 'DISPATCHER',
      livreur: 'LIVREUR',
    };

    for (const [actor, role] of Object.entries(expectedRoles)) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: EMAILS[actor as keyof typeof EMAILS], password: PASSWORD });
      expect(res.status, actor).toBe(200);
      expect(res.body.data.user.role).toBe(role);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    }
  });

  it('répond de la même façon pour un mot de passe erroné et un compte inconnu', async () => {
    const badPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAILS.admin, password: 'mauvais-mdp' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'personne@seduction.cd', password: 'mauvais-mdp' });

    expect(badPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(badPassword.body.message).toBe(unknown.body.message);
  });

  it('expose le profil connecté via /me', async () => {
    const token = await login('facturier');
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: EMAILS.facturier, role: 'FACTURIER' });
  });

  it('refuse /me sans jeton', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('valide le format de l\'e-mail (400 + détails)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'pas-un-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details[0]).toHaveProperty('path');
  });

  it('bloque un compte désactivé puis le rétablit', async () => {
    const admin = await login('admin');
    const livreur = await login('livreur');

    const meBefore = await request(app).get('/api/auth/me').set(auth(livreur));
    expect(meBefore.status).toBe(200);

    const disable = await request(app)
      .put(`/api/users/${meBefore.body.data.id}`)
      .set(auth(admin))
      .send({ isActive: false });
    expect(disable.status).toBe(200);
    expect(disable.body.data.isActive).toBe(false);

    const meDisabled = await request(app).get('/api/auth/me').set(auth(livreur));
    expect(meDisabled.status).toBe(403);
    expect(meDisabled.body.message).toMatch(/désactivé/i);

    const enable = await request(app)
      .put(`/api/users/${meBefore.body.data.id}`)
      .set(auth(admin))
      .send({ isActive: true });
    expect(enable.status).toBe(200);

    const meAfter = await request(app).get('/api/auth/me').set(auth(livreur));
    expect(meAfter.status).toBe(200);
  });

  it('exige un mot de passe robuste à la création d\'un compte', async () => {
    const admin = await login('admin');
    const res = await request(app)
      .post('/api/users')
      .set(auth(admin))
      .send({
        email: 'test-faible@seduction.cd',
        password: 'court',
        firstName: 'Test',
        lastName: 'Faible',
        role: 'COMMERCIAL',
      });
    expect(res.status).toBe(400);
    expect(res.body.details?.[0]?.message).toMatch(/8 caractères/);
  });

  it('crée un utilisateur avec un mot de passe haché (bcrypt)', async () => {
    const admin = await login('admin');
    const email = `test-securite-${Date.now()}@seduction.cd`;
    const created = await request(app)
      .post('/api/users')
      .set(auth(admin))
      .send({
        email,
        password: 'MotDePasse1!',
        firstName: 'Sécurité',
        lastName: 'Test',
        role: 'MAGASINIER',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.passwordHash).toBeUndefined();
    expect(created.body.data.id).toEqual(expect.any(String));

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'MotDePasse1!' });
    expect(loginRes.status).toBe(200);

    const duplicate = await request(app)
      .post('/api/users')
      .set(auth(admin))
      .send({
        email,
        password: 'MotDePasse1!',
        firstName: 'Doublon',
        lastName: 'Test',
        role: 'COMMERCIAL',
      });
    expect(duplicate.status).toBe(409);
  });
});
