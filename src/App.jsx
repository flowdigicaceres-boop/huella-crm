// src/App.jsx
import React, { useState } from 'react';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import EdificiosLista from './components/EdificiosLista';
import EdificioFicha from './components/EdificioFicha';
import RegistrarVisitaForm from './components/RegistrarVisitaForm';
import MapView from './components/MapView';
import MiJornada from './components/MiJornada';
import Estadisticas from './components/Estadisticas';

function App() {
  const {
    edificios,
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
  
  // Navigation history to allow back button to return to the correct origin
  const [previousTab, setPreviousTab] = useState('dashboard');

  const handleTabChange = (tab) => {
    // Record history before changing to detail/register views
    if (currentTab !== 'detail' && currentTab !== 'register-visit') {
      setPreviousTab(currentTab);
    }
    setCurrentTab(tab);
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
    setCurrentTab('detail'); // return to the building file
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
          <MapView
            edificios={edificios}
            setSelectedBuildingGescal={handleSelectBuilding}
            setCurrentTab={handleTabChange}
          />
        );
      case 'jornada':
        return (
          <MiJornada
            edificios={edificios}
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
            edificios={edificios}
            visitas={visitas}
            onBack={() => setCurrentTab(previousTab)}
            onRegisterVisitClick={() => handleTabChange('register-visit')}
          />
        );
      case 'register-visit':
        return (
          <RegistrarVisitaForm
            gescal={selectedBuildingGescal}
            edificios={edificios}
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
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
