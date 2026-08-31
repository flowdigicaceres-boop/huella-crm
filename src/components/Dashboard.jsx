// src/components/Dashboard.jsx
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Map as MapIcon, 
  List, 
  Calendar, 
  BarChart3, 
  Building,
  CheckCircle,
  Clock,
  XCircle,
  History,
  CloudOff,
  Flame,
  Target
} from 'lucide-react';
import { isVisitFromToday } from './Layout';

export default function Dashboard({ 
  edificios = [], 
  visitas = [], 
  setCurrentTab, 
  setSelectedBuildingGescal,
  setGlobalSearch 
}) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      setGlobalSearch(searchValue.trim());
      setCurrentTab('list');
    }
  };

  const handleFilterClick = (statusText) => {
    setGlobalSearch(statusText);
    setCurrentTab('list');
  };

  // CÁLCULO DIRECTO Y 100% SEGURO DE VISITAS HOY
  const visitasHoyStats = useMemo(() => {
    const mapaVisitas = {};

    (visitas || []).forEach(v => {
      const f = v.Fecha || v.fecha;
      if (isVisitFromToday(f)) {
        const g = v.GESCAL || v.gescal;
        if (g) mapaVisitas[String(g)] = v.Resultado || v.resultado || '';
      }
    });

    (edificios || []).forEach(b => {
      const ult = b['ULTIMA-VISITA'] || b['ULTIMA_VISITA'] || b.Fecha;
      if (isVisitFromToday(ult)) {
        const g = b.GESCAL26 || b.GESCAL;
        if (g && !mapaVisitas[String(g)]) {
          mapaVisitas[String(g)] = b['ESTADO IC'] || '';
        }
      }
    });

    let concedidosHoy = 0;
    let denegadosHoy = 0;
    let enGestionHoy = 0;

    Object.values(mapaVisitas).forEach((resultado) => {
      const r = String(resultado || '').toLowerCase();
      if (r.includes('concedido')) concedidosHoy++;
      else if (r.includes('denegado')) denegadosHoy++;
      else enGestionHoy++;
    });

    return {
      totalHoy: Object.keys(mapaVisitas).length,
      concedidosHoy,
      denegadosHoy,
      enGestionHoy
    };
  }, [visitas, edificios]);

  // Dynamic global statistics
  const stats = useMemo(() => {
    const total = edificios.length;
    let concedidos = 0;
    let denegados = 0;
    let enGestion = 0;

    edificios.forEach(e => {
      const st = (e['ESTADO IC'] || '').toLowerCase();
      if (st.includes('concedido')) {
        concedidos++;
      } else if (st.includes('denegado')) {
        denegados++;
      } else {
        enGestion++;
      }
    });

    return { total, concedidos, denegados, enGestion };
  }, [edificios]);

  function parseDateTime(dateStr, timeStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    
    let hours = 0, minutes = 0;
    if (timeStr) {
      const t = timeStr.split(':');
      if (t.length >= 2) {
        hours = parseInt(t[0], 10);
        minutes = parseInt(t[1], 10);
      }
    }
    
    return new Date(parts[2], parts[1] - 1, parts[0], hours, minutes).getTime();
  }

  const recentVisits = useMemo(() => {
    return [...visitas]
      .sort((a, b) => parseDateTime(b.Fecha, b.Hora) - parseDateTime(a.Fecha, a.Hora))
      .slice(0, 3);
  }, [visitas]);

  const findBuildingName = (gescal) => {
    const b = edificios.find(e => String(e.GESCAL26) === String(gescal));
    if (!b) return 'Edificio Desconocido';
    const tipo = b['TIPO-VIA'] || '';
    const nombre = b['NOMBRE-VIA'] || '';
    const num = b['NUM'] || '';
    return `${tipo} ${nombre} ${num}`.trim();
  };

  const getResultadoBadgeColor = (res) => {
    const r = (res || '').toLowerCase();
    if (r.includes('concedido')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (r.includes('denegado')) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-amber-50 text-amber-700 border-amber-100';
  };

  const objetivoPorcentaje = Math.min(100, Math.round((visitasHoyStats.totalHoy / 20) * 100));

  return (
    <div className="space-y-5 pb-8">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder="Buscar dirección, población, GESCAL..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pl-11 pr-4 py-3 rounded-2xl text-sm shadow-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
        />
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
      </form>

      {/* WIDGET DESTACADO: CONTADOR DE VISITAS DE HOY */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-4 shadow-md shadow-amber-500/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Flame size={20} className="text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100 block">Jornada de Trabajo</span>
              <h3 className="text-lg font-extrabold leading-none">
                {visitasHoyStats.totalHoy} Visitas Realizadas Hoy
              </h3>
            </div>
          </div>
          <Target size={24} className="text-white/40" />
        </div>

        {/* Desglose de Hoy */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
          <div className="bg-white/15 backdrop-blur-xs rounded-xl py-1.5 px-1">
            <span className="block font-bold text-sm">{visitasHoyStats.concedidosHoy}</span>
            <span className="text-[9px] text-amber-100 font-semibold">Concedidos</span>
          </div>
          <div className="bg-white/15 backdrop-blur-xs rounded-xl py-1.5 px-1">
            <span className="block font-bold text-sm">{visitasHoyStats.enGestionHoy}</span>
            <span className="text-[9px] text-amber-100 font-semibold">En Gestión</span>
          </div>
          <div className="bg-white/15 backdrop-blur-xs rounded-xl py-1.5 px-1">
            <span className="block font-bold text-sm">{visitasHoyStats.denegadosHoy}</span>
            <span className="text-[9px] text-amber-100 font-semibold">Denegados</span>
          </div>
        </div>

        {/* Barra de Progreso hacia Objetivo */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] font-bold text-amber-100">
            <span>Objetivo estimado (20)</span>
            <span>{objetivoPorcentaje}% completado</span>
          </div>
          <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500" 
              style={{ width: `${objetivoPorcentaje}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Global Counters Widgets (Clickable) */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => handleFilterClick('Concedido')}
          className="bg-emerald-50/60 border border-emerald-100/80 hover:bg-emerald-100/50 rounded-2xl p-3 text-center shadow-xs active:scale-95 transition cursor-pointer"
        >
          <div className="mx-auto w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
            <CheckCircle size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{stats.concedidos}</span>
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block truncate">Concedidos</span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterClick('Gestión')}
          className="bg-amber-50/60 border border-amber-100/80 hover:bg-amber-100/50 rounded-2xl p-3 text-center shadow-xs active:scale-95 transition cursor-pointer"
        >
          <div className="mx-auto w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
            <Clock size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{stats.enGestion}</span>
          <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block truncate">En Gestión</span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterClick('Denegado')}
          className="bg-rose-50/60 border border-rose-100/80 hover:bg-rose-100/50 rounded-2xl p-3 text-center shadow-xs active:scale-95 transition cursor-pointer"
        >
          <div className="mx-auto w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-1">
            <XCircle size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{stats.denegados}</span>
          <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block truncate">Denegados</span>
        </button>
      </div>

      {/* Main Grid Navigation Menu */}
      <div className="grid grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => { setGlobalSearch(''); setCurrentTab('list'); }}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-95 group"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
            <List size={22} />
          </div>
          <span className="font-bold text-slate-800 text-sm">Listado Edificios</span>
          <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">Ver todos los portales y buscar</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('map')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-95 group"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-3 group-hover:bg-indigo-600 group-hover:text-white transition">
            <MapIcon size={22} />
          </div>
          <span className="font-bold text-slate-800 text-sm">Mapa Interactivo</span>
          <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">Ubicación visual en mapa</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('jornada')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-95 group"
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl mb-3 group-hover:bg-rose-600 group-hover:text-white transition">
            <Calendar size={22} />
          </div>
          <span className="font-bold text-slate-800 text-sm">Mi Jornada</span>
          <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">Agenda de hoy y cercanos</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('stats')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-95 group"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
            <BarChart3 size={22} />
          </div>
          <span className="font-bold text-slate-800 text-sm">Estadísticas</span>
          <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">Métricas de visitas y éxito</span>
        </button>
      </div>

      {/* Database Summary Banner */}
      <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-md shadow-blue-500/10">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Base de datos</span>
          <h4 className="text-base font-bold mt-0.5">{stats.total} Edificios registrados</h4>
        </div>
        <div className="p-2.5 bg-blue-500/40 rounded-xl text-white shrink-0">
          <Building size={22} />
        </div>
      </div>

      {/* Recent Visits (Activity Feed) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center text-sm">
          <History size={16} className="mr-2 text-slate-500" />
          Actividad Reciente
        </h3>
        
        {recentVisits.length === 0 ? (
          <p className="text-slate-400 text-xs py-4 text-center">No hay visitas registradas todavía.</p>
        ) : (
          <div className="space-y-3">
            {recentVisits.map((v, i) => {
              const isPendingSync = v.sincronizado === false;
              
              return (
                <div 
                  key={v.id || i} 
                  className="flex items-start justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0 cursor-pointer active:bg-slate-50 rounded-xl p-2 transition select-none"
                  onClick={() => {
                    setSelectedBuildingGescal(v.GESCAL);
                    setCurrentTab('detail');
                  }}
                >
                  <div className="space-y-0.5 max-w-[65%] pr-2">
                    <span className="block text-xs font-bold text-slate-800 truncate">
                      {findBuildingName(v.GESCAL)}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {v.Fecha} a las {v.Hora}
                    </span>
                    {v.Comentario && (
                      <span className="block text-xs text-slate-500 truncate italic mt-0.5">
                        "{v.Comentario}"
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end space-y-1 shrink-0">
                    <div className="flex items-center space-x-1">
                      {isPendingSync && (
                        <CloudOff size={11} className="text-amber-600" title="Pendiente de sincronizar" />
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getResultadoBadgeColor(v.Resultado)}`}>
                        {v.Resultado}
                      </span>
                    </div>

                    {v['Próxima visita'] && (
                      <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                        Agenda: {v['Próxima visita']}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}