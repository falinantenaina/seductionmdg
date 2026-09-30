import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('santé de l\'API', () => {
  it('répond sur /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
  });

  it('expose une route inconnue en 404 JSON', async () => {
    const res = await request(app).get('/api/inexistant');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
  });
});
