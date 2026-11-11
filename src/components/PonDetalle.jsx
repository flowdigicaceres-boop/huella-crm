// src/components/PonDetalle.jsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Navigation, Layers, Users, Upload, Copy, CheckCheck, ChevronRight, Calendar, MapPin, KeyRound, AlertTriangle } from 'lucide-react';
import { db } from '../services/db';
import { centroDePon, estaCumplida, DIAS_AVISO_LLAVES } from '../utils/pons';
import { ChipObjetivo, formatoAvance } from './ponUi';

function direccion(e) {
  // La web usa 99998 / 99999 para "sin número"
  const num = Number(e['NUM']) >= 99990 ? 's/n' : (e['NUM'] || '');
  return `${e['TIPO-VIA'] || ''} ${e['NOMBRE-VIA'] || ''} ${num}`.replace(/\s+/g, ' ').trim();
}

function chipEstado(texto, tipo) {
  const estilos = {
    verde: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rojo: 'bg-rose-50 text-rose-700 border-rose-100',
    ambar: 'bg-amber-50 text-amber-700 border-amber-100',
    gris: 'bg-slate-50 text-slate-600 border-slate-200'
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${estilos[tipo]}`}>{texto}</span>
  );
}

function estadoCrm(e) {
  const st = String(e['ESTADO IC'] || '').toUpperCase();
  if (st.includes('DENEG')) return chipEstado('CRM: Denegado', 'rojo');
  if (st.includes('CONCED')) return chipEstado('CRM: Concedido', 'verde');
  if (st.includes('GEST')) return chipEstado('CRM: En gestión', 'ambar');
  return chipEstado('Sin visitar', 'gris');
}

export default function PonDetalle({ pon, onBack, onSelectBuilding }) {
  const [centro, setCentro] = useState(null);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    if (!pon) return undefined;
    let activo = true;
    db.getTodosGeocodes().then((g) => { if (activo) setCentro(centroDePon(pon, g || {})); }).catch(() => {});
    return () => { activo = false; };
  }, [pon]);

  if (!pon) {
    return (
      <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <p className="text-slate-500 font-semibold text-sm">PON no encontrado (puede haber cambiado con la última descarga).</p>
        <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl">Volver</button>
      </div>
    );
  }

  const copiar = (texto, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(''), 1800);
    }
  };

  const abrirMapa = () => {
    if (!centro) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${centro.lat},${centro.lon}`, '_blank');
  };

  const porGestionar = [...pon.gestionables].sort((a, b) => (Number(b.TOTALES) || 0) - (Number(a.TOTALES) || 0));

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center space-x-2">
        <button onClick={onBack} type="button" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition">
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-slate-800 text-lg">Detalle del PON</span>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: pon.tramo.color }} />
        <div className="pt-2 flex items-center space-x-2 flex-wrap gap-y-1">
          <ChipObjetivo objetivo={pon.objetivo} grande />
          {pon.densidad && (
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
              {pon.densidad === 'FINALIZADO' ? 'Finalizado' : `${pon.densidad} · ${pon.fase}`}
            </span>
          )}
          {pon.avance !== null && (
            <span className="text-xs font-semibold text-slate-500">Avance {formatoAvance(pon.avance)}</span>
          )}
        </div>
        <h2 className="font-bold text-slate-900 text-lg leading-tight break-words">{pon.nombre}</h2>
        <p className="text-xs text-slate-500 font-medium flex items-center">
          <MapPin size={12} className="mr-1 text-slate-400" />
          {pon.poblacion}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-slate-50 rounded-xl py-2">
            <span className="block text-lg font-extrabold text-slate-800">{pon.gestionablesN}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Por gestionar</span>
          </div>
          <div className="bg-slate-50 rounded-xl py-2">
            <span className="block text-lg font-extrabold text-blue-600">{pon.uuisGestionables}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">UUIs</span>
          </div>
          <div className="bg-slate-50 rounded-xl py-2">
            <span className="block text-lg font-extrabold text-amber-600">{pon.pendientesSubirN}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Por subir</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          {pon.concedidosWeb > 0
            ? `${pon.totalEdificios} edificios en el PON · ${pon.concedidosWeb} ya concedidos en la web`
            : `${pon.totalEdificios} edificios pendientes en la web`}
        </p>

        <button
          type="button"
          onClick={abrirMapa}
          disabled={!centro}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold rounded-xl text-sm active:scale-95 transition disabled:opacity-40"
        >
          <Navigation size={16} className="text-blue-600" />
          <span>{centro ? 'Cómo llegar al PON' : 'Localizando el PON…'}</span>
        </button>
      </div>

      <div className="space-y-2.5">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <Layers size={16} className="mr-2 text-slate-500" />
          Edificios por gestionar ({porGestionar.length})
        </h3>
        {porGestionar.length === 0 && (
          <p className="text-xs text-slate-400 bg-white border border-slate-100 rounded-2xl p-4 text-center">
            No queda nada por gestionar en este PON.
          </p>
        )}
        {porGestionar.map((e) => (
          <div
            key={e.GESCAL26}
            onClick={() => onSelectBuilding(e.GESCAL26)}
            className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-xs active:scale-95 transition cursor-pointer select-none"
          >
            <div className="space-y-1.5 min-w-0 pr-2">
              <div className="flex items-center flex-wrap gap-1.5">
                {chipEstado(`Web: ${e['ESTADO WEB'] || '—'}`, e['ESTADO WEB'] === 'DENEGADO' ? 'rojo' : 'gris')}
                {estadoCrm(e)}
                {estaCumplida(e) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center">
                    <AlertTriangle size={9} className="mr-1" />
                    CUMPLIDA
                  </span>
                )}
                {e.llaves && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center text-white ${
                    e.llaves.dias <= DIAS_AVISO_LLAVES ? 'bg-rose-600' : 'bg-rose-500'
                  }`}>
                    <KeyRound size={9} className="mr-1" />
                    LLAVES
                  </span>
                )}
              </div>
              {e.llaves && (
                <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1">
                  Entrega de llaves: {e.llaves.fecha}. Gestionar antes del {e.llaves.limite}{' '}
                  ({e.llaves.dias >= 0 ? `quedan ${e.llaves.dias} días` : `vencido hace ${-e.llaves.dias} días`})
                </p>
              )}
              <h4 className="font-bold text-slate-800 text-sm leading-snug">{direccion(e)}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center"><Layers size={12} className="mr-1 text-slate-400" />{e.TOTALES || 0} UUIs</span>
                {Number(e.CLIENTES) > 0 && (
                  <span className="flex items-center"><Users size={12} className="mr-1 text-slate-400" />{e.CLIENTES}</span>
                )}
                {e['ULTIMA-VISITA'] && (
                  <span className="flex items-center"><Calendar size={12} className="mr-1 text-slate-400" />{e['ULTIMA-VISITA']}</span>
                )}
                {e['FECHA-CONTACTADO'] && (
                  <span className="flex items-center" title="Última vez declarado como Contactado en la web">Contactado {e['FECHA-CONTACTADO']}</span>
                )}
              </div>
              {e.COMENTARIO && (
                <p className="text-[11px] text-slate-500 italic line-clamp-2 whitespace-pre-line">{String(e.COMENTARIO).split('---')[0]}</p>
              )}
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </div>
        ))}
      </div>

      {pon.pendientesSubirN > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Upload size={16} className="mr-2 text-amber-500" />
            Concedidos en tu CRM, pendientes de subir ({pon.pendientesSubirN})
          </h3>
          {pon.pendientesSubir.map((e) => (
            <div key={e.GESCAL26} className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 flex items-center justify-between">
              <div className="min-w-0 pr-2 space-y-0.5">
                <h4 className="font-bold text-slate-800 text-xs leading-snug">{direccion(e)}</h4>
                <span className="text-[10px] text-slate-500 font-mono block truncate">{e.GESCAL26}</span>
                <span className="text-[10px] text-amber-700 font-semibold">Web: {e['ESTADO WEB']}</span>
              </div>
              <button
                type="button"
                onClick={() => copiar(String(e.GESCAL26), e.GESCAL26)}
                className="shrink-0 py-2 px-3 bg-white border border-amber-200 text-amber-700 font-bold rounded-xl text-[11px] flex items-center space-x-1 active:scale-95 transition"
              >
                {copiado === e.GESCAL26 ? <CheckCheck size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiado === e.GESCAL26 ? '¡Copiado!' : 'Gescal'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
