// src/App.jsx
import React, { useState } from 'react';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EdificiosLista from './components/EdificiosLista';
import EdificioFicha from './components/EdificioFicha';
import RegistrarVisitaForm from './components/RegistrarVisitaForm';
import MapaTab from './components/MapaTab';
import PonesLista from './components/PonesLista';
import PonDetalle from './components/PonDetalle';
import MiJornada from './components/MiJornada';
import Estadisticas from './components/Estadisticas';

function App() {
  const {
    edificios,
    edificiosConWeb,
    pons,
    webError,
    webGuardado,
    visitas,
    loading,
    syncing,
    error,
    isOnline,
    scriptUrl,
    saveScriptUrl,
    fetchData,
    registrarVisita
  } = useGoogleSheets();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedBuildingGescal, setSelectedBuildingGescal] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  
  const [previousTab, setPreviousTab] = useState('dashboard');

  const handleTabChange = (tab) => {
    if (currentTab !== 'detail' && currentTab !== 'register-visit') {
      setPreviousTab(currentTab);
    }
    setCurrentTab(tab);
  };

  // PON abierto desde la lista o desde el mapa; "volver" regresa a donde se abrió
  const [selectedPonId, setSelectedPonId] = useState(null);
  const [ponBackTab, setPonBackTab] = useState('pons');

  const handleSelectPon = (ponId) => {
    setSelectedPonId(ponId);
    setPonBackTab(currentTab === 'map' ? 'map' : 'pons');
    setCurrentTab('pon-detail');
  };

  const handleSelectBuilding = (gescal) => {
    setSelectedBuildingGescal(gescal);
    if (currentTab !== 'detail' && currentTab !== 'register-visit') {
      setPreviousTab(currentTab);
    }
    setCurrentTab('detail');
  };

  const handleRegisterVisitSave = async (gescal, resultado, comentario, proximaVisita) => {
    await registrarVisita(gescal, resultado, comentario, proximaVisita);
    setCurrentTab('detail');
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            edificios={edificios}
            visitas={visitas}
            setCurrentTab={handleTabChange}
            setSelectedBuildingGescal={handleSelectBuilding}
            setGlobalSearch={setGlobalSearch}
          />
        );
      case 'list':
        return (
          <EdificiosLista
            edificios={edificios}
            setSelectedBuildingGescal={handleSelectBuilding}
            setCurrentTab={handleTabChange}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
          />
        );
      case 'map':
        return (
          <MapaTab
            edificios={edificios}
            pons={pons}
            webError={webError}
            setSelectedBuildingGescal={handleSelectBuilding}
            setCurrentTab={handleTabChange}
            onSelectPon={handleSelectPon}
          />
        );
      case 'pons':
        return (
          <PonesLista
            pons={pons}
            webError={webError}
            webGuardado={webGuardado}
            onSelectPon={handleSelectPon}
          />
        );
      case 'pon-detail':
        return (
          <PonDetalle
            pon={pons?.pons.find((p) => p.id === selectedPonId) || null}
            onBack={() => setCurrentTab(ponBackTab)}
            onSelectBuilding={handleSelectBuilding}
          />
        );
      case 'jornada':
        return (
          <MiJornada
            edificios={edificios}
            visitas={visitas}
            setSelectedBuildingGescal={handleSelectBuilding}
            setCurrentTab={handleTabChange}
          />
        );
      case 'stats':
        return (
          <Estadisticas
            edificios={edificios}
            visitas={visitas}
          />
        );
      case 'detail':
        return (
          <EdificioFicha
            gescal={selectedBuildingGescal}
            edificios={edificiosConWeb}
            visitas={visitas}
            onBack={() => setCurrentTab(previousTab)}
            onRegisterVisitClick={() => handleTabChange('register-visit')}
          />
        );
      case 'register-visit':
        return (
          <RegistrarVisitaForm
            gescal={selectedBuildingGescal}
            edificios={edificiosConWeb}
            onSave={handleRegisterVisitSave}
            onCancel={() => setCurrentTab('detail')}
          />
        );
      default:
        return (
          <div className="text-center py-10">
            <p className="text-slate-500">Vista no encontrada.</p>
          </div>
        );
    }
  };

  return (
    <Layout
      currentTab={currentTab}
      setCurrentTab={handleTabChange}
      loading={loading}
      syncing={syncing}
      error={error}
      isOnline={isOnline}
      scriptUrl={scriptUrl}
      saveScriptUrl={saveScriptUrl}
      fetchData={fetchData}
      edificios={edificios}
      visitas={visitas}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;