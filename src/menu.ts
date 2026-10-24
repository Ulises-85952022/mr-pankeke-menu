// Fotos y favoritos del menú (Fase 4).
// KV guarda la versión actual de cada foto y la lista de favoritos; R2 guarda cada versión en platos/<id>/<v>/<tamaño>.jpg.
// Como cada versión tiene su propia ruta, el navegador puede cachearla para siempre sin riesgo de ver una foto vieja.

export interface MenuEnv {
  MENU_KV: KVNamespace;
  FOTOS: R2Bucket;
  ASSETS: Fetcher;
}

export interface FotoEntrada {
  v: number;
  actualizado: string;
  anterior: number | null;
  legacy?: Record<string, string | null>;
}
export type Fotos = Record<string, FotoEntrada>;
export interface Favoritos {
  items: string[];
  actualizado: string;
}

export const TAMANOS = ['thumb', '600', '1200'] as const;
export const MAX_FAVORITOS = 12;
const MAX_BYTES = 2 * 1024 * 1024;

const cabeceraJson = { 'Content-Type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cabeceraJson, ...headers } });
}

export function esIdValido(id: string): boolean {
  return /^[a-z0-9-]{1,80}$/.test(id);
}

// Revisa que la lista de favoritos tenga entre 1 y 12 platillos, sin repetidos, y que todos existan en el menú.
export function validarFavoritos(items: unknown, idsMenu: Set<string>): string | null {
  if (!Array.isArray(items) || !items.every((x) => typeof x === 'string')) return 'Lista inválida';
  const lista = items as string[];
  if (lista.length < 1 || lista.length > MAX_FAVORITOS) return `Elige entre 1 y ${MAX_FAVORITOS} favoritos`;
  if (new Set(lista).size !== lista.length) return 'Hay platillos repetidos';
  if (!lista.every((id) => idsMenu.has(id))) return 'Hay platillos que no existen en el menú';
  return null;
}

// Revisa que cada tamaño sea un JPEG no vacío y de hasta 2 MB.
export function validarFotos(archivos: unknown[]): string | null {
  for (const a of archivos) {
    if (!(a instanceof File) || a.type !== 'image/jpeg' || a.size === 0 || a.size > MAX_BYTES) {
      return 'Cada tamaño debe ser un JPEG de hasta 2 MB';
    }
  }
  return null;
}

async function idsDelMenu(env: MenuEnv): Promise<Set<string>> {
  const r = await env.ASSETS.fetch(new Request('https://assets.local/menu-index.json'));
  const platos = (await r.json()) as { id: string }[];
  return new Set(platos.map((p) => p.id));
}

async function leerFotos(env: MenuEnv): Promise<Fotos> {
  return (await env.MENU_KV.get<Fotos>('fotos', 'json')) ?? {};
}

async function leerFavoritos(env: MenuEnv): Promise<Favoritos | null> {
  return env.MENU_KV.get<Favoritos>('favoritos', 'json');
}

// Para el panel: platillos del menú, fotos actuales y favoritos.
export async function obtenerMenu(env: MenuEnv): Promise<Response> {
  const [r, fotos, favoritos] = await Promise.all([
    env.ASSETS.fetch(new Request('https://assets.local/menu-index.json')),
    leerFotos(env),
    leerFavoritos(env),
  ]);
  return json({ platos: await r.json(), fotos, favoritos: favoritos?.items ?? [] });
}

// Para el sitio público: solo la versión de cada foto y los favoritos. Si favoritos es null, el HTML se queda como está.
export async function datosPublicos(env: MenuEnv): Promise<Response> {
  const fotos = await leerFotos(env);
  const favoritos = await leerFavoritos(env);
  const versiones: Record<string, number> = {};
  for (const [id, f] of Object.entries(fotos)) if (f.v > 0) versiones[id] = f.v;
  return json(
    { fotos: versiones, favoritos: favoritos?.items ?? null },
    200,
    { 'Cache-Control': 'public, max-age=60' },
  );
}

export async function subirFoto(request: Request, env: MenuEnv, id: string): Promise<Response> {
  if (!esIdValido(id) || !(await idsDelMenu(env)).has(id)) {
    return json({ error: 'Platillo no encontrado' }, 404);
  }
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Formulario inválido' }, 400);

  const archivos = TAMANOS.map((t) => form.get(t));
  const error = validarFotos(archivos);
  if (error) return json({ error }, 400);

  const fotos = await leerFotos(env);
  const previo = fotos[id];
  const v = (previo?.v ?? 0) + 1;
  await Promise.all(
    TAMANOS.map((t, i) =>
      env.FOTOS.put(`platos/${id}/${v}/${t}.jpg`, archivos[i] as File, {
        httpMetadata: { contentType: 'image/jpeg' },
      }),
    ),
  );

  fotos[id] = {
    v,
    actualizado: new Date().toISOString(),
    anterior: previo?.v ?? null,
    legacy: previo?.legacy,
  };
  await env.MENU_KV.put('fotos', JSON.stringify(fotos));
  return json({ ok: true, v });
}

export async function guardarFavoritos(request: Request, env: MenuEnv): Promise<Response> {
  const cuerpo = await request.json<{ items?: unknown }>().catch(() => null);
  const items = cuerpo?.items;
  const error = validarFavoritos(items, await idsDelMenu(env));
  if (error) return json({ error }, 400);

  const favoritos: Favoritos = { items: items as string[], actualizado: new Date().toISOString() };
  await env.MENU_KV.put('favoritos', JSON.stringify(favoritos));
  return json({ ok: true });
}
