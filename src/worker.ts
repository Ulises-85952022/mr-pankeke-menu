import { login, logout, origenPermitido, sesionValida, type AuthEnv } from './auth';
import { datosPublicos, guardarFavoritos, obtenerMenu, subirFoto } from './menu';

export interface Env extends AuthEnv {
  ASSETS: Fetcher;
  FOTOS: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API del panel: solo desde el origen del admin.
    if (url.pathname.startsWith('/api/')) {
      if (!origenPermitido(request)) {
        return new Response(JSON.stringify({ error: 'Origen no permitido' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env);
      if (url.pathname === '/api/logout' && request.method === 'POST') return logout();
      if (!(await sesionValida(request, env))) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (url.pathname === '/api/menu' && request.method === 'GET') return obtenerMenu(env);
      if (url.pathname === '/api/favoritos' && request.method === 'PUT') return guardarFavoritos(request, env);
      const foto = url.pathname.match(/^\/api\/fotos\/([^/]+)$/);
      if (foto && request.method === 'POST') return subirFoto(request, env, decodeURIComponent(foto[1]));
      return new Response(JSON.stringify({ error: 'No encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Fotos y favoritos para el sitio público. Sin /api/ para que no pida la cabecera de origen del admin.
    if (url.pathname === '/datos-menu.json' && request.method === 'GET') return datosPublicos(env);

    // En el host del admin, la raíz es el login del panel (public/admin/).
    if (url.hostname === 'admin.mrpankeketepa.com' && url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', url), request));
    }

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

    // El resto (incluida la página principal) sale tal cual de public/.
    return env.ASSETS.fetch(request);
  },
};
