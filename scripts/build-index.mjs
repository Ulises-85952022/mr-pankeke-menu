// Asigna un data-id estable a cada platillo y genera public/menu-index.json.
// Uso: node scripts/build-index.mjs [carpeta-del-sitio]   (por defecto: public)
import { parse } from 'node-html-parser';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'public';
const htmlPath = join(dir, 'index.html');
const indexPath = join(dir, 'menu-index.json');

// "Chilaquiles Norteños" -> "chilaquiles-nortenos"
function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Nombre normalizado para emparejar cada favorito con su platillo.
function nameKey(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const root = parse(readFileSync(htmlPath, 'utf8'));
const rows = root.querySelectorAll('li.row');
const favs = root.querySelectorAll('li.fav');

const used = new Map(); // id -> nombre (para detectar colisiones)
const entries = [];

for (const row of rows) {
  const nombre = row.querySelector('h4').text.trim();
  const section = sectionOf(row);
  let id = row.getAttribute('data-id');
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    id = slugify(nombre);
    if (used.has(id)) id = `${id}-${slugify(section)}`; // colisión: agrega la sección
  }
  if (used.has(id)) throw new Error(`data-id repetido: "${id}" (${used.get(id)} y ${nombre})`);
  used.set(id, nombre);
  row.setAttribute('data-id', id);

  const tag = row.querySelector('.tag');
  const p = row.querySelector('p');
  let descripcion = p ? p.text : '';
  if (p && tag) descripcion = descripcion.replace(tag.text, '');
  const img = row.querySelector('img');
  entries.push({
    id,
    nombre,
    precio: row.querySelector('.price').text.trim(),
    descripcion: descripcion.replace(/\s+/g, ' ').trim(),
    seccion: section,
    foto: img ? img.getAttribute('src') : null,
  });
}

// Cada favorito toma el id de su platillo: no crea entradas nuevas.
const byName = new Map(entries.map(e => [nameKey(e.nombre), e.id]));
for (const fav of favs) {
  const nombre = fav.querySelector('h4').text.trim();
  const id = byName.get(nameKey(nombre));
  if (!id) throw new Error(`favorito sin platillo en el menú: "${nombre}"`);
  fav.setAttribute('data-id', id);
  // Si el platillo no tiene foto en su fila, usa la del favorito.
  const entrada = entries.find(e => e.id === id);
  const fotoFav = fav.querySelector('img');
  if (entrada && !entrada.foto && fotoFav) entrada.foto = fotoFav.getAttribute('src');
}

if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('ids repetidos en menu-index');

writeFileSync(htmlPath, root.toString());
writeFileSync(indexPath, JSON.stringify(entries, null, 2) + '\n');
console.log(`OK ${entries.length} platillos, ${favs.length} favoritos`);

function sectionOf(el) {
  for (let n = el.parentNode; n; n = n.parentNode) {
    if (n.tagName === 'SECTION' && n.classList.contains('cat')) {
      return n.querySelector('.cat-title').text.trim();
    }
  }
  throw new Error(`fila sin sección: "${el.querySelector('h4').text}"`);
}
