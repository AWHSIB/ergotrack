/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PostureTracker } from './components/posture/PostureTracker';
import { WaterTracker } from './components/water/WaterTracker';
import { MedicineTracker } from './components/medicine/MedicineTracker';
import { WellnessDashboard } from './components/dashboard/WellnessDashboard';
import { wellnessAudio } from './utils/audio';
import { loadTodayWaterLogs, saveTodayWaterLogs } from './utils/storage';
import {
  Activity,
  Droplets,
  Pill,
  LayoutDashboard,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'posture' | 'water' | 'medicine'>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Global shared state for overview calculations
  const [postureScore, setPostureScore] = useState(88);
  const initialWater = loadTodayWaterLogs();
  const [hydrationMl, setHydrationMl] = useState(
    initialWater.logs.reduce((sum, l) => sum + l.amountMl, 0)
  );
  const [hydrationTargetMl, setHydrationTargetMl] = useState(initialWater.target);
  const [takenMedDoses, setTakenMedDoses] = useState(1);
  const [totalMedDoses, setTotalMedDoses] = useState(3);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    wellnessAudio.setSoundEnabled(next);
  };

  const handleQuickAddWater = (amount: number) => {
    const currentLogs = loadTodayWaterLogs();
    const newLog = {
      id: `water_${Date.now()}`,
      amountMl: amount,
      timestamp: Date.now(),
      label: 'Quick dash sip',
    };
    const updated = [newLog, ...currentLogs.logs];
    saveTodayWaterLogs(updated, currentLogs.target);
    setHydrationMl(updated.reduce((sum, l) => sum + l.amountMl, 0));
    wellnessAudio.playWaterSip();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-stone-900">Align & Nourish</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/80">
                  AI Wellness
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Posture Biofeedback · Hydration Studio · Medicine Schedule
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Functional interactive buttons) */}
          <nav className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('posture')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'posture'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-700" />
              <span>Posture</span>
            </button>

            <button
              onClick={() => setActiveTab('water')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'water'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-sky-600" />
              <span>Hydration</span>
            </button>

            <button
              onClick={() => setActiveTab('medicine')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'medicine'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Pill className="w-3.5 h-3.5 text-indigo-600" />
              <span>Medicine</span>
            </button>
          </nav>

          {/* Audio Tone Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                soundEnabled
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-white border-stone-200 text-stone-400 hover:text-stone-700'
              }`}
              title={soundEnabled ? 'Chimes active (Web Audio)' : 'All sounds muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <WellnessDashboard
            postureScore={postureScore}
            hydrationMl={hydrationMl}
            hydrationTargetMl={hydrationTargetMl}
            takenMedDoses={takenMedDoses}
            totalMedDoses={totalMedDoses}
            onNavigateTab={setActiveTab}
            onQuickAddWater={handleQuickAddWater}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />
        )}

        {activeTab === 'posture' && (
          <PostureTracker onScoreUpdate={setPostureScore} />
        )}

        {activeTab === 'water' && (
          <WaterTracker
            onProgressUpdate={(current, target) => {
              setHydrationMl(current);
              setHydrationTargetMl(target);
            }}
          />
        )}

        {activeTab === 'medicine' && (
          <MedicineTracker
            onAdherenceUpdate={(taken, total) => {
              setTakenMedDoses(taken);
              setTotalMedDoses(total);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Align & Nourish · Ergonomic Biofeedback & Habit Architecture</span>
          </div>
          <p className="text-[11px] text-stone-400">
            Client-side computer vision ensures webcam frames never leave your local browser session.
          </p>
        </div>
      </footer>
    </div>
  );
}
