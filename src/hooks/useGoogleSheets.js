// src/hooks/useGoogleSheets.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/db';

export function useGoogleSheets() {
  const [edificios, setEdificios] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Ref para evitar bucles de sincronización simultáneos
  const isSyncingVisitasRef = useRef(false);

  // URL del script guardada en localStorage
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('huella_crm_script_url') || '');

  // Guardar URL de Apps Script
  const saveScriptUrl = (url) => {
    const trimmedUrl = String(url || '').trim();
    localStorage.setItem('huella_crm_script_url', trimmedUrl);
    setScriptUrl(trimmedUrl);
  };

  // Cargar datos locales desde IndexedDB
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

  // Enviar una visita individual a Google Apps Script
  const sendVisitaToSheets = useCallback(async (visita) => {
    if (!scriptUrl) throw new Error('No Apps Script URL configured');
    
    // Enviamos el comentario en todas las variantes de nombre posibles
    const payload = {
      gescal: visita.GESCAL,
      resultado: visita.Resultado,
      comentario: visita.Comentario || '',
      Comentario: visita.Comentario || '',
      COMENTARIO: visita.Comentario || '',
      comentarios: visita.Comentario || '',
      proximaVisita: visita['Próxima visita'],
      fecha: visita.Fecha,
      hora: visita.Hora
    };

    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    return true;
  }, [scriptUrl]);

  // Sincronizar todas las visitas pendientes
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
      
      console.log(`Sincronizando ${pending.length} visitas pendientes...`);
      
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

  // Obtener datos desde Google Sheets
  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    await loadLocalData();

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
        await db.saveVisitas(data.visitas);
        
        await loadLocalData();
        await syncPendingVisitas();
      } else {
        throw new Error(data.error || 'La hoja de cálculo devolvió un error');
      }
    } catch (e) {
      console.error('Sincronización fallida, usando datos offline:', e);
      setError(`Error de sincronización (${e.message || e}). Usando datos locales.`);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [scriptUrl, loadLocalData, syncPendingVisitas]);

  // Registrar una nueva visita
  const registrarVisita = async (gescal, resultado, comentario, proximaVisita) => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES'); 
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const comentarioLimpio = String(comentario || '').trim();
    
    const nuevaVisita = {
      Fecha: fecha,
      Hora: hora,
      GESCAL: gescal,
      Resultado: resultado,
      Comentario: comentarioLimpio,
      'Próxima visita': proximaVisita || '',
      sincronizado: false
    };
    
    try {
      // 1. Guardar localmente en IndexedDB
      const savedVisitaObj = await db.addVisita(nuevaVisita);
      await db.updateEdificioEstado(gescal, resultado, fecha, proximaVisita || '', comentarioLimpio);
      await loadLocalData();
      
      // 2. Intentar enviar a Google Sheets inmediatamente
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
          console.warn('Sincronización inmediata fallida, se reintentará online:', e);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Error registrando visita:', e);
      throw e;
    }
  };

  // Detectar cambios de red
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

  // Cargar al montar
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