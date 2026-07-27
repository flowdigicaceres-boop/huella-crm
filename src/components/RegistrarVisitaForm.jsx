// src/components/RegistrarVisitaForm.jsx
import React, { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Save, 
  X, 
  Calendar, 
  MessageSquare, 
  CheckSquare 
} from 'lucide-react';

const RESULT_OPTIONS = [
  { id: 'Portal cerrado', label: '🚪 Portal cerrado', color: 'border-slate-200 text-slate-700 bg-slate-50 active:bg-slate-200 focus:bg-slate-100' },
  { id: 'No localizado', label: '❓ No localizado', color: 'border-slate-200 text-slate-700 bg-slate-50 active:bg-slate-200 focus:bg-slate-100' },
  { id: 'Hablado con vecino', label: '👥 Hablado con vecino', color: 'border-blue-100 text-blue-800 bg-blue-50/50 active:bg-blue-200 focus:bg-blue-100' },
  { id: 'Hablado con presidente', label: '👑 Hablado con presidente', color: 'border-indigo-100 text-indigo-800 bg-indigo-50/50 active:bg-indigo-200 focus:bg-indigo-100' },
  { id: 'Pendiente documentación', label: '📄 Pendiente doc.', color: 'border-amber-100 text-amber-800 bg-amber-50/50 active:bg-amber-200 focus:bg-amber-100' },
  { id: 'Pendiente llamada', label: '📞 Pendiente llamada', color: 'border-orange-100 text-orange-800 bg-orange-50/50 active:bg-orange-200 focus:bg-orange-100' },
  { id: 'Concedido', label: '🟢 Concedido', color: 'border-emerald-200 text-emerald-800 bg-emerald-50 active:bg-emerald-200 focus:bg-emerald-100 font-bold' },
  { id: 'Denegado', label: '🔴 Denegado', color: 'border-rose-200 text-rose-800 bg-rose-50 active:bg-rose-200 focus:bg-rose-100 font-bold' },
  { id: 'Otro', label: '⚙️ Otro', color: 'border-slate-200 text-slate-700 bg-slate-50 active:bg-slate-200 focus:bg-slate-100' }
];

export default function RegistrarVisitaForm({ 
  gescal, 
  edificios = [], 
  onSave, 
  onCancel 
}) {
  const [resultado, setResultado] = useState('');
  const [comentario, setComentario] = useState('');
  const [proximaVisita, setProximaVisita] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Find building
  const building = edificios.find(e => e.GESCAL26 === gescal);

  if (!building) return null;

  const tipoVia = String(building['TIPO-VIA'] || '').trim();
  const nombreVia = String(building['NOMBRE-VIA'] || '').trim();
  const num = String(building['NUM'] || '').trim();
  const fullAddress = `${tipoVia} ${nombreVia} ${num}, ${building.POBLACION || ''}`.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resultado) {
      setFormError('Por favor, selecciona un resultado para la visita.');
      return;
    }

    setFormError('');
    setSaving(true);
    
    try {
      // Format next visit date to DD/MM/YYYY if selected
      let formattedNextDate = '';
      if (proximaVisita) {
        const d = new Date(proximaVisita);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        formattedNextDate = `${day}/${month}/${year}`;
      }

      await onSave(gescal, resultado, comentario.trim(), formattedNextDate);
      // Wait for React to update and call cancel/finish
      setSaving(false);
    } catch (err) {
      console.error(err);
      setFormError('Ocurrió un error al guardar localmente.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={onCancel}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-slate-800 text-lg">Registrar Visita</span>
      </div>

      {/* Target Building Info */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <MapPin size={20} />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h4 className="font-bold text-slate-800 text-sm truncate">{fullAddress}</h4>
          <span className="text-[10px] text-slate-400 font-mono block truncate">
            GESCAL: {building.GESCAL26}
          </span>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold">
            {formError}
          </div>
        )}

        {/* Outcome Selector */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <CheckSquare size={14} className="mr-1.5 text-slate-400" />
            Resultado de la visita *
          </label>
          
          <div className="grid grid-cols-2 gap-2.5">
            {RESULT_OPTIONS.map((opt) => {
              const isSelected = resultado === opt.id;
              
              // Custom active/selected border coloring
              let selectionStyle = isSelected 
                ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 text-blue-900 font-semibold scale-[1.02]' 
                : 'border-slate-100 text-slate-700';
              
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setResultado(opt.id);
                    setFormError('');
                  }}
                  className={`border py-3 px-3 rounded-xl text-xs text-left transition select-none flex items-center justify-between cursor-pointer min-h-[48px] active:scale-98 ${opt.color} ${selectionStyle}`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Free Comment */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <MessageSquare size={14} className="mr-1.5 text-slate-400" />
            Comentarios o notas
          </label>
          <textarea
            rows={3}
            placeholder="Introduce detalles sobre la conversación, por qué está cerrado, etc."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2.5 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 transition"
          />
        </div>

        {/* Next Visit Date */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <Calendar size={14} className="mr-1.5 text-slate-400" />
            Planificar próxima visita
          </label>
          <input
            type="date"
            value={proximaVisita}
            min={new Date().toISOString().split('T')[0]} // Cannot plan visits in the past
            onChange={(e) => setProximaVisita(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2.5 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition font-medium"
          />
          <p className="text-[10px] text-slate-400 leading-normal">
            Opcional. Si lo agendas, este portal aparecerá automáticamente en tu listado de "Mi Jornada" en la fecha programada.
          </p>
        </div>

        {/* Form Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl text-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            <span className="flex items-center justify-center space-x-1.5">
              <X size={16} />
              <span>Cancelar</span>
            </span>
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-blue-500/10 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="flex items-center justify-center space-x-1.5">
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              <span>{saving ? 'Guardando...' : 'Guardar Visita'}</span>
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
