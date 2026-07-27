// src/services/geocoding.js
import { db } from './db';

let lastRequestTime = 0;
const MIN_DELAY = 1100; // 1.1s delay to comply with Nominatim's 1 req/sec policy

// Queue for geocoding requests
let queue = [];
let processing = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { building, resolve, reject } = queue.shift();
    try {
      const coords = await performGeocoding(building);
      resolve(coords);
    } catch (error) {
      console.error('Geocoding queue error:', error);
      reject(error);
    }
  }

  processing = false;
}

async function performGeocoding(building) {
  // Check IndexedDB cache first
  const cached = await db.getGeocode(building.GESCAL26);
  if (cached) {
    return { lat: cached.lat, lon: cached.lon };
  }

  // Componer dirección completa
  // E.g., "CALLE MAYOR 15, MADRID, España"
  const tipoVia = String(building['TIPO-VIA'] || '').trim();
  const nombreVia = String(building['NOMBRE-VIA'] || '').trim();
  const num = String(building['NUM'] || '').trim();
  const poblacion = String(building['POBLACION'] || '').trim();
  
  if (!nombreVia || !poblacion) {
    return null; // Dirección inválida
  }

  const address = `${tipoVia} ${nombreVia} ${num}, ${poblacion}, España`;

  // Rate limiting delay
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_DELAY) {
    const waitTime = MIN_DELAY - timeSinceLast;
    await delay(waitTime);
  }

  lastRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'HuellaCRM-Android-App-v1.0 (range.escritorio.ia@gmail.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      
      // Guardar en la base de datos local (IndexedDB)
      await db.saveGeocode(building.GESCAL26, lat, lon);
      return { lat, lon };
    } else {
      // Intentar una búsqueda menos específica si falla (sin el número de portal)
      const fallbackAddress = `${tipoVia} ${nombreVia}, ${poblacion}, España`;
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackAddress)}&limit=1`;
      
      await delay(MIN_DELAY);
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'Accept-Language': 'es',
          'User-Agent': 'HuellaCRM-Android-App-v1.0 (range.escritorio.ia@gmail.com)'
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          const lat = parseFloat(fallbackData[0].lat);
          const lon = parseFloat(fallbackData[0].lon);
          await db.saveGeocode(building.GESCAL26, lat, lon);
          return { lat, lon };
        }
      }
      
      // Si todo falla, guardar null o valor por defecto para no volver a intentar infinitamente
      await db.saveGeocode(building.GESCAL26, null, null);
      return null;
    }
  } catch (error) {
    console.error(`Error geocodificando: ${address}`, error);
    return null;
  }
}

export const geocodeBuilding = (building) => {
  return new Promise((resolve, reject) => {
    // Check cache synchronously if possible or add to queue
    db.getGeocode(building.GESCAL26).then((cached) => {
      if (cached) {
        resolve(cached.lat !== null ? { lat: cached.lat, lon: cached.lon } : null);
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
