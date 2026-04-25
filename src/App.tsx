/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type FormEvent } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Mail, 
  RefreshCw, 
  ShieldAlert,
  Database,
  Smartphone,
  ChevronRight,
  Plus,
  Link,
  Settings,
  Shield,
  Copy,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Chip {
  id: string;
  name: string;
  api_url: string;
}

interface Log {
  id: string;
  chip_id: string;
  status: 'online' | 'offline';
  payload: any;
  created_at: string;
}

interface Alert {
  id: string;
  chip_id: string;
  message: string;
  severity: 'critical' | 'warning';
  created_at: string;
}

export default function App() {
  const [data, setData] = useState<{ chips: Chip[]; recentLogs: Log[]; activeAlerts: Alert[]; webhookRaw: any[] }>({
    chips: [],
    recentLogs: [],
    activeAlerts: [],
    webhookRaw: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChip, setNewChip] = useState({ id: '', name: '', api_url: '' });
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Falha ao buscar status do servidor');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setFeedback({ type: 'error', msg: 'Erro de conexão com o banco ou tabelas inexistentes.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRegisterChip = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch('/api/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChip)
      });
      
      const result = await res.json();

      if (res.ok) {
        setNewChip({ id: '', name: '', api_url: '' });
        setShowAddForm(false);
        setFeedback({ type: 'success', msg: 'Chip registrado com sucesso!' });
        fetchStatus();
      } else {
        setFeedback({ type: 'error', msg: result.message || 'Erro ao salvar chip no banco.' });
      }
    } catch (err) {
      console.error('Failed to register chip:', err);
      setFeedback({ type: 'error', msg: 'Erro na requisição. Verifique o console.' });
    }
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      await fetch('/api/watchdog', { method: 'POST' });
      await fetchStatus();
      setFeedback({ type: 'success', msg: 'Watchdog executado!' });
    } catch (err) {
      console.error('Manual check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSimulateSignal = async (chip_id: string) => {
    try {
      await fetch('/api/webhooks/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chip_id, status: 'online', type: 'test_simulation' })
      });
      fetchStatus();
      setFeedback({ type: 'success', msg: 'Sinal simulado! O chip agora conta como ativo.' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChip = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este chip e seus logs?')) return;
    try {
      await fetch(`/api/chips/${id}`, { method: 'DELETE' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50 backdrop-blur-sm shadow-xl">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="text-sky-500 w-8 h-8" />
              CHIP<span className="text-sky-500">WATCH</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-medium">Gestão de Chips e Monitoramento</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-6 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 transition-all flex items-center gap-2 shadow-lg shadow-sky-900/20 active:scale-95"
            >
              <Plus className="w-5 h-5" /> Adicionar Chip
            </button>
            <button 
              onClick={handleCheckNow}
              disabled={isChecking}
              className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50 group"
              title="Forçar Verificação do Watchdog"
            >
              <RefreshCw className={cn("w-5 h-5", isChecking && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Webhook & APN Guide Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-sky-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-4 text-sky-400">
              <Link className="w-5 h-5" />
              <h2 className="font-bold uppercase text-xs tracking-wider">URL do Webhook (POST)</h2>
            </div>
            <p className="text-xs text-slate-400 mb-3">Configure seu rastreador para enviar dados para:</p>
            <div className="bg-black/50 p-4 rounded-xl border border-slate-800 group relative">
              <code className="text-sky-300 text-[11px] font-mono break-all leading-relaxed">
                {window.location.origin}/api/webhooks/signal
              </code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/signal`);
                  setFeedback({ type: 'success', msg: 'URL copiada!' });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy className="w-3 h-3 text-slate-300" />
              </button>
            </div>
            <div className="mt-4 flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Shield className="w-3 h-3" /> Endpoint Público
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Zap className="w-3 h-3" /> Formato: JSON
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <Settings className="w-5 h-5" />
              <h2 className="font-bold uppercase text-xs tracking-wider">Parâmetros APN Algar/TIM</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">Ponto de Acesso (APN)</p>
                <p className="text-slate-200 font-mono text-xs">voxter.br</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">Login & Senha</p>
                <p className="text-slate-200 font-mono text-xs">algar / algar</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">PIN Code (Obrigatório)</p>
                <p className="text-slate-200 font-mono text-xs">1212</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">Rede Preferencial</p>
                <p className="text-slate-200 text-xs">2G/4G ALG-5</p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Alert Notification */}
        <AnimatePresence>
          {feedback && (
            <motion.div 
              key="feedback-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "p-3 rounded-lg text-sm font-medium mb-4",
                feedback.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}
            >
              {feedback.msg}
            </motion.div>
          )}
          {data.activeAlerts.length > 0 && (
            <motion.div 
              key="alerts-status-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
                <div className="bg-red-500 rounded-lg p-2 shrink-0 animate-pulse">
                  <ShieldAlert className="text-white w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-500">Alertas Ativos</h3>
                  <p className="text-sm text-red-400/80">Existem chips com falha de comunicação detectada.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Chip Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              key="add-chip-form-panel"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
            >
              <form onSubmit={handleRegisterChip} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">ID do Chip (IMEI)</label>
                  <input 
                    required
                    value={newChip.id}
                    onChange={e => setNewChip({...newChip, id: e.target.value})}
                    placeholder="ex: 86940..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Nome do Objeto</label>
                  <input 
                    required
                    value={newChip.name}
                    onChange={e => setNewChip({...newChip, name: e.target.value})}
                    placeholder="ex: Caminhão Scania" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">URL/API do Chip (Opcional)</label>
                  <input 
                    value={newChip.api_url}
                    onChange={e => setNewChip({...newChip, api_url: e.target.value})}
                    placeholder="http://ip-do-chip/api" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
                <button type="submit" className="w-full bg-sky-500 text-white rounded-lg py-2 text-sm font-bold hover:bg-sky-600 transition-colors">
                  Salvar Chip
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.chips.map((chip, idx) => {
            const lastLog = data.recentLogs.find(l => l.chip_id === chip.id);
            const isOnline = lastLog?.status === 'online';
            return (
              <div key={`chip-${chip.id}-${idx}`} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-slate-100">{chip.name}</h3>
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{chip.id}</p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                    isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500"
                  )}>
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lastLog ? new Date(lastLog.created_at).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">{chip.api_url ? 'API Linked' : 'No URL'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-2 gap-2">
                   <div className="text-center p-2 bg-slate-950/50 rounded-lg">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Bateria</p>
                      <p className="text-sm font-mono">{lastLog?.payload?.battery ?? '--'}%</p>
                   </div>
                   <div className="text-center p-2 bg-slate-950/50 rounded-lg">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Logs</p>
                      <p className="text-sm font-mono">{data.recentLogs.filter(l => l.chip_id === chip.id).length}</p>
                   </div>
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => handleSimulateSignal(chip.id)}
                    className="flex-1 text-[10px] bg-sky-500/10 text-sky-400 py-2 rounded-lg font-bold hover:bg-sky-500 hover:text-white transition-all flex items-center justify-center gap-1"
                  >
                    <Activity className="w-3 h-3" /> Sinal
                  </button>
                  <button 
                    onClick={() => handleDeleteChip(chip.id)}
                    className="bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity & Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
           <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-500" />
              Logs Recentes (Supabase)
            </h2>
            <div className="bg-slate-900 shadow-xl rounded-2xl border border-slate-800 overflow-hidden">
               <div className="divide-y divide-slate-800">
                {data.recentLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Aguardando comunicações...</div>
                ) : (
                  data.recentLogs.map((log, idx) => (
                    <div key={`log-${log.id}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-800/20">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", log.status === 'online' ? 'bg-emerald-500' : 'bg-red-500')} />
                        <div>
                          <p className="text-xs font-bold">{log.chip_id}</p>
                          <p className="text-[9px] text-slate-500 uppercase">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">
                        {log.status}
                      </span>
                    </div>
                  ))
                )}
               </div>
            </div>
           </div>

           <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Notificações de Falha
            </h2>
            <div className="space-y-3">
               {data.activeAlerts.map((alert, idx) => (
                 <div key={`alert-${alert.id}-${idx}`} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl relative group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-red-400">{alert.message}</p>
                        <p className="text-[10px] text-red-500/50 mt-1 uppercase font-mono">
                          {new Date(alert.created_at).toLocaleString()} | ID: {alert.chip_id}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleResolveAlert(alert.id)}
                        className="bg-emerald-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Marcar como resolvido"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               ))}
               {data.activeAlerts.length === 0 && (
                 <div className="p-8 text-center text-slate-700 font-medium italic">
                    Nenhuma anormalidade detectada.
                 </div>
               )}
            </div>
           </div>
        </div>

        {/* Webhook Raw Debug Section */}
        <div className="space-y-4 pb-20">
           <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-400" />
              Diagnóstico de Sinais (Webhook Raw)
            </h2>
            <div className="bg-slate-900 shadow-xl rounded-2xl border border-slate-800 overflow-hidden">
               <div className="p-4 bg-black/20 border-b border-slate-800 flex justify-between items-center">
                  <p className="text-[10px] text-slate-500 uppercase font-black">Últimas comunicações brutas interceptadas</p>
               </div>
               <div className="divide-y divide-slate-800/50">
                  {data.webhookRaw.length === 0 ? (
                    <div className="p-12 text-center text-slate-700 italic">Aguardando sinais externos...</div>
                  ) : (
                    data.webhookRaw.map((raw, idx) => (
                      <div key={`raw-${raw.id}-${idx}`} className="p-4 hover:bg-slate-800/20 transition-colors flex flex-col md:flex-row gap-4 justify-between">
                        <div className="space-y-1 flex-1">
                          <p className="text-[10px] font-mono text-slate-500">{new Date(raw.created_at).toLocaleString()}</p>
                          <div className="bg-black/40 p-3 rounded-lg border border-slate-800/50 mt-1">
                             <pre className="text-[10px] text-sky-400/80 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(raw.payload, null, 2)}
                             </pre>
                          </div>
                        </div>
                         <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase">
                               {raw.method}
                            </span>
                            {raw.payload?.chip_id || raw.payload?.imei ? (
                               <span className="text-[9px] text-emerald-500 font-black uppercase">✔ Reconhecido</span>
                            ) : (
                               <span className="text-[9px] text-amber-500 font-black uppercase">⚠ Desconhecido</span>
                            )}
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
        </div>

      </div>
    </div>
  );
}
