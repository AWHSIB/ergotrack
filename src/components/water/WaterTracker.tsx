import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { WaterLog } from '../../types';
import { wellnessAudio } from '../../utils/audio';
import { loadTodayWaterLogs, saveTodayWaterLogs } from '../../utils/storage';
import {
  Droplets,
  Plus,
  RotateCcw,
  Sparkles,
  Clock,
  Trash2,
  Bell,
  BellOff,
  Sliders,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

interface Props {
  onProgressUpdate?: (current: number, target: number) => void;
}

export const WaterTracker: React.FC<Props> = ({ onProgressUpdate }) => {
  const initialData = loadTodayWaterLogs();
  const [targetMl, setTargetMl] = useState<number>(initialData.target);
  const [logs, setLogs] = useState<WaterLog[]>(initialData.logs);
  const [customInput, setCustomInput] = useState<string>('');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(45);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [secondsUntilReminder, setSecondsUntilReminder] = useState<number>(45 * 60);

  const totalCurrentMl = logs.reduce((sum, log) => sum + log.amountMl, 0);
  const progressPercent = Math.min(100, Math.round((totalCurrentMl / targetMl) * 100));
  const remainingMl = Math.max(0, targetMl - totalCurrentMl);

  // Sync to localStorage
  useEffect(() => {
    saveTodayWaterLogs(logs, targetMl);
    if (onProgressUpdate) {
      onProgressUpdate(totalCurrentMl, targetMl);
    }
  }, [logs, targetMl, totalCurrentMl, onProgressUpdate]);

  // Reminder countdown ticker
  useEffect(() => {
    if (!reminderEnabled) return;
    const interval = setInterval(() => {
      setSecondsUntilReminder((prev) => {
        if (prev <= 1) {
          wellnessAudio.playWaterSip();
          return reminderMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [reminderEnabled, reminderMinutes]);

  const addWater = (amount: number, label: string) => {
    if (amount <= 0) return;
    const newLog: WaterLog = {
      id: `water_${Date.now()}`,
      amountMl: amount,
      timestamp: Date.now(),
      label,
    };

    const newLogs = [newLog, ...logs];
    setLogs(newLogs);
    wellnessAudio.playWaterSip();

    // Check if target newly reached!
    const previousTotal = totalCurrentMl;
    if (previousTotal < targetMl && previousTotal + amount >= targetMl) {
      wellnessAudio.playMilestone();
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#0d9488', '#38bdf8', '#0284c7', '#5eead4'],
        });
      } catch {}
    }

    // Reset reminder timer
    setSecondsUntilReminder(reminderMinutes * 60);
  };

  const removeLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      addWater(parsed, `Custom (${parsed}ml)`);
      setCustomInput('');
      setShowCustomModal(false);
    }
  };

  const formatReminderTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Group logs by hour for distribution graph
  const hourlyData = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8; // 8 AM to 9 PM
    const logsInHour = logs.filter((l) => {
      const d = new Date(l.timestamp);
      return d.getHours() === hour;
    });
    const total = logsInHour.reduce((sum, item) => sum + item.amountMl, 0);
    return { hour, label: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'p' : 'a'}`, total };
  });
  const maxHourly = Math.max(500, ...hourlyData.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Hydration Studio & Water Intake</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <span>Metabolic fluid replenishment</span>
            <span aria-hidden="true">·</span>
            <span>Target: {targetMl} ml</span>
            <span aria-hidden="true">·</span>
            <span>Intake: {totalCurrentMl} ml</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Reminder Toggle */}
          <button
            onClick={() => setReminderEnabled(!reminderEnabled)}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              reminderEnabled
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-white border-stone-200 text-stone-500 hover:text-stone-800'
            }`}
            title="Hydration sip interval reminder"
          >
            {reminderEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {reminderEnabled ? `Next sip in ${formatReminderTime(secondsUntilReminder)}` : 'Reminders Off'}
            </span>
          </button>

          {/* Adjust Target Button */}
          <button
            onClick={() => setShowTargetModal(true)}
            className="px-3 py-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-stone-500" />
            <span>Target Goal</span>
          </button>
        </div>
      </div>

      {/* Main Hydration Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Liquid Cylinder & Quick Log */}
        <div className="lg:col-span-6 space-y-6">
          {/* Animated Water Cylinder Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
            {/* Visual Glass Cylinder */}
            <div className="relative w-44 h-64 rounded-3xl border-4 border-stone-300/80 bg-stone-100/60 overflow-hidden shadow-inner flex flex-col justify-end">
              {/* Target lines indicator markings */}
              <div className="absolute inset-y-0 right-2 flex flex-col justify-between py-5 text-[10px] font-mono text-stone-400 select-none pointer-events-none z-10">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
              </div>

              {/* Water Liquid Fill with Animated SVG Wave */}
              <div
                className="w-full bg-linear-to-t from-sky-600 via-sky-500 to-teal-400 transition-all duration-700 relative flex items-center justify-center"
                style={{ height: `${Math.max(8, progressPercent)}%` }}
              >
                {/* SVG Liquid Surface Wave */}
                <div className="absolute -top-3 inset-x-0 h-4 overflow-hidden leading-none">
                  <svg
                    viewBox="0 0 500 150"
                    preserveAspectRatio="none"
                    className="w-[200%] h-full text-teal-400 fill-current animate-pulse opacity-80"
                  >
                    <path d="M0.00,49.98 C150.00,150.00 349.20,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
                  </svg>
                </div>

                {/* Floating Bubbles */}
                <div className="absolute w-2 h-2 rounded-full bg-white/40 top-4 left-6 animate-ping" />
                <div className="absolute w-3 h-3 rounded-full bg-white/30 top-12 right-8 animate-pulse" />
              </div>

              {/* Foreground Numeric Status */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none drop-shadow-xs">
                <span className="font-mono text-3xl font-extrabold text-stone-900 tracking-tight">
                  {progressPercent}%
                </span>
                <span className="text-xs font-semibold text-stone-700">
                  {totalCurrentMl} <span className="font-normal text-stone-500">/ {targetMl} ml</span>
                </span>
              </div>
            </div>

            {/* Status Text under bottle */}
            <div className="mt-4 text-center space-y-1">
              {progressPercent >= 100 ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Daily Hydration Goal Completed!
                </div>
              ) : (
                <p className="text-xs text-stone-600">
                  <strong className="text-stone-900 font-mono">{remainingMl} ml</strong> remaining to reach optimal hydration today.
                </p>
              )}
            </div>
          </div>

          {/* Quick-Add Drink Buttons */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Quick Log Hydration
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => addWater(150, 'Small glass (150ml)')}
                className="p-3 rounded-xl border border-stone-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-center group active:scale-95"
              >
                <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🥛</div>
                <div className="font-medium text-xs text-stone-800">+150 ml</div>
                <div className="text-[10px] text-stone-400">Small Cup</div>
              </button>

              <button
                onClick={() => addWater(250, 'Standard glass (250ml)')}
                className="p-3 rounded-xl border border-stone-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-center group active:scale-95"
              >
                <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🫗</div>
                <div className="font-medium text-xs text-stone-800">+250 ml</div>
                <div className="text-[10px] text-stone-400">Standard Glass</div>
              </button>

              <button
                onClick={() => addWater(350, 'Mug / Tumbler (350ml)')}
                className="p-3 rounded-xl border border-stone-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-center group active:scale-95"
              >
                <div className="text-xl mb-1 group-hover:scale-110 transition-transform">☕</div>
                <div className="font-medium text-xs text-stone-800">+350 ml</div>
                <div className="text-[10px] text-stone-400">Large Mug</div>
              </button>

              <button
                onClick={() => addWater(500, 'Water Bottle (500ml)')}
                className="p-3 rounded-xl border border-stone-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-center group active:scale-95"
              >
                <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🍶</div>
                <div className="font-medium text-xs text-stone-800">+500 ml</div>
                <div className="text-[10px] text-stone-400">Sport Bottle</div>
              </button>
            </div>

            {/* Custom Log Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowCustomModal(true)}
                className="w-full py-2 px-3 text-xs font-medium text-stone-700 bg-stone-50 border border-stone-200 rounded-xl hover:bg-stone-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Custom Volume</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Hourly Pace & Intake Log History */}
        <div className="lg:col-span-6 space-y-6">
          {/* Hourly Distribution Chart */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
                <span>Intake Distribution (Today)</span>
              </h3>
              <span className="text-xs text-stone-400">Hourly logs</span>
            </div>

            <div className="h-32 flex items-end gap-1.5 pt-4 pb-1">
              {hourlyData.map((d, idx) => {
                const barHeight = d.total > 0 ? Math.max(12, Math.round((d.total / maxHourly) * 100)) : 4;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full relative flex flex-col items-center justify-end h-full">
                      {d.total > 0 && (
                        <div className="absolute -top-6 text-[9px] font-mono text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-100 px-1 rounded pointer-events-none z-10 whitespace-nowrap">
                          {d.total}ml
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          d.total > 0 ? 'bg-sky-500 hover:bg-sky-400' : 'bg-stone-100'
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 mt-1">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Intake Timeline */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>Intake History</span>
              </h3>
              <span className="text-xs text-stone-400">{logs.length} logged entries</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 flex-1">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No water logged yet today. Click one of the quick buttons to start!
                </div>
              ) : (
                logs.map((log) => {
                  const time = new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100/80 transition-colors border border-stone-200/60 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900 font-mono">+{log.amountMl} ml</div>
                          <div className="text-[11px] text-stone-500">{log.label || 'Water drink'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-stone-400 text-[11px]">{time}</span>
                        <button
                          onClick={() => removeLog(log.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors rounded"
                          title="Undo / Delete log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Target Adjustment Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4">
            <h3 className="font-semibold text-stone-900 text-base">Adjust Daily Hydration Goal</h3>
            <p className="text-xs text-stone-500">
              Select or enter your desired daily water intake target in milliliters.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[2000, 2500, 3000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTargetMl(preset)}
                  className={`py-2 text-xs font-mono font-medium rounded-lg border ${
                    targetMl === preset
                      ? 'border-sky-500 bg-sky-50 text-sky-900'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {preset} ml
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-stone-600">Custom Target (ml)</label>
              <input
                type="number"
                min="1000"
                max="6000"
                step="100"
                value={targetMl}
                onChange={(e) => setTargetMl(parseInt(e.target.value, 10) || 2000)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTargetModal(false)}
                className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Drink Volume Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCustomSubmit}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4"
          >
            <h3 className="font-semibold text-stone-900 text-base">Log Custom Fluid Amount</h3>
            <p className="text-xs text-stone-500">Enter the fluid amount in milliliters (ml).</p>

            <div className="space-y-1">
              <label className="text-xs text-stone-600">Amount (ml)</label>
              <input
                type="number"
                min="10"
                max="2000"
                step="25"
                placeholder="e.g. 400"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
              >
                Log Fluid
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
