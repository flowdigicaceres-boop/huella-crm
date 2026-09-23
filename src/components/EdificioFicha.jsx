// src/components/EdificioFicha.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Layers, 
  Tag, 
  Users, 
  MessageSquare, 
  Navigation, 
  Plus, 
  History, 
  Info,
  Calendar,
  Clock,
  CloudOff,
  CheckCheck,
  Copy,
  Radio
} from 'lucide-react';
import { db } from '../services/db';
import { geocodeBuilding } from '../services/geocoding';

export default function EdificioFicha({ 
  gescal, 
  edificios = [], 
  visitas = [], 
  onBack, 
  onRegisterVisitClick 
}) {
  const [buildingVisits, setBuildingVisits] = useState([]);
  const [coords, setCoords] = useState(null);
  const [copied, setCopied] = useState(false);

  const building = edificios.find(e => String(e.GESCAL26 || e.GESCAL) === String(gescal));

  const getUuisValue = (b) => {
    if (!b) return '0';
    if (b['TOTALES '] !== undefined && b['TOTALES '] !== null && String(b['TOTALES ']).trim() !== '') {
      return String(b['TOTALES ']).trim();
    }
    if (b['TOTALES'] !== undefined && b['TOTALES'] !== null && String(b['TOTALES']).trim() !== '') {
      return String(b['TOTALES']).trim();
    }
    const keys = Object.keys(b);
    for (const key of keys) {
      const cleanKey = key.trim().toUpperCase();
      if (cleanKey === 'TOTALES' || cleanKey === 'TOTALES (UUIS)' || cleanKey === 'UUIS') {
        const val = String(b[key]).trim();
        if (val) return val;
      }
    }
    return '0';
  };

  useEffect(() => {
    let isMounted = true;

    if (gescal) {
      db.getVisitasPorEdificio(gescal).then((res) => {
        if (isMounted) setBuildingVisits(res || []);
      }).catch(err => {
        console.error('Error cargando visitas del edificio:', err);
      });

      if (building) {
        geocodeBuilding(building).then((res) => {
          if (isMounted && res) setCoords(res);
        }).catch(err => console.error('Error de geocodificación:', err));
      }
    }

    return () => { isMounted = false; };
  }, [gescal, visitas]);

  if (!building) {
    return (
      <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <p className="text-slate-500 font-semibold text-sm">Edificio no encontrado.</p>
        <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl">
          Volver al listado
        </button>
      </div>
    );
  }

  const tipoVia = String(building['TIPO-VIA'] || '').trim();
  const nombreVia = String(building['NOMBRE-VIA'] || '').trim();
  const num = String(building['NUM'] || '').trim();
  const fullAddress = `${tipoVia} ${nombreVia} ${num}, ${building.POBLACION || ''}`.trim();
  const uuisCount = getUuisValue(building);
  const zonaGpon = String(building['ZONA-GPON'] || '').trim();

  const handleNavigate = () => {
    let url;
    if (coords && coords.lat && coords.lon) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress + ', España')}`;
    }
    window.open(url, '_blank');
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status) => {
    const st = (status || '').toLowerCase();
    if (st.includes('concedido')) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badgeBg: 'bg-emerald-50 border-emerald-100' };
    if (st.includes('denegado')) return { bg: 'bg-rose-500', text: 'text-rose-700', badgeBg: 'bg-rose-50 border-rose-100' };
    return { bg: 'bg-amber-500', text: 'text-amber-700', badgeBg: 'bg-amber-50 border-amber-100' };
  };

  const getVisitOutcomeColor = (outcome) => {
    const r = (outcome || '').toLowerCase();
    if (r.includes('concedido')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (r.includes('denegado')) return 'bg-rose-50 text-rose-700 border-rose-100';
    if (r.includes('cerrado') || r.includes('no localizado')) return 'bg-slate-50 text-slate-600 border-slate-200';
    return 'bg-amber-50 text-amber-700 border-amber-100';
  };

  const colors = getStatusColor(building['ESTADO IC']);

  // Parser del historial de comentarios acumulados
  const comentariosHistorial = (building.COMENTARIO || '')
    .split('---')
    .map(c => c.trim())
    .filter(c => c.length > 0 && c !== 'no localizo a nadie');

  return (
    <div className="space-y-5 pb-8">
      {/* Header controls */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={onBack}
          type="button"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-slate-800 text-lg">Detalle del Edificio</span>
      </div>

      {/* Building Summary Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${colors.bg}`} />
        
        <div className="flex justify-between items-start pt-2">
          <div className="space-y-1.5 pr-2">
            <div className="flex items-center space-x-2">
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${colors.badgeBg} ${colors.text}`}>
                {building['ESTADO IC'] || 'En Gestión'}
              </span>

              <span className="inline-flex items-center text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                <Layers size={13} className="mr-1" />
                {uuisCount} UUIs
              </span>
            </div>
            
            <div className="flex items-center space-x-2 pt-1">
              <h2 className="font-bold text-slate-900 text-lg leading-tight">
                {`${tipoVia} ${nombreVia} ${num}`.trim()}
              </h2>
              <button 
                onClick={handleCopyAddress} 
                title="Copiar dirección" 
                className="text-slate-400 hover:text-slate-600 active:scale-95 transition"
              >
                <Copy size={14} />
              </button>
            </div>
            
            {copied && <span className="text-[10px] text-emerald-600 font-medium block">¡Dirección copiada!</span>}

            <span className="text-xs text-slate-400 font-mono block">
              GESCAL: {building.GESCAL26}
            </span>
          </div>
        </div>

        {/* Buttons strip */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            onClick={onRegisterVisitClick}
            className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-xl text-sm shadow-md shadow-blue-500/10 active:scale-95 transition"
          >
            <Plus size={16} />
            <span>Registrar Visita</span>
          </button>
          
          <button
            onClick={handleNavigate}
            className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold rounded-xl text-sm active:scale-95 transition"
          >
            <Navigation size={16} className="text-blue-600" />
            <span>Cómo Llegar</span>
          </button>
        </div>
      </div>

      {/* Technical Sheet Detail */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center border-b border-slate-50 pb-2">
          <Info size={16} className="mr-2 text-slate-500" />
          Ficha Técnica
        </h3>

        <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
          <div>
            <span className="block text-slate-400 font-medium">Población</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5 truncate">
              <MapPin size={12} className="mr-1 text-slate-400 shrink-0" />
              {building.POBLACION || 'No especificada'}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Número de UUIs</span>
            <span className="font-bold text-blue-600 text-sm flex items-center mt-0.5 truncate">
              <Layers size={13} className="mr-1 text-blue-500 shrink-0" />
              {uuisCount} UUIs
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Zona GPON</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5 truncate">
              <Radio size={12} className="mr-1 text-slate-400 shrink-0" />
              {zonaGpon || 'Sin zona asignada'}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Tipo de Permiso</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5 truncate">
              <Tag size={12} className="mr-1 text-slate-400 shrink-0" />
              {building['TIPO-DE-PERM'] || 'Sin asignar'}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Clientes</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5 truncate">
              <Users size={12} className="mr-1 text-slate-400 shrink-0" />
              {building.CLIENTES || 'Ninguno'}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Última Visita Realizada</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5 truncate">
              <Calendar size={12} className="mr-1 text-slate-400 shrink-0" />
              {building['ULTIMA-VISITA'] || 'Sin visitas'}
            </span>
          </div>

          <div>
            <span className="block text-slate-400 font-medium">Próxima Visita Agendada</span>
            <span className="font-bold text-amber-600 flex items-center mt-0.5 truncate">
              <Calendar size={12} className="mr-1 text-amber-500 shrink-0" />
              {building['PROXIMA-VISITA'] || 'No agendada'}
            </span>
          </div>
        </div>
      </div>

      {/* HISTORIAL COMPLETO DE OBSERVACIONES Y COMENTARIOS DE LA FINCA */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <MessageSquare size={16} className="mr-2 text-blue-600" />
          Historial de Observaciones de la Finca ({comentariosHistorial.length})
        </h3>

        {comentariosHistorial.length === 0 ? (
          <p className="text-slate-400 text-xs py-3 text-center italic bg-slate-50 rounded-xl">
            No hay notas previas registradas en este edificio.
          </p>
        ) : (
          <div className="space-y-2.5">
            {comentariosHistorial.map((coment, idx) => (
              <div 
                key={idx}
                className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed space-y-1"
              >
                <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-[10px]">
                  <Clock size={11} />
                  <span>Nota #{comentariosHistorial.length - idx}</span>
                </div>
                <p className="whitespace-pre-line font-medium text-slate-800">
                  {coment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visits Timeline */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
          <span className="flex items-center">
            <History size={16} className="mr-2 text-slate-500" />
            Línea de Tiempo de Visitas ({buildingVisits.length})
          </span>
        </h3>

        {buildingVisits.length === 0 ? (
          <p className="text-slate-400 text-xs py-3 text-center text-slate-400">
            Sin visitas cronológicas registradas.
          </p>
        ) : (
          <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
            {buildingVisits.map((v, i) => {
              const isPendingSync = v.sincronizado === false;
              
              return (
                <div key={v.id || i} className="relative">
                  <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${isPendingSync ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-xs font-semibold text-slate-700 flex items-center">
                        <Clock size={11} className="mr-1 text-slate-400" />
                        {v.Fecha} a las {v.Hora}
                      </span>

                      <div className="flex items-center space-x-1.5">
                        {isPendingSync ? (
                          <span className="flex items-center text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <CloudOff size={10} className="mr-1" />
                            Pendiente sync
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            <CheckCheck size={12} />
                          </span>
                        )}

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getVisitOutcomeColor(v.Resultado)}`}>
                          {v.Resultado}
                        </span>
                      </div>
                    </div>
                    
                    {v.Comentario && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100/60 italic">
                        "{v.Comentario}"
                      </p>
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