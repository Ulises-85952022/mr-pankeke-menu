import { describe, expect, it } from 'vitest';
import { esIdValido, MAX_FAVORITOS, validarFavoritos, validarFotos } from '../src/menu';

const MENU = new Set(['taco-keke', 'choco-keke', 'tradicionales']);

describe('esIdValido', () => {
  it('acepta minúsculas, números y guiones', () => {
    expect(esIdValido('taco-keke')).toBe(true);
    expect(esIdValido('plato2')).toBe(true);
  });

  it('rechaza rutas, mayúsculas y vacíos', () => {
    expect(esIdValido('../secretos')).toBe(false);
    expect(esIdValido('Taco')).toBe(false);
    expect(esIdValido('')).toBe(false);
  });
});

describe('validarFavoritos', () => {
  it('acepta una lista válida', () => {
    expect(validarFavoritos(['taco-keke', 'choco-keke'], MENU)).toBeNull();
  });

  it('rechaza lista vacía, no arreglo o con elementos que no son texto', () => {
    expect(validarFavoritos([], MENU)).not.toBeNull();
    expect(validarFavoritos('taco-keke', MENU)).not.toBeNull();
    expect(validarFavoritos([1, 2], MENU)).not.toBeNull();
  });

  it('rechaza más de 12 favoritos', () => {
    const muchos = Array.from({ length: MAX_FAVORITOS + 1 }, (_, i) => `plato-${i}`);
    const menu = new Set(muchos);
    expect(validarFavoritos(muchos, menu)).not.toBeNull();
  });

  it('rechaza repetidos y platillos que no están en el menú', () => {
    expect(validarFavoritos(['taco-keke', 'taco-keke'], MENU)).toBe('Hay platillos repetidos');
    expect(validarFavoritos(['no-existe'], MENU)).toBe('Hay platillos que no existen en el menú');
  });
});

describe('validarFotos', () => {
  const jpeg = (tam = 10) => new File([new Uint8Array(tam)], 'f.jpg', { type: 'image/jpeg' });

  it('acepta tres JPEG pequeños', () => {
    expect(validarFotos([jpeg(), jpeg(), jpeg()])).toBeNull();
  });

  it('rechaza un tamaño que falta o no es archivo', () => {
    expect(validarFotos([jpeg(), jpeg(), null])).not.toBeNull();
  });

  it('rechaza tipos que no son JPEG y archivos vacíos o muy grandes', () => {
    const png = new File([new Uint8Array(10)], 'f.png', { type: 'image/png' });
    expect(validarFotos([png, jpeg(), jpeg()])).not.toBeNull();
    expect(validarFotos([jpeg(0), jpeg(), jpeg()])).not.toBeNull();
    expect(validarFotos([jpeg(3 * 1024 * 1024), jpeg(), jpeg()])).not.toBeNull();
  });
});
