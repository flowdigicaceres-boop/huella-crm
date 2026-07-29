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
import { geocodeBuilding } from '../services/geocoding';

import 'leaflet/dist/leaflet.css';

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
    <div class="relative flex h-8 w-8 items-center justify-center">
      <div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></div>
      <div class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md bg-blue-600"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
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
  const [mapCenter, setMapCenter] = useState([40.029, -6.088]); // Plasencia por defecto
  const [mapZoom, setMapZoom] = useState(14);
  const [loadingGeocodes, setLoadingGeocodes] = useState(true);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [gpsError, setGpsError] = useState(null);

  // Leer la población persistente guardada por el usuario
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

        // BÚSQUEDA CONTINUA EN SEGUNDO PLANO PARA RESOLVER EL 100% DE EDIFICIOS
        if (unmapped.length > 0) {
          geocodeAllUnmappedContinuously(unmapped, () => isMounted);
        }
      } catch (err) {
        console.error('Error cargando geocodes:', err);
        if (isMounted) setLoadingGeocodes(false);
      }
    }

    loadGeocodes();
    geolocateUser(false);

    return () => { isMounted = false; };
  }, [edificios]);

  // Procesa continuamente todos los edificios no mapeados
  const geocodeAllUnmappedContinuously = async (list, checkIsMounted) => {
    for (let i = 0; i < list.length; i++) {
      if (!checkIsMounted()) break;
      const b = list[i];
      try {
        const coords = await geocodeBuilding(b);
        if (coords && checkIsMounted()) {
          setGeocodedEdificios(prev => [...prev, { ...b, coords }]);
          setUnmappedCount(c => Math.max(0, c - 1));
        }
      } catch (e) {
        console.warn('Geocodificación progresiva:', e);
      }
      // Pausa respetuosa de 800ms entre búsquedas para no saturar OpenStreetMap
      await new Promise(r => setTimeout(r, 800));
    }
  };

  const edificiosVisibles = useMemo(() => {
    if (poblacionFiltro === 'todos') return geocodedEdificios;
    return geocodedEdificios.filter(e => String(e.POBLACION || '').trim() === poblacionFiltro);
  }, [geocodedEdificios, poblacionFiltro]);

  // Centrado dinámico en la zona filtrada
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
  }, [edificiosVisibles, poblacionFiltro]);

  const geolocateUser = (fly = true) => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización GPS.');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        if (fly) {
          setMapCenter(coords);
          setMapZoom(17);
        }
      },
      (err) => {
        console.warn('GPS error:', err);
        if (fly) {
          setGpsError('No se pudo obtener tu ubicación GPS.');
          setTimeout(() => setGpsError(null), 4000);
        }
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
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
            <Loader size={10} className="animate-spin text-blue-500 ml-1" title={`Buscando ${unmappedCount} restantes en segundo plano...`} />
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
          onClick={() => geolocateUser(true)}
          type="button"
          className="flex items-center space-x-1 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg active:scale-95 transition shrink-0"
        >
          <Crosshair size={12} />
          <span>GPS</span>
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
            <p className="text-slate-500 text-xs font-semibold">Cargando ubicaciones de la zona...</p>
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

          {userLocation && (
            <>
              <Marker position={userLocation} icon={userLocationIcon} />
              <Circle 
                center={userLocation} 
                radius={80} 
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1 }} 
              />
            </>
          )}

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