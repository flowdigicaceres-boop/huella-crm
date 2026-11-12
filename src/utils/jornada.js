// src/utils/jornada.js
// Visitas hechas HOY: un único cálculo para todos los contadores de la app, de forma que
// el número de arriba (la llama) y el de la propuesta del día siempre coinciden.
import { normalizarFecha, hoyDDMMYYYY } from './fechas';

/** Conjunto de GESCAL visitados hoy: los registrados en este móvil hoy + las visitas de hoy de la hoja. */
export function idsVisitadosHoy(visitas) {
  const hoyLargo = new Date().toLocaleDateString('es-ES');
  const ids = new Set();

  try {
    const fechaGuardada = localStorage.getItem('huella_daily_counter_date');
    if (fechaGuardada === hoyLargo) {
      const crudos = localStorage.getItem('huella_daily_visited_ids');
      if (crudos) JSON.parse(crudos).forEach((g) => ids.add(String(g).trim()));
    } else {
      // Ha cambiado el día: se empieza de cero
      localStorage.setItem('huella_daily_counter_date', hoyLargo);
      localStorage.setItem('huella_daily_visited_ids', JSON.stringify([]));
    }
  } catch (e) {
    /* sin almacenamiento: solo cuentan las visitas de la hoja */
  }

  const hoy = hoyDDMMYYYY();
  (visitas || []).forEach((v) => {
    const g = v.GESCAL || v.gescal;
    if (g && normalizarFecha(v.Fecha || v.fecha) === hoy) ids.add(String(g).trim());
  });
  return ids;
}
