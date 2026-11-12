// src/utils/ubicacion.js
// Ayudas para localizar edificios sin salirse de su población: centros de las poblaciones, comprobación de
// que unas coordenadas son plausibles y texto de la dirección para el buscador.
import { distanciaKm } from './pons.js';

const CENTROS = {
  plasencia: [40.029, -6.088],
  caceres: [39.475, -6.372],
  'navalmoral de la mata': [39.891, -5.541],
  trujillo: [39.461, -5.881],
  coria: [39.983, -6.536],
  badajoz: [38.878, -6.970],
  merida: [38.916, -6.343],
  miajadas: [39.152, -5.908]
};
const PROVINCIA_BADAJOZ = new Set(['badajoz', 'merida', 'miajadas']);

// Un edificio no puede estar a más de esta distancia del centro de su población.
// (Un resultado en otra provincia, a cientos de km, es siempre un error del buscador.)
export const RADIO_MAXIMO_KM = 12;

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function claveCentro(poblacion) {
  const n = sinTildes(poblacion);
  if (!n) return null;
  return Object.keys(CENTROS).find((k) => n === k || n.includes(k) || k.includes(n)) || null;
}

export function centroDePoblacion(poblacion) {
  const k = claveCentro(poblacion);
  return k ? { lat: CENTROS[k][0], lon: CENTROS[k][1] } : null;
}

export function provinciaDe(poblacion) {
  const k = claveCentro(poblacion);
  return k && PROVINCIA_BADAJOZ.has(k) ? 'Badajoz' : 'Cáceres';
}

/** Población de un edificio (columna POBLACION o, si falta, el principio de ZONA-GPON). */
export function poblacionDe(e) {
  const p = String((e && (e.POBLACION ?? e['Población'] ?? e.Poblacion)) || '').trim();
  if (p) return p;
  const gpon = sinTildes(e && (e['ZONA-GPON'] || ''));
  const k = Object.keys(CENTROS).find((c) => gpon.startsWith(c.split(' ')[0]));
  return k || '';
}

/** ¿Están estas coordenadas razonablemente cerca de la población? Sin población conocida no se puede juzgar. */
export function coordenadaPlausible(coords, poblacion) {
  if (!coords || coords.lat === null || coords.lat === undefined || coords.lon === null || coords.lon === undefined) return false;
  if (!Number.isFinite(Number(coords.lat)) || !Number.isFinite(Number(coords.lon))) return false;
  const c = centroDePoblacion(poblacion);
  if (!c) return true;
  return distanciaKm(c.lat, c.lon, Number(coords.lat), Number(coords.lon)) <= RADIO_MAXIMO_KM;
}

/** Caja alrededor de la población para limitar la búsqueda (unos ±13 km). */
export function cajaDePoblacion(poblacion, grados = 0.12) {
  const c = centroDePoblacion(poblacion);
  if (!c) return null;
  return { minLat: c.lat - grados, maxLat: c.lat + grados, minLon: c.lon - grados * 1.3, maxLon: c.lon + grados * 1.3 };
}

/** Tipo, nombre y número de la vía limpios. La web usa 99998 / 99999 para "sin número". */
export function partesDireccion(e) {
  let tipo = String(e['TIPO-VIA'] || '').trim();
  if (/^(c|cl|c\/|calle)\.?$/i.test(tipo)) tipo = 'CALLE';
  else if (/^(av|avda|av\.|avenida)\.?$/i.test(tipo)) tipo = 'AVENIDA';
  // Solo se quita una abreviatura al principio del nombre ("C/ ", "CL ")
  const nombre = String(e['NOMBRE-VIA'] || '').replace(/^\s*(c\/|cl\.?\s)\s*/i, '').trim();
  const n = parseInt(String(e['NUM'] ?? '').replace(/\D/g, ''), 10);
  const num = Number.isFinite(n) && n > 0 && n < 99990 ? n : null;
  return { tipo, nombre, num };
}

/** "CALLE ALTA 5, Plasencia, Cáceres, España" (sin número si no lo tiene). */
export function direccionTexto(e) {
  const poblacion = poblacionDe(e);
  const { tipo, nombre, num } = partesDireccion(e);
  return [`${tipo} ${nombre}${num ? ` ${num}` : ''}`.replace(/\s+/g, ' ').trim(), poblacion, provinciaDe(poblacion), 'España']
    .filter(Boolean)
    .join(', ');
}

/** Dirección de la vía sin número, para el segundo intento. */
export function calleTexto(e) {
  const poblacion = poblacionDe(e);
  const { tipo, nombre } = partesDireccion(e);
  return [`${tipo} ${nombre}`.replace(/\s+/g, ' ').trim(), poblacion, provinciaDe(poblacion), 'España'].filter(Boolean).join(', ');
}
