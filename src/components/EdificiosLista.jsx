// src/components/EdificiosLista.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  MapPin, 
  Layers, 
  ChevronRight,
  Sparkles,
  Calendar,
  X,
  RotateCcw
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
  
  // RECUPERAR FILTROS DESDE LOCALSTORAGE PARA MEMORIA PERMANENTE
  const [selectedEstado, setSelectedEstado] = useState(() => {
    return localStorage.getItem('huella_filter_estado') || 'todos';
  });

  const [selectedPoblacion, setSelectedPoblacion] = useState(() => {
    return localStorage.getItem('huella_filter_poblacion') || 'todos';
  });

  const [selectedUuisRange, setSelectedUuisRange] = useState(() => {
    return localStorage.getItem('huella_filter_uuis') || 'todos';
  });

  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('huella_sort_by') || 'direccion';
  });

  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('huella_sort_order') || 'asc';
  });

  const [page, setPage] = useState(1);

  // Sincronizar búsqueda global si cambia desde fuera
  useEffect(() => {
    setSearchTerm(globalSearch);
  }, [globalSearch]);

  // Lista única de poblaciones
  const poblaciones = useMemo(() => {
    const pobs = new Set();
    edificios.forEach(e => {
      if (e.POBLACION) pobs.add(String(e.POBLACION).trim());
    });
    return Array.from(pobs).sort();
  }, [edificios]);

  // Manejadores con guardado automático en localStorage
  const handlePoblacionChange = (val) => {
    setSelectedPoblacion(val);
    localStorage.setItem('huella_filter_poblacion', val);
    setPage(1);
  };

  const handleEstadoChange = (val) => {
    setSelectedEstado(val);
    localStorage.setItem('huella_filter_estado', val);
    setPage(1);
  };

  const handleUuisChange = (val) => {
    setSelectedUuisRange(val);
    localStorage.setItem('huella_filter_uuis', val);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setGlobalSearch(val);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setGlobalSearch('');
    setPage(1);
  };

  // Restablecer absolutamente todos los filtros
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setGlobalSearch('');
    setSelectedEstado('todos');
    setSelectedPoblacion('todos');
    setSelectedUuisRange('todos');
    setSortBy('direccion');
    setSortOrder('asc');
    
    localStorage.removeItem('huella_filter_poblacion');
    localStorage.removeItem('huella_filter_estado');
    localStorage.removeItem('huella_filter_uuis');
    localStorage.removeItem('huella_sort_by');
    localStorage.removeItem('huella_sort_order');
    setPage(1);
  };

  const getStatusBadge = (estado) => {
    const st = (estado || '').toLowerCase();
    if (st.includes('concedido')) {
      return <span className="bg-emerald-50 text-emerald-700 border-emerald-100 border text-[10px] font-bold px-2 py-0.5 rounded-full">Concedido</span>;
    }
    if (st.includes('denegado')) {
      return <span className="bg-rose-50 text-rose-700 border-rose-100 border text-[10px] font-bold px-2 py-0.5 rounded-full">Denegado</span>;
    }
    return <span className="bg-amber-50 text-amber-700 border-amber-100 border text-[10px] font-bold px-2 py-0.5 rounded-full">En Gestión</span>;
  };

  function parseDateTimestamp(dateStr) {
    if (!dateStr) return 9999999999999;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(parts[2], parts[1] - 1, parts[0]);
      return isNaN(d.getTime()) ? 9999999999999 : d.getTime();
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 9999999999999 : d.getTime();
  }

  // Filtrado y ordenación
  const filteredEdificios = useMemo(() => {
    let result = [...edificios];

    // 1. Filtro por Búsqueda de Texto
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(e => {
        const address = `${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.toLowerCase();
        const poblacion = (e.POBLACION || '').toLowerCase();
        const uuis = String(e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || '');
        const state = (e['ESTADO IC'] || '').toLowerCase();
        const gescal = String(e.GESCAL26 || '').toLowerCase();
        
        return address.includes(q) || 
               poblacion.includes(q) || 
               uuis.includes(q) || 
               state.includes(q) || 
               gescal.includes(q);
      });
    }

    // 2. Filtro de Estado
    if (selectedEstado !== 'todos') {
      result = result.filter(e => {
        const st = (e['ESTADO IC'] || '').toLowerCase();
        if (selectedEstado === 'concedido') return st.includes('concedido');
        if (selectedEstado === 'denegado') return st.includes('denegado');
        if (selectedEstado === 'gestion') return st.includes('gestión') || st.includes('gestion') || st.includes('en trámite') || st.includes('tramite') || st === '';
        return true;
      });
    }

    // 3. Filtro de Población
    if (selectedPoblacion !== 'todos') {
      result = result.filter(e => String(e.POBLACION || '').trim() === selectedPoblacion);
    }

    // 4. Filtro de Rango de UUIs
    if (selectedUuisRange !== 'todos') {
      result = result.filter(e => {
        const rawUuis = e['TOTALES '] ?? e['TOTALES'] ?? e['TOTALES (UUIs)'] ?? 0;
        const uuis = parseInt(rawUuis, 10) || 0;
        if (selectedUuisRange === 'alto') return uuis >= 40;
        if (selectedUuisRange === 'medio') return uuis >= 15 && uuis < 40;
        if (selectedUuisRange === 'bajo') return uuis < 15;
        return true;
      });
    }

    // 5. Ordenación
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'direccion') {
        const addrA = `${a['NOMBRE-VIA'] || ''} ${a['NUM'] || ''}`.toLowerCase();
        const addrB = `${b['NOMBRE-VIA'] || ''} ${b['NUM'] || ''}`.toLowerCase();
        comparison = addrA.localeCompare(addrB);
      } else if (sortBy === 'uuis') {
        const uA = parseInt(a['TOTALES '] ?? a['TOTALES'] ?? a['TOTALES (UUIs)'] ?? 0, 10) || 0;
        const uB = parseInt(b['TOTALES '] ?? b['TOTALES'] ?? b['TOTALES (UUIs)'] ?? 0, 10) || 0;
        comparison = uA - uB;
      } else if (sortBy === 'poblacion') {
        const pA = (a.POBLACION || '').toLowerCase();
        const pB = (b.POBLACION || '').toLowerCase();
        comparison = pA.localeCompare(pB);
      } else if (sortBy === 'proxima-visita') {
        const pA = parseDateTimestamp(a['PROXIMA-VISITA']);
        const pB = parseDateTimestamp(b['PROXIMA-VISITA']);
        comparison = pA - pB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [edificios, searchTerm, selectedEstado, selectedPoblacion, selectedUuisRange, sortBy, sortOrder]);

  const paginatedEdificios = useMemo(() => {
    return filteredEdificios.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredEdificios, page]);

  const hasMore = filteredEdificios.length > paginatedEdificios.length;

  const toggleSortOrder = (newSortBy) => {
    const newOrder = sortBy === newSortBy ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    localStorage.setItem('huella_sort_by', newSortBy);
    localStorage.setItem('huella_sort_order', newOrder);
    setPage(1);
  };

  const handleSelectBuilding = (gescal) => {
    setSelectedBuildingGescal(gescal);
    setCurrentTab('detail');
  };

  const hasActiveFilters = searchTerm || selectedEstado !== 'todos' || selectedPoblacion !== 'todos' || selectedUuisRange !== 'todos';

  return (
    <div className="space-y-4 pb-8">
      {/* Sticky Top controls */}
      <div className="bg-slate-50/95 backdrop-blur-xs space-y-3 pb-2 sticky top-[57px] z-20">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por calle, población, GESCAL..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pl-11 pr-10 py-2.5 rounded-2xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-medium shadow-xs"
          />
          <Search className="absolute left-4 top-3 text-slate-400" size={17} />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Badges Row con Persistencia */}
        <div className="flex space-x-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          {/* Población (Plasencia, etc.) */}
          <div className="relative shrink-0">
            <select
              value={selectedPoblacion}
              onChange={(e) => handlePoblacionChange(e.target.value)}
              className={`appearance-none border text-xs px-3 py-1.5 pr-7 rounded-full font-bold cursor-pointer shadow-2xs ${
                selectedPoblacion !== 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <option value="todos" className="bg-white text-slate-700">Población: Todas</option>
              {poblaciones.map((p, idx) => (
                <option key={idx} value={p} className="bg-white text-slate-700">{p}</option>
              ))}
            </select>
            <Filter size={11} className={`absolute right-2.5 top-2.5 pointer-events-none ${selectedPoblacion !== 'todos' ? 'text-white' : 'text-slate-400'}`} />
          </div>

          {/* Estado */}
          <div className="relative shrink-0">
            <select
              value={selectedEstado}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className={`appearance-none border text-xs px-3 py-1.5 pr-7 rounded-full font-bold cursor-pointer shadow-2xs ${
                selectedEstado !== 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <option value="todos" className="bg-white text-slate-700">Estado: Todos</option>
              <option value="concedido" className="bg-white text-slate-700">Concedidos</option>
              <option value="gestion" className="bg-white text-slate-700">En Gestión</option>
              <option value="denegado" className="bg-white text-slate-700">Denegados</option>
            </select>
            <Filter size={11} className={`absolute right-2.5 top-2.5 pointer-events-none ${selectedEstado !== 'todos' ? 'text-white' : 'text-slate-400'}`} />
          </div>

          {/* UUIs */}
          <div className="relative shrink-0">
            <select
              value={selectedUuisRange}
              onChange={(e) => handleUuisChange(e.target.value)}
              className={`appearance-none border text-xs px-3 py-1.5 pr-7 rounded-full font-bold cursor-pointer shadow-2xs ${
                selectedUuisRange !== 'todos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <option value="todos" className="bg-white text-slate-700">UUIs: Todos</option>
              <option value="alto" className="bg-white text-slate-700">Alto (&gt;= 40 UUIs)</option>
              <option value="medio" className="bg-white text-slate-700">Medio (15-39 UUIs)</option>
              <option value="bajo" className="bg-white text-slate-700">Bajo (&lt; 15 UUIs)</option>
            </select>
            <Filter size={11} className={`absolute right-2.5 top-2.5 pointer-events-none ${selectedUuisRange !== 'todos' ? 'text-white' : 'text-slate-400'}`} />
          </div>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 pt-2 px-1">
          <span className="font-semibold text-slate-500">
            {filteredEdificios.length} {filteredEdificios.length === 1 ? 'edificio' : 'edificios'}
          </span>
          <div className="flex space-x-3">
            <button 
              type="button"
              onClick={() => toggleSortOrder('direccion')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'direccion' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>Dir</span>
              <ArrowUpDown size={11} />
            </button>
            <button 
              type="button"
              onClick={() => toggleSortOrder('uuis')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'uuis' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>UUIs</span>
              <ArrowUpDown size={11} />
            </button>
            <button 
              type="button"
              onClick={() => toggleSortOrder('proxima-visita')} 
              className={`flex items-center space-x-1 font-semibold transition ${sortBy === 'proxima-visita' ? 'text-blue-600' : 'hover:text-slate-600'}`}
            >
              <span>Prox. Visita</span>
              <ArrowUpDown size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* List cards */}
      {paginatedEdificios.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <Layers size={36} className="mx-auto text-slate-300" />
          <div>
            <p className="text-sm font-bold text-slate-700">No se encontraron edificios</p>
            <p className="text-xs text-slate-400 mt-1">Prueba a cambiar los términos o restablecer los filtros.</p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl hover:bg-blue-100 transition active:scale-95"
            >
              <RotateCcw size={13} />
              <span>Restablecer Filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedEdificios.map((e, idx) => {
            const rawUuis = e['TOTALES '] ?? e['TOTALES'] ?? e['TOTALES (UUIs)'] ?? 0;
            const uuisVal = parseInt(rawUuis, 10) || 0;
            const isUuiHigh = uuisVal >= 40;

            return (
              <div
                key={String(e.GESCAL26) || idx}
                onClick={() => handleSelectBuilding(e.GESCAL26)}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:shadow-sm active:scale-95 transition cursor-pointer select-none"
              >
                <div className="space-y-1.5 max-w-[80%] pr-2">
                  <div className="flex items-center space-x-1.5">
                    {getStatusBadge(e['ESTADO IC'])}
                    {isUuiHigh && (
                      <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center">
                        <Sparkles size={8} className="mr-0.5" /> High UUI
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-sm leading-snug">
                    {`${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.trim()}
                  </h4>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center shrink-0">
                      <MapPin size={12} className="mr-1 text-slate-400" />
                      {e.POBLACION}
                    </span>
                    <span className="flex items-center shrink-0">
                      <Layers size={12} className="mr-1 text-slate-400" />
                      {uuisVal} UUIs
                    </span>
                    {e['PROXIMA-VISITA'] && (
                      <span className="flex items-center shrink-0 text-amber-600 font-semibold">
                        <Calendar size={12} className="mr-1 text-amber-500" />
                        Próx: {e['PROXIMA-VISITA']}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-slate-400 shrink-0">
                  <ChevronRight size={20} />
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              className="w-full py-3 bg-white border border-slate-200 text-blue-600 hover:bg-slate-50 font-bold rounded-2xl text-sm transition active:scale-95 shadow-xs"
            >
              Ver más edificios ({filteredEdificios.length - paginatedEdificios.length} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}