// src/components/PonesLista.jsx
import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, Filter, Upload, Layers, Radio, KeyRound, AlertTriangle } from 'lucide-react';
import { ordenarPons } from '../utils/pons';
import { ChipObjetivo, MensajeSinWeb, AvisoWeb, esFinalizado, formatoAvance, usePonFiltros } from './ponUi';

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function PonesLista({ pons, webError, webGuardado, onSelectPon }) {
  const { poblacion, verFinalizados, setPoblacion, setVerFinalizados } = usePonFiltros();
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('objetivo');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [aviso, setAviso] = useState('');   // '', 'cumplidas' o 'llaves'

  const poblaciones = useMemo(() => {
    const set = new Set();
    (pons?.pons || []).forEach((p) => { if (p.poblacion) set.add(p.poblacion); });
    return Array.from(set).sort();
  }, [pons]);

  const visibles = useMemo(() => {
    if (!pons) return [];
    const q = normalizar(busqueda);
    return pons.pons
      .filter((p) => p.gestionablesN > 0 || (soloPendientes && p.pendientesSubirN > 0))
      .filter((p) => verFinalizados || !esFinalizado(p) || p.llavesN > 0)   // con llaves siempre se ve
      .filter((p) => poblacion === 'todos' || p.poblacion === poblacion)
      .filter((p) => !soloPendientes || p.pendientesSubirN > 0)
      .filter((p) => aviso !== 'cumplidas' || p.cumplidasN > 0)
      .filter((p) => aviso !== 'llaves' || p.llavesN > 0)
      .filter((p) => !q || normalizar(p.nombre).includes(q) || normalizar(p.poblacion).includes(q))
      .sort(ordenarPons(orden));
  }, [pons, busqueda, poblacion, verFinalizados, soloPendientes, orden, aviso]);

  const finalizadosOcultos = useMemo(() => {
    if (!pons || verFinalizados) return 0;
    return pons.pons.filter((p) => p.gestionablesN > 0 && esFinalizado(p) && p.llavesN === 0).length;
  }, [pons, verFinalizados]);

  if (!pons) return <MensajeSinWeb webError={webError} />;

  const totalEdificios = visibles.reduce((a, p) => a + p.gestionablesN, 0);
  const totalUuis = visibles.reduce((a, p) => a + p.uuisGestionables, 0);
  const totalSubir = visibles.reduce((a, p) => a + p.pendientesSubirN, 0);

  return (
    <div className="space-y-4 pb-8">
      <div className="bg-slate-50/95 backdrop-blur-xs space-y-3 pb-2 sticky top-[57px] z-20">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar PON o población..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pl-11 pr-4 py-2.5 rounded-2xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium shadow-xs"
          />
          <Search className="absolute left-4 top-3 text-slate-400" size={17} />
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          <div className="relative shrink-0">
            <select
              value={poblacion}
              onChange={(e) => setPoblacion(e.target.value)}
              className={`appearance-none border text-xs px-3 py-1.5 pr-7 rounded-full font-bold cursor-pointer ${
                poblacion !== 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <option value="todos" className="bg-white text-slate-700">Población: Todas</option>
              {poblaciones.map((p) => (
                <option key={p} value={p} className="bg-white text-slate-700">{p}</option>
              ))}
            </select>
            <Filter size={11} className={`absolute right-2.5 top-2.5 pointer-events-none ${poblacion !== 'todos' ? 'text-white' : 'text-slate-400'}`} />
          </div>

          <div className="relative shrink-0">
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              className="appearance-none border text-xs px-3 py-1.5 pr-7 rounded-full font-bold cursor-pointer bg-white text-slate-700 border-slate-200"
            >
              <option value="objetivo">Orden: Objetivo hora</option>
              <option value="uuis">Orden: UUIs por gestionar</option>
              <option value="edificios">Orden: Edificios por gestionar</option>
              <option value="nombre">Orden: Nombre</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSoloPendientes(!soloPendientes)}
            className={`shrink-0 border text-xs px-3 py-1.5 rounded-full font-bold transition ${
              soloPendientes ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Con pendientes de subir
          </button>
        </div>

        <AvisoWeb webError={webError} ignoradas={pons.resumen.filasIgnoradas} />
        {pons.resumen.llaves > 0 && (
          <button
            type="button"
            onClick={() => setAviso(aviso === 'llaves' ? '' : 'llaves')}
            className={`w-full text-left text-xs font-bold rounded-xl px-3 py-2 flex items-center border ${
              aviso === 'llaves' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <KeyRound size={14} className="mr-2 shrink-0" />
            {pons.resumen.llaves} {pons.resumen.llaves === 1 ? 'edificio con fecha' : 'edificios con fecha'} de entrega de llaves: visitar sí o sí
          </button>
        )}
        {pons.resumen.cumplidas > 0 && (
          <button
            type="button"
            onClick={() => setAviso(aviso === 'cumplidas' ? '' : 'cumplidas')}
            className={`w-full text-left text-xs font-bold rounded-xl px-3 py-2 flex items-center border ${
              aviso === 'cumplidas' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <AlertTriangle size={14} className="mr-2 shrink-0" />
            {pons.resumen.cumplidas} edificios con fecha CUMPLIDA (más de 100 días sin contactar)
          </button>
        )}

        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-semibold text-slate-500">
            {visibles.length} PONs · {totalEdificios} edificios · {totalUuis} UUIs
          </span>
          {totalSubir > 0 && (
            <span className="font-bold text-amber-600 flex items-center">
              <Upload size={11} className="mr-1" />
              {totalSubir} por subir
            </span>
          )}
        </div>

        {finalizadosOcultos > 0 && (
          <button
            type="button"
            onClick={() => setVerFinalizados(true)}
            className="w-full text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl py-1.5"
          >
            {finalizadosOcultos} PONs finalizados (objetivo 0) ocultos · Mostrar
          </button>
        )}
        {verFinalizados && (
          <button
            type="button"
            onClick={() => setVerFinalizados(false)}
            className="w-full text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl py-1.5"
          >
            Ocultar PONs finalizados (objetivo 0)
          </button>
        )}
        {webGuardado && (
          <p className="text-[10px] text-slate-400 px-1">
            Datos de la web descargados al sincronizar el {new Date(webGuardado).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-2 shadow-xs">
          <Layers size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No hay PONs con esos filtros</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectPon(p.id)}
              className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:shadow-sm active:scale-95 transition cursor-pointer select-none"
            >
              <div className="space-y-1.5 min-w-0 pr-2">
                <div className="flex items-center space-x-1.5">
                  <ChipObjetivo objetivo={p.objetivo} />
                  {p.densidad && p.densidad !== 'FINALIZADO' && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.densidad} · {p.fase}
                    </span>
                  )}
                  {p.pendientesSubirN > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center">
                      <Upload size={9} className="mr-0.5" />
                      {p.pendientesSubirN}
                    </span>
                  )}
                  {p.llavesN > 0 && (
                    <span className="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded flex items-center">
                      <KeyRound size={9} className="mr-0.5" />
                      Llaves
                    </span>
                  )}
                  {p.cumplidasN > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                      {p.cumplidasN} cumpl.
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-800 text-sm leading-snug break-words flex items-center">
                  <Radio size={13} className="mr-1.5 text-slate-400 shrink-0" />
                  {p.nombre}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                  <span>{p.poblacion}</span>
                  <span className="font-bold text-slate-700">{p.gestionablesN} edificios</span>
                  <span>{p.uuisGestionables} UUIs</span>
                  {p.avance !== null && p.objetivo !== 0 && <span>Avance {formatoAvance(p.avance)}</span>}
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
