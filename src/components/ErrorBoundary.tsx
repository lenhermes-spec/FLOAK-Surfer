import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unbekannter Anwendungsfehler',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full h-dvh bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-black tracking-tight">Etwas ist schiefgelaufen</h2>
            <p className="text-xs text-slate-300 leading-relaxed break-words max-w-full">
              Das Spiel ist auf ein technisches Problem gestoßen. Bitte lade die Seite neu.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Neu laden</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
