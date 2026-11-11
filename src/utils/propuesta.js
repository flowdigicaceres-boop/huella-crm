// src/utils/propuesta.js
// Propuesta del día: dada una población, elige unas 20 visitas agrupadas en los PON necesarios,
// sin mandarte de un extremo a otro de la población, e incluye algún PON de objetivo bajo
// para poder declarar ahí horas sin cargarte objetivo. Es una SUGERENCIA: no escribe nada.
import { centroDePon, distanciaKm, SIN_PON } from './pons.js';
import { recomendarHoras, horasDeJornada } from './horas.js';

export const VISITAS_POR_DEFECTO = 20;
export const DIAS_SIN_REPETIR = 7;          // no se proponen edificios visitados en los últimos 7 días
export const OBJETIVO_BAJO = 3.75;          // "objetivo bajo": 3,75 o menos (incluye los finalizados, 0)
export const MAX_PONS_BAJOS = 3;            // como mucho 3 PON de objetivo bajo
export const FRACCION_VISITAS_BAJAS = 0.3;  // alrededor de un 30 % de las visitas van a PON de objetivo bajo
const PENALIZACION_POR_PON_KM = 0.15;       // a igual cercanía se prefieren menos PON (menos partes)
const COLCHON_CLUSTER = 1.3;                // el grupo de PON cercanos tiene margen para elegir

