// src/components/RegistrarVisitaForm.jsx
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Save, 
  X, 
  Calendar, 
  MessageSquare, 
  CheckSquare,
  Mic,
  MicOff,
  Sparkles,
  Loader
} from 'lucide-react';
import { analizarDictadoLocal } from '../utils/dictado';

const RESULT_OPTIONS = [
  { id: 'Concedido', label: '🟢 Concedido', color: 'border-emerald-200 text-emerald-800 bg-emerald-50 active:bg-emerald-200 font-bold' },
  { id: 'Denegado', label: '🔴 Denegado', color: 'border-rose-200 text-rose-800 bg-rose-50 active:bg-rose-200 font-bold' },
  { id: 'En gestión', label: '🟡 En gestión', color: 'border-amber-200 text-amber-800 bg-amber-50 active:bg-amber-200 font-bold' }
];

// Modelo de Gemini para el dictado. Se puede cambiar desde Ajustes sin tocar el código.
const GEMINI_MODEL_POR_DEFECTO = 'gemini-2.5-flash';

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

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const recognitionRef = useRef(null);

  const geminiApiKey = localStorage.getItem('huella_gemini_api_key') || '';
  const geminiModel = localStorage.getItem('huella_gemini_model') || GEMINI_MODEL_POR_DEFECTO;

  const building = edificios.find(e => String(e.GESCAL26) === String(gescal));

  if (!building) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-slate-500 text-sm">No se encontró la información del edificio.</p>
        <button 
          onClick={onCancel}
          type="button"
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-medium text-xs"
        >
          Volver
        </button>
      </div>
    );
  }

  const tipoVia = String(building['TIPO-VIA'] || '').trim();
  const nombreVia = String(building['NOMBRE-VIA'] || '').trim();
  const num = String(building['NUM'] || '').trim();
  const fullAddress = `${tipoVia} ${nombreVia} ${num}, ${building.POBLACION || ''}`.trim();

  const addDaysToNextVisit = (days) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    
    setProximaVisita(`${year}-${month}-${day}`);
  };

  const startVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setFormError('Tu navegador no soporta reconocimiento de voz por micrófono.');
      return;
    }

    setFormError('');
    setIsRecording(true);
    setAiStatusMsg('Escuchando tu voz... Habla con claridad 🎙️');

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        if (transcript.trim()) {
          await processVoiceWithAI(transcript);
        } else {
          setAiStatusMsg('');
        }
      };

      recognition.onerror = (event) => {
        console.warn('Error de reconocimiento de voz:', event.error);
        setIsRecording(false);
        setAiStatusMsg('');
        if (event.error !== 'no-speech') {
          setFormError('No se pudo capturar el audio. Inténtalo de nuevo.');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
      setAiStatusMsg('');
      setFormError('Error al activar el micrófono.');
    }
  };

  const stopVoiceDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setAiStatusMsg('');
    }
  };

  const processVoiceWithAI = async (textDictated) => {
    setIsAnalyzingAI(true);
    setAiStatusMsg('Analizando visita con IA... ⏳');

    let parsedResult = null;
    let usoIA = false;
    let motivoSinIA = '';

    if (!geminiApiKey) {
      motivoSinIA = 'sin clave de IA en Ajustes';
    } else if (!navigator.onLine) {
      motivoSinIA = 'sin conexión';
    } else {
      try {
        const prompt = `
Eres un asistente de IA para un CRM de permisos de fibra óptica.
Analiza la siguiente transcripción dictada por un comercial en campo:
"${textDictated}"

INSTRUCCIONES CLAVE:
1. Determina el estado de la finca entre estas tres opciones exactas:
   - "Concedido" (SOLO si ya han firmado o autorizado de forma clara; "no han firmado" o "van a firmar" NO es concedido).
   - "Denegado" (si rechazaron o se negaron de forma clara).
   - "En gestión" (en cualquier otro caso: no localizado, portal cerrado, hablado con presidente o vecino, faltan papeles, hay que volver a llamar...).

2. Redacta un comentario profesional, técnico, conciso y limpio en español para el CRM.
   Conserva los datos útiles (con quién se habló, qué hay que hacer, teléfonos, fechas).

Responde ÚNICAMENTE en formato JSON:
{
  "estado": "Concedido" | "Denegado" | "En gestión",
  "comentario": "Texto profesional redactado"
}
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        if (!response.ok) {
          motivoSinIA = `la IA respondió con error ${response.status}`;
        } else {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
            usoIA = true;
          } else {
            motivoSinIA = 'la IA no devolvió un resultado válido';
          }
        }
      } catch (err) {
        console.warn('Fallo al llamar a la IA:', err);
        motivoSinIA = 'no se pudo contactar con la IA';
      }
    }

    // Solo hay tres estados; cualquier otro valor se trata como "En gestión"
    if (parsedResult && !RESULT_OPTIONS.some(o => o.id === parsedResult.estado)) {
      parsedResult.estado = 'En gestión';
    }

    if (!parsedResult) {
      parsedResult = analizarDictadoLocal(textDictated);
    }

    if (parsedResult) {
      if (parsedResult.estado) {
        setResultado(parsedResult.estado);
      }
      if (parsedResult.comentario) {
        setComentario(prev => {
          const prevText = prev ? prev.trim() + '\n' : '';
          return prevText + parsedResult.comentario;
        });
      }
    }

    setIsAnalyzingAI(false);
    setAiStatusMsg(
      usoIA
        ? `✨ Analizada con IA: ${parsedResult.estado}. Revísala antes de guardar`
        : `Analizador local (${motivoSinIA}): ${parsedResult.estado}. Revísalo antes de guardar`
    );
    setTimeout(() => setAiStatusMsg(''), 8000);
  };

  // =========================================================================
  // SUBMIT CON SEPARACIÓN ESTRICTA DE ESTADO Y COMENTARIO
  // =========================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resultado) {
      setFormError('Por favor, selecciona una opción para la visita.');
      return;
    }

    setFormError('');
    setSaving(true);
    
    try {
      let formattedNextDate = '';
      if (proximaVisita) {
        const [year, month, day] = proximaVisita.split('-');
        formattedNextDate = `${day}/${month}/${year}`;
      }

      // 1. ESTADO OFICIAL DEL EDIFICIO (Solo CONCEDIDO, DENEGADO o EN GESTION)
      let estadoOficialEdificio = 'EN GESTION';
      if (resultado === 'Concedido') {
        estadoOficialEdificio = 'CONCEDIDO';
      } else if (resultado === 'Denegado') {
        estadoOficialEdificio = 'DENEGADO';
      } else {
        estadoOficialEdificio = 'EN GESTION';
      }

      // 2. COMENTARIO DEL EDIFICIO (Columna K)
      // Si no escribió comentario, se usa el nombre del estado elegido
      const comentarioFinal = comentario.trim() || resultado;

      // Guardar con Estado Oficial limpio y Comentario correcto
      await onSave(gescal, estadoOficialEdificio, comentarioFinal, formattedNextDate);
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
          type="button"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-slate-800 text-lg">Registrar Visita</span>
      </div>

      {/* Target Building Info */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
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

      {/* BOTÓN ASISTENTE DE VOZ IA */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-md shadow-blue-500/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center">
            <Sparkles size={14} className="mr-1.5" />
            Asistente por Voz con IA
          </span>
          {isAnalyzingAI && <Loader size={16} className="animate-spin text-blue-200" />}
        </div>

        <p className="text-xs text-blue-100 leading-relaxed">
          Dicta la visita por voz. La IA seleccionará el estado y redactará las observaciones.
        </p>

        {isRecording ? (
          <button
            type="button"
            onClick={stopVoiceDictation}
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 animate-pulse transition"
          >
            <MicOff size={16} />
            <span>Detener Dictado (Grabando...)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startVoiceDictation}
            disabled={isAnalyzingAI}
            className="w-full py-3 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition active:scale-95 shadow-xs disabled:opacity-50"
          >
            <Mic size={16} className="text-blue-600" />
            <span>🎙️ Dictar visita por voz</span>
          </button>
        )}

        {aiStatusMsg && (
          <p className="text-[11px] font-semibold text-amber-200 text-center pt-1 animate-fade-in">
            {aiStatusMsg}
          </p>
        )}
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold">
            {formError}
          </div>
        )}

        {/* Outcome Selector */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <CheckSquare size={14} className="mr-1.5 text-slate-400" />
            Resultado de la visita *
          </label>
          
          <div className="grid grid-cols-2 gap-2.5">
            {RESULT_OPTIONS.map((opt) => {
              const isSelected = resultado === opt.id;
              
              let selectionStyle = isSelected 
                ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30 text-blue-900 font-bold scale-[1.01]' 
                : 'border-slate-100 text-slate-700';
              
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setResultado(opt.id);
                    setFormError('');
                  }}
                  className={`border py-3 px-3 rounded-xl text-xs text-left transition select-none flex items-center justify-between cursor-pointer min-h-[48px] active:scale-95 ${opt.color} ${selectionStyle}`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Free Comment */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
            <MessageSquare size={14} className="mr-1.5 text-slate-400" />
            Comentarios o notas
          </label>
          <textarea
            rows={3}
            placeholder="Detalles de la conversación, contacto del presidente, observaciones..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2.5 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 transition"
          />
        </div>

        {/* Next Visit Date */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center">
              <Calendar size={14} className="mr-1.5 text-slate-400" />
              Planificar próxima visita
            </span>
            {proximaVisita && (
              <button 
                type="button" 
                onClick={() => setProximaVisita('')} 
                className="text-[11px] text-rose-500 font-normal hover:underline"
              >
                Limpiar
              </button>
            )}
          </label>

          {/* Quick Date Presets */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => addDaysToNextVisit(3)}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-medium rounded-lg transition"
            >
              +3 días
            </button>
            <button
              type="button"
              onClick={() => addDaysToNextVisit(7)}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-medium rounded-lg transition"
            >
              +1 sem.
            </button>
            <button
              type="button"
              onClick={() => addDaysToNextVisit(14)}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-medium rounded-lg transition"
            >
              +2 sem.
            </button>
            <button
              type="button"
              onClick={() => addDaysToNextVisit(30)}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-medium rounded-lg transition"
            >
              +1 mes
            </button>
          </div>

          <input
            type="date"
            value={proximaVisita}
            min={new Date().toISOString().split('T')[0]}
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
            className="w-full py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl text-sm transition active:scale-95 disabled:opacity-50"
          >
            <span className="flex items-center justify-center space-x-1.5">
              <X size={16} />
              <span>Cancelar</span>
            </span>
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-blue-500/10 active:scale-95 disabled:opacity-50"
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