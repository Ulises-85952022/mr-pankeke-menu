// Genera el valor de ADMIN_PASSWORD_HASH (PBKDF2-SHA256, 100 000 iteraciones).
// Uso: node scripts/hash-password.mjs
// La clave se pide en la terminal sin mostrarse. Nunca se guarda en disco.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERACIONES = 100000;

function leerClave() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Ejecútalo en una terminal interactiva.'));
    process.stdout.write('Clave nueva: ');
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

const clave = await leerClave();
if (clave.length < 12) {
  console.error('La clave debe tener al menos 12 caracteres.');
  process.exit(1);
}
const sal = randomBytes(16);
const hash = pbkdf2Sync(clave, sal, ITERACIONES, 32, 'sha256');
console.log(`${ITERACIONES}:${sal.toString('base64')}:${hash.toString('base64')}`);
