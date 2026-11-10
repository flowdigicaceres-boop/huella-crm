// src/utils/fechas.js
// La hoja de Google puede devolver fechas como "2026-08-19T22:00:00.000Z" (ISO en UTC)
// o como "19/08/2026". La app trabaja siempre con "dd/mm/yyyy".

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO',
  'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const ISO_COMPLETO = /^\d{4}-\d{2}-\d{2}T/;
const ISO_SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

const pad = (n) => String(n).padStart(2, '0');

/** Devuelve "dd/mm/yyyy", o '' si el valor no es una fecha (p. ej. texto de una fórmula). */
export function normalizarFecha(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';

  if (ISO_COMPLETO.test(s)) {
    const d = new Date(s); // hora local del móvil: 22:00Z del día anterior = 00:00 en España
    return isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  const iso = s.match(ISO_SOLO_FECHA);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const m = s.match(DMY);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${pad(parseInt(m[1], 10))}/${pad(parseInt(m[2], 10))}/${y}`;
  }

  return '';
}

/** Google Sheets convierte "8 DE SEPTIEMBRE" en una fecha. Lo devolvemos a texto. */
export function normalizarNombreVia(raw) {
  if (raw === null || raw === undefined) return raw;
  const s = String(raw).trim();
  if (!ISO_COMPLETO.test(s)) return raw;
  const d = new Date(s);
  if (isNaN(d.getTime())) return raw;
  return `${d.getDate()} DE ${MESES[d.getMonth()]}`;
}

/** Copia del edificio con las fechas y el nombre de la vía ya legibles. */
export function normalizarEdificio(edificio) {
  if (!edificio) return edificio;
  const copia = { ...edificio };
  ['ULTIMA-VISITA', 'PROXIMA-VISITA'].forEach((campo) => {
    if (campo in copia) copia[campo] = normalizarFecha(copia[campo]);
  });
  if ('NOMBRE-VIA' in copia) copia['NOMBRE-VIA'] = normalizarNombreVia(copia['NOMBRE-VIA']);
  return copia;
}

/** Copia de la visita con las fechas ya legibles. */
export function normalizarVisita(visita) {
  if (!visita) return visita;
  const copia = { ...visita };
  if ('Fecha' in copia) copia.Fecha = normalizarFecha(copia.Fecha);
  if ('Próxima visita' in copia) copia['Próxima visita'] = normalizarFecha(copia['Próxima visita']);
  return copia;
}

/** Marca de tiempo (ms) de "dd/mm/yyyy" + "HH:mm" para ordenar visitas. */
export function marcaDeTiempo(fecha, hora) {
  const f = normalizarFecha(fecha);
  if (!f) return 0;
  const [d, m, y] = f.split('/').map(Number);
  let h = 0;
  let min = 0;
  const t = String(hora || '').match(/(\d{1,2}):(\d{2})/);
  if (t) {
    h = parseInt(t[1], 10);
    min = parseInt(t[2], 10);
  }
  return new Date(y, m - 1, d, h, min).getTime();
}

/** "dd/mm/yyyy" de hoy, con ceros. */
export function hoyDDMMYYYY() {
  const n = new Date();
  return `${pad(n.getDate())}/${pad(n.getMonth() + 1)}/${n.getFullYear()}`;
}
