// src/components/MiJornada.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  MapPin, 
  Layers, 
  Compass, 
  Clock, 
  ChevronRight, 
  Sparkles,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { db } from '../services/db';

export default function MiJornada({ 
  edificios = [], 
  setSelectedBuildingGescal, 
  setCurrentTab 
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [geocodes, setGeocodes] = useState({});
  const [loadingGPS, setLoadingGPS] = useState(false);

  // Load all cached geocodes and geolocate user on mount
  useEffect(() => {
    db.getTodosGeocodes().then((res) => {
      setGeocodes(res || {});
    }).catch(err => console.error('Error loading geocodes:', err));

    // Request GPS
    setLoadingGPS(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          });
          setLoadingGPS(false);
        },
        (err) => {
          console.warn('GPS location error:', err);
          setLoadingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setLoadingGPS(false);
    }
  }, []);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('es-ES');
  }, []);

  // Helper date parsing (returns Date object or null)
  function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
  }

  // Split buildings into categories:
  // 1. Pending (PROXIMA-VISITA is today or in the past, and ESTADO is not Concedido/Denegado)
  // 2. Future (PROXIMA-VISITA is in the future, and ESTADO is not Concedido/Denegado)
  const lists = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = [];
    const future = [];

    edificios.forEach(e => {
      const estado = (e['ESTADO IC'] || '').toLowerCase();
      // Skip completed tasks (concedidos / denegados)
      if (estado.includes('concedido') || estado.includes('denegado')) return;

      const proxDate = parseDate(e['PROXIMA-VISITA']);
      if (proxDate) {
        proxDate.setHours(0, 0, 0, 0);
        if (proxDate <= today) {
          pending.push(e);
        } else {
          future.push(e);
        }
      }
    });

    // Sort pending by date ascending (oldest first)
    pending.sort((a, b) => parseDate(a['PROXIMA-VISITA']) - parseDate(b['PROXIMA-VISITA']));
    
    // Sort future by date ascending (closest future date first)
    future.sort((a, b) => parseDate(a['PROXIMA-VISITA']) - parseDate(b['PROXIMA-VISITA']));

    return { pending, future };
  }, [edificios]);

  // Calculate nearby buildings
  const nearby = useMemo(() => {
    if (!userLocation || Object.keys(geocodes).length === 0) return [];

    const result = [];
    edificios.forEach(e => {
      const estado = (e['ESTADO IC'] || '').toLowerCase();
      // Skip completed
      if (estado.includes('concedido') || estado.includes('denegado')) return;

      const coords = geocodes[e.GESCAL26];
      if (coords && coords.lat !== null && coords.lon !== null) {
        const dist = getDistance(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        // Limit to 2km radius
        if (dist <= 2.0) {
          result.push({ ...e, dist });
        }
      }
    });

    // Sort by distance (closest first) and limit to top 8
    return result.sort((a, b) => a.dist - b.dist).slice(0, 8);
  }, [edificios, geocodes, userLocation]);

  // Haversine formula
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d; // distance in km
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  return (
    <div className="space-y-6">
      {/* Date Header banner */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jornada de Trabajo</span>
          <h2 className="text-lg font-bold text-slate-800 mt-0.5">Hoy: {todayStr}</h2>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <Calendar size={22} />
        </div>
      </div>

      {/* Nearby Buildings section */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
          <span className="flex items-center">
            <Compass size={16} className="mr-2 text-slate-500" />
            Edificios Cercanos (&lt;2 km)
          </span>
          {loadingGPS && (
            <span className="text-[10px] text-blue-600 font-medium animate-pulse">Buscando GPS...</span>
          )}
        </h3>

        {!userLocation ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
            <HelpCircle size={24} className="mx-auto text-slate-300 mb-1.5" />
            <p className="text-xs text-slate-400 font-medium px-4">
              Activa la geolocalización en tu móvil para encontrar edificios pendientes a tu alrededor.
            </p>
          </div>
        ) : nearby.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">No hay edificios pendientes en un radio de 2 km.</p>
        ) : (
          <div className="space-y-3">
            {nearby.map((e, idx) => (
              <div
                key={e.GESCAL26 || idx}
                onClick={() => {
                  setSelectedBuildingGescal(e.GESCAL26);
                  setCurrentTab('detail');
                }}
                className="bg-slate-50 border border-slate-100/60 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 max-w-[80%]">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-semibold">
                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                      A {(e.dist * 1000).toFixed(0)}m
                    </span>
                    <span>{e['TOTALES (UUIs)']} UUIs</span>
                    <span>{e.POBLACION}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Tasks (Today / Past) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Clock size={16} className="mr-2 text-rose-500" />
          Pendientes Hoy o Atrasados ({lists.pending.length})
        </h3>

        {lists.pending.length === 0 ? (
          <div className="text-center py-8 border border-slate-50 rounded-xl bg-slate-50/50">
            <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2 animate-bounce" />
            <p className="text-xs text-emerald-800 font-semibold">¡Todo al día!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">No tienes visitas pendientes agendadas para hoy.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.pending.map((e, idx) => (
              <div
                key={e.GESCAL26 || idx}
                onClick={() => {
                  setSelectedBuildingGescal(e.GESCAL26);
                  setCurrentTab('detail');
                }}
                className="bg-slate-50 border border-slate-100/60 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 max-w-[80%]">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium">
                    <span className="text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded font-semibold">
                      Agendado: {e['PROXIMA-VISITA']}
                    </span>
                    <span>{e['TOTALES (UUIs)']} UUIs</span>
                    <span>{e.POBLACION}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Future Scheduled Visits */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Calendar size={16} className="mr-2 text-indigo-500" />
          Visitas Agendadas a Futuro ({lists.future.length})
        </h3>

        {lists.future.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">No tienes visitas planificadas para el futuro.</p>
        ) : (
          <div className="space-y-3">
            {lists.future.map((e, idx) => (
              <div
                key={e.GESCAL26 || idx}
                onClick={() => {
                  setSelectedBuildingGescal(e.GESCAL26);
                  setCurrentTab('detail');
                }}
                className="bg-slate-50 border border-slate-100/60 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 max-w-[80%]">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium">
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-semibold">
                      Agenda: {e['PROXIMA-VISITA']}
                    </span>
                    <span>{e['TOTALES (UUIs)']} UUIs</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
