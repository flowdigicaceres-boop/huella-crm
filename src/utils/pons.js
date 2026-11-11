// src/utils/pons.js
// Cruza la descarga de la web (pestaña WEB de la hoja) con el CRM y agrupa por PON (ZONA-GPON).
//
//  - "Por gestionar": la web NO lo tiene concedido y mi CRM tampoco.
//  - "Pendiente de subir": mi CRM lo tiene CONCEDIDO pero la web todavía no.
//
// Todo se recalcula en cada carga: la web manda en PON, objetivo y datos del edificio;
// el CRM manda en estado, comentarios y visitas.

import { normalizarFecha } from './fechas.js';

export const SIN_PON = '(SIN PON ASIGNADO)';

// FECHA-ENTREGA-LLAVES es la fecha tope: la gestión debe hacerse con al menos 60 días de antelación.
export const DIAS_ANTELACION_LLAVES = 60;
// Aviso destacado cuando quedan menos de estos días para el límite de gestión
export const DIAS_AVISO_LLAVES = 30;

function aFecha(dmy) {
  const m = String(dmy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function formatoFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Datos de la fecha de entrega de llaves de un edificio, o null si no tiene. */
export function infoLlaves(fila, hoy = new Date()) {
  const fecha = normalizarFecha(fila['FECHA-ENTREGA-LLAVES']);
  const tope = aFecha(fecha);
  if (!tope) return null;
  const limite = new Date(tope);
  limite.setDate(limite.getDate() - DIAS_ANTELACION_LLAVES);
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return {
    fecha,                                   // fecha tope de entrega de llaves
    limite: formatoFecha(limite),            // último día para tenerlo gestionado
    dias: Math.round((limite - hoy0) / 86400000), // días que quedan hasta ese límite (negativo = vencido)
    estado: String(fila['ESTADO_LLAVES'] || '').trim()
  };
}

export function estaCumplida(edificio) {
  return String(edificio['ESTADO_FECHA'] || '').trim().toUpperCase() === 'CUMPLIDA';
}

// Tramos de color según OBJETIVO_HORA. Es solo una configuración: se puede cambiar aquí.
// El objetivo sale de una tabla (densidad + fase) y vale 0 cuando el PON está FINALIZADO.
export const TRAMOS = [
  { id: 'muy-alto', min: 10, color: '#4338ca', etiqueta: '10 o más' },
  { id: 'alto', min: 5, color: '#2563eb', etiqueta: '5 a 9,9' },
  { id: 'medio', min: 0.0001, color: '#0ea5e9', etiqueta: 'Menos de 5' },
  { id: 'finalizado', min: 0, color: '#9ca3af', etiqueta: '0 · Finalizado' }
];
export const TRAMO_SIN_DATO = { id: 'sin-dato', color: '#d1d5db', etiqueta: 'Sin dato' };

export function tramoDeObjetivo(objetivo) {
  if (objetivo === null || objetivo === undefined || Number.isNaN(objetivo)) return TRAMO_SIN_DATO;
  return TRAMOS.find((t) => objetivo >= t.min) || TRAMO_SIN_DATO;
}

function sinTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

export function esEstadoConcedido(estado) {
  return sinTildes(estado) === 'CONCEDIDO';
}

function aNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const CAMPOS_ESTATICOS = ['POBLACION', 'TIPO-VIA', 'NOMBRE-VIA', 'NUM', 'ZONA-GPON', 'TOTALES', 'TIPO-DE-PERMISO', 'CLIENTES'];

/** Edificio con el formato del CRM: datos fijos de la web + estado y comentarios del CRM. */
function fusionarEdificio(fila, crm) {
  const base = crm ? { ...crm } : { GESCAL26: String(fila.GESCAL26).trim(), 'ESTADO IC': '' };
  CAMPOS_ESTATICOS.forEach((campo) => {
    if (fila[campo] !== undefined && fila[campo] !== null && fila[campo] !== '') base[campo] = fila[campo];
  });
  base['ESTADO WEB'] = String(fila['ESTADO-DE-PERMISO'] || '').trim();
  base['ESTADO_FECHA'] = String(fila['ESTADO_FECHA'] || '').trim();
  base['FECHA-CONTACTADO'] = normalizarFecha(fila['FECHA-CONTACTADO']);
  base['TIPO-BLOQUEO'] = String(fila['TIPO-BLOQUEO'] || '').trim();
  base.llaves = infoLlaves(fila);
  base._soloWeb = !crm;
  return base;
}

export function construirPons(web, edificiosCRM = []) {
  if (!web || !Array.isArray(web.filas)) return null;

  const crmPorGescal = new Map();
  edificiosCRM.forEach((e) => {
    const g = String(e.GESCAL26 || e.GESCAL || '').trim();
    if (g) crmPorGescal.set(g, e);
  });

  const meta = new Map();
  (web.pons || []).forEach((p) => meta.set(p.pon || SIN_PON, p));

  const pons = new Map();
  const soloWeb = [];

  web.filas.forEach((fila) => {
    const gescal = String(fila.GESCAL26 || '').trim();
    if (!gescal) return;
    if (esEstadoConcedido(fila['ESTADO-DE-PERMISO'])) return; // por si el servidor no lo filtró

    const clave = String(fila['ZONA-GPON'] || '').trim() || SIN_PON;
    let pon = pons.get(clave);
    if (!pon) {
      const m = meta.get(clave) || {};
      const objetivo = aNumero(m.objetivo !== undefined ? m.objetivo : fila.OBJETIVO_HORA);
      pon = {
        id: clave,
        nombre: clave,
        poblacion: m.poblacion || fila.POBLACION || '',
        densidad: m.densidad || fila.DENSIDAD || '',
        fase: m.fase || fila.FASE || '',
        avance: aNumero(m.avance !== undefined ? m.avance : fila.AVANCE_FASE),
        objetivo,
        tramo: tramoDeObjetivo(objetivo),
        totalEdificios: m.total || 0,
        concedidosWeb: m.concedidos || 0,
        gestionables: [],
        pendientesSubir: [],
        uuisGestionables: 0,
        uuisPendientes: 0,
        clientes: 0
      };
      pons.set(clave, pon);
    }

    const crm = crmPorGescal.get(gescal);
    const edificio = fusionarEdificio(fila, crm);
    if (edificio._soloWeb) soloWeb.push(edificio);

    const uuis = aNumero(edificio.TOTALES) || 0;
    if (crm && esEstadoConcedido(crm['ESTADO IC'])) {
      pon.pendientesSubir.push(edificio);
      pon.uuisPendientes += uuis;
    } else {
      pon.gestionables.push(edificio);
      pon.uuisGestionables += uuis;
      pon.clientes += aNumero(edificio.CLIENTES) || 0;
    }
  });

  const lista = Array.from(pons.values());
  lista.forEach((p) => {
    p.pendientesSubirN = p.pendientesSubir.length;
    p.gestionablesN = p.gestionables.length;
    // Avisos: edificios con ESTADO_FECHA = CUMPLIDA y edificios con fecha de entrega de llaves
    p.cumplidasN = p.gestionables.filter(estaCumplida).length;
    const conLlaves = p.gestionables.filter((e) => e.llaves);
    p.llavesN = conLlaves.length;
    p.llavesDias = conLlaves.length ? Math.min(...conLlaves.map((e) => e.llaves.dias)) : null;
  });
  lista.sort(ordenarPons('objetivo'));

  return {
    pons: lista,
    edificiosSoloWeb: soloWeb,
    resumen: {
      pons: lista.length,
      porGestionar: lista.reduce((a, p) => a + p.gestionablesN, 0),
      uuisPorGestionar: lista.reduce((a, p) => a + p.uuisGestionables, 0),
      pendientesSubir: lista.reduce((a, p) => a + p.pendientesSubirN, 0),
      edificiosSoloWeb: soloWeb.length,
      cumplidas: lista.reduce((a, p) => a + p.cumplidasN, 0),
      llaves: lista.reduce((a, p) => a + p.llavesN, 0)
    }
  };
}

/** Orden por defecto: objetivo (mayor primero, sin dato al final), luego UUIs por gestionar. */
export function ordenarPons(criterio = 'objetivo') {
  const obj = (p) => (p.objetivo === null ? -1 : p.objetivo);
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);
  if (criterio === 'uuis') return (a, b) => b.uuisGestionables - a.uuisGestionables || porNombre(a, b);
  if (criterio === 'edificios') return (a, b) => b.gestionablesN - a.gestionablesN || porNombre(a, b);
  if (criterio === 'nombre') return porNombre;
  return (a, b) => obj(b) - obj(a) || b.uuisGestionables - a.uuisGestionables || porNombre(a, b);
}

// ---------------------------------------------------------------------------
// Posición de cada PON en el mapa: mediana de las coordenadas de sus edificios.
// ---------------------------------------------------------------------------
function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Edificios del PON (por gestionar y pendientes de subir) con coordenadas ya conocidas. */
export function edificiosDelPon(pon) {
  return [...pon.gestionables, ...pon.pendientesSubir];
}

/**
 * Centro del PON a partir de las coordenadas guardadas (GESCAL26 -> {lat, lon}).
 * Descarta puntos a más de 3 km de la mediana (geocodificaciones erróneas).
 * Devuelve null si ningún edificio tiene coordenadas.
 */
export function centroDePon(pon, geocodes) {
  const puntos = [];
  edificiosDelPon(pon).forEach((e) => {
    const c = geocodes[String(e.GESCAL26)];
    if (c && c.lat !== null && c.lat !== undefined && c.lon !== null && c.lon !== undefined) puntos.push(c);
  });
  if (puntos.length === 0) return null;

  const lat = mediana(puntos.map((p) => p.lat));
  const lon = mediana(puntos.map((p) => p.lon));
  const buenos = puntos.filter((p) => distanciaKm(lat, lon, p.lat, p.lon) <= 3);
  if (buenos.length === 0) return { lat, lon, puntos: puntos.length };

  return {
    lat: mediana(buenos.map((p) => p.lat)),
    lon: mediana(buenos.map((p) => p.lon)),
    puntos: buenos.length
  };
}
