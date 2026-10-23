// Genera .seed/fotos.json y .seed/favoritos.json desde public/index.html.
// Luego se suben a KV con: npm run seed:kv:upload (requiere sesión de wrangler).
import { parse } from 'node-html-parser';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = parse(readFileSync('public/index.html', 'utf8'));
const now = new Date().toISOString();
const fotos = {};
const favoritos = [];

// Fotos originales de las filas del menú (miniatura de 96 px).
for (const row of root.querySelectorAll('li.row[data-id]')) {
  const img = row.querySelector('img');
  if (!img) continue;
  fotos[row.getAttribute('data-id')] = {
    v: 0, actualizado: now, anterior: null,
    legacy: { thumb: img.getAttribute('src') },
  };
}

// Fotos originales de los favoritos (600 y 1200 px). Se mezclan con la entrada de su platillo.
for (const fav of root.querySelectorAll('li.fav[data-id]')) {
  const id = fav.getAttribute('data-id');
  const img = fav.querySelector('img');
  const srcset = img.getAttribute('srcset') || '';
  const grande2x = srcset.split(',').map(s => s.trim().split(' ')[0]).find(u => u.endsWith('1200.jpg')) ?? null;
  const entrada = fotos[id] ?? (fotos[id] = { v: 0, actualizado: now, anterior: null, legacy: {} });
  entrada.legacy.grande = img.getAttribute('src');
  entrada.legacy.grande2x = grande2x;
  favoritos.push(id);
}

if (favoritos.length > 12) throw new Error('más de 12 favoritos');
mkdirSync('.seed', { recursive: true });
writeFileSync('.seed/fotos.json', JSON.stringify(fotos, null, 2) + '\n');
writeFileSync('.seed/favoritos.json', JSON.stringify({ items: favoritos, actualizado: now }, null, 2) + '\n');
console.log(`OK fotos=${Object.keys(fotos).length} favoritos=${favoritos.length}`);
