import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('acceso a la API del panel', () => {
  it('no responde en el sitio público', async () => {
    const r = await SELF.fetch('https://mrpankeketepa.com/api/menu');
    expect(r.status).toBe(404);
  });

  it('en el admin, sin la cabecera de Cloudflare Access, rechaza', async () => {
    const r = await SELF.fetch('https://admin.mrpankeketepa.com/api/menu');
    expect(r.status).toBe(401);
  });

  it('en el admin, con la cabecera de Access, deja pasar la petición', async () => {
    const r = await SELF.fetch('https://admin.mrpankeketepa.com/api/menu', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'prueba@ejemplo.com' },
    });
    expect(r.status).not.toBe(401);
    expect(r.status).not.toBe(404);
  });
});
