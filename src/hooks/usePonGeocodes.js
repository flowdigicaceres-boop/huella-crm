// src/hooks/usePonGeocodes.js
// Coordenadas para colocar cada PON en el mapa. Reutiliza la caché de coordenadas del móvil
// (IndexedDB, 'geocodes') y solo geocodifica los edificios que faltan, unos pocos por PON.
import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { edificiosDelPon } from '../utils/pons';
import { geocodeFastRealStreet } from '../components/MapView';

const PUNTOS_POR_PON = 3;       // con 3 edificios localizados basta para situar el PON
const PAUSA_MS = 150;
const SIMULTANEOS = 4;          // peticiones a la vez al servicio de direcciones

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const tieneCoordenadas = (c) => c && c.lat !== null && c.lat !== undefined && c.lon !== null && c.lon !== undefined;

export function usePonGeocodes(pons, activo = true) {
  const [geocodes, setGeocodes] = useState({});
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let cancelado = false;
    db.getTodosGeocodes().then((c) => { if (!cancelado) setGeocodes(c || {}); }).catch(() => {});
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!activo || !pons || pons.length === 0) return undefined;
    let cancelado = false;

    (async () => {
      const cache = (await db.getTodosGeocodes()) || {};
      if (cancelado) return;
      setGeocodes(cache);

      // Cuántos edificios hay que geocodificar como máximo (solo para el indicador de progreso)
      let totalPendiente = 0;
      const plan = pons.map((pon) => {
        const edificios = edificiosDelPon(pon);
        const conCoord = edificios.filter((e) => tieneCoordenadas(cache[String(e.GESCAL26)])).length;
        const candidatos = edificios.filter((e) => !(String(e.GESCAL26) in cache));
        totalPendiente += Math.min(candidatos.length, Math.max(0, PUNTOS_POR_PON - conCoord));
        return { edificios, conCoord, candidatos };
      });
      setPendientes(totalPendiente);

      // Varios PON a la vez, pero dentro de cada PON uno a uno (se para al tener suficientes puntos)
      const trabajar = async ({ conCoord, candidatos }) => {
        let encontrados = conCoord;
        for (const e of candidatos) {
          if (cancelado || encontrados >= PUNTOS_POR_PON) break;
          const gescal = String(e.GESCAL26);
          let coords = null;
          try {
            coords = await geocodeFastRealStreet(e);
          } catch (err) {
            coords = null;
          }
          if (cancelado) return;
          if (coords) {
            await db.saveGeocode(gescal, coords.lat, coords.lon);
            setGeocodes((prev) => ({ ...prev, [gescal]: coords }));
            encontrados += 1;
          } else {
            await db.saveGeocode(gescal, null, null); // no se vuelve a intentar en cada carga
          }
          setPendientes((n) => Math.max(0, n - 1));
          await esperar(PAUSA_MS);
        }
      };

      const cola = plan.filter((p) => p.candidatos.length > 0 && p.conCoord < PUNTOS_POR_PON);
      let siguiente = 0;
      await Promise.all(
        Array.from({ length: SIMULTANEOS }, async () => {
          while (!cancelado && siguiente < cola.length) {
            const tarea = cola[siguiente];
            siguiente += 1;
            await trabajar(tarea);
          }
        })
      );
      if (!cancelado) setPendientes(0);
    })();

    return () => { cancelado = true; };
  }, [pons, activo]);

  return { geocodes, pendientes };
}
