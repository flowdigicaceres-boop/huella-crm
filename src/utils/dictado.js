// src/utils/dictado.js
// Analizador local del dictado por voz (se usa cuando no hay IA disponible).
// Solo decide entre los tres estados del edificio. Ante la duda devuelve "En gestión",
// que es el único que no cierra el edificio.

const POSITIVO = /firmad|concedid|autoriz|aceptad|visto bueno|dejan instalar|conforme/;
const NEGACION = /\b(no|sin|nada|nadie|ni|ninguno|ninguna|tampoco)\b/;
const DENEGADO = /denegad|rechaz|se nieg|no quier|prohibid|negad|imposible/;

function sinTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function detectarEstado(texto) {
  const clausulas = sinTildes(texto).split(/[.,;\n]+/);

  // "no han firmado", "sin firmar", "no está autorizado" no son un Concedido
  const concedido = clausulas.some((c) => POSITIVO.test(c) && !NEGACION.test(c));
  if (concedido) return 'Concedido';

  const denegado = clausulas.some((c) => DENEGADO.test(c));
  if (denegado) return 'Denegado';

  return 'En gestión';
}

export function limpiarComentario(texto) {
  let limpio = String(texto || '')
    .replace(/^(bueno|pues|eh|em|nada)\s+/gui, '')
    .replace(/\b(eh|em|bueno|nada)\b/gui, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpio.length > 0) limpio = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  return limpio;
}

export function analizarDictadoLocal(texto) {
  return { estado: detectarEstado(texto), comentario: limpiarComentario(texto) };
}
