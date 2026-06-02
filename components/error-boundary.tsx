"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  sectionLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="rounded-md border border-red-500/20 bg-red-500/5 p-6 text-center dark:border-red-400/20 dark:bg-red-400/5"
        >
          <AlertTriangle className="mx-auto mb-3 text-red-500 dark:text-red-400" size={24} />
          <h3 className="text-sm font-bold text-red-700 dark:text-red-300">
            {this.props.sectionLabel
              ? `Blad w sekcji: ${this.props.sectionLabel}`
              : "Wystapil nieoczekiwany blad"}
          </h3>
          <p className="mt-1 text-xs text-red-600/70 dark:text-red-400/70">
            Nie udalo sie zaladowac tej czesci strony.
          </p>
          <button
            onClick={this.handleReset}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-white/80 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-white dark:border-red-400/20 dark:bg-white/5 dark:text-red-300 dark:hover:bg-white/10"
          >
            <RefreshCw size={12} />
            Sprobuj ponownie
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
