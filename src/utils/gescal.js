// src/utils/gescal.js
// Un GESCAL real son muchos dígitos seguidos de guiones o letras ("10000390004900002---------").
// Sirve para detectar datos pegados con las columnas desplazadas (una población o un nombre en lugar del
// GESCAL) antes de que una sola visita acabe marcando como visitados cientos de edificios "iguales".
export const GESCAL_RE = /^\d{12,}[-A-Za-z0-9]*$/;

export function esGescal(g) {
  return GESCAL_RE.test(String(g === null || g === undefined ? '' : g).trim());
}

/** Comprueba la descarga web recibida: si casi ninguna fila trae un GESCAL, está mal pegada. */
export function revisarWeb(web) {
  const filas = (web && web.filas) || [];
  const total = filas.length;
  const malas = filas.filter((f) => !esGescal(f.GESCAL26)).length;
  if (total > 0 && malas > total * 0.2) {
    return {
      ok: false,
      total,
      malas,
      mensaje: `La pestaña WEB tiene mal las columnas: ${malas} de ${total} filas no traen un GESCAL. `
        + 'Borra su contenido y pega de nuevo la descarga entera, con su fila de cabeceras, desde la celda A1.'
    };
  }
  return { ok: true, total, malas, mensaje: '' };
}
