// src/components/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-md mx-auto my-10 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl shadow-lg space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <h2 className="text-lg font-bold">¡Uy! Algo ha fallado</h2>
          </div>
          <p className="text-xs text-rose-700 leading-normal">
            La aplicación ha experimentado un error inesperado al renderizar esta pantalla:
          </p>
          <pre className="p-3.5 bg-rose-100 rounded-xl text-xs font-mono overflow-auto max-h-48 text-rose-900 border border-rose-200">
            {this.state.error && this.state.error.stack ? this.state.error.stack : (this.state.error && this.state.error.toString())}
          </pre>
          <div className="pt-2">
            <button
              onClick={() => {
                // Clear state and reload
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-500/10 active:scale-98 transition"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