function aFecha(dmy) {
  const m = String(dmy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

/** Días desde la última visita; Infinity si nunca se visitó. */
export function diasDesde(dmy, hoy) {
  const f = aFecha(dmy);
  if (!f) return Infinity;
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((hoy0 - f) / 86400000);
}

function prioridadEstado(e) {
  const web = String(e['ESTADO WEB'] || '').toUpperCase();
  return web === 'EN GESTION' || web === 'REGESTIONAR' ? 0 : 1;
}

/** Dentro de un PON: llaves primero, luego En gestión/Regestionar, luego los visitados hace más tiempo. */
function ordenarEdificios(lista, hoy) {
  return [...lista].sort((a, b) => {
    const llaves = (b.llaves ? 1 : 0) - (a.llaves ? 1 : 0);
    if (llaves) return llaves;
    const estado = prioridadEstado(a) - prioridadEstado(b);
    if (estado) return estado;
    const da = diasDesde(a['ULTIMA-VISITA'], hoy);
    const db = diasDesde(b['ULTIMA-VISITA'], hoy);
    if (da === db) return 0;
    return db > da ? 1 : -1;
  });
}

function elegibles(pon, hoy, excluidos) {
  return pon.gestionables.filter((e) => {
    if (excluidos.has(String(e.GESCAL26))) return false;
    if (e.llaves) return true;                                   // las de llaves entran siempre
    if (pon.id === SIN_PON) return false;   // "sin PON" no es un PON real (edificios dispersos): solo si tienen llaves
    return diasDesde(e['ULTIMA-VISITA'], hoy) >= DIAS_SIN_REPETIR;
  });
}

const esBajo = (c) => c.pon.objetivo !== null && c.pon.objetivo !== undefined && c.pon.objetivo <= OBJETIVO_BAJO;
const dist = (a, b) => distanciaKm(a.lat, a.lon, b.lat, b.lon);

function clusterDesde(semilla, ubicados, meta, metaActivos) {
  const orden = [...ubicados].sort((a, b) => dist(semilla.centro, a.centro) - dist(semilla.centro, b.centro));
  const lista = [];
  let suma = 0;
  let sumaActivos = 0;
  for (const c of orden) {
    lista.push(c);
    suma += c.edificios.length;
    if (!esBajo(c)) sumaActivos += c.edificios.length;
    // el grupo debe tener visitas de sobra en total y en PON activos (la mayoría va a PON activos)
    if (suma >= meta && sumaActivos >= metaActivos) break;
  }
  const radio = lista.length > 1 ? dist(semilla.centro, lista[lista.length - 1].centro) : 0;
  return { semilla, lista, suma, radio, score: radio + PENALIZACION_POR_PON_KM * lista.length };
}

function mediaCentros(lista) {
  return {
    lat: lista.reduce((a, c) => a + c.centro.lat, 0) / lista.length,
    lon: lista.reduce((a, c) => a + c.centro.lon, 0) / lista.length
  };
}

/** Recorrido sugerido: vecino más cercano empezando por el punto de salida (si lo hay). */
function ordenarRecorrido(grupos, salida) {
  const con = grupos.filter((g) => g.centro);
  const sin = grupos.filter((g) => !g.centro);
  const ruta = [];
  let actual = salida;
  const pendientes = [...con];
  while (pendientes.length) {
    let mejor = 0;
    if (actual) {
      let dMin = Infinity;
      pendientes.forEach((g, i) => {
        const d = dist(actual, g.centro);
        if (d < dMin) { dMin = d; mejor = i; }
      });
    }
    const [g] = pendientes.splice(mejor, 1);
    ruta.push(g);
    actual = g.centro;
  }
  return [...ruta, ...sin];
}

/**
 * pons: resultado de construirPons. geocodes: { GESCAL26: {lat, lon} }.
 * semilla: 0 = mejor propuesta; 1, 2... = otras alternativas. excluir: GESCAL26 que no se quieren.
 * posicion: { lat, lon } opcional; si está, la propuesta arranca en el PON más cercano.
 */
export function proponerDia({
  pons, poblacion, n = VISITAS_POR_DEFECTO, geocodes = {}, hoy = new Date(),
  posicion = null, semilla = 0, excluir = [], jornada = horasDeJornada(hoy)
}) {
  if (!pons) return { vacio: true, motivo: 'sin-datos' };
  const excluidos = new Set(excluir.map(String));

  const candidatos = pons.pons
    .filter((p) => p.poblacion === poblacion)
    .map((pon) => ({
      pon,
      edificios: ordenarEdificios(elegibles(pon, hoy, excluidos), hoy),
      centro: centroDePon(pon, geocodes)
    }))
    .filter((c) => c.edificios.length > 0);

  const disponibles = candidatos.reduce((a, c) => a + c.edificios.length, 0);
  if (disponibles === 0) return { vacio: true, motivo: 'sin-edificios' };

  const objetivoVisitas = Math.min(n, disponibles);
  const ubicados = candidatos.filter((c) => c.centro);
  const sinUbicar = candidatos.length - ubicados.length;
  const avisos = [];

  // ---- 1. Grupo de PON cercanos entre sí ----
  let cluster = null;
  if (ubicados.length > 0) {
    const meta = Math.ceil(objetivoVisitas * COLCHON_CLUSTER);
    const cuotaBajos = Math.max(1, Math.round(FRACCION_VISITAS_BAJAS * objetivoVisitas));
    const metaActivos = Math.ceil((objetivoVisitas - cuotaBajos) * COLCHON_CLUSTER);
    let semillas;
    if (posicion) {
      semillas = [...ubicados].sort((a, b) => dist(posicion, a.centro) - dist(posicion, b.centro)).slice(0, 15);
    } else {
      semillas = [...ubicados].sort((a, b) => b.edificios.length - a.edificios.length).slice(0, 15);
    }
    const vistos = new Set();
    const ranking = [];
    semillas.forEach((s) => {
      const c = clusterDesde(s, ubicados, meta, metaActivos);
      const clave = c.lista.map((x) => x.pon.id).sort().join('|');
      if (!vistos.has(clave)) { vistos.add(clave); ranking.push(c); }
    });
    if (!posicion) ranking.sort((a, b) => a.score - b.score);
    cluster = ranking[semilla % ranking.length];
  }

  // ---- 2. Elegir las visitas ----
  const elegidos = new Map(); // id del PON -> { c, edificios: [] }
  let total = 0;
  const tomar = (c, max, filtro = () => true) => {
    let ya = elegidos.get(c.pon.id);
    if (!ya) { ya = { c, edificios: [] }; }
    const nuevos = c.edificios.filter((e) => filtro(e) && !ya.edificios.includes(e)).slice(0, Math.max(0, max));
    if (nuevos.length) {
      ya.edificios.push(...nuevos);
      elegidos.set(c.pon.id, ya);
      total += nuevos.length;
    }
    return nuevos.length;
  };

  // 2a. Edificios con fecha de llaves de la población: siempre
  candidatos.forEach((c) => {
    if (total < objetivoVisitas) tomar(c, objetivoVisitas - total, (e) => e.llaves);
  });

  // 2b. PON de objetivo bajo (o 0) cerca del grupo, para poder declarar ahí más horas
  if (cluster) {
    const centro = mediaCentros(cluster.lista);
    const maxDist = Math.max(cluster.radio * 1.5, 2);
    const bajos = ubicados
      .filter((c) => esBajo(c) && dist(centro, c.centro) <= maxDist)
      .sort((a, b) => dist(centro, a.centro) - dist(centro, b.centro))
      .slice(0, MAX_PONS_BAJOS);
    let cuota = Math.max(1, Math.round(FRACCION_VISITAS_BAJAS * objetivoVisitas));
    for (const c of bajos) {
      if (cuota <= 0 || total >= objetivoVisitas) break;
      cuota -= tomar(c, Math.min(cuota, objetivoVisitas - total));
    }
    if (bajos.length === 0) {
      avisos.push('No hay ningún PON de objetivo bajo cerca: las horas se repartirán entre PON de objetivo alto.');
    }
  }

  // 2c. El resto, en PON activos del grupo: primero los que tienen más edificios (menos partes)
  const base = cluster ? cluster.lista : [];
  const activos = base
    .filter((c) => !esBajo(c))
    .sort((a, b) => b.edificios.length - a.edificios.length || dist(cluster.semilla.centro, a.centro) - dist(cluster.semilla.centro, b.centro));
  for (const c of activos) {
    if (total >= objetivoVisitas) break;
    tomar(c, objetivoVisitas - total);
  }

  // 2d. Si aún faltan, lo más cercano que quede (primero el resto del grupo, luego el resto de la población)
  if (total < objetivoVisitas) {
    const centro = cluster ? mediaCentros(cluster.lista) : null;
    const resto = [...candidatos].sort((a, b) => {
      if (!centro || !a.centro || !b.centro) return (b.centro ? 1 : 0) - (a.centro ? 1 : 0) || b.edificios.length - a.edificios.length;
      return dist(centro, a.centro) - dist(centro, b.centro);
    });
    for (const c of resto) {
      if (total >= objetivoVisitas) break;
      tomar(c, objetivoVisitas - total);
    }
  }

  // ---- 3. Recorrido y horas ----
  const grupos = ordenarRecorrido(
    Array.from(elegidos.values()).map(({ c, edificios }) => ({
      pon: c.pon, centro: c.centro, edificios, tipo: esBajo(c) ? 'bajo' : 'activo'
    })),
    posicion || (cluster ? cluster.semilla.centro : null)
  );

  let kmRecorrido = 0;
  grupos.forEach((g, i) => {
    const previo = grupos[i - 1];
    g.kmDesdeAnterior = previo && previo.centro && g.centro ? dist(previo.centro, g.centro) : null;
    if (g.kmDesdeAnterior) kmRecorrido += g.kmDesdeAnterior;
  });

  const conCentro = grupos.filter((g) => g.centro);
  let dispersionKm = 0;
  conCentro.forEach((a) => conCentro.forEach((b) => { dispersionKm = Math.max(dispersionKm, dist(a.centro, b.centro)); }));

  const { horas, coste, costeBase } = recomendarHoras(grupos.map((g) => ({ objetivo: g.pon.objetivo })), jornada);
  grupos.forEach((g, i) => { g.horas = horas[i]; });

  if (total < n) avisos.push(`Solo hay ${total} edificios disponibles (no visitados en los últimos ${DIAS_SIN_REPETIR} días).`);
  if (sinUbicar > 0) avisos.push(`${sinUbicar} PON aún sin ubicar en el mapa: la cercanía puede no ser perfecta.`);

  return {
    vacio: false,
    grupos,
    jornada,
    nVisitas: total,
    objetivoVisitas: n,
    coste,
    costeBase,
    kmRecorrido,
    dispersionKm,
    sinUbicar,
    avisos
  };
}
