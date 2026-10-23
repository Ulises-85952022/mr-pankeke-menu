export interface Env {
  ASSETS: Fetcher;
  FOTOS: R2Bucket;
  MENU_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
