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

// Icono personalizado para los edificios
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

// Icono GPS del usuario (Punto Azul pulsante)
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

// Función limpiadora de direcciones para Extremadura (Plasencia, Cáceres, Navalmoral)
function buildCleanAddress(b) {
  const tipo = String(b['TIPO-VIA'] || '').replace(/c\//i, '').replace(/cl/i, '').replace(/av/i, '').trim();
  const nombre = String(b['NOMBRE-VIA'] || '').replace(/^c\//i, '').replace(/^cl\//i, '').replace(/^av\//i, '').trim();
  const num = String(b['NUM'] || '').trim();
  const pob = String(b.POBLACION || 'Plasencia').trim();
  
  return `${tipo} ${nombre} ${num}, ${pob}, Extremadura, España`.replace(/\s+/g, ' ').trim();
}

export default function MapView({ 
  edificios = [], 
  setSelectedBuildingGescal, 
  setCurrentTab 
}) {
  const [geocodedEdificios, setGeocodedEdificios] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.029, -6.088]); // Plasencia por defecto
  const [mapZoom, setMapZoom] = useState(14);
  const [loadingGeocodes, setLoadingGeocodes] = useState(true);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [gpsError, setGpsError] = useState(null);

  const [poblacionFiltro, setPoblacionFiltro] = useState(() => {
    return localStorage.getItem('huella_filter_poblacion') || 'todos';
  });

  const poblaciones = useMemo(() => {
    const pobs = new Set();
    edificios.forEach(e => {
      if (e.POBLACION) pobs.add(String(e.POBLACION).trim());
    });
    return Array.from(pobs).sort();
  }, [edificios]);

  // RASTREO GPS EN TIEMPO REAL PERMANENTE (PUNTO AZUL)
  useEffect(() => {
    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(coords);
        },
        (err) => {
          console.warn('GPS watch error:', err);
          setGpsError('GPS inactivo o sin permiso.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
    } else {
      setGpsError('Navegador sin soporte GPS.');
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Carga de geocodes
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

  // Geocodificación optimizada para OpenStreetMap
  const geocodeAllUnmappedContinuously = async (list, checkIsMounted) => {
    for (let i = 0; i < list.length; i++) {
      if (!checkIsMounted()) break;
      const b = list[i];
      try {
        const address = buildCleanAddress(b);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.length > 0 && checkIsMounted()) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          await db.saveGeocode(b.GESCAL26, lat, lon);
          
          setGeocodedEdificios(prev => [...prev, { ...b, coords: { lat, lon } }]);
          setUnmappedCount(c => Math.max(0, c - 1));
        }
      } catch (e) {
        console.warn('Error geocodificando:', e);
      }
      await new Promise(r => setTimeout(r, 600));
    }
  };

  const edificiosVisibles = useMemo(() => {
    if (poblacionFiltro === 'todos') return geocodedEdificios;
    return geocodedEdificios.filter(e => String(e.POBLACION || '').trim() === poblacionFiltro);
  }, [geocodedEdificios, poblacionFiltro]);

  // Centrado automático en la población visible
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
        const avgLat = sumLat / validCount;
        const avgLon = sumLon / validCount;
        setMapCenter([avgLat, avgLon]);
        setMapZoom(14);
      }
    }
  }, [edificiosVisibles.length, poblacionFiltro]);

  // Centrar cámara en el usuario al pulsar botón GPS
  const handleCenterUserGPS = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(17);
    } else {
      setGpsError('Buscando señal GPS actual...');
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
    const address = `${tipo} ${nombre} ${num}, ${e.POBLACION || ''}, España`;
    
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
            <Loader size={10} className="animate-spin text-blue-500 ml-1" title={`Buscando ${unmappedCount} restantes...`} />
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

          {/* MARCADOR GPS DEL USUARIO (PUNTO AZUL) SIEMPRE VISIBLE */}
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
                      {e.POBLACION} &bull; {e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || 0} UUIs
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