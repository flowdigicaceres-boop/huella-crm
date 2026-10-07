// src/components/MiJornada.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  MapPin, 
  Compass, 
  Clock, 
  ChevronRight, 
  CheckCircle, 
  HelpCircle,
  RefreshCw,
  Copy,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  FileText
} from 'lucide-react';
import { db } from '../services/db';

// Helper de Población autónomo
function getPoblacionEdificio(e) {
  if (!e) return 'Cáceres';
  const rawPob = e['POBLACION'] ?? e['Población'] ?? e['Poblacion'] ?? e['MUNICIPIO'] ?? e['LOCALIDAD'] ?? '';
  const strPob = String(rawPob).trim();
  if (strPob) return strPob;
  return 'Cáceres';
}

export default function MiJornada({ 
  edificios = [], 
  visitas = [], 
  setSelectedBuildingGescal, 
  setCurrentTab 
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [geocodes, setGeocodes] = useState({});
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const requestGPS = useCallback(() => {
    setLoadingGPS(true);
    setGpsError(false);

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
          setGpsError(true);
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    } else {
      setLoadingGPS(false);
      setGpsError(true);
    }
  }, []);

  useEffect(() => {
    db.getTodosGeocodes().then((res) => {
      setGeocodes(res || {});
    }).catch(err => console.error('Error loading geocodes:', err));

    requestGPS();
  }, [requestGPS]);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  }, []);

  const handleCopyText = (text, identifier) => {
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text);
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // REPORTE DE VISITAS REALIZADAS: Carga todas las visitas registradas en la app
  const visitasRealizadasReporte = useMemo(() => {
    const list = [];
    const seenGescals = new Set();

    // 1. Cargar desde la lista de visitas
    (visitas || []).forEach(v => {
      const g = String(v.GESCAL || v.gescal || '').trim();
      if (g && !seenGescals.has(g)) {
        seenGescals.add(g);
        const b = edificios.find(e => String(e.GESCAL26 || e.GESCAL) === g);
        list.push({
          gescal: g,
          resultado: v.Resultado || v.resultado || b?.['ESTADO IC'] || 'En gestión',
          comentario: v.Comentario || v.comentario || b?.['COMENTARIO'] || 'Sin comentarios adicionales',
          hora: v.Hora || v.hora || '',
          edificio: b
        });
      }
    });

    // 2. Cargar desde edificios que tengan última visita registrada
    (edificios || []).forEach(b => {
      const ult = String(b['ULTIMA-VISITA'] || b['ULTIMA_VISITA'] || b.Fecha || '').trim();
      const g = String(b.GESCAL26 || b.GESCAL || '').trim();
      const coment = String(b['COMENTARIO'] || b['Comentario'] || '').trim();

      if (g && !seenGescals.has(g)) {
        if ((ult && ult !== 'Sin visitas' && ult !== 'No agendada' && ult.length > 5) || (coment && coment.length > 3 && coment !== 'no localizo a nadie')) {
          seenGescals.add(g);
          list.push({
            gescal: g,
            resultado: b['ESTADO IC'] || 'En gestión',
            comentario: coment || 'Sin comentarios adicionales',
            hora: '',
            edificio: b
          });
        }
      }
    });

    return list;
  }, [visitas, edificios]);

  function parseDateTimestamp(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(parts[2], parts[1] - 1, parts[0]);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const lists = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const pending = [];
    const future = [];

    edificios.forEach(e => {
      const estado = (e['ESTADO IC'] || '').toLowerCase();
      if (estado.includes('concedido') || estado.includes('denegado')) return;

      const proxTimestamp = parseDateTimestamp(e['PROXIMA-VISITA']);
      if (proxTimestamp > 0) {
        if (proxTimestamp <= todayTimestamp) {
          pending.push(e);
        } else {
          future.push(e);
        }
      }
    });

    pending.sort((a, b) => parseDateTimestamp(a['PROXIMA-VISITA']) - parseDateTimestamp(b['PROXIMA-VISITA']));
    future.sort((a, b) => parseDateTimestamp(a['PROXIMA-VISITA']) - parseDateTimestamp(b['PROXIMA-VISITA']));

    return { pending, future };
  }, [edificios]);

  const nearby = useMemo(() => {
    if (!userLocation || Object.keys(geocodes).length === 0) return [];

    const result = [];
    edificios.forEach(e => {
      const estado = (e['ESTADO IC'] || '').toLowerCase();
      if (estado.includes('concedido') || estado.includes('denegado')) return;

      const coords = geocodes[String(e.GESCAL26 || e.GESCAL)];
      if (coords && coords.lat !== null && coords.lon !== null) {
        const dist = getDistance(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
        if (dist <= 2.0) {
          result.push({ ...e, dist });
        }
      }
    });

    return result.sort((a, b) => a.dist - b.dist).slice(0, 8);
  }, [edificios, geocodes, userLocation]);

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const clampedA = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return R * c;
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  function formatDist(distKm) {
    if (distKm < 1) {
      return `${Math.round(distKm * 1000)} m`;
    }
    return `${distKm.toFixed(1)} km`;
  }

  const handleSelect = (gescal) => {
    setSelectedBuildingGescal(gescal);
    setCurrentTab('detail');
  };

  const getBadgeColor = (res) => {
    const r = (res || '').toLowerCase();
    if (r.includes('concedido')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (r.includes('denegado')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Date Header banner */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jornada de Trabajo</span>
          <h2 className="text-lg font-bold text-slate-800 capitalize mt-0.5">Hoy: {todayStr}</h2>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
          <Calendar size={22} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN PRINCIPAL: REPORTE DE VISITAS CON BOTONES DE COPIADO */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-md space-y-2">
        <div className="flex items-center space-x-2">
          <ClipboardList size={22} className="text-blue-200" />
          <h3 className="font-extrabold text-base">
            Reporte de Visitas Realizadas ({visitasRealizadasReporte.length})
          </h3>
        </div>
        <p className="text-xs text-blue-100 leading-relaxed">
          Toca los botones para copiar el Comentario, Gescal o la Dirección y pegarlos directamente en el nuevo programa.
        </p>
      </div>

      {visitasRealizadasReporte.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-xs shadow-sm">
          No hay visitas registradas todavía. Al registrar visitas en los edificios aparecerán aquí con sus botones de copiado.
        </div>
      ) : (
        <div className="space-y-3">
          {visitasRealizadasReporte.map((item, idx) => {
            const b = item.edificio;
            const tipo = String(b?.['TIPO-VIA'] || '').trim();
            const nom = String(b?.['NOMBRE-VIA'] || '').trim();
            const num = String(b?.['NUM'] || '').trim();
            const pob = getPoblacionEdificio(b);
            const direccionCompleta = `${tipo} ${nom} ${num}, ${pob}`.trim();

            const textoTodoJunto = `GESCAL: ${item.gescal}\nDIRECCIÓN: ${direccionCompleta}\nESTADO: ${item.resultado}\nOBSERVACIONES: ${item.comentario}`;

            return (
              <div 
                key={item.gescal || idx}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                {/* Cabecera de la Visita */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div className="space-y-0.5 max-w-[70%]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Visita #{idx + 1} {item.hora && `(${item.hora})`}
                    </span>
                    <h4 className="font-bold text-slate-800 text-xs leading-snug">
                      {direccionCompleta || 'Dirección no especificada'}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {item.gescal}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(item.resultado)}`}>
                    {item.resultado}
                  </span>
                </div>

                {/* Observación / Comentario */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center">
                    <MessageSquare size={11} className="mr-1 text-blue-500" />
                    Observación / Comentario:
                  </span>
                  <p className="text-slate-800 font-medium whitespace-pre-line text-xs">
                    {item.comentario}
                  </p>
                </div>

                {/* BOTONES DE COPIADO RÁPIDO */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyText(item.comentario, `coment_${idx}`)}
                    className="py-2 px-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1 transition border border-blue-100"
                  >
                    {copiedId === `coment_${idx}` ? (
                      <>
                        <CheckCheck size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Comentario</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyText(item.gescal, `gescal_${idx}`)}
                    className="py-2 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1 transition border border-slate-200"
                  >
                    {copiedId === `gescal_${idx}` ? (
                      <>
                        <CheckCheck size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Gescal</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyText(textoTodoJunto, `todo_${idx}`)}
                    className="py-2 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1 transition border border-slate-200"
                  >
                    {copiedId === `todo_${idx}` ? (
                      <>
                        <CheckCheck size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <FileText size={12} />
                        <span>Todo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SECCIÓN EDIFICIOS CERCANOS */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Compass size={16} className="mr-2 text-slate-500" />
            Edificios Cercanos (&lt;2 km)
          </h3>

          <button
            onClick={requestGPS}
            disabled={loadingGPS}
            className="flex items-center space-x-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg active:scale-95 transition disabled:opacity-50"
          >
            <RefreshCw size={11} className={loadingGPS ? 'animate-spin' : ''} />
            <span>{loadingGPS ? 'Buscando...' : 'GPS'}</span>
          </button>
        </div>

        {!userLocation ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
            <HelpCircle size={24} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-500 font-medium px-4">
              {gpsError 
                ? 'No se pudo acceder a tu ubicación GPS. Verifica los permisos de tu navegador.'
                : 'Pulsa el botón de GPS arriba para encontrar portales cercanos a tu posición actual.'}
            </p>
            <button
              onClick={requestGPS}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl active:scale-95 transition"
            >
              Activar Geolocalización
            </button>
          </div>
        ) : nearby.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">No hay portales pendientes en un radio de 2 km.</p>
        ) : (
          <div className="space-y-2.5">
            {nearby.map((e, idx) => (
              <div
                key={String(e.GESCAL26 || e.GESCAL) || idx}
                onClick={() => handleSelect(e.GESCAL26 || e.GESCAL)}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-semibold">
                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shrink-0">
                      A {formatDist(e.dist)}
                    </span>
                    <span className="truncate">{e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || 0} UUIs</span>
                    <span className="truncate">{getPoblacionEdificio(e)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PENDIENTES HOY O ATRASADOS */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Clock size={16} className="mr-2 text-rose-500" />
          Pendientes Hoy o Atrasados ({lists.pending.length})
        </h3>

        {lists.pending.length === 0 ? (
          <div className="text-center py-6 border border-slate-50 rounded-xl bg-slate-50/50">
            <CheckCircle size={26} className="mx-auto text-emerald-500 mb-1.5 animate-bounce" />
            <p className="text-xs text-emerald-800 font-semibold">¡Todo al día!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">No tienes visitas pendientes agendadas para hoy.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lists.pending.map((e, idx) => (
              <div
                key={String(e.GESCAL26 || e.GESCAL) || idx}
                onClick={() => handleSelect(e.GESCAL26 || e.GESCAL)}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                    <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-semibold border border-rose-100 shrink-0">
                      Agendado: {e['PROXIMA-VISITA']}
                    </span>
                    <span className="truncate">{e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || 0} UUIs</span>
                    <span className="truncate">{getPoblacionEdificio(e)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VISITAS AGENDADAS A FUTURO */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Calendar size={16} className="mr-2 text-indigo-500" />
          Visitas Agendadas a Futuro ({lists.future.length})
        </h3>

        {lists.future.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">No tienes visitas planificadas para el futuro.</p>
        ) : (
          <div className="space-y-2.5">
            {lists.future.map((e, idx) => (
              <div
                key={String(e.GESCAL26 || e.GESCAL) || idx}
                onClick={() => handleSelect(e.GESCAL26 || e.GESCAL)}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-slate-100 transition select-none"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <h4 className="font-bold text-slate-800 text-xs truncate">
                    {`${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${e['NUM'] || ''}`.trim()}
                  </h4>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold border border-indigo-100 shrink-0">
                      Agenda: {e['PROXIMA-VISITA']}
                    </span>
                    <span className="truncate">{e['TOTALES '] || e['TOTALES'] || e['TOTALES (UUIs)'] || 0} UUIs</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}