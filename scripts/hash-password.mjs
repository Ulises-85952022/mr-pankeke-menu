// Genera el valor de ADMIN_PASSWORD_HASH (PBKDF2-SHA256, 100 000 iteraciones).
// Uso:
//   node scripts/hash-password.mjs                       -> imprime el hash
//   node scripts/hash-password.mjs --subir               -> sube ADMIN_PASSWORD_HASH a Cloudflare
//   node scripts/hash-password.mjs --subir --cerrar-sesiones
//       -> además rota SESSION_SECRET y cierra todas las sesiones abiertas
// La clave se pide en la terminal sin mostrarse. Nunca se guarda en disco.
// Para --subir hace falta `npm install` y `npx wrangler login` una vez.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ITERACIONES = 100000;
const SUBIR = process.argv.includes('--subir');
const CERRAR_SESIONES = process.argv.includes('--cerrar-sesiones');

function leerClave(pregunta) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Ejecútalo en una terminal interactiva.'));
    process.stdout.write(pregunta);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    let clave = '';
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(clave);
        }
        if (c === '\u0003') process.exit(130); // Ctrl+C
        if (c === '\u007f' || c === '\b') clave = clave.slice(0, -1);
        else clave += c;
      }
    };
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

// Sube un secreto al Worker. El valor va por stdin, así no queda en el historial ni en la lista de procesos.
function subirSecreto(nombre, valor) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', nombre], {
    input: valor,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`No se pudo subir ${nombre}. Revisa que hayas hecho "npx wrangler login".`);
    process.exit(r.status ?? 1);
  }
  console.log(`${nombre} actualizado en Cloudflare.`);
}

const clave = await leerClave('Clave nueva: ');
const repite = await leerClave('Repite la clave: ');
if (clave !== repite) {
  console.error('Las claves no coinciden. No se subió nada.');
  process.exit(1);
}
if (clave.length < 12) {
  console.error('La clave debe tener al menos 12 caracteres.');
  process.exit(1);
}
const sal = randomBytes(16);
const hash = pbkdf2Sync(clave, sal, ITERACIONES, 32, 'sha256');
const valor = `${ITERACIONES}:${sal.toString('base64')}:${hash.toString('base64')}`;

if (!SUBIR) {
  console.log(valor);
  process.exit(0);
}

subirSecreto('ADMIN_PASSWORD_HASH', valor);
if (CERRAR_SESIONES) {
  subirSecreto('SESSION_SECRET', randomBytes(32).toString('base64'));
  console.log('Sesiones anteriores cerradas.');
}
console.log('Listo. Prueba el login con la clave nueva.');
