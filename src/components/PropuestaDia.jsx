// src/components/PropuestaDia.jsx
// "Proponer día": eliges la población y la app sugiere unas 20 visitas agrupadas por PON, cercanas
// entre sí, con las horas recomendadas para cada parte. Es solo una sugerencia: no escribe nada.
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Sparkles, MapPin, Navigation, Layers, RefreshCw, KeyRound, AlertTriangle, CheckCircle,
  ChevronRight, Loader, Crosshair, Upload, XCircle
} from 'lucide-react';
import {
  proponerDia, visitablesDelPon, leerHistorialPropuestas, guardarPropuestaDeHoy, VISITAS_POR_DEFECTO, DIAS_SIN_REPETIR
} from '../utils/propuesta';
import { formatoHoras, horasDeJornada } from '../utils/horas';
import { estaCumplida, esEstadoDenegado } from '../utils/pons';
import { hoyDDMMYYYY } from '../utils/fechas';
import { idsVisitadosHoy } from '../utils/jornada';
import { usePonGeocodes } from '../hooks/usePonGeocodes';
import { ChipObjetivo, MensajeSinWeb, AvisoWeb } from './ponUi';

function direccion(e) {
  const num = Number(e['NUM']) >= 99990 ? 's/n' : (e['NUM'] || '');
  return `${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${num}`.replace(/\s+/g, ' ').trim();
}

const km = (n) => `${n.toFixed(1).replace('.', ',')} km`;

