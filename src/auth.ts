export interface AuthEnv {
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  MENU_KV: KVNamespace;
}

const COOKIE = '__Host-sesion';
const DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const VENTANA_S = 15 * 60; // bloqueo de 15 minutos
const MAX_FALLOS = 5;
const ORIGEN_ADMIN = 'https://admin.mrpankeketepa.com';

const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// Compara en tiempo constante para no revelar cuántos caracteres coinciden.
function igual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [iter, saltB64, hashB64] = guardado.split(':');
  const llave = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: Number(iter), hash: 'SHA-256' },
    llave,
    256,
  );
  return igual(new Uint8Array(bits), unb64(hashB64));
}

async function hmacKey(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// Valor de la cookie: "<expiración en ms>.<firma en base64>"
export async function firmarSesion(secreto: string, expiraMs: number): Promise<string> {
  const payload = String(expiraMs);
  const firma = await crypto.subtle.sign('HMAC', await hmacKey(secreto), enc.encode(payload));
  return `${payload}.${b64(firma)}`;
}

export async function sesionValida(request: Request, env: AuthEnv): Promise<boolean> {
  const cookie = request.headers.get('Cookie') ?? '';
  const valor = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!valor) return false;
  const punto = valor.lastIndexOf('.');
  if (punto < 0) return false;
  const payload = valor.slice(0, punto);
  let firma: Uint8Array;
  try {
    firma = unb64(valor.slice(punto + 1));
  } catch {
    return false;
  }
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), firma, enc.encode(payload));
  return ok && Number(payload) > Date.now();
}

function atributosCookie(maxAge: number): string {
  return `${COOKIE}=%VALOR%; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export async function login(request: Request, env: AuthEnv): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const llave = `login:fallos:${ip}`;
  const ahora = Date.now();
  const estado = (await env.MENU_KV.get<{ n: number; hasta: number }>(llave, 'json')) ?? { n: 0, hasta: 0 };

  if (estado.hasta > ahora) {
    return json({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429, {
      'Retry-After': String(Math.ceil((estado.hasta - ahora) / 1000)),
    });
  }

  const cuerpo = await request.json<{ clave?: unknown }>().catch(() => ({} as { clave?: unknown }));
  const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : '';

  if (clave && (await verificarClave(clave, env.ADMIN_PASSWORD_HASH))) {
    await env.MENU_KV.delete(llave);
    const valor = await firmarSesion(env.SESSION_SECRET, ahora + DURACION_MS);
    return json({ ok: true }, 200, {
      'Set-Cookie': atributosCookie(DURACION_MS / 1000).replace('%VALOR%', valor),
    });
  }

  const n = estado.n + 1;
  const nuevo = n >= MAX_FALLOS ? { n: 0, hasta: ahora + VENTANA_S * 1000 } : { n, hasta: 0 };
  await env.MENU_KV.put(llave, JSON.stringify(nuevo), { expirationTtl: VENTANA_S });
  return json({ error: 'Clave incorrecta.' }, 401);
}

export function logout(): Response {
  return json({ ok: true }, 200, { 'Set-Cookie': atributosCookie(0).replace('%VALOR%', '') });
}

export function origenPermitido(request: Request): boolean {
  return request.headers.get('Origin') === ORIGEN_ADMIN;
}
