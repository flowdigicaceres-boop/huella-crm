// src/components/ponUi.jsx
// Piezas visuales comunes de las pantallas de PON.
import React, { useState } from 'react';
import { tramoDeObjetivo } from '../utils/pons';

export function formatoObjetivo(objetivo) {
  if (objetivo === null || objetivo === undefined) return 'Sin dato';
  return String(objetivo).replace('.', ',');
}

export function formatoAvance(avance) {
  if (avance === null || avance === undefined) return '';
  return `${Math.round(avance * 100)} %`;
}

export function ChipObjetivo({ objetivo, grande = false }) {
  const tramo = tramoDeObjetivo(objetivo);
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold text-white shrink-0 ${grande ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'}`}
      style={{ backgroundColor: tramo.color }}
      title={`Objetivo hora: ${tramo.etiqueta}`}
    >
      {objetivo === null || objetivo === undefined ? 'Sin dato' : `${formatoObjetivo(objetivo)} /h`}
    </span>
  );
}

/** Los PON finalizados tienen OBJETIVO_HORA = 0. */
export function esFinalizado(pon) {
  return pon.objetivo === 0;
}

/**
 * Filtros compartidos por la lista y el mapa de PONs; se recuerdan en el móvil.
 * Por defecto los PON finalizados (objetivo 0) están ocultos.
 */
export function usePonFiltros() {
  const leer = (clave, defecto) => {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? defecto : v;
    } catch (e) {
      return defecto;
    }
  };
  const [poblacion, setPoblacionState] = useState(() => leer('huella_pon_poblacion', 'todos'));
  const [verFinalizados, setVerFinalizadosState] = useState(() => leer('huella_pon_finalizados', 'no') === 'si');

  const guardar = (clave, valor) => {
    try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ }
  };

  return {
    poblacion,
    verFinalizados,
    setPoblacion: (v) => { setPoblacionState(v); guardar('huella_pon_poblacion', v); },
    setVerFinalizados: (v) => { setVerFinalizadosState(v); guardar('huella_pon_finalizados', v ? 'si' : 'no'); }
  };
}

export function MensajeSinWeb({ webError }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-3 text-center">
      <p className="text-sm font-bold text-slate-800">Todavía no hay datos de la descarga web</p>
      <p className="text-xs text-slate-500 leading-relaxed">
        Pega la descarga diaria de la web en una pestaña llamada <strong>WEB</strong> de tu hoja de Google
        (con su fila de cabeceras) y pulsa sincronizar.
      </p>
      {webError && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
          {webError}
        </p>
      )}
    </div>
  );
}