export default function PropuestaDia({ pons, visitas = [], webError, estado, setEstado, onSelectBuilding, onSelectPon, onBack }) {
  const [errorGps, setErrorGps] = useState('');
  // Por defecto se incluyen los denegados de tu hoja (reintento de firma); se pueden quitar con la casilla
  const incluirDenegados = estado.incluirDenegados !== false;

  const poblaciones = useMemo(() => {
    const cuenta = new Map();
    (pons?.pons || []).forEach((p) => {
      const n = visitablesDelPon(p, incluirDenegados).length;
      if (p.poblacion && n > 0) cuenta.set(p.poblacion, (cuenta.get(p.poblacion) || 0) + n);
    });
    return Array.from(cuenta.entries()).sort((a, b) => b[1] - a[1]).map(([nombre]) => nombre);
  }, [pons, incluirDenegados]);

  const poblacion = estado.poblacion && poblaciones.includes(estado.poblacion) ? estado.poblacion : (poblaciones[0] || '');

  const ponsDePoblacion = useMemo(
    () => (pons ? pons.pons.filter((p) => p.poblacion === poblacion && visitablesDelPon(p, incluirDenegados).length > 0) : []),
    [pons, poblacion, incluirDenegados]
  );

  // Avisos de la población elegida: cruce entre la web y la hoja EDIFICIOS
  const avisosPoblacion = useMemo(() => {
    const delaPoblacion = (pons?.pons || []).filter((p) => p.poblacion === poblacion);
    return {
      denegados: delaPoblacion.filter((p) => p.denegadosN > 0),
      porSubir: delaPoblacion.filter((p) => p.pendientesSubirN > 0),
      nDenegados: delaPoblacion.reduce((a, p) => a + p.denegadosN, 0),
      nPorSubir: delaPoblacion.reduce((a, p) => a + p.pendientesSubirN, 0)
    };
  }, [pons, poblacion]);

  // Se localizan los PON de la población en segundo plano para poder agruparlos por cercanía
  const { geocodes, pendientes } = usePonGeocodes(ponsDePoblacion, Boolean(poblacion));

  // Estado actual de cada edificio (para marcar los que ya has visitado hoy)
  const actuales = useMemo(() => {
    const m = new Map();
    (pons?.pons || []).forEach((p) => [...p.gestionables, ...p.pendientesSubir, ...p.denegadosCrm].forEach((e) => m.set(String(e.GESCAL26), e)));
    return m;
  }, [pons]);

  const hoy = hoyDDMMYYYY();
  const resultado = estado.resultado;

  // Visitas de hoy: TODAS (las de la propuesta y las que hagas fuera de ella). Es el mismo número del contador de arriba.
  const visitadosHoy = useMemo(() => idsVisitadosHoy(visitas), [visitas]);
  const totalHoy = visitadosHoy.size;

  const calcular = (cambios) => {
    const siguiente = { ...estado, poblacion, ...cambios };
    // Las visitas que ya llevas hoy cuentan: se propone solo lo que falta hasta el objetivo
    const faltan = Math.max(0, siguiente.n - totalHoy);
    if (faltan === 0) {
      setEstado({ ...siguiente, resultado: { vacio: true, motivo: 'objetivo-cumplido' } });
      return;
    }
    const r = proponerDia({
      pons, poblacion: siguiente.poblacion, n: faltan, geocodes, hoy: new Date(),
      posicion: siguiente.posicion || null, semilla: siguiente.semilla, excluir: siguiente.excluidos,
      jornada: siguiente.jornada, incluirDenegados: siguiente.incluirDenegados !== false,
      historial: leerHistorialPropuestas()
    });
    // Se anota lo propuesto para dar más variedad a los días siguientes (lo no hecho irá después)
    if (!r.vacio) guardarPropuestaDeHoy(r.grupos.flatMap((g) => g.edificios.map((e) => e.GESCAL26)));
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

  // De las visitas de esta propuesta, cuántas ya están hechas hoy
  const hechasPropuesta = resultado && !resultado.vacio
    ? resultado.grupos.flatMap((g) => g.edificios).filter((e) => visitadosHoy.has(String(e.GESCAL26))
        || (actuales.get(String(e.GESCAL26)) || e)['ULTIMA-VISITA'] === hoy).length
    : 0;

  return (
    <div className="space-y-4 pb-8">
      <Cabecera onBack={onBack} />
      <AvisoWeb webError={webError} ignoradas={pons.resumen.filasIgnoradas} />

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
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Objetivo de visitas hoy</span>
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

        <p className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          Hoy llevas {totalHoy} de {estado.n} visitas
          {totalHoy > 0 && totalHoy < estado.n ? ` · faltan ${estado.n - totalHoy}` : ''}
        </p>

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

        {/* Solo se proponen los edificios en gestión en la web Y en tu hoja EDIFICIOS; el resto se avisa */}
        {avisosPoblacion.nPorSubir > 0 && (
          <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start">
            <Upload size={13} className="mr-2 mt-0.5 shrink-0" />
            <span>
              {avisosPoblacion.nPorSubir} {avisosPoblacion.nPorSubir === 1 ? 'edificio está' : 'edificios están'} CONCEDIDO en tu hoja pero
              {' '}en gestión en la web (en {avisosPoblacion.porSubir.length} PON): no se proponen, falta subirlos a la web.
            </span>
          </div>
        )}
        {avisosPoblacion.nDenegados > 0 && (
          <div className="text-[11px] bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-1.5">
            <p className="font-semibold text-rose-800 flex items-start">
              <XCircle size={13} className="mr-2 mt-0.5 shrink-0" />
              <span>
                {avisosPoblacion.nDenegados} {avisosPoblacion.nDenegados === 1 ? 'edificio está' : 'edificios están'} DENEGADO en tu hoja pero
                {' '}en gestión en la web. PON con denegados:
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5 pl-5">
              {avisosPoblacion.denegados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPon(p.id)}
                  className="text-[10px] font-bold text-rose-700 bg-white border border-rose-200 rounded-full px-2 py-0.5 active:scale-95 transition"
                >
                  {p.nombre} · {p.denegadosN}
                </button>
              ))}
            </div>
            <label className="flex items-center space-x-2 pl-5 pt-0.5 font-bold text-rose-800 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirDenegados}
                onChange={(e) => setEstado({ ...estado, incluirDenegados: e.target.checked, resultado: null, semilla: 0, excluidos: [] })}
                className="accent-rose-600"
              />
              <span>Reintentar su firma: incluirlos en la propuesta</span>
            </label>
          </div>
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
          {resultado.motivo === 'objetivo-cumplido'
            ? `Ya has hecho ${totalHoy} visitas hoy: has llegado al objetivo de ${estado.n}. Si quieres seguir, sube el objetivo de visitas.`
            : `No hay edificios disponibles en ${poblacion} (descontando los visitados en los últimos ${DIAS_SIN_REPETIR} días).`}
        </div>
      )}

      {resultado && !resultado.vacio && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Propuesta para {poblacion}</span>
              <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">{totalHoy}/{estado.n} hoy</span>
            </div>
            <p className="text-lg font-extrabold leading-tight">
              {resultado.nVisitas} visitas propuestas · {resultado.grupos.length} PON
            </p>
            <p className="text-[11px] text-blue-100">
              De esta propuesta llevas {hechasPropuesta} hechas
              {totalHoy > hechasPropuesta ? ` · otras ${totalHoy - hechasPropuesta} visitas de hoy fuera de ella` : ''}.
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
                    {(g.pon.denegadosN > 0 || g.pon.pendientesSubirN > 0) && (
                      <p className="flex flex-wrap gap-1.5 pt-0.5">
                        {g.pon.denegadosN > 0 && !incluirDenegados && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                            {g.pon.denegadosN} denegado{g.pon.denegadosN === 1 ? '' : 's'} en tu hoja
                          </span>
                        )}
                        {g.pon.pendientesSubirN > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            {g.pon.pendientesSubirN} concedido{g.pon.pendientesSubirN === 1 ? '' : 's'} por subir
                          </span>
                        )}
                      </p>
                    )}
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
                            {esEstadoDenegado(e['ESTADO IC'])
                              ? <span className="font-bold text-rose-600">DENEGADO · reintento</span>
                              : <span>{e['ESTADO WEB']}</span>}
                            {e['ULTIMA-VISITA'] ? <span>visitado {e['ULTIMA-VISITA']}</span> : <span>sin visitar</span>}
                            {e.llaves && <span className="font-bold text-rose-600 flex items-center"><KeyRound size={10} className="mr-0.5" />LLAVES</span>}
                            {estaCumplida(actual) && <span className="font-bold text-amber-700">CUMPLIDA</span>}
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
