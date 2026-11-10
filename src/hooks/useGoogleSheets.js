// src/hooks/useGoogleSheets.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/db';

function registrarVisitaEnMemoriaDiaria(gescalId) {
  try {
    const todayStr = new Date().toLocaleDateString('es-ES');
    const storedDate = localStorage.getItem('huella_daily_counter_date');
    let idsSet = new Set();

    if (storedDate === todayStr) {
      const rawIds = localStorage.getItem('huella_daily_visited_ids');
      if (rawIds) {
        idsSet = new Set(JSON.parse(rawIds));
      }
    } else {
      localStorage.setItem('huella_daily_counter_date', todayStr);
    }

    if (gescalId) {
      idsSet.add(String(gescalId).trim());
    }

    localStorage.setItem('huella_daily_visited_ids', JSON.stringify(Array.from(idsSet)));
  } catch (e) {}
}

export function useGoogleSheets() {
  const [edificios, setEdificios] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const isSyncingVisitasRef = useRef(false);

  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('huella_crm_script_url') || '');

  const saveScriptUrl = (url) => {
    const trimmedUrl = String(url || '').trim();
    localStorage.setItem('huella_crm_script_url', trimmedUrl);
    setScriptUrl(trimmedUrl);
  };

  const loadLocalData = useCallback(async () => {
    try {
      const localEdificios = await db.getEdificios();
      const localVisitas = await db.getVisitas();
      setEdificios(localEdificios || []);
      setVisitas(localVisitas || []);
      return { edificios: localEdificios, visitas: localVisitas };
    } catch (e) {
      console.error('Error cargando datos locales:', e);
      return { edificios: [], visitas: [] };
    }
  }, []);

  const sendVisitaToSheets = useCallback(async (visita) => {
    if (!scriptUrl) throw new Error('No Apps Script URL configured');

    const payload = {
      gescal: visita.GESCAL,
      resultado: visita.Resultado,
      comentario: visita.Comentario || '',
      proximaVisita: visita['Próxima visita'] || '',
      fecha: visita.Fecha,
      hora: visita.Hora
    };

    // Sin 'no-cors' para poder leer la respuesta: la visita solo se da por
    // sincronizada si el Apps Script confirma que la ha guardado.
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      throw new Error('Respuesta ilegible del servidor');
    }
    if (!result || result.success !== true) {
      throw new Error((result && result.error) || 'El servidor no confirmó el guardado');
    }

    return true;
  }, [scriptUrl]);

  const syncPendingVisitas = useCallback(async () => {
    if (!navigator.onLine || !scriptUrl || isSyncingVisitasRef.current) return;
    
    isSyncingVisitasRef.current = true;
    
    try {
      const allVisitas = await db.getVisitas();
      const pending = allVisitas.filter(v => v.sincronizado === false);
      
      if (pending.length === 0) {
        isSyncingVisitasRef.current = false;
        return;
      }
      
      for (const visita of pending) {
        try {
          await sendVisitaToSheets(visita);
          
          const updatedVisita = { ...visita };
          delete updatedVisita.sincronizado;
          
          if (db.updateVisita) {
            await db.updateVisita(updatedVisita);
          } else {
            const currentList = await db.getVisitas();
            await db.saveVisitas(
              currentList.map(v => v.id === visita.id ? updatedVisita : v)
            );
          }
        } catch (err) {
          console.error(`Error al sincronizar visita ${visita.id}:`, err);
        }
      }
      
      await loadLocalData();
    } catch (e) {
      console.error('Error sincronizando visitas pendientes:', e);
    } finally {
      isSyncingVisitasRef.current = false;
    }
  }, [scriptUrl, sendVisitaToSheets, loadLocalData]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    
    const local = await loadLocalData();

    if (!scriptUrl) {
      setError('Configura la URL de Google Apps Script en los Ajustes.');
      setLoading(false);
      return;
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch(`${scriptUrl}?_t=${Date.now()}`);
      if (!response.ok) throw new Error('Error al conectar con Google Sheets');
      
      const data = await response.json();
      if (data && data.success) {
        await db.saveEdificios(data.edificios);
        // Si la hoja no devuelve visitas no se borra el historial que ya hay en el móvil
        if (Array.isArray(data.visitas) && data.visitas.length > 0) {
          await db.saveVisitas(data.visitas);
        }

        await loadLocalData();
        await syncPendingVisitas();
        setError(null);
      } else {
        throw new Error(data.error || 'La hoja de cálculo devolvió un error');
      }
    } catch (e) {
      console.warn('Sincronización con aviso temporal:', e);
      if (local && local.edificios && local.edificios.length > 0) {
        setError('Error de sincronización de red. Usando datos locales.');
        setTimeout(() => setError(null), 4000);
      } else {
        setError(`Error de sincronización (${e.message || e}). Revisa tu conexión.`);
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [scriptUrl, loadLocalData, syncPendingVisitas]);

  // REGISTRO DE VISITA CON HISTORIAL ACUMULATIVO DE COMENTARIOS
  const registrarVisita = async (gescal, resultado, comentario, proximaVisita) => {
    const now = new Date();
    
    const dayStr = String(now.getDate()).padStart(2, '0');
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const yearStr = String(now.getFullYear());
    const fecha = `${dayStr}/${monthStr}/${yearStr}`;
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    const comentarioLimpio = String(comentario || '').trim();

    // El historial de la finca se construye con las visitas (hoja VISITAS);
    // COMENTARIO del edificio guarda solo el último comentario, igual que hace el Apps Script.
    const nuevaVisita = {
      Fecha: fecha,
      Hora: hora,
      GESCAL: gescal,
      Resultado: resultado,
      Comentario: comentarioLimpio || resultado,
      'Próxima visita': proximaVisita || '',
      sincronizado: false
    };
    
    try {
      registrarVisitaEnMemoriaDiaria(gescal);

      // Guardar visita en IndexedDB y actualizar el edificio con el último comentario
      const savedVisitaObj = await db.addVisita(nuevaVisita);
      await db.updateEdificioEstado(gescal, resultado, fecha, proximaVisita || '', nuevaVisita.Comentario);
      await loadLocalData();
      
      // Enviar a Google Sheets
      if (navigator.onLine && scriptUrl) {
        try {
          await sendVisitaToSheets(savedVisitaObj);
          
          const syncedVisitaObj = { ...savedVisitaObj };
          delete syncedVisitaObj.sincronizado;
          
          if (db.updateVisita) {
            await db.updateVisita(syncedVisitaObj);
          } else {
            const currentVisitas = await db.getVisitas();
            await db.saveVisitas(
              currentVisitas.map(v => v.id === savedVisitaObj.id ? syncedVisitaObj : v)
            );
          }
          
          await loadLocalData();
        } catch (e) {
          console.warn('Sincronización inmediata fallida, se enviará online:', e);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Error registrando visita:', e);
      throw e;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingVisitas();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingVisitas]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    edificios,
    visitas,
    loading,
    syncing,
    error,
    isOnline,
    scriptUrl,
    saveScriptUrl,
    fetchData,
    registrarVisita,
    syncPendingVisitas
  };
}