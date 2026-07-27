// src/services/db.js

const DB_NAME = 'HuellaCRM_DB';
const DB_VERSION = 1;

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
      
      // Store para edificios (clave: GESCAL26)
      if (!db.objectStoreNames.contains('edificios')) {
        db.createObjectStore('edificios', { keyPath: 'GESCAL26' });
      }
      
      // Store para visitas (clave: entero autoincremental)
      if (!db.objectStoreNames.contains('visitas')) {
        const store = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('gescal', 'GESCAL', { unique: false });
      }
      
      // Store para geocodificación cacheada (clave: GESCAL26)
      if (!db.objectStoreNames.contains('geocodes')) {
        db.createObjectStore('geocodes', { keyPath: 'GESCAL26' });
      }
    };
  });
};

export const db = {
  // ----------------------------------------------------
  // BUILDINGS METHODS
  // ----------------------------------------------------
  async saveEdificios(edificios) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edificios', 'readwrite');
      const store = tx.objectStore('edificios');
      
      store.clear();
      
      if (!edificios || edificios.length === 0) {
        resolve();
        return;
      }

      edificios.forEach((edificio) => {
        if (edificio && edificio.GESCAL26) {
          store.put(edificio);
        }
      });

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

  // ----------------------------------------------------
  // VISITS METHODS
  // ----------------------------------------------------
  async saveVisitas(visitasNuevas = []) {
    const db = await initDB();
    
    // Prevenir pérdida de visitas pendientes de sincronización
    const visitasActuales = await this.getVisitas();
    const pendientesSincronizar = visitasActuales.filter(v => v.sincronizado === false);

    return new Promise((resolve, reject) => {
      const tx = db.transaction('visitas', 'readwrite');
      const store = tx.objectStore('visitas');
      
      store.clear();

      visitasNuevas.forEach((visita) => {
        const copy = { ...visita };
        delete copy.id;
        store.add(copy);
      });

      pendientesSincronizar.forEach((visitaPendiente) => {
        store.put(visitaPendiente);
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

  // ----------------------------------------------------
  // GEOCODING CACHE METHODS
  // ----------------------------------------------------
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