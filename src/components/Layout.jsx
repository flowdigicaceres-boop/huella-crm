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
  X 
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 select-none pb-16 safe-bottom">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            H
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Huella CRM
          </span>
        </div>

        {/* Sync and Connection Indicators */}
        <div className="flex items-center space-x-3">
          {/* Connection status */}
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
            isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {isOnline ? (
              <>
                <Wifi size={13} className="mr-1" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={13} className="mr-1" />
                <span>Sin Red</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          <button
            onClick={handleRefresh}
            disabled={loading || syncing}
            className={`p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95 ${
              syncing || loading ? 'animate-spin text-blue-600' : ''
            }`}
            title="Sincronizar ahora"
          >
            <RefreshCw size={20} />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              setTempUrl(scriptUrl);
              setShowSettings(true);
            }}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            title="Ajustes"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 md:px-6">
        {/* Banner Error/Aviso */}
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start space-x-2">
            <span className="font-semibold">Nota:</span>
            <span>{error}</span>
          </div>
        )}

        {/* Content Children */}
        {loading && edificios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm font-medium">Cargando base de datos...</p>
          </div>
        ) : (
          <div className="fade-in">{children}</div>
        )}
      </main>

      {/* Bottom Nav Bar (Mobile-first Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 flex justify-around items-center py-2 px-1 shadow-lg md:max-w-lg md:mx-auto md:rounded-t-2xl">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'dashboard' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home size={22} className={currentTab === 'dashboard' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Inicio</span>
        </button>

        <button
          onClick={() => setCurrentTab('list')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'list' || currentTab === 'detail' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={22} className={currentTab === 'list' || currentTab === 'detail' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Edificios</span>
        </button>

        <button
          onClick={() => setCurrentTab('map')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'map' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Map size={22} className={currentTab === 'map' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Mapa</span>
        </button>

        <button
          onClick={() => setCurrentTab('jornada')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'jornada' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar size={22} className={currentTab === 'jornada' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Jornada</span>
        </button>

        <button
          onClick={() => setCurrentTab('stats')}
          className={`flex flex-col items-center flex-1 py-1 transition ${
            currentTab === 'stats' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart3 size={22} className={currentTab === 'stats' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-1">Estadísticas</span>
        </button>
      </nav>

      {/* Settings Modal (CORS-friendly configuration) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-scale-up">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Ajustes de Conexión</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  URL de Google Apps Script Web App
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                  required
                />
                <p className="mt-2 text-xs text-slate-400 leading-normal">
                  Pega la URL obtenida al desplegar tu Apps Script como aplicación web accesible para "Cualquiera" (Anyone).
                </p>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition"
                >
                  Guardar y Sincronizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
