import React from 'react';
import {
  Activity,
  Droplets,
  Pill,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Flame,
  Volume2,
  VolumeX,
  Smile,
  Zap,
  Heart
} from 'lucide-react';
import { wellnessAudio } from '../../utils/audio';

interface Props {
  postureScore: number;
  hydrationMl: number;
  hydrationTargetMl: number;
  takenMedDoses: number;
  totalMedDoses: number;
  onNavigateTab: (tab: 'dashboard' | 'posture' | 'water' | 'medicine') => void;
  onQuickAddWater: (amount: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const WellnessDashboard: React.FC<Props> = ({
  postureScore,
  hydrationMl,
  hydrationTargetMl,
  takenMedDoses,
  totalMedDoses,
  onNavigateTab,
  onQuickAddWater,
  soundEnabled,
  onToggleSound,
}) => {
  const hydrationPercent = Math.min(100, Math.round((hydrationMl / (hydrationTargetMl || 2500)) * 100));
  const medPercent = totalMedDoses > 0 ? Math.round((takenMedDoses / totalMedDoses) * 100) : 100;

  // Composite Daily Wellness Index
  const compositeScore = Math.round((postureScore * 0.4) + (hydrationPercent * 0.35) + (medPercent * 0.25));

  return (
    <div className="space-y-6">
      {/* Top Welcome & Score Header */}
      <div className="bg-linear-to-br from-stone-900 via-stone-800 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative background accents */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-medium backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Ergonomic & Health Routine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Daily Wellness & Alignment Hub
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Real-time biomechanics camera biofeedback, scheduled hydration pacing, and precise medication adherence to thrive at your desk.
            </p>
          </div>

          {/* Big Composite Gauge */}
          <div className="flex items-center gap-5 bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl shrink-0 self-start md:self-auto">
            <div className="text-center">
              <span className="block text-[10px] uppercase tracking-wider text-teal-200 font-medium">Daily Wellness Index</span>
              <span className="font-mono text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                {compositeScore}
              </span>
              <span className="text-[10px] text-stone-300">/ 100 points</span>
            </div>

            <div className="h-12 w-px bg-white/20" />

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-teal-200 font-medium">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Active Streak: 5 Days</span>
              </div>
              <div className="text-[11px] text-stone-300">
                All 3 pillars active today
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Three Pillars Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Posture Pillar */}
        <div
          onClick={() => onNavigateTab('posture')}
          className="bg-white rounded-2xl border border-stone-200 hover:border-teal-400/80 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-mono text-xl font-bold text-teal-800">{postureScore}%</span>
            </div>
            <h3 className="font-semibold text-stone-900 text-base group-hover:text-teal-800 transition-colors">
              AI Posture Tracker
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Camera computer vision monitors cervical spine alignment with audible warning beep alert when below 70%.
            </p>
          </div>

          <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-teal-700 font-medium">Launch Camera HUD</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 group-hover:text-teal-700 transition-all" />
          </div>
        </div>

        {/* 2. Hydration Pillar */}
        <div
          onClick={() => onNavigateTab('water')}
          className="bg-white rounded-2xl border border-stone-200 hover:border-sky-400/80 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="font-mono text-xl font-bold text-sky-700">{hydrationPercent}%</span>
            </div>
            <h3 className="font-semibold text-stone-900 text-base group-hover:text-sky-700 transition-colors">
              Hydration Studio
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              {hydrationMl} of {hydrationTargetMl} ml logged. Keeps metabolic energy high and prevents dry eyes.
            </p>
          </div>

          <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-sky-700 font-medium">View Intake Bottle</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 group-hover:text-sky-700 transition-all" />
          </div>
        </div>

        {/* 3. Medicine Pillar */}
        <div
          onClick={() => onNavigateTab('medicine')}
          className="bg-white rounded-2xl border border-stone-200 hover:border-indigo-400/80 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Pill className="w-5 h-5" />
              </div>
              <span className="font-mono text-xl font-bold text-indigo-700">{medPercent}%</span>
            </div>
            <h3 className="font-semibold text-stone-900 text-base group-hover:text-indigo-800 transition-colors">
              Medication Schedule
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              {takenMedDoses} of {totalMedDoses} doses taken today. Alerts for timing and refills.
            </p>
          </div>

          <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-indigo-700 font-medium">Open Intake Schedule</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 group-hover:text-indigo-700 transition-all" />
          </div>
        </div>
      </div>

      {/* Quick Action Dock & Ergonomic Wellness Routine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Instant Quick Actions</span>
          </h3>

          <div className="space-y-2.5">
            <button
              onClick={() => {
                onQuickAddWater(250);
              }}
              className="w-full p-3 rounded-xl border border-stone-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-stone-900">Drank a Glass of Water</div>
                  <div className="text-[11px] text-stone-500">+250 ml to today's hydration</div>
                </div>
              </div>
              <span className="text-xs font-mono font-medium text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded">
                +250ml
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('posture')}
              className="w-full p-3 rounded-xl border border-stone-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-stone-900">Check Spine Alignment</div>
                  <div className="text-[11px] text-stone-500">Live camera posture detection HUD</div>
                </div>
              </div>
              <span className="text-xs font-medium text-teal-800 bg-teal-100/60 px-2 py-0.5 rounded">
                Open
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('medicine')}
              className="w-full p-3 rounded-xl border border-stone-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-stone-900">Check Medicine Schedule</div>
                  <div className="text-[11px] text-stone-500">Review upcoming doses & stock</div>
                </div>
              </div>
              <span className="text-xs font-medium text-indigo-800 bg-indigo-100/60 px-2 py-0.5 rounded">
                Review
              </span>
            </button>
          </div>
        </div>

        {/* Desk Ergonomic Tips & Micro-Break Protocol */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Ergonomic Desk Routine Protocol</span>
            </h3>
            <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-medium">
              Physical Therapist Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <span className="font-semibold text-stone-900 block">The 20-20-20 Eye Rest Rule</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Every 20 minutes, look at an object at least 20 feet away for 20 seconds. Relaxes ciliary eye muscles and reduces subconscious monitor squinting.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <span className="font-semibold text-stone-900 block">Chin Retraction (Tuck)</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Draw your chin straight backward like making a gentle double chin. Realigns cervical vertebrae C1-C7 directly over shoulders.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <span className="font-semibold text-stone-900 block">Scapular Squeeze</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Pull shoulder blades backward and downward for 10 seconds. Counters rounded desk shoulders and eases upper trapezius stiffness.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <span className="font-semibold text-stone-900 block">Consistent Water Sips</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Drinking smaller sips of water every 30-45 minutes ensures superior cellular hydration compared to chugging large quantities at once.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
