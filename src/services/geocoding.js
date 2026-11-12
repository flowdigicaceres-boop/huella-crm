// src/services/geocoding.js
// Coordenadas de un edificio para "Cómo llegar" y la ficha. Usa la caché del móvil (IndexedDB) y, si no hay,
// busca por dirección dentro de su población (ver geocoder.js). Nunca devuelve un sitio lejos de su población.
import { db } from './db';
import { geocodeFastRealStreet } from './geocoder';
import {
  poblacionDe, centroDePoblacion, cajaDePoblacion, coordenadaPlausible, direccionTexto
} from '../utils/ubicacion';

const MIN_DELAY = 1100; // Nominatim pide como máximo 1 petición por segundo
let lastRequestTime = 0;

// Cola para no lanzar muchas búsquedas a la vez
let queue = [];
let processing = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { building, resolve, reject } = queue.shift();
    try {
      resolve(await performGeocoding(building));
    } catch (error) {
      console.error('Geocoding queue error:', error);
      reject(error);
    }
  }

  processing = false;
}

/** Último recurso: Nominatim, limitado a la caja de la población. */
async function buscarNominatim(building, poblacion) {
  const espera = MIN_DELAY - (Date.now() - lastRequestTime);
  if (espera > 0) await delay(espera);
  lastRequestTime = Date.now();

  const caja = cajaDePoblacion(poblacion);
  let url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=es&q=${encodeURIComponent(direccionTexto(building))}`;
  if (caja) url += `&viewbox=${caja.minLon},${caja.maxLat},${caja.maxLon},${caja.minLat}&bounded=1`;

  const response = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!response.ok) throw new Error(`Nominatim request failed: ${response.status}`);
  const data = await response.json();
  const buena = (data || []).find((d) => coordenadaPlausible({ lat: parseFloat(d.lat), lon: parseFloat(d.lon) }, poblacion));
  return buena ? { lat: parseFloat(buena.lat), lon: parseFloat(buena.lon) } : null;
}

async function performGeocoding(building) {
  const poblacion = poblacionDe(building);

  // 1. Caché del móvil: solo se usa si cae dentro de su población (si no, se vuelve a buscar)
  const cached = await db.getGeocode(building.GESCAL26);
  if (cached) {
    if (cached.lat === null || cached.lat === undefined) return null;
    if (coordenadaPlausible(cached, poblacion)) return { lat: cached.lat, lon: cached.lon };
  }

  // 2. Búsqueda por dirección dentro de la población
  let coords = null;
  try {
    coords = await geocodeFastRealStreet(building);
  } catch (e) {
    coords = null;
  }

  // 3. Último recurso
  if (!coords && poblacion && centroDePoblacion(poblacion)) {
    try {
      coords = await buscarNominatim(building, poblacion);
    } catch (e) {
      coords = null;
    }
  }

  if (coords) {
    await db.saveGeocode(building.GESCAL26, coords.lat, coords.lon);
    return coords;
  }
  // Se guarda como "no localizado" para no insistir en cada carga
  await db.saveGeocode(building.GESCAL26, null, null);
  return null;
}

export const geocodeBuilding = (building) => {
  return new Promise((resolve, reject) => {
    db.getGeocode(building.GESCAL26).then((cached) => {
      if (cached && cached.lat !== null && cached.lat !== undefined
          && coordenadaPlausible(cached, poblacionDe(building))) {
        resolve({ lat: cached.lat, lon: cached.lon });
      } else if (cached && (cached.lat === null || cached.lat === undefined)) {
        resolve(null);
      } else {
        queue.push({ building, resolve, reject });
        processQueue();
      }
    }).catch(() => {
      queue.push({ building, resolve, reject });
      processQueue();
    });
  });
};
