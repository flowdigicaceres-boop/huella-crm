// src/utils/horas.js
// Horas que se recomienda declarar en cada parte (uno por PON). Es el MISMO criterio que usa el bot
// (bot.py, recomendar_horas): poco tiempo donde el OBJETIVO_HORA es alto y más donde es bajo.
// Es solo una recomendación: las horas las pones tú.

export const MINUTOS_MINIMOS_POR_PON = 15;
export const PASO_HORAS = 0.25;
const SUAVIZADO_OBJETIVO = 2; // el peso de cada PON es 1 / (objetivo + 2)

/** 8 horas de lunes a jueves y 7 los viernes. */
export function horasDeJornada(fecha = new Date()) {
  return fecha.getDay() === 5 ? 7 : 8;
}

export function formatoHoras(h) {
  const minutos = Math.round(h * 60);
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/** Objetivo de cada PON; si no se conoce, se trata como el más alto de los conocidos. */
export function objetivosEfectivos(grupos) {
  const conocidos = grupos.map((g) => g.objetivo).filter((o) => o !== null && o !== undefined);
  const peor = conocidos.length ? Math.max(...conocidos) : 0;
  return grupos.map((g) => (g.objetivo !== null && g.objetivo !== undefined ? g.objetivo : peor));
}

export function costeObjetivo(horas, objetivos) {
  return horas.reduce((a, h, i) => a + h * objetivos[i], 0);
}

/**
 * grupos: [{ objetivo }] (uno por PON). Devuelve { horas, coste, costeBase }:
 * horas por grupo en cuartos de hora (suman la jornada), el "coste" de ese reparto
 * (suma de horas x objetivo) y el coste si se pusieran las mismas horas en todos los PON.
 */
export function recomendarHoras(grupos, jornada) {
  const n = grupos.length;
  if (n === 0) return { horas: [], coste: 0, costeBase: 0 };

  const obj = objetivosEfectivos(grupos);
  const pesos = obj.map((o) => 1 / (o + SUAVIZADO_OBJETIVO));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  const minimo = Math.min(MINUTOS_MINIMOS_POR_PON / 60, jornada / n);
  const libre = jornada - minimo * n;
  const horas = pesos.map((p) => minimo + (libre * p) / sumaPesos);

  // Redondeo a cuartos de hora conservando exactamente el total de la jornada
  const r = horas.map((h) =>
    jornada >= PASO_HORAS * n ? Math.max(PASO_HORAS, Math.round(h / PASO_HORAS) * PASO_HORAS) : h
  );
  const orden = obj.map((_, i) => i).sort((a, b) => obj[a] - obj[b]); // de menor a mayor objetivo
  for (let vuelta = 0; vuelta < 400; vuelta += 1) {
    const diferencia = Math.round((jornada - r.reduce((a, b) => a + b, 0)) * 1e6) / 1e6;
    if (Math.abs(diferencia) < 1e-9) break;
    if (diferencia > 0) {
      r[orden[0]] += PASO_HORAS; // faltan horas: al PON de menor objetivo
    } else {
      // sobran horas: se quitan del PON de mayor objetivo que pueda perderlas
      let candidato = -1;
      for (let k = orden.length - 1; k >= 0; k -= 1) {
        if (r[orden[k]] - PASO_HORAS >= PASO_HORAS - 1e-9) { candidato = orden[k]; break; }
      }
      if (candidato < 0) break;
      r[candidato] -= PASO_HORAS;
    }
  }

  const base = new Array(n).fill(jornada / n);
  return { horas: r, coste: costeObjetivo(r, obj), costeBase: costeObjetivo(base, obj) };
}
