// src/components/MapaTab.jsx
// Pestaña "Mapa": por defecto se ve por PON; el mapa antiguo de edificios sigue disponible.
import React, { useState } from 'react';
import MapView from './MapView';
import MapaPons from './MapaPons';

export default function MapaTab({ edificios, pons, webError, setSelectedBuildingGescal, setCurrentTab, onSelectPon }) {
  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem('huella_map_modo') || 'pons'; } catch (e) { return 'pons'; }
  });

  const cambiar = (nuevo) => {
    setModo(nuevo);
    try { localStorage.setItem('huella_map_modo', nuevo); } catch (e) { /* sin almacenamiento */ }
  };

  const boton = (id, texto) => (
    <button
      type="button"
      onClick={() => cambiar(id)}
      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
        modo === id ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex bg-slate-200/70 rounded-xl p-1">
        {boton('pons', 'Por PON')}
        {boton('edificios', 'Por edificio')}
      </div>
      {modo === 'pons' ? (
        <MapaPons pons={pons} webError={webError} onSelectPon={onSelectPon} />
      ) : (
        <div className="[&>div]:!h-[calc(100vh-190px)]">
          <MapView
            edificios={edificios}
            setSelectedBuildingGescal={setSelectedBuildingGescal}
            setCurrentTab={setCurrentTab}
          />
        </div>
      )}
    </div>
  );
}
