// src/components/EdificiosLista.jsx
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  MapPin, 
  Layers, 
  ChevronRight,
  Sparkles,
  Calendar
} from 'lucide-react';

const ITEMS_PER_PAGE = 35;

export default function EdificiosLista({ 
  edificios = [], 
  setSelectedBuildingGescal, 
  setCurrentTab,
  globalSearch = '',
  setGlobalSearch
}) {
  const [searchTerm, setSearchTerm] = useState(globalSearch);
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [selectedPoblacion, setSelectedPoblacion] = useState('todos');
  const [selectedUuisRange, setSelectedUuisRange] = useState('todos');
  const [sortBy, setSortBy] = useState('direccion'); // 'direccion', 'uuis', 'poblacion', 'proxima-visita'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [page, setPage] = useState(1);

  // Sync state if global search changes (e.g. from dashboard search)
  React.useEffect(() => {
    setSearchTerm(globalSearch);
  }, [globalSearch]);

  // Extract unique populations for filter dropdown
  const poblaciones = useMemo(() => {
    const pobs = new Set();
    edificios.forEach(e => {
      if (e.POBLACION) pobs.add(String(e.POBLACION).trim());
    });
    return Array.from(pobs).sort();
  }, [edificios]);

  // Handle Search Input Change
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setGlobalSearch(val); // Sync back to App state
    setPage(1); // Reset page on search
  };

  const getStatusBadge = (estado) => {
    const st = (estado || '').toLowerCase();
    if (st.includes('concedido')) {
      return <span className="bg-emerald-50 text-emerald-700 border-emerald-100 border text-[10px] font-semibold px-2 py-0.5 rounded-full">Concedido</span>;
    }
    if (st.includes('denegado')) {
      return <span className="bg-rose-50 text-rose-700 border-rose-100 border text-[10px] font-semibold px-2 py-0.5 rounded-full">Denegado</span>;
    }
    return <span className="bg-amber-50 text-amber-700 border-amber-100 border text-[10px] font-semibold px-2 py-0.5 rounded-full">En Gestión</span>;
  };

  // Filter and Sort buildings
  const filteredEdificios = useMemo(() => {
    let result = [...edificios];

    // 1. Text Search Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(e => {
        const address = `${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.toLowerCase();
        const poblacion = (e.POBLACION || '').toLowerCase();
        const uuis = String(e['TOTALES (UUIs)'] || '');
        const state = (e['ESTADO IC'] || '').toLowerCase();
        const gescal = (e.GESCAL26 || '').toLowerCase();
        
        return address.includes(q) || 
               poblacion.includes(q) || 
               uuis.includes(q) || 
               state.includes(q) || 
               gescal.includes(q);
      });
    }

    // 2. Status Filter
    if (selectedEstado !== 'todos') {
      result = result.filter(e => {
        const st = (e['ESTADO IC'] || '').toLowerCase();
        if (selectedEstado === 'concedido') return st.includes('concedido');
        if (selectedEstado === 'denegado') return st.includes('denegado');
        if (selectedEstado === 'gestion') return st.includes('gestión') || st.includes('gestion') || st.includes('en trámite') || st.includes('tramite') || st === '';
        return true;
      });
    }

    // 3. Population Filter
    if (selectedPoblacion !== 'todos') {
      result = result.filter(e => String(e.POBLACION || '').trim() === selectedPoblacion);
    }

    // 4. UUIs (TOTALES) Filter
    if (selectedUuisRange !== 'todos') {
      result = result.filter(e => {
        const uuis = parseInt(e['TOTALES (UUIs)'] || 0, 10);
        if (selectedUuisRange === 'alto') return uuis >= 40;
        if (selectedUuisRange === 'medio') return uuis >= 15 && uuis < 40;
        if (selectedUuisRange === 'bajo') return uuis < 15;
        return true;
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'direccion') {
        const addrA = `${a['NOMBRE-VIA']} ${a['NUM']}`.toLowerCase();
        const addrB = `${b['NOMBRE-VIA']} ${b['NUM']}`.toLowerCase();
        comparison = addrA.localeCompare(addrB);
      } else if (sortBy === 'uuis') {
        const uA = parseInt(a['TOTALES (UUIs)'] || 0, 10);
        const uB = parseInt(b['TOTALES (UUIs)'] || 0, 10);
        comparison = uA - uB;
      } else if (sortBy === 'poblacion') {
        const pA = (a.POBLACION || '').toLowerCase();
        const pB = (b.POBLACION || '').toLowerCase();
        comparison = pA.localeCompare(pB);
      } else if (sortBy === 'proxima-visita') {
        const pA = parseDate(a['PROXIMA-VISITA']);
        const pB = parseDate(b['PROXIMA-VISITA']);
        comparison = pA - pB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [edificios, searchTerm, selectedEstado, selectedPoblacion, selectedUuisRange, sortBy, sortOrder]);

  // Helper date parser
  function parseDate(dateStr) {
    if (!dateStr) return new Date(9999, 11, 31); // Empty dates go to the end
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
  }

  // Paginated chunk
  const paginatedEdificios = useMemo(() => {
    return filteredEdificios.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredEdificios, page]);

  const hasMore = filteredEdificios.length > paginatedEdificios.length;

  const toggleSortOrder = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Sticky Top controls */}
      <div className="bg-slate-50 space-y-3 pb-2 sticky top-[57px] z-20">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filtrar por dirección, UUIS..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pl-11 pr-4 py-2.5 rounded-2xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium shadow-xs"
          />
          <Search className="absolute left-4 top-3 text-slate-400" size={17} />
        </div>

        {/* Filter Badges Row */}
        <div className="flex space-x-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          {/* Status filter dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedEstado}
              onChange={(e) => { setSelectedEstado(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 pr-7 rounded-full font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="todos">Estado: Todos</option>
              <option value="concedido">Concedidos</option>
              <option value="gestion">En Gestión</option>
              <option value="denegado">Denegados</option>
            </select>
            <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Population filter dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedPoblacion}
              onChange={(e) => { setSelectedPoblacion(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 pr-7 rounded-full font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="todos">Población: Todas</option>
              {poblaciones.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
            <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* UUIs filter dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedUuisRange}
              onChange={(e) => { setSelectedUuisRange(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 pr-7 rounded-full font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="todos">UUIs: Todos</option>
              <option value="alto">Alto (&gt;= 40 UUIs)</option>
              <option value="medio">Medio (15-39 UUIs)</option>
              <option value="bajo">Bajo (&lt; 15 UUIs)</option>
            </select>
            <Filter size={11} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Sort Indicators */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 pt-2 px-1">
          <span className="font-semibold text-slate-500">
            {filteredEdificios.length} {filteredEdificios.length === 1 ? 'edificio' : 'edificios'}
          </span>
          <div className="flex space-x-3">
            <button 
              onClick={() => toggleSortOrder('direccion')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'direccion' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>Dir</span>
              <ArrowUpDown size={11} />
            </button>
            <button 
              onClick={() => toggleSortOrder('uuis')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'uuis' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>UUIs</span>
              <ArrowUpDown size={11} />
            </button>
            <button 
              onClick={() => toggleSortOrder('proxima-visita')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'proxima-visita' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>Prox. Visita</span>
              <ArrowUpDown size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Buildings List cards */}
      {paginatedEdificios.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 shadow-xs">
          <Layers size={36} className="mx-auto text-slate-300 mb-2 animate-pulse" />
          <p className="text-sm font-semibold">No se encontraron edificios</p>
          <p className="text-xs text-slate-400 mt-1">Prueba a cambiar los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedEdificios.map((e, idx) => {
            const isUuiHigh = parseInt(e['TOTALES (UUIs)'] || 0, 10) >= 45;
            return (
              <div
                key={e.GESCAL26 || idx}
                onClick={() => {
                  setSelectedBuildingGescal(e.GESCAL26);
                  setCurrentTab('detail');
                }}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs active:scale-[0.99] transition cursor-pointer select-none"
              >
                <div className="space-y-1.5 max-w-[75%]">
                  <div className="flex items-center space-x-1.5">
                    {getStatusBadge(e['ESTADO IC'])}
                    {isUuiHigh && (
                      <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center">
                        <Sparkles size={8} className="mr-0.5" /> High UUI
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-sm leading-snug">
                    {`${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.trim()}
                  </h4>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center shrink-0">
                      <MapPin size={12} className="mr-1 text-slate-400" />
                      {e.POBLACION}
                    </span>
                    <span className="flex items-center shrink-0">
                      <Layers size={12} className="mr-1 text-slate-400" />
                      {e['TOTALES (UUIs)']} UUIs
                    </span>
                    {e['PROXIMA-VISITA'] && (
                      <span className="flex items-center shrink-0 text-amber-600 font-semibold">
                        <Calendar size={12} className="mr-1 text-amber-500" />
                        Próx: {e['PROXIMA-VISITA']}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-slate-400">
                  <ChevronRight size={20} />
                </div>
              </div>
            );
          })}

          {/* Load More Button */}
          {hasMore && (
            <button
              onClick={() => setPage(page + 1)}
              className="w-full py-3 bg-white border border-slate-200 text-blue-600 hover:bg-slate-50 font-bold rounded-2xl text-sm transition active:scale-[0.98] shadow-xs"
            >
              Ver más edificios ({filteredEdificios.length - paginatedEdificios.length} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
