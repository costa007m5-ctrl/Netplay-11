import React from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Captura erros globais que travam a tela e mostra mensagem em vez de tela preta
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      const missing: string[] = [];
      const env = (import.meta as any).env || {};
      if (!env.VITE_TMDB_API_KEY) missing.push('VITE_TMDB_API_KEY');
      if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
      if (!env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
      return (
        <div style={{ minHeight: '100vh', background: '#111', color: '#fff', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#e50914', fontSize: 22, marginBottom: 12 }}>NetPlay — erro ao iniciar</h1>
          {missing.length > 0 && (
            <div style={{ background: '#330', border: '1px solid #aa0', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <p style={{ marginBottom: 8, fontWeight: 600 }}>Variáveis de ambiente faltando no Vercel:</p>
              <ul style={{ paddingLeft: 20 }}>
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
              <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                Vai em Vercel → Project → Settings → Environment Variables, adiciona as variáveis acima e faz Redeploy.
              </p>
            </div>
          )}
          <p style={{ marginBottom: 8 }}><strong>Mensagem do erro:</strong></p>
          <pre style={{ background: '#000', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
            {err.message}
            {err.stack ? '\n\n' + err.stack : ''}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>,
);
