// src/components/MapView.jsx
import React, { useState, useEffect, useRef } from 'react';
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
  Navigation, 
  Maximize2, 
  Building, 
  Crosshair, 
  Layers,
  Info
} from 'lucide-react';
import { db } from '../services/db';
import { geocodeBuilding } from '../services/geocoding';

// Fix Leaflet container size
import 'leaflet/dist/leaflet.css';

// Custom Marker DivIcons to avoid Vite image import issues and support offline use
const getMarkerIcon = (status) => {
  const st = (status || '').toLowerCase();
  let color = 'bg-amber-500'; // En gestión / default
  if (st.includes('concedido')) color = 'bg-emerald-500';
  if (st.includes('denegado')) color = 'bg-rose-500';

  return L.divIcon({
    className: 'custom-div-icon',
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
  className: 'user-location-icon',
  html: `
    <div class="relative flex h-8 w-8 items-center justify-center">
      <div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></div>
      <div class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-md bg-blue-600"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Component to fly to user location or bounds
function MapController({ center, zoom, userLocation }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
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
  const [mapCenter, setMapCenter] = useState([40.416775, -3.703790]); // Madrid center default
  const [mapZoom, setMapZoom] = useState(13);
  const [loadingGeocodes, setLoadingGeocodes] = useState(true);
  const [unmappedCount, setUnmappedCount] = useState(0);

  // Load existing geocodes and trigger background lazy geocoding
  useEffect(() => {
    let isMounted = true;

    async function loadGeocodes() {
      try {
        setLoadingGeocodes(true);
        // Load all cached geocodes
        const cached = await db.getTodosGeocodes();
        
        const mapped = [];
        const unmapped = [];

        edificios.forEach(e => {
          const coords = cached[e.GESCAL26];
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

          // Center map on the first mapped building if available
          if (mapped.length > 0) {
            setMapCenter([mapped[0].coords.lat, mapped[0].coords.lon]);
            setMapZoom(15);
          }
        }

        // Start background geocoding (lazy loading) for unmapped buildings
        // Limit to first 20 for active map session, then loop slowly
        if (unmapped.length > 0) {
          geocodeUnmappedSlowly(unmapped, isMounted);
        }
      } catch (err) {
        console.error('Error loading geocodes:', err);
        if (isMounted) setLoadingGeocodes(false);
      }
    }

    loadGeocodes();

    // Geolocate user automatically on mount
    geolocateUser(false);

    return () => {
      isMounted = false;
    };
  }, [edificios]);

  // Background slow geocoding function
  const geocodeUnmappedSlowly = async (list, isMounted) => {
    // Only process up to 30 unmapped buildings per session to conserve rate limits
    const maxToGeocode = Math.min(list.length, 30);
    
    for (let i = 0; i < maxToGeocode; i++) {
      if (!isMounted) break;
      const b = list[i];
      try {
        const coords = await geocodeBuilding(b);
        if (coords && isMounted) {
          setGeocodedEdificios(prev => [...prev, { ...b, coords }]);
          setUnmappedCount(c => c - 1);
        }
      } catch (e) {
        console.warn('Lazy geocoding error:', e);
      }
    }
  };

  // Locate User GPS
  const geolocateUser = (fly = true) => {
    if (!navigator.geolocation) return;
    
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
        console.warn('Geolocation error:', err);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
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
      {/* Top Banner Map Stats */}
      <div className="flex items-center justify-between text-xs bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center space-x-1.5 font-semibold text-slate-700">
          <Building size={14} className="text-blue-500" />
          <span>Mapeados: {geocodedEdificios.length}</span>
        </div>
        {unmappedCount > 0 && (
          <div className="text-[10px] text-slate-400 font-medium">
            <span>({unmappedCount} sin geocodificar, resolviendo en segundo plano...)</span>
          </div>
        )}
        <button 
          onClick={() => geolocateUser(true)}
          className="flex items-center space-x-1 font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg active:scale-95 transition"
        >
          <Crosshair size={12} />
          <span>Centrar GPS</span>
        </button>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs relative">
        {loadingGeocodes && geocodedEdificios.length === 0 ? (
          <div className="absolute inset-0 z-50 bg-slate-50/80 backdrop-blur-xs flex items-center justify-center flex-col space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Cargando ubicaciones...</p>
          </div>
        ) : null}

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

          {/* User Location Marker */}
          {userLocation && (
            <>
              <Marker position={userLocation} icon={userLocationIcon} />
              <Circle center={userLocation} radius={100} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }} />
            </>
          )}

          {/* Buildings Markers */}
          {geocodedEdificios.map((e, idx) => (
            <Marker 
              key={e.GESCAL26 || idx} 
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
                      {`${e['TIPO-VIA']} ${e['NOMBRE-VIA']} ${e['NUM']}`.trim()}
                    </h4>
                    <span className="block text-[10px] text-slate-500">
                      {e.POBLACION} &bull; {e['TOTALES (UUIs)']} UUIs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedBuildingGescal(e.GESCAL26);
                        setCurrentTab('detail');
                      }}
                      className="py-1 px-2 bg-blue-600 text-white rounded text-[10px] font-bold text-center block"
                    >
                      Ver Ficha
                    </button>
                    <a
                      href={getMapsUrl(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-bold text-center flex items-center justify-center space-x-0.5"
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
