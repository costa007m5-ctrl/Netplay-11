import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Database, Link as LinkIcon, CheckCircle2, ShieldCheck, Play, Video } from 'lucide-react';
import Hls from 'hls.js';

export default function AdminTeraboxTab() {
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTest = async () => {
    if (!testUrl) return;
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const res = await fetch(`/api/terabox-pro?url=${encodeURIComponent(testUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na requisição');
      setTestResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const videoUrlToPlay = React.useMemo(() => {
    if (!testResult) return null;
    return testResult.url || testResult.stream_url || testResult.video_url || testResult.src || (testResult.data && testResult.data.url) || 
      (testResult.list && testResult.list.length > 0 && (testResult.list[0].url || testResult.list[0].dlink));
  }, [testResult]);

  useEffect(() => {
    if (!videoUrlToPlay || !videoRef.current) return;
    
    let hls: Hls | null = null;
    
    if (videoUrlToPlay.includes('.m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(videoUrlToPlay);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = videoUrlToPlay;
      }
    } else {
      videoRef.current.src = videoUrlToPlay;
    }
    
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoUrlToPlay]);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-cyan-400">
          <Database size={36} /> Terabox Pro API
        </h2>
        <p className="text-gray-400 text-sm mt-2">
          Integração automática para links Terabox e KingX usando a API XAPIverse.
        </p>
      </div>

      <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/30 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="text-cyan-400" size={24} />
            <h3 className="text-xl font-bold">Status da Configuração</h3>
        </div>
        <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div> Ativo e Configurado no Servidor
        </div>
        <p className="text-sm text-gray-400 mt-2">
          O servidor está configurado para utilizar a chave de API <code>xAPIverse-Key</code>.
          O endpoint local <code>/api/terabox-pro</code> processará os links.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <LinkIcon className="text-gray-400" size={20} />
          Testador de Links
        </h3>
        <p className="text-sm text-gray-400 mb-4">Cole um link do Terabox ou KingX abaixo para simular a extração direta da API.</p>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            placeholder="Ex: https://terabox.com/..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleTest}
            disabled={loading || !testUrl}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={18} />}
            Testar
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {videoUrlToPlay && (
          <div className="mt-8 rounded-xl overflow-hidden border border-white/10 bg-black">
            <div className="bg-white/5 p-3 flex items-center gap-2 border-b border-white/10">
              <Video size={16} className="text-cyan-400" />
              <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">Preview do Vídeo</span>
            </div>
            <video 
              ref={videoRef}
              controls 
              className="w-full aspect-video outline-none"
              autoPlay
            />
          </div>
        )}

        {testResult && (
          <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl overflow-x-auto">
            <h4 className="font-bold text-gray-300 mb-2 text-sm uppercase">Resultado da Extração</h4>
            <pre className="text-xs text-green-400 whitespace-pre-wrap">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}
