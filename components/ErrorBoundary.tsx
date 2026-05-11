'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-rose-200/50 p-10 text-center border border-rose-100 relative overflow-hidden">
            {/* Decorative background charm */}
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-rose-100 rounded-full blur-3xl opacity-50" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mb-8 border border-rose-200">
                <AlertCircle className="w-10 h-10 text-rose-600" />
              </div>
              
              <h1 className="text-2xl font-black text-rose-900 uppercase tracking-tighter mb-4">
                Something went wrong
              </h1>
              
              <p className="text-sm font-medium text-rose-600/70 mb-8 leading-relaxed">
                The application encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {this.state.error && (
                <div className="w-full bg-rose-50 rounded-2xl p-4 mb-8 border border-rose-100 text-left overflow-hidden">
                  <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-2">Error Details</p>
                  <p className="text-[11px] font-mono text-rose-700 break-all leading-tight opacity-80">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 w-full">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 bg-rose-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-[0.97] shadow-lg shadow-rose-600/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex items-center justify-center gap-2 bg-rose-100 text-rose-900 font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-rose-200 transition-all active:scale-[0.97]"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
