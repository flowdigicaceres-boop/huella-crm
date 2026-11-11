// src/components/PropuestaDia.jsx
// "Proponer día": eliges la población y la app sugiere unas 20 visitas agrupadas por PON, cercanas
// entre sí, con las horas recomendadas para cada parte. Es solo una sugerencia: no escribe nada.
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Sparkles, MapPin, Navigation, Layers, RefreshCw, KeyRound, AlertTriangle, CheckCircle,
  ChevronRight, Loader, Crosshair
} from 'lucide-react';
import { proponerDia, VISITAS_POR_DEFECTO, DIAS_SIN_REPETIR } from '../utils/propuesta';
import { formatoHoras, horasDeJornada } from '../utils/horas';
import { estaCumplida } from '../utils/pons';
import { hoyDDMMYYYY } from '../utils/fechas';
import { usePonGeocodes } from '../hooks/usePonGeocodes';
import { ChipObjetivo, MensajeSinWeb } from './ponUi';

function direccion(e) {
  const num = Number(e['NUM']) >= 99990 ? 's/n' : (e['NUM'] || '');
  return `${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${num}`.replace(/\s+/g, ' ').trim();
}

const km = (n) => `${n.toFixed(1).replace('.', ',')} km`;

export default function PropuestaDia({ pons, webError, estado, setEstado, onSelectBuilding, onSelectPon, onBack }) {
  const [errorGps, setErrorGps] = useState('');

  const poblaciones = useMemo(() => {
    const cuenta = new Map();
    (pons?.pons || []).forEach((p) => {
      if (p.poblacion && p.gestionablesN > 0) cuenta.set(p.poblacion, (cuenta.get(p.poblacion) || 0) + p.gestionablesN);
    });
    return Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1]).map(([nombre]) => nombre);
  }, [pons]);

  const poblacion = estado.poblacion && poblaciones.includes(estado.poblacion) ? estado.poblacion : (poblaciones[0] || '');

  const ponsDePoblacion = useMemo(
    () => (pons ? pons.pons.filter((p) => p.poblacion === poblacion && p.gestionablesN > 0) : []),
    [pons, poblacion]
  );

  // Se localizan los PON de la población en segundo plano para poder agruparlos por cercanía
  const { geocodes, pendientes } = usePonGeocodes(ponsDePoblacion, Boolean(poblacion));

  // Estado actual de cada edificio (para marcar los que ya has visitado hoy)
  const actuales = useMemo(() => {
    const m = new Map();
    (pons?.pons || []).forEach((p) => [...p.gestionables, ...p.pendientesSubir].forEach((e) => m.set(String(e.GESCAL26), e)));
    return m;
  }, [pons]);

  const hoy = hoyDDMMYYYY();
  const resultado = estado.resultado;

  const calcular = (cambios) => {
    const siguiente = { ...estado, poblacion, ...cambios };
    const r = proponerDia({
      pons, poblacion: siguiente.poblacion, n: siguiente.n, geocodes, hoy: new Date(),
      posicion: siguiente.posicion || null, semilla: siguiente.semilla, excluir: siguiente.excluidos,
      jornada: siguiente.jornada
    });
    setEstado({ ...siguiente, resultado: r });
  };

  const proponer = () => calcular({ semilla: 0, excluidos: [] });
  const otraPropuesta = () => calcular({ semilla: estado.semilla + 1, excluidos: [] });
  const cambiarEdificio = (gescal) => calcular({ excluidos: [...estado.excluidos, String(gescal)] });

  const usarPosicion = () => {
    setErrorGps('');
    if (estado.posicion) { setEstado({ ...estado, posicion: null }); return; }
    if (!navigator.geolocation) { setErrorGps('Este móvil no permite usar el GPS.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setEstado({ ...estado, posicion: { lat: pos.coords.latitude, lon: pos.coords.longitude } }),
      () => setErrorGps('No se pudo obtener tu posición. Revisa el permiso de ubicación.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (!pons) {
    return (
      <div className="space-y-4 pb-8">
        <Cabecera onBack={onBack} />
        <MensajeSinWeb webError={webError} />
      </div>
    );
  }

  const hechas = resultado && !resultado.vacio
    ? resultado.grupos.flatMap((g) => g.edificios).filter((e) => (actuales.get(String(e.GESCAL26)) || e)['ULTIMA-VISITA'] === hoy).length
    : 0;

  return (
    <div className="space-y-4 pb-8">
      <Cabecera onBack={onBack} />

      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Población</span>
            <select
              value={poblacion}
              onChange={(e) => setEstado({ ...estado, poblacion: e.target.value, resultado: null, semilla: 0, excluidos: [] })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2.5 text-slate-800"
            >
              {poblaciones.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Visitas</span>
            <input
              type="number"
              min="1"
              max="60"
              value={estado.n}
              onChange={(e) => setEstado({ ...estado, n: Math.max(1, Math.min(60, Number(e.target.value) || VISITAS_POR_DEFECTO)) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2.5 text-slate-800"
            />
          </label>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>Jornada: <strong className="text-slate-700">{estado.jornada} h</strong> {estado.jornada === 7 ? '(viernes)' : ''}</span>
          <button
            type="button"
            onClick={usarPosicion}
            className={`flex items-center space-x-1 font-bold px-2.5 py-1 rounded-lg active:scale-95 transition ${
              estado.posicion ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <Crosshair size={12} />
            <span>{estado.posicion ? 'Saliendo de mi posición' : 'Salir desde mi posición'}</span>
          </button>
        </div>
        {errorGps && <p className="text-[11px] font-semibold text-rose-600">{errorGps}</p>}

        {pendientes > 0 && (
          <p className="text-[11px] text-slate-500 flex items-center">
            <Loader size={11} className="animate-spin mr-1.5 text-blue-500" />
            Localizando los PON en el mapa ({pendientes} pendientes). Mejor espera a que termine para que agrupe bien por cercanía.
          </p>
        )}

        <button
          type="button"
          onClick={proponer}
          disabled={!poblacion}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition disabled:opacity-50"
        >
          <Sparkles size={16} />
          <span>{resultado ? 'Volver a proponer' : 'Proponer día'}</span>
        </button>
      </div>

      {resultado && resultado.vacio && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-xs text-slate-500 shadow-xs">
          No hay edificios disponibles en {poblacion} (descontando los visitados en los últimos {DIAS_SIN_REPETIR} días).
        </div>
      )}

      {resultado && !resultado.vacio && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Propuesta para {poblacion}</span>
              <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">{hechas}/{resultado.nVisitas} hechas hoy</span>
            </div>
            <p className="text-lg font-extrabold leading-tight">
              {resultado.nVisitas} visitas · {resultado.grupos.length} PON
            </p>
            <p className="text-xs text-blue-100">
              Zona de {km(resultado.dispersionKm)} · recorrido aprox. {km(resultado.kmRecorrido)} · jornada de {resultado.jornada} h
            </p>
            <p className="text-[11px] text-blue-100">
              Objetivo equivalente de las horas recomendadas: <strong>{resultado.coste.toFixed(1).replace('.', ',')}</strong> UUIs
              (con las mismas horas en todos los PON serían {resultado.costeBase.toFixed(1).replace('.', ',')}).
            </p>
          </div>

          {resultado.avisos.map((a) => (
            <div key={a} className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start">
              <AlertTriangle size={13} className="mr-2 mt-0.5 shrink-0" />
              <span>{a}</span>
            </div>
          ))}

          <div className="space-y-3">
            {resultado.grupos.map((g, i) => (
              <div key={g.pon.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0 pr-2">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">PARTE {i + 1}</span>
                      <ChipObjetivo objetivo={g.pon.objetivo} />
                      {g.tipo === 'bajo' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                          Objetivo bajo
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm break-words">{g.pon.nombre}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {g.edificios.length} edificios
                      {g.kmDesdeAnterior !== null && g.kmDesdeAnterior !== undefined ? ` · a ${km(g.kmDesdeAnterior)} del anterior` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Horas</span>
                    <span className="block text-sm font-extrabold text-blue-600">{formatoHoras(g.horas)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {g.edificios.map((e) => {
                    const actual = actuales.get(String(e.GESCAL26)) || e;
                    const visitadoHoy = actual['ULTIMA-VISITA'] === hoy;
                    return (
                      <div key={e.GESCAL26} className={`rounded-xl border p-2.5 flex items-center justify-between ${visitadoHoy ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <button type="button" onClick={() => onSelectBuilding(e.GESCAL26)} className="text-left min-w-0 pr-2 flex-1">
                          <span className="block text-xs font-bold text-slate-800 leading-snug">{direccion(e)}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 font-medium mt-0.5">
                            <span className="flex items-center"><Layers size={10} className="mr-0.5" />{e.TOTALES || 0} UUIs</span>
                            <span>{e['ESTADO WEB']}</span>
                            {e['ULTIMA-VISITA'] ? <span>visitado {e['ULTIMA-VISITA']}</span> : <span>sin visitar</span>}
                            {e.llaves && <span className="font-bold text-rose-600 flex items-center"><KeyRound size={10} className="mr-0.5" />LLAVES</span>}
                            {estaCumplida(e) && <span className="font-bold text-amber-700">CUMPLIDA</span>}
                          </span>
                        </button>
                        {visitadoHoy ? (
                          <span className="text-emerald-600 shrink-0"><CheckCircle size={18} /></span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cambiarEdificio(e.GESCAL26)}
                            className="shrink-0 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 flex items-center active:scale-95 transition"
                          >
                            <RefreshCw size={10} className="mr-1" />
                            Cambiar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPon(g.pon.id)}
                  className="w-full text-xs font-bold text-blue-600 flex items-center justify-center py-1"
                >
                  Abrir PON <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={otraPropuesta}
            className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition"
          >
            <RefreshCw size={14} />
            <span>Otra propuesta</span>
          </button>

          <p className="text-[11px] text-slate-400 leading-relaxed px-1">
            Es una sugerencia: puedes cambiar edificios, saltarte PON o improvisar. Las horas son una recomendación
            (poco tiempo donde el objetivo hora es alto y más donde es bajo); las pones tú en cada parte. No se escribe nada
            en tu hoja ni en Digi hasta que registres visitas.
          </p>
        </>
      )}
    </div>
  );
}

function Cabecera({ onBack }) {
  return (
    <div className="flex items-center space-x-2">
      <button onClick={onBack} type="button" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition">
        <ArrowLeft size={20} />
      </button>
      <span className="font-bold text-slate-800 text-lg">Proponer día</span>
    </div>
  );
}
