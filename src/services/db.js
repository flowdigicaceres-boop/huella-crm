// src/services/db.js
import { normalizarEdificio, normalizarVisita } from '../utils/fechas';

const DB_NAME = 'HuellaCRM_DB';
const DB_VERSION = 2;

let dbInstance = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('edificios')) {
        db.createObjectStore('edificios', { keyPath: 'GESCAL26' });
      }
      
      if (!db.objectStoreNames.contains('visitas')) {
        const store = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('gescal', 'GESCAL', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('geocodes')) {
        db.createObjectStore('geocodes', { keyPath: 'GESCAL26' });
      }

      // v2: datos de la descarga web (PONs) y otros datos sueltos
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }
    };
  });
};

function extractCoordinatesFromBuilding(edificio) {
  if (!edificio) return null;

  let lat = null;
  let lon = null;

  const latVal = edificio['LATITUD'] || edificio['LAT'] || edificio['Latitud'] || edificio['lat'] || edificio['LATITUD_GPS'];
  const lonVal = edificio['LONGITUD'] || edificio['LON'] || edificio['Longitud'] || edificio['lon'] || edificio['LONGITUD_GPS'];

  if (latVal && lonVal) {
    const parsedLat = parseFloat(String(latVal).replace(',', '.'));
    const parsedLon = parseFloat(String(lonVal).replace(',', '.'));
    if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
      lat = parsedLat;
      lon = parsedLon;
    }
  } else {
    const combined = edificio['COORDENADAS'] || edificio['Coordenadas'] || edificio['GPS'] || edificio['UBICACION'];
    if (combined && String(combined).includes(',')) {
      const parts = String(combined).split(',');
      const parsedLat = parseFloat(parts[0].trim().replace(',', '.'));
      const parsedLon = parseFloat(parts[1].trim().replace(',', '.'));
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
        lat = parsedLat;
        lon = parsedLon;
      }
    }
  }

  return (lat !== null && lon !== null) ? { lat, lon } : null;
}

export const db = {
  async saveEdificios(edificios) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['edificios', 'geocodes'], 'readwrite');
      const storeEdificios = tx.objectStore('edificios');
      const storeGeocodes = tx.objectStore('geocodes');
      
      storeEdificios.clear();
      
      if (!edificios || edificios.length === 0) {
        resolve();
        return;
      }

      edificios.forEach((edificio) => {
        if (edificio && edificio.GESCAL26) {
          const gescalKey = String(edificio.GESCAL26);
          storeEdificios.put(normalizarEdificio(edificio));

          const coords = extractCoordinatesFromBuilding(edificio);
          if (coords) {
            storeGeocodes.put({ GESCAL26: gescalKey, lat: coords.lat, lon: coords.lon });
          }
        }
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Guarda la descarga web (filas por gestionar + resumen de PONs) para trabajar sin conexión. */
  async saveWeb(web) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ k: 'web', web, guardado: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getWeb() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction('meta', 'readonly').objectStore('meta').get('web');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /** Alta local de un edificio que viene de la web y todavía no está en el CRM. */
  async upsertEdificio(edificio) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edificios', 'readwrite');
      const copia = { ...normalizarEdificio(edificio) };
      delete copia._soloWeb;
      tx.objectStore('edificios').put(copia);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getEdificios() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edificios', 'readonly');
      const store = tx.objectStore('edificios');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async updateEdificioEstado(gescal, estado, ultimaVisita, proximaVisita, comentario = '') {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edificios', 'readwrite');
      const store = tx.objectStore('edificios');
      const getRequest = store.get(String(gescal));

      getRequest.onsuccess = () => {
        const edificio = getRequest.result;
        if (edificio) {
          edificio['ESTADO IC'] = estado;
          edificio['ULTIMA-VISITA'] = ultimaVisita;
          edificio['PROXIMA-VISITA'] = proximaVisita;
          if (comentario) {
            edificio['COMENTARIO'] = comentario;
          }
          store.put(edificio);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveVisitas(visitasNuevas = []) {
    const db = await initDB();
    
    const visitasActuales = await this.getVisitas();
    const pendientesSincronizar = visitasActuales.filter(v => v.sincronizado === false);

    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readwrite');
      const store = tx.objectStore('visitas');
      
      store.clear();

      const claveVisita = (v) => `${String(v.GESCAL).trim()}|${v.Fecha}|${String(v.Hora || '').trim()}`;
      const clavesPendientes = new Set(pendientesSincronizar.map((v) => claveVisita(normalizarVisita(v))));

      visitasNuevas.forEach((visita) => {
        const copy = normalizarVisita(visita);
        delete copy.id;
        // Si esa visita sigue pendiente en este móvil, se conserva solo la copia local
        if (clavesPendientes.has(claveVisita(copy))) return;
        store.add(copy);
      });

      // Sin conservar el id antiguo: un id repetido pisaría una visita descargada de la hoja
      pendientesSincronizar.forEach((visitaPendiente) => {
        const copy = { ...visitaPendiente };
        delete copy.id;
        store.add(copy);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async addVisita(visita) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readwrite');
      const store = tx.objectStore('visitas');
      const request = store.add(visita);

      request.onsuccess = () => {
        resolve({ ...visita, id: request.result });
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  async updateVisita(visita) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readwrite');
      const store = tx.objectStore('visitas');
      store.put(visita);

      tx.oncomplete = () => resolve(visita);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getVisitas() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readonly');
      const store = tx.objectStore('visitas');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getVisitasPorEdificio(gescal) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readonly');
      const store = tx.objectStore('visitas');
      const index = store.index('gescal');
      const request = index.getAll(String(gescal));

      request.onsuccess = () => {
        const visits = request.result || [];
        visits.sort((a, b) => {
          const dateA = parseDateTime(a.Fecha, a.Hora);
          const dateB = parseDateTime(b.Fecha, b.Hora);
          return dateB - dateA;
        });
        resolve(visits);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveGeocode(gescal, lat, lon) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('geocodes', 'readwrite');
      const store = tx.objectStore('geocodes');
      store.put({ GESCAL26: String(gescal), lat, lon });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getGeocode(gescal) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('geocodes', 'readonly');
      const store = tx.objectStore('geocodes');
      const request = store.get(String(gescal));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getTodosGeocodes() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('geocodes', 'readonly');
      const store = tx.objectStore('geocodes');
      const request = store.getAll();

      request.onsuccess = () => {
        const cache = {};
        (request.result || []).forEach(item => {
          cache[item.GESCAL26] = { lat: item.lat, lon: item.lon };
        });
        resolve(cache);
      };
      request.onerror = () => reject(request.error);
    });
  },

  // PURGADOR DE COORDENADAS ANTIGUAS EN LÍNEA
  async clearGeocodesCache() {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('geocodes', 'readwrite');
      const store = tx.objectStore('geocodes');
      store.clear();
      tx.oncomplete = () => resolve();
    });
  }
};

function parseDateTime(dateStr, timeStr) {
  try {
    if (!dateStr) return new Date(0);
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return new Date(dateStr);
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    if (timeStr) {
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
      if (timeParts.length >= 3) {
        seconds = parseInt(timeParts[2], 10);
      }
    }
    
    return new Date(year, month, day, hours, minutes, seconds);
  } catch (e) {
    return new Date(0);
  }
}