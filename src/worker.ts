import { datosPublicos, guardarFavoritos, obtenerMenu, subirFoto } from './menu';

const HOST_ADMIN = 'admin.mrpankeketepa.com';

export interface Env {
  ASSETS: Fetcher;
  FOTOS: R2Bucket;
  MENU_KV: KVNamespace;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // La API y el panel solo viven en el host del admin, detrás de Cloudflare Access.
    if (url.pathname.startsWith('/api/')) {
      if (url.hostname !== HOST_ADMIN) return json({ error: 'No encontrado' }, 404);
      // Access solo deja pasar a quien tiene permiso y pone su correo en esta cabecera. Sin ella, no hay acceso.
      if (!request.headers.get('Cf-Access-Authenticated-User-Email')) return json({ error: 'No autorizado' }, 401);

      if (url.pathname === '/api/menu' && request.method === 'GET') return obtenerMenu(env);
      if (url.pathname === '/api/favoritos' && request.method === 'PUT') return guardarFavoritos(request, env);
      const foto = url.pathname.match(/^\/api\/fotos\/([^/]+)$/);
      if (foto && request.method === 'POST') return subirFoto(request, env, decodeURIComponent(foto[1]));
      return json({ error: 'No encontrado' }, 404);
    }

    // Fotos y favoritos para el sitio público.
    if (url.pathname === '/datos-menu.json' && request.method === 'GET') return datosPublicos(env);

    // Fotos subidas desde el panel: /fotos/<id>/<v>/<tamaño>.<ext> -> R2 platos/<id>/<v>/<tamaño>.<ext>
    if (url.pathname.startsWith('/fotos/')) {
      const obj = await env.FOTOS.get('platos/' + url.pathname.slice('/fotos/'.length));
      if (!obj) return new Response('No encontrada', { status: 404 });
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // En el host del admin, la raíz es el panel (public/admin/).
    if (url.hostname === HOST_ADMIN && url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', url), request));
    }

    // El resto (incluida la página principal) sale tal cual de public/.
    return env.ASSETS.fetch(request);
  },
};
