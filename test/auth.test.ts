import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { firmarSesion } from '../src/auth';

const CLAVE = 'clave-de-prueba-123';
const ORIGEN = { Origin: 'https://admin.mrpankeketepa.com', 'Content-Type': 'application/json' };

function intento(ip: string, clave: string, origen: Record<string, string> = ORIGEN) {
  return SELF.fetch('https://admin.mrpankeketepa.com/api/login', {
    method: 'POST',
    headers: { ...origen, 'CF-Connecting-IP': ip },
    body: JSON.stringify({ clave }),
  });
}

function cookieDe(res: Response): string {
  const set = res.headers.get('Set-Cookie') ?? '';
  return set.split(';')[0];
}

describe('login', () => {
  it('clave correcta: 200 y cookie __Host-sesion segura', async () => {
    const res = await intento('10.0.0.1', CLAVE);
    expect(res.status).toBe(200);
    const set = res.headers.get('Set-Cookie') ?? '';
    expect(set).toMatch(/^__Host-sesion=/);
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/Secure/);
    expect(set).toMatch(/SameSite=Strict/);
    expect(set).toMatch(/Path=\//);
    expect(set).toMatch(/Max-Age=2592000/);
  });

  it('clave incorrecta: 401', async () => {
    const res = await intento('10.0.0.2', 'otra-clave-equivocada');
    expect(res.status).toBe(401);
  });

  it('5 fallos bloquean el 6.º intento con 429, aun con la clave correcta', async () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 5; i++) {
      expect((await intento(ip, 'mala-' + i)).status).toBe(401);
    }
    expect((await intento(ip, CLAVE)).status).toBe(429);
  });

  it('origen distinto del admin: 403', async () => {
    const res = await intento('10.0.0.4', CLAVE, { ...ORIGEN, Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });
});

describe('sesión', () => {
  it('cookie válida deja pasar la API', async () => {
    const login = await intento('10.0.0.5', CLAVE);
    const res = await SELF.fetch('https://admin.mrpankeketepa.com/api/platos', {
      headers: { Origin: ORIGEN.Origin, Cookie: cookieDe(login) },
    });
    expect(res.status).not.toBe(401);
  });

  it('cookie alterada: 401', async () => {
    const login = await intento('10.0.0.6', CLAVE);
    const valor = cookieDe(login).split('=')[1];
    const alterada = '__Host-sesion=' + valor.slice(0, -2) + 'AA';
    const res = await SELF.fetch('https://admin.mrpankeketepa.com/api/platos', {
      headers: { Origin: ORIGEN.Origin, Cookie: alterada },
    });
    expect(res.status).toBe(401);
  });

  it('cookie vencida: 401', async () => {
    const vencida = await firmarSesion(env.SESSION_SECRET, Date.now() - 1000);
    const res = await SELF.fetch('https://admin.mrpankeketepa.com/api/platos', {
      headers: { Origin: ORIGEN.Origin, Cookie: '__Host-sesion=' + vencida },
    });
    expect(res.status).toBe(401);
  });

  it('sin cookie: 401 en la API', async () => {
    const res = await SELF.fetch('https://admin.mrpankeketepa.com/api/platos', {
      headers: { Origin: ORIGEN.Origin },
    });
    expect(res.status).toBe(401);
  });
});
