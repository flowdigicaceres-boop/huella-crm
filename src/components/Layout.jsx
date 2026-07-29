// src/components/Layout.jsx
import React, { useState } from 'react';
import { 
  Home, 
  Map, 
  List, 
  Calendar, 
  BarChart3, 
  Settings, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  X,
  Trash2
} from 'lucide-react';

export default function Layout({ 
  currentTab, 
  setCurrentTab, 
  loading, 
  syncing, 
  error, 
  isOnline, 
  scriptUrl, 
  saveScriptUrl, 
  fetchData, 
  edificios = [],
  children 
}) {
  const [showSettings, setShowSettings] = useState(!scriptUrl);
  const [tempUrl, setTempUrl] = useState(scriptUrl);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveScriptUrl(tempUrl);
    setShowSettings(false);
    fetchData(true);
  };

  const handleRefresh = () => {
    if (scriptUrl) {
      fetchData(true);
    } else {
      setShowSettings(true);
    }
  };

  const handleClearCacheAndReload = () => {
    if (window.confirm('¿Deseas vaciar la memoria caché del móvil y volver a descargar la base de datos limpia?')) {
      try {
        indexedDB.deleteDatabase('HuellaCRM_DB');
        localStorage.clear();
        window.location.reload(true);
      } catch (e) {
        window.location.reload(true);
      }
    }
  };

  const isEdificiosActive = currentTab === 'list' || currentTab === 'detail' || currentTab === 'register-visit';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 select-none pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-xs">
        <div 
          onClick={() => setCurrentTab('dashboard')}
          className="flex items-center space-x-2 cursor-pointer active:scale-95 transition"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            H
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Huella CRM
          </span>
        </div>

        {/* Sync and Connection Indicators */}
        <div className="flex items-center space-x-2.5">
          <div className={`flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
            isOnline ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            {isOnline ? (
              <>
                <Wifi size={12} className="mr-1" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="mr-1" />
                <span>Sin Red</span>
              </>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || syncing}
            type="button"
            className={`p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95 ${
              syncing || loading ? 'animate-spin text-blue-600' : ''
            }`}
            title="Sincronizar con Google Sheets"
          >
            <RefreshCw size={18} />
          </button>

          <button
            onClick={() => {
              setTempUrl(scriptUrl);
              setShowSettings(true);
            }}
            type="button"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            title="Ajustes de Conexión"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 md:px-6">
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-medium flex items-start space-x-2 shadow-xs">
            <span className="font-bold shrink-0">Nota:</span>
            <span>{error}</span>
          </div>
        )}

        {loading && edificios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Cargando base de datos local...</p>
          </div>
        ) : (
          <div className="animate-fade-in">{children}</div>
        )}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center py-2 px-1 shadow-lg md:max-w-lg md:mx-auto md:rounded-t-2xl">
        <button
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'dashboard' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home size={20} className={currentTab === 'dashboard' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('list')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            isEdificiosActive ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={20} className={isEdificiosActive ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Edificios</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('map')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'map' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Map size={20} className={currentTab === 'map' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Mapa</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('jornada')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'jornada' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar size={20} className={currentTab === 'jornada' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Jornada</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('stats')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'stats' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart3 size={20} className={currentTab === 'stats' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Estadísticas</span>
        </button>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-up">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">Ajustes de Conexión</h3>
              <button 
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  URL de Google Apps Script Web App
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                  required
                />
              </div>

              {/* BOTÓN ROJO PARA VACIAR CACHÉ ANTIGUA */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClearCacheAndReload}
                  className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-rose-200"
                >
                  <Trash2 size={14} />
                  <span>Vaciar Memoria Caché y Recargar</span>
                </button>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}