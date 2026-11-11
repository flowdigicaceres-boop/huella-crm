// src/components/MapaPons.jsx
// Mapa de trabajo por PON: una chincheta por PON, coloreada según su OBJETIVO_HORA y con el
// número de edificios que quedan por gestionar. Al tocarla se abre un resumen y el detalle del PON.
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Filter, Loader, Upload, Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { TRAMOS, TRAMO_SIN_DATO, centroDePon } from '../utils/pons';
import { usePonGeocodes } from '../hooks/usePonGeocodes';
import { ChipObjetivo, MensajeSinWeb, esFinalizado, usePonFiltros } from './ponUi';

const CENTRO_POR_DEFECTO = [39.9, -6.0];

function iconoPon(pon, seleccionado) {
  const n = pon.gestionablesN;
  const tam = Math.round(30 + Math.min(n, 15) * 1.6);
  const fuente = n >= 100 ? 11 : 13;
  const aro = seleccionado ? '0 0 0 4px rgba(15,23,42,.45), 0 2px 8px rgba(0,0,0,.45)' : '0 2px 6px rgba(0,0,0,.35)';
  const insignia = pon.pendientesSubirN > 0
    ? `<div style="position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 3px;border-radius:9999px;background:#f59e0b;border:2px solid #fff;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${pon.pendientesSubirN}</div>`
    : '';
  const llaves = pon.llavesN > 0
    ? `<div style="position:absolute;bottom:-5px;right:-5px;min-width:17px;height:17px;padding:0 3px;border-radius:9999px;background:#e11d48;border:2px solid #fff;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">&#128273;</div>`
    : '';
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `<div style="position:relative;width:${tam}px;height:${tam}px">
      <div style="width:100%;height:100%;border-radius:9999px;background:${pon.tramo.color};border:3px solid #fff;box-shadow:${aro};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${fuente}px">${n}</div>${insignia}${llaves}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2]
  });
}

function AjustarVista({ puntos, clave }) {
  const map = useMap();
  const ultimaClave = useRef('');
  const usuarioMovio = useRef(false);

  useMapEvents({ dragstart: () => { usuarioMovio.current = true; } });

  useEffect(() => {
    if (ultimaClave.current !== clave) {
      ultimaClave.current = clave;
      usuarioMovio.current = false;
    }
    if (usuarioMovio.current || puntos.length === 0) return;
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15, animate: false });
  }, [puntos, clave, map]);

  return null;
}

function CerrarAlTocarMapa({ onCerrar }) {
  useMapEvents({ click: onCerrar });
  return null;
}

function VolarA({ destino }) {
  const map = useMap();
  useEffect(() => {
    if (destino) map.flyTo(destino, 16, { duration: 0.8 });
  }, [destino, map]);
  return null;
}

export default function MapaPons({ pons, webError, onSelectPon }) {
  const { poblacion, verFinalizados, setPoblacion, setVerFinalizados } = usePonFiltros();
  const [seleccionado, setSeleccionado] = useState(null);
  const [miPosicion, setMiPosicion] = useState(null);
  const [volarA, setVolarA] = useState(null);
  const [errorGps, setErrorGps] = useState('');

  const poblaciones = useMemo(() => {
    const set = new Set();
    (pons?.pons || []).forEach((p) => { if (p.poblacion) set.add(p.poblacion); });
    return Array.from(set).sort();
  }, [pons]);

  const visibles = useMemo(() => {
    if (!pons) return [];
    return pons.pons
      .filter((p) => p.gestionablesN > 0)
      .filter((p) => verFinalizados || !esFinalizado(p) || p.llavesN > 0)
      .filter((p) => poblacion === 'todos' || p.poblacion === poblacion);
  }, [pons, poblacion, verFinalizados]);

  const { geocodes, pendientes } = usePonGeocodes(visibles, true);

  const ubicados = useMemo(
    () => visibles.map((p) => ({ pon: p, centro: centroDePon(p, geocodes) })).filter((x) => x.centro),
    [visibles, geocodes]
  );
  const sinUbicar = visibles.length - ubicados.length;

  const puntos = useMemo(() => ubicados.map((x) => [x.centro.lat, x.centro.lon]), [ubicados]);

  const conteoTramos = useMemo(() => {
    const cuenta = new Map();
    visibles.forEach((p) => cuenta.set(p.tramo.id, (cuenta.get(p.tramo.id) || 0) + 1));
    return cuenta;
  }, [visibles]);

  const ponSeleccionado = useMemo(
    () => visibles.find((p) => p.id === seleccionado) || null,
    [visibles, seleccionado]
  );

  const cerrar = useCallback(() => setSeleccionado(null), []);

  const pedirGps = () => {
    setErrorGps('');
    if (!navigator.geolocation) {
      setErrorGps('Este móvil no permite usar el GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setMiPosicion(p);
        setVolarA(p);
      },
      () => setErrorGps('No se pudo obtener tu posición. Revisa el permiso de ubicación.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (!pons) return <MensajeSinWeb webError={webError} />;

  const tramosLeyenda = [...TRAMOS, TRAMO_SIN_DATO].filter((t) => conteoTramos.get(t.id));

  return (
    <div className="flex flex-col h-[calc(100vh-190px)] space-y-2 relative">
      <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm gap-2">
        <div className="flex items-center space-x-1 font-semibold text-slate-700 shrink-0">
          <Layers size={14} className="text-blue-500 shrink-0" />
          <span>{ubicados.length} PONs</span>
          {(pendientes > 0 || sinUbicar > 0) && (
            <Loader size={10} className="animate-spin text-blue-500 ml-1" title="Localizando PONs…" />
          )}
        </div>

        <div className="relative flex-1 max-w-[170px]">
          <select
            value={poblacion}
            onChange={(e) => { setPoblacion(e.target.value); setSeleccionado(null); }}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-[11px] px-2 py-1 pr-6 rounded-xl font-bold focus:border-blue-500 cursor-pointer truncate"
          >
            <option value="todos">Todas las poblaciones</option>
            {poblaciones.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
          <Filter size={10} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={pedirGps}
          type="button"
          className="flex items-center space-x-1 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg active:scale-95 transition shrink-0"
        >
          <Crosshair size={12} />
          <span>Mi GPS</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-0.5">
        {tramosLeyenda.map((t) => (
          <span key={t.id} className="shrink-0 flex items-center text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-full px-2 py-1">
            <span className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: t.color }} />
            {t.etiqueta} · {conteoTramos.get(t.id)}
          </span>
        ))}
        <button
          type="button"
          onClick={() => { setVerFinalizados(!verFinalizados); setSeleccionado(null); }}
          className={`shrink-0 text-[10px] font-bold rounded-full px-2 py-1 border ${
            verFinalizados ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'
          }`}
        >
          {verFinalizados ? 'Ocultar finalizados' : 'Ver finalizados'}
        </button>
      </div>

      {errorGps && (
        <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold">{errorGps}</div>
      )}

      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs relative">
        <MapContainer center={CENTRO_POR_DEFECTO} zoom={9} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjustarVista puntos={puntos} clave={`${poblacion}|${verFinalizados}`} />
          <CerrarAlTocarMapa onCerrar={cerrar} />
          <VolarA destino={volarA} />

          {miPosicion && (
            <CircleMarker center={miPosicion} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />
          )}

          {ubicados.map(({ pon, centro }) => (
            <Marker
              key={pon.id}
              position={[centro.lat, centro.lon]}
              icon={iconoPon(pon, pon.id === seleccionado)}
              eventHandlers={{ click: () => setSeleccionado(pon.id) }}
            />
          ))}
        </MapContainer>

        {ubicados.length === 0 && (
          <div className="absolute inset-0 z-[500] bg-slate-50/80 flex flex-col items-center justify-center space-y-2 pointer-events-none">
            <div className="w-9 h-9 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 text-xs font-semibold px-6 text-center">
              {visibles.length === 0 ? 'No hay PONs con esos filtros.' : 'Localizando los PONs en el mapa…'}
            </p>
          </div>
        )}

        {ponSeleccionado && (
          <div className="absolute bottom-3 left-3 right-3 z-[1100] bg-white rounded-2xl shadow-xl border border-slate-100 p-3 space-y-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <ChipObjetivo objetivo={ponSeleccionado.objetivo} />
              {ponSeleccionado.densidad && ponSeleccionado.densidad !== 'FINALIZADO' && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {ponSeleccionado.densidad} · {ponSeleccionado.fase}
                </span>
              )}
              {ponSeleccionado.pendientesSubirN > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center">
                  <Upload size={9} className="mr-0.5" />
                  {ponSeleccionado.pendientesSubirN} por subir
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-900 text-sm break-words">{ponSeleccionado.nombre}</h4>
            <p className="text-xs text-slate-500 font-medium">
              {ponSeleccionado.poblacion} · <strong className="text-slate-700">{ponSeleccionado.gestionablesN} edificios</strong> · {ponSeleccionado.uuisGestionables} UUIs
            </p>
            <button
              type="button"
              onClick={() => onSelectPon(ponSeleccionado.id)}
              className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl text-sm active:scale-95 transition"
            >
              Abrir PON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
