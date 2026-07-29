// src/components/MapView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap,
  Circle
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Building, 
  Crosshair, 
  Navigation,
  AlertCircle,
  Filter,
  Loader
} from 'lucide-react';
import { db } from '../services/db';

import 'leaflet/dist/leaflet.css';

const TOWN_COORDS = {
  'plasencia': [40.029, -6.088],
  'caceres': [39.475, -6.372],
  'cáceres': [39.475, -6.372],
  'navalmoral de la mata': [39.891, -5.541],
  'navalmoral': [39.891, -5.541],
  'trujillo': [39.461, -5.881],
  'coria': [39.983, -6.536],
  'badajoz': [38.878, -6.970],
  'merida': [38.916, -6.343],
  'mérida': [38.916, -6.343],
  'miajadas': [39.152, -5.908]
};

// DETECTOR UNIVERSAL DE MUNICIPIO (POBLACION, LOCALIDAD, MUNICIPIO Y CODIGO POSTAL 10600)
export function resolvePoblacion(e) {
  if (!e) return 'Plasencia';

  // 1. Comprobar todas las columnas posibles de ubicación
  const raw = e['POBLACION'] ?? e['Población'] ?? e['Poblacion'] ?? e['MUNICIPIO'] ?? e['LOCALIDAD'] ?? e['CIUDAD'] ?? e['POBLACIÓN'] ?? '';
  const str = String(raw).trim();

  if (str) {
    if (/plasencia/i.test(str)) return 'Plasencia';
    if (/caceres|cáceres/i.test(str)) return 'Cáceres';
    if (/navalmoral/i.test(str)) return 'Navalmoral de la Mata';
    if (/trujillo/i.test(str)) return 'Trujillo';
    if (/coria/i.test(str)) return 'Coria';
    if (/badajoz/i.test(str)) return 'Badajoz';
    if (/merida|mérida/i.test(str)) return 'Mérida';
    if (/miajadas/i.test(str)) return 'Miajadas';
    return str.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
  }

  // 2. Detección por Código GESCAL / Postal (Plasencia = 10600)
  const gescal = String(e.GESCAL26 || e.GESCAL || '').replace(/\D/g, '');
  if (gescal.includes('10600') || gescal.includes('10601') || gescal.includes('10602') || gescal.startsWith('106')) {
    return 'Plasencia';
  }
  if (gescal.includes('10001') || gescal.includes('10002') || gescal.startsWith('100')) {
    return 'Cáceres';
  }
  if (gescal.includes('10500') || gescal.startsWith('105')) {
    return 'Navalmoral de la Mata';
  }

  return 'Plasencia';
}

function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ');
}

function pseudoRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

const getMarkerIcon = (status) => {
  const st = (status || '').toLowerCase();
  let color = 'bg-amber-500';
  if (st.includes('concedido')) color = 'bg-emerald-500';
  if (st.includes('denegado')) color = 'bg-rose-500';

  return L.divIcon({
    className: 'custom-div-icon bg-transparent border-none',
    html: `
      <div class="flex items-center justify-center">
        <span class="relative flex h-6 w-6">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-40"></span>
          <span class="relative inline-flex rounded-full h-6 w-6 border-2 border-white shadow-md ${color} items-center justify-center">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </span>
        </span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10]
  });
};

const userLocationIcon = L.divIcon({
  className: 'user-location-icon bg-transparent border-none',
  html: `
    <div class="relative flex h-10 w-10 items-center justify-center">
      <div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-50"></div>
      <div class="relative inline-flex rounded-full h-5 w-5 border-2 border-white shadow-lg bg-blue-600 items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    map.invalidateSize();
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 0.8 });
    }
  }, [center, zoom, map]);

  return null;
}

export default function MapView({ 
  edificios = [], 
  setSelectedBuildingGescal, 
  setCurrentTab 
}) {
  const [geocodedEdificios, setGeocodedEdificios] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.029, -6.088]);
  const [mapZoom, setMapZoom] = useState(14);
  const [loadingGeocodes, setLoadingGeocodes] = useState(true);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [gpsError, setGpsError] = useState(null);

  const [poblacionFiltro, setPoblacionFiltro] = useState(() => {
    return localStorage.getItem('huella_filter_poblacion') || 'todos';
  });

  // Lista normalizada universal de poblaciones
  const poblaciones = useMemo(() => {
    const pobsSet = new Set();
    edificios.forEach(e => {
      const pob = resolvePoblacion(e);
      if (pob) pobsSet.add(pob);
    });
    return Array.from(pobsSet).sort();
  }, [edificios]);

  // Rastreo GPS en tiempo real
  useEffect(() => {
    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.warn('GPS error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadGeocodes() {
      try {
        setLoadingGeocodes(true);
        const cached = await db.getTodosGeocodes();
        
        const mapped = [];
        const unmapped = [];

        edificios.forEach(e => {
          const coords = cached[String(e.GESCAL26)];
          if (coords && coords.lat !== null && coords.lon !== null) {
            mapped.push({ ...e, coords });
          } else {
            unmapped.push(e);
          }
        });

        if (isMounted) {
          setGeocodedEdificios(mapped);
          setUnmappedCount(unmapped.length);
          setLoadingGeocodes(false);
        }

        if (unmapped.length > 0) {
          geocodeAllUnmappedContinuously(unmapped, () => isMounted);
        }
      } catch (err) {
        console.error('Error cargando geocodes:', err);
        if (isMounted) setLoadingGeocodes(false);
      }
    }

    loadGeocodes();

    return () => { isMounted = false; };
  }, [edificios]);

  // Geocodificador continuo con resolución universal de municipio
  const geocodeAllUnmappedContinuously = async (list, checkIsMounted) => {
    for (let i = 0; i < list.length; i++) {
      if (!checkIsMounted()) break;
      const b = list[i];
      const gescalKey = String(b.GESCAL26 || i);
      const poblacion = resolvePoblacion(b);
      const pobNorm = normalizeText(poblacion);

      const tipo = String(b['TIPO-VIA'] || '').replace(/c\//i, '').replace(/cl/i, '').replace(/av/i, '').trim();
      const nombre = String(b['NOMBRE-VIA'] || '').replace(/^c\//i, '').replace(/^cl\//i, '').replace(/^av/i, '').trim();
      const num = String(b['NUM'] || '').replace(/s\/n/i, '').trim();

      let finalCoords = null;

      if (nombre) {
        try {
          const q1 = `${tipo} ${nombre} ${num}, ${poblacion}, Extremadura, España`.replace(/\s+/g, ' ');
          const res1 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q1)}&limit=1`);
          const data1 = await res1.json();
          if (data1 && data1.length > 0) {
            finalCoords = { lat: parseFloat(data1[0].lat), lon: parseFloat(data1[0].lon) };
          }
        } catch (e) {}

        if (!finalCoords) {
          try {
            const q2 = `${nombre}, ${poblacion}, Extremadura, España`.replace(/\s+/g, ' ');
            const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q2)}&limit=1`);
            const data2 = await res2.json();
            if (data2 && data2.length > 0) {
              const offsetLat = (pseudoRandom(gescalKey + 'lat') - 0.5) * 0.0015;
              const offsetLon = (pseudoRandom(gescalKey + 'lon') - 0.5) * 0.0015;
              finalCoords = { lat: parseFloat(data2[0].lat) + offsetLat, lon: parseFloat(data2[0].lon) + offsetLon };
            }
          } catch (e) {}
        }
      }

      if (!finalCoords) {
        let baseCenter = TOWN_COORDS[pobNorm];
        if (!baseCenter) {
          try {
            const res3 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(poblacion + ', Extremadura, España')}&limit=1`);
            const data3 = await res3.json();
            if (data3 && data3.length > 0) {
              baseCenter = [parseFloat(data3[0].lat), parseFloat(data3[0].lon)];
            }
          } catch (e) {}
        }

        if (!baseCenter) baseCenter = [40.029, -6.088]; // Plasencia por defecto

        const jitterLat = (pseudoRandom(gescalKey + 'jlat') - 0.5) * 0.008;
        const jitterLon = (pseudoRandom(gescalKey + 'jlon') - 0.5) * 0.008;
        finalCoords = { lat: baseCenter[0] + jitterLat, lon: baseCenter[1] + jitterLon };
      }

      if (finalCoords && checkIsMounted()) {
        await db.saveGeocode(gescalKey, finalCoords.lat, finalCoords.lon);
        setGeocodedEdificios(prev => [...prev, { ...b, coords: finalCoords }]);
        setUnmappedCount(c => Math.max(0, c - 1));
      }

      await new Promise(r => setTimeout(r, 400));
    }
  };

  // FILTRADO CON DETECTOR UNIVERSAL
  const edificiosVisibles = useMemo(() => {
    if (poblacionFiltro === 'todos') return geocodedEdificios;
    const targetNorm = normalizeText(poblacionFiltro);
    
    return geocodedEdificios.filter(e => {
      const pobNorm = normalizeText(resolvePoblacion(e));
      return pobNorm.includes(targetNorm) || targetNorm.includes(pobNorm);
    });
  }, [geocodedEdificios, poblacionFiltro]);

  // Centrado dinámico
  useEffect(() => {
    if (edificiosVisibles.length > 0) {
      let sumLat = 0;
      let sumLon = 0;
      let validCount = 0;

      edificiosVisibles.forEach(b => {
        if (b.coords && b.coords.lat && b.coords.lon) {
          sumLat += parseFloat(b.coords.lat);
          sumLon += parseFloat(b.coords.lon);
          validCount++;
        }
      });

      if (validCount > 0) {
        setMapCenter([sumLat / validCount, sumLon / validCount]);
        setMapZoom(14);
      }
    }
  }, [edificiosVisibles.length, poblacionFiltro]);

  const handleCenterUserGPS = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(17);
    } else {
      setGpsError('Obteniendo posición GPS...');
      setTimeout(() => setGpsError(null), 3000);
    }
  };

  const handlePoblacionChange = (val) => {
    setPoblacionFiltro(val);
    localStorage.setItem('huella_filter_poblacion', val);
  };

  const getMapsUrl = (e) => {
    const tipo = String(e['TIPO-VIA'] || '').trim();
    const nombre = String(e['NOMBRE-VIA'] || '').trim();
    const num = String(e['NUM'] || '').trim();
    const pob = resolvePoblacion(e);
    const address = `${tipo} ${nombre} ${num}, ${pob}, España`;
    
    if (e.coords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${e.coords.lat},${e.coords.lon}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-3 relative">
      {/* Top Banner Map Stats & Population Filter */}
      <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm gap-2">
        <div className="flex items-center space-x-1 font-semibold text-slate-700 shrink-0">
          <Building size={14} className="text-blue-500 shrink-0" />
          <span>{edificiosVisibles.length} en mapa</span>
          {unmappedCount > 0 && (
            <Loader size={10} className="animate-spin text-blue-500 ml-1" title={`Mapeando ${unmappedCount} restantes...`} />
          )}
        </div>

        <div className="relative flex-1 max-w-[170px]">
          <select
            value={poblacionFiltro}
            onChange={(e) => handlePoblacionChange(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-[11px] px-2 py-1 pr-6 rounded-xl font-bold focus:border-blue-500 cursor-pointer truncate"
          >
            <option value="todos">Todas las poblaciones</option>
            {poblaciones.map((p, idx) => (
              <option key={idx} value={p}>{p}</option>
            ))}
          </select>
          <Filter size={10} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <button 
          onClick={handleCenterUserGPS}
          type="button"
          className="flex items-center space-x-1 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg active:scale-95 transition shrink-0"
        >
          <Crosshair size={12} />
          <span>Mi GPS</span>
        </button>
      </div>

      {gpsError && (
        <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
          <AlertCircle size={14} className="shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs relative">
        {loadingGeocodes && geocodedEdificios.length === 0 && (
          <div className="absolute inset-0 z-50 bg-slate-50/80 backdrop-blur-xs flex items-center justify-center flex-col space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Cargando mapa de la zona...</p>
          </div>
        )}

        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* PUNTO AZUL GPS EN TIEMPO REAL */}
          {userLocation && (
            <>
              <Marker position={userLocation} icon={userLocationIcon} />
              <Circle 
                center={userLocation} 
                radius={100} 
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 1.5 }} 
              />
            </>
          )}

          {/* MARCADORES DE LOS EDIFICIOS */}
          {edificiosVisibles.map((e, idx) => (
            <Marker 
              key={String(e.GESCAL26) || idx} 
              position={[e.coords.lat, e.coords.lon]}
              icon={getMarkerIcon(e['ESTADO IC'])}
            >
              <Popup>
                <div className="p-1 space-y-2 text-slate-800" style={{ minWidth: '160px' }}>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {e['ESTADO IC'] || 'En Gestión'}
                    </span>
                    <h4 className="font-bold text-xs leading-normal">
                      {`${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.trim()}
                    </h4>
                    <span className="block text-[10px] text-slate-500">
                      {resolvePoblacion(e)} &bull; {e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || 0} UUIs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedBuildingGescal(e.GESCAL26);
                        setCurrentTab('detail');
                      }}
                      className="py-1 px-2 bg-blue-600 text-white rounded text-[10px] font-bold text-center block active:scale-95 transition"
                    >
                      Ver Ficha
                    </button>
                    <a
                      href={getMapsUrl(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-bold text-center flex items-center justify-center space-x-0.5 active:scale-95 transition"
                    >
                      <Navigation size={9} className="text-blue-600" />
                      <span>Cómo ir</span>
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}