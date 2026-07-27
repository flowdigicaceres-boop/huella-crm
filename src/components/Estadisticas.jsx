// src/components/Estadisticas.jsx
import React, { useMemo } from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Layers,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';

export default function Estadisticas({ 
  edificios = [], 
  visitas = [] 
}) {

  const stats = useMemo(() => {
    const totalEdificios = edificios.length;
    const totalVisitas = visitas.length;
    
    // Status counts
    let concedidos = 0;
    let denegados = 0;
    let enGestion = 0;

    edificios.forEach(e => {
      const st = (e['ESTADO IC'] || '').toLowerCase();
      if (st.includes('concedido')) concedidos++;
      else if (st.includes('denegado')) denegados++;
      else enGestion++;
    });

    // Success Rate = Concedidos / (Concedidos + Denegados)
    const totalResueltos = concedidos + denegados;
    const tasaExito = totalResueltos > 0 ? Math.round((concedidos / totalResueltos) * 100) : 0;

    // Poblaciones stats (top 3)
    const pobs = {};
    edificios.forEach(e => {
      if (e.POBLACION) {
        const p = e.POBLACION.trim();
        pobs[p] = (pobs[p] || 0) + 1;
      }
    });

    const topPoblaciones = Object.entries(pobs)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalEdificios,
      totalVisitas,
      concedidos,
      denegados,
      enGestion,
      tasaExito,
      topPoblaciones
    };
  }, [edificios, visitas]);

  // Donut SVG parameters
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.tasaExito / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-2">
        <span className="font-bold text-slate-800 text-lg">Estadísticas de Gestión</span>
      </div>

      {/* Success Rate Widget (SVG Donut) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tasa de Éxito</span>
          <h3 className="text-2xl font-bold text-slate-800">{stats.tasaExito}%</h3>
          <p className="text-xs text-slate-500 leading-normal max-w-[180px]">
            Porcentaje de permisos concedidos sobre el total de edificios resueltos.
          </p>
        </div>

        {/* Donut Chart */}
        <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="text-slate-100"
              strokeWidth={strokeWidth}
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="text-emerald-500 transition-all duration-500"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <TrendingUp size={20} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 mt-0.5">ÉXITO</span>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Edificios</span>
            <span className="block text-lg font-bold text-slate-800">{stats.totalEdificios}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <BarChart3 size={20} />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Visitas log</span>
            <span className="block text-lg font-bold text-slate-800">{stats.totalVisitas}</span>
          </div>
        </div>
      </div>

      {/* Building Status Distribution */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Layers size={16} className="mr-2 text-slate-500" />
          Distribución de Estados
        </h3>

        <div className="space-y-3.5">
          {/* Concedidos Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-700 flex items-center">
                <CheckCircle2 size={12} className="mr-1" />
                Concedidos
              </span>
              <span className="text-slate-800">{stats.concedidos} ({stats.totalEdificios > 0 ? Math.round((stats.concedidos / stats.totalEdificios) * 100) : 0}%)</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.totalEdificios > 0 ? (stats.concedidos / stats.totalEdificios) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* En Gestión Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-amber-700 flex items-center">
                <Clock size={12} className="mr-1" />
                En Gestión
              </span>
              <span className="text-slate-800">{stats.enGestion} ({stats.totalEdificios > 0 ? Math.round((stats.enGestion / stats.totalEdificios) * 100) : 0}%)</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.totalEdificios > 0 ? (stats.enGestion / stats.totalEdificios) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Denegados Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-rose-700 flex items-center">
                <XCircle size={12} className="mr-1" />
                Denegados
              </span>
              <span className="text-slate-800">{stats.denegados} ({stats.totalEdificios > 0 ? Math.round((stats.denegados / stats.totalEdificios) * 100) : 0}%)</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.totalEdificios > 0 ? (stats.denegados / stats.totalEdificios) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Poblaciones */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <MapPin size={16} className="mr-2 text-slate-500" />
          Poblaciones con más Edificios
        </h3>

        {stats.topPoblaciones.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-2">No hay datos de poblaciones.</p>
        ) : (
          <div className="space-y-3.5 text-xs">
            {stats.topPoblaciones.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                <span className="font-bold text-slate-700">{p.name}</span>
                <span className="font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                  {p.count} portales
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
