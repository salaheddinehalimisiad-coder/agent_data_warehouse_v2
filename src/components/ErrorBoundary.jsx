import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-slate-950 text-slate-200 p-6 text-center">
          <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 mb-6">
            <AlertTriangle size={32} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-rose-600 mb-2">
            System Fault Detected
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            A critical error occurred in the UI layer. The system has automatically captured the trace.
          </p>
          <div className="bg-black/50 p-4 rounded-xl text-left border border-white/10 overflow-auto max-w-2xl max-h-48 w-full text-xs text-rose-300 font-mono mb-6">
             {this.state.error && this.state.error.toString()}
             <br />
             {this.state.errorInfo && this.state.errorInfo.componentStack}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold text-sm"
          >
            <RefreshCw size={16} /> Reboot System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
