// src/components/Dashboard.jsx
import React, { useState } from 'react';
import { 
  Search, 
  Map, 
  List, 
  Calendar, 
  BarChart3, 
  Building,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  History
} from 'lucide-react';

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

  // Dynamic statistics
  const total = edificios.length;
  const concedidos = edificios.filter(e => {
    const st = (e['ESTADO IC'] || '').toLowerCase();
    return st.includes('concedido');
  }).length;
  const denegados = edificios.filter(e => {
    const st = (e['ESTADO IC'] || '').toLowerCase();
    return st.includes('denegado');
  }).length;
  const enGestion = edificios.filter(e => {
    const st = (e['ESTADO IC'] || '').toLowerCase();
    return st.includes('gestión') || st.includes('gestion') || st.includes('en trámite') || st.includes('tramite') || st === '';
  }).length;

  // Get last 3 visits to show recent activity
  const recentVisits = [...visitas].slice(0, 3);

  // Helper to find building from visit
  const findBuildingName = (gescal) => {
    const b = edificios.find(e => e.GESCAL26 === gescal);
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

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder="Buscar dirección, población, UUIS..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pl-11 pr-4 py-3 rounded-2xl text-sm shadow-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium"
        />
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
      </form>

      {/* Counters Widgets */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 text-center shadow-xs">
          <div className="mx-auto w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
            <CheckCircle size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{concedidos}</span>
          <span className="text-[10px] text-emerald-800 font-medium uppercase tracking-wider">Concedidos</span>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 text-center shadow-xs">
          <div className="mx-auto w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
            <Clock size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{enGestion}</span>
          <span className="text-[10px] text-amber-800 font-medium uppercase tracking-wider">En Gestión</span>
        </div>

        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3 text-center shadow-xs">
          <div className="mx-auto w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
            <XCircle size={18} />
          </div>
          <span className="block text-xl font-bold text-slate-800">{denegados}</span>
          <span className="text-[10px] text-rose-800 font-medium uppercase tracking-wider">Denegados</span>
        </div>
      </div>

      {/* Main Grid Navigation Menu */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => { setGlobalSearch(''); setCurrentTab('list'); }}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-[0.98] group"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
            <List size={22} />
          </div>
          <span className="font-bold text-slate-800">Listado Edificios</span>
          <span className="text-xs text-slate-400 mt-1">Ver todos los portales y buscar</span>
        </button>

        <button
          onClick={() => setCurrentTab('map')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-[0.98] group"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-3 group-hover:bg-indigo-600 group-hover:text-white transition">
            <Map size={22} />
          </div>
          <span className="font-bold text-slate-800">Mapa Geocodificado</span>
          <span className="text-xs text-slate-400 mt-1">Ubicación visual de edificios</span>
        </button>

        <button
          onClick={() => setCurrentTab('jornada')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-[0.98] group"
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl mb-3 group-hover:bg-rose-600 group-hover:text-white transition">
            <Calendar size={22} />
          </div>
          <span className="font-bold text-slate-800">Mi Jornada</span>
          <span className="text-xs text-slate-400 mt-1">Pendientes de hoy y cercanos</span>
        </button>

        <button
          onClick={() => setCurrentTab('stats')}
          className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-start text-left shadow-xs hover:shadow-md transition active:scale-[0.98] group"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
            <BarChart3 size={22} />
          </div>
          <span className="font-bold text-slate-800">Estadísticas</span>
          <span className="text-xs text-slate-400 mt-1">Métricas de visitas y éxito</span>
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-md shadow-blue-500/10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">Base de datos</span>
          <h4 className="text-lg font-bold mt-0.5">{total} Edificios en total</h4>
        </div>
        <div className="p-2 bg-blue-500/40 rounded-xl text-white">
          <Building size={24} />
        </div>
      </div>

      {/* Recent Visits (Activity Feed) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center text-sm">
          <History size={16} className="mr-2 text-slate-500" />
          Actividad Reciente
        </h3>
        
        {recentVisits.length === 0 ? (
          <p className="text-slate-400 text-xs py-4 text-center">No hay visitas registradas todavía.</p>
        ) : (
          <div className="space-y-3.5">
            {recentVisits.map((v, i) => (
              <div 
                key={i} 
                className="flex items-start justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0 cursor-pointer active:bg-slate-50 rounded-lg p-1.5 transition"
                onClick={() => {
                  setSelectedBuildingGescal(v.GESCAL);
                  setCurrentTab('detail');
                }}
              >
                <div className="space-y-0.5 max-w-[70%]">
                  <span className="block text-xs font-bold text-slate-800 truncate">
                    {findBuildingName(v.GESCAL)}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {v.Fecha} a las {v.Hora}
                  </span>
                  {v.Comentario && (
                    <span className="block text-xs text-slate-500 truncate italic">
                      "{v.Comentario}"
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getResultadoBadgeColor(v.Resultado)}`}>
                    {v.Resultado}
                  </span>
                  {v['Próxima visita'] && (
                    <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                      Próxima: {v['Próxima visita']}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
