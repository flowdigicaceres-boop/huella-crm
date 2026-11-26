// src/utils/horas.js
// Horas que se recomienda declarar en cada parte (uno por PON). Es el MISMO criterio que usa el bot
// (bot.py, recomendar_horas): poco tiempo donde el OBJETIVO_HORA es alto y más donde es bajo.
// Es solo una recomendación: las horas las pones tú.

export const MINUTOS_MINIMOS_POR_PON = 15;
export const PASO_HORAS = 0.25;
const SUAVIZADO_OBJETIVO = 2; // el peso de cada PON es 1 / (objetivo + 2)

// Horario de trabajo, en minutos desde las 0:00 (cada par es un tramo continuo)
export const HORARIO_SEMANA = [[9 * 60, 14 * 60], [15 * 60, 18 * 60]]; // lunes a jueves: 9-14 y 15-18
export const HORARIO_VIERNES = [[8 * 60, 15 * 60]];                    // viernes: 8-15

export function bloquesDeJornada(fecha = new Date()) {
  return fecha.getDay() === 5 ? HORARIO_VIERNES : HORARIO_SEMANA;
}

/** 8 horas de lunes a jueves y 7 los viernes. */
export function horasDeJornada(fecha = new Date()) {
  return bloquesDeJornada(fecha).reduce((a, [ini, fin]) => a + (fin - ini), 0) / 60;
}

export function formatoHoras(h) {
  const minutos = Math.round(h * 60);
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/** 540 -> "9:00" */
export function formatoHora(minutos) {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Tramos [[ini, fin], ...] -> "9:00–10:30" (o "13:15–14:00 + 15:00–15:45" si el parte salta el descanso). */
export function formatoTramos(tramos) {
  return tramos.map(([ini, fin]) => `${formatoHora(ini)}–${formatoHora(fin)}`).join(' + ');
}

/**
 * Las horas de otros trabajos se dejan libres al FINAL de la jornada.
 * Devuelve { libres, reservadas }: los tramos que quedan para los partes y los que se reservan.
 */
export function repartirOtrasHoras(bloques, otrasHoras = 0) {
  let resto = Math.max(0, Math.round(otrasHoras * 4) * 15); // minutos, en cuartos de hora
  const libres = [];
  const reservadas = [];
  for (let i = bloques.length - 1; i >= 0; i -= 1) {
    const [ini, fin] = bloques[i];
    const quita = Math.min(resto, fin - ini);
    resto -= quita;
    if (quita > 0) reservadas.unshift([fin - quita, fin]);
    if (fin - quita > ini) libres.unshift([ini, fin - quita]);
  }
  return { libres, reservadas };
}

/**
 * Coloca los partes uno detrás de otro en los tramos libres, a partir de la hora de entrada.
 * horas: horas por parte (en cuartos de hora, suman lo que hay libre). Para que ningún parte cruce el descanso
 * se ajustan las horas de los partes que lo cruzarían en cuartos de hora (el cambio mínimo posible).
 * Devuelve { horas, horarios }: horas ajustadas y, por parte, sus tramos [[ini, fin], ...] (más de uno solo si no ha sido posible evitar cruzar).
 */
export function planificarHorario(horas, libres) {
  const d = horas.map((h) => Math.max(1, Math.round(h * 4)));            // cuartos de hora
  const largos = libres.map(([ini, fin]) => (fin - ini) / 15);
  const limites = [];                                                     // posiciones (en cuartos) donde hay un descanso
  let acumulado = 0;
  largos.forEach((l, i) => { acumulado += l; if (i < largos.length - 1) limites.push(acumulado); });

  limites.forEach((P) => {
    let S = 0;
    const pref = d.map((x) => { S += x; return S; });
    if (pref.includes(P)) return;
    const j = pref.findIndex((s) => s > P);               // parte que cruza el descanso
    if (j < 0) return;
    const inicio = j > 0 ? pref[j - 1] : 0;
    const opciones = [];
    if (j + 1 < d.length) opciones.push({ cambio: pref[j] - P, aplicar: () => { d[j] -= pref[j] - P; d[j + 1] += pref[j] - P; } });  // el parte j acaba en el descanso
    if (j > 0) opciones.push({ cambio: P - inicio, aplicar: () => { d[j - 1] += P - inicio; d[j] -= P - inicio; } });               // el parte anterior se alarga hasta el descanso
    if (opciones.length === 0) return;
    opciones.sort((a, b) => a.cambio - b.cambio)[0].aplicar();
  });

  let desde = 0;
  const horarios = d.map((x) => {
    const hasta = desde + x;
    const tramos = [];
    let offset = 0;
    libres.forEach(([ini], k) => {
      const lo = Math.max(desde, offset);
      const hi = Math.min(hasta, offset + largos[k]);
      if (hi > lo) tramos.push([ini + (lo - offset) * 15, ini + (hi - offset) * 15]);
      offset += largos[k];
    });
    desde = hasta;
    return tramos;
  });
  return { horas: d.map((x) => x / 4), horarios };
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
