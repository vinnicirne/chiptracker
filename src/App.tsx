/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, type FormEvent } from 'react';
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
  Zap,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Chip {
  id: string;
  name: string;
  api_url: string;
  phone?: string;
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

  // Função para traduzir o log para o Suporte
  const formatLogType = (type: string) => {
    const types: Record<string, string> = {
      'ignitionOn': '🔥 Ignição LIGADA',
      'ignitionOff': '❄️ Ignição DESLIGADA',
      'overspeed': '⚠️ Excesso de Velocidade',
      'panico': '🚨 PÂNICO ATIVADO',
      'lowBattery': '🪫 Bateria Baixa',
      'test_simulation': '🧪 Sinal de Teste',
      'movement': '🚗 Veículo em Movimento',
      'stopped': '🛑 Veículo Parado',
    };
    return types[type] || type || 'Sinal Recebido';
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChip, setNewChip] = useState({ id: '', name: '', api_url: '', phone: '' });
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'https://chiptracker.vercel.app' 
    : '';

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
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
        setNewChip({ id: '', name: '', api_url: '', phone: '' });
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
          {data?.activeAlerts?.length > 0 && (
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
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Número do Chip</label>
                  <input 
                    value={newChip.phone}
                    onChange={e => setNewChip({...newChip, phone: e.target.value})}
                    placeholder="ex: 219999..." 
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
          {data?.chips?.map((chip, idx) => {
            const lastLog = data?.recentLogs?.find(l => l.chip_id === chip.id);
            const isOnline = lastLog?.status === 'online';
            return (
              <div 
                key={chip.id} 
                onClick={() => setSelectedChipId(selectedChipId === chip.id ? null : chip.id)}
                className={cn(
                  "relative group bg-slate-900 border transition-all duration-300 p-6 cursor-pointer",
                  selectedChipId === chip.id ? "border-sky-500 ring-1 ring-sky-500/50 rounded-2xl shadow-[0_0_30px_-10px_rgba(14,165,233,0.3)]" : "border-slate-800 hover:border-slate-700 rounded-xl"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <h3 className="text-lg font-black text-white tracking-tight">{chip.name}</h3>
                    </div>
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
                    <span className="truncate max-w-[100px]">{chip.phone || 'Sem número'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-2 gap-2">
                   <div className="text-center p-2 bg-slate-950/50 rounded-lg">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Bateria</p>
                      <p className="text-sm font-mono">{lastLog?.payload?.battery ?? '--'}%</p>
                   </div>
                   <button 
                      onClick={() => setSelectedChipId(selectedChipId === chip.id ? null : chip.id)}
                      className={cn(
                        "text-center p-2 rounded-lg transition-all border",
                        selectedChipId === chip.id ? "bg-sky-500/20 border-sky-500/50" : "bg-slate-950/50 border-transparent hover:border-slate-700"
                      )}
                    >
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Logs</p>
                      <p className={cn("text-sm font-mono", selectedChipId === chip.id ? "text-sky-400" : "")}>
                        {data?.recentLogs?.filter(l => l.chip_id === chip.id).length || 0}
                      </p>
                   </button>
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
             <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-500" />
                {selectedChipId ? 'Filtrando Dispositivo' : 'Logs Recentes (Supabase)'}
              </h2>
              {selectedChipId && (
                <button onClick={() => setSelectedChipId(null)} className="text-[10px] text-sky-400 font-bold uppercase hover:underline">
                  Ver Todos
                </button>
              )}
            </div>
            <div className="bg-slate-900 shadow-xl rounded-2xl border border-slate-800 overflow-hidden">
               <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                {data?.recentLogs?.filter(l => !selectedChipId || l.chip_id === selectedChipId).length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Nenhum log encontrado para este filtro.</div>
                ) : (
                  data.recentLogs
                    .filter(log => !selectedChipId || log.chip_id === selectedChipId)
                    .map((log, idx) => {
                      const chip = data.chips?.find(c => c.id === log.chip_id);
                      const vehicleName = chip ? chip.name : log.chip_id;
                      
                      return (
                        <React.Fragment key={`log-${log.id}-${idx}`}>
                          <div className="p-4 flex items-center justify-between hover:bg-slate-800/20">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", log.status === 'online' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50')} />
                              <div>
                                <p className="text-xs font-bold text-slate-200">
                                  {vehicleName}
                                </p>
                                <p className="text-[9px] text-slate-500 uppercase tracking-tighter">
                                  {new Date(log.created_at).toLocaleString()} | {formatLogType(log.payload?.type)}
                                </p>
                              </div>
                            </div>
                        <div className="flex items-center gap-2">
                          {log.payload?.location && (
                            <a 
                              href={`https://www.google.com/maps?q=${log.payload.location.lat},${log.payload.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-1 rounded hover:bg-sky-500 hover:text-white transition-all font-bold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              VER MAPA
                            </a>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedLogId(expandedLogId === log.id ? null : log.id);
                            }}
                            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-500 hover:text-sky-400"
                            title="Ver Log Técnico"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">
                            {log.status === 'online' ? 'SINAL OK' : 'OFFLINE'}
                          </span>
                        </div>
                      </div>
                      {expandedLogId === log.id && (
                        <div className="px-14 pb-4 animate-in fade-in slide-in-from-top-1">
                          <pre className="bg-slate-950 p-3 rounded-lg text-[10px] text-sky-500 font-mono overflow-x-auto border border-sky-500/10">
                            {JSON.stringify(log.payload || {}, null, 2)}
                          </pre>
                        </div>
                      )}
                    </React.Fragment>
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


      </div>
    </div>
  );
}
