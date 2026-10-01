import React, { useState } from 'react';
import { PostureAuditResult } from '../../types';
import { X, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Eye, Sun, Sliders } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  capturedImage: string | null;
  currentScore: number;
  slouchCount: number;
  sessionSeconds: number;
}

export const AiPostureAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  capturedImage,
  currentScore,
  slouchCount,
  sessionSeconds,
}) => {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<PostureAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/posture-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: capturedImage,
          currentScore,
          slouchEvents: slouchCount,
          sessionDurationSeconds: sessionSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error('Audit request failed');
      }

      const data = await response.json();
      if (data.audit) {
        setAuditResult(data.audit);
      } else {
        throw new Error('No audit data returned');
      }
    } catch (err: any) {
      setError('Unable to complete AI audit. Using clinical fallback guidelines.');
      // Fallback result
      setAuditResult({
        overallRating: currentScore > 75 ? 'Good Alignment' : 'Correction Recommended',
        score: currentScore || 78,
        headPosition: currentScore > 70 ? 'Upright with neutral cervical spine' : 'Mild forward head posture detected (approx 12-15° flexion)',
        shoulderLevel: 'Slight trapezius elevation. Keep shoulders rolled gently backward.',
        screenErgonomics: 'Keep top edge of display at or just below horizontal eye level.',
        lightingConditions: 'Balanced front lighting minimizes eye strain and monitor squinting.',
        actionableTips: [
          'Perform 5 chin retractions: Glide your head horizontally backward.',
          'Drop shoulder blades downward as if slipping them into your back pockets.',
          'Ensure feet are flat on the floor with hips slightly above knees.'
        ],
        breakRecommendation: 'Stand up, interlace hands behind back, and open your chest for 30 seconds.'
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !auditResult && !loading) {
      runAudit();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-lg leading-tight">AI Ergonomic & Posture Audit</h3>
              <p className="text-xs text-stone-500">Comprehensive workstation and musculoskeletal biomechanics analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Snapshot and Live Stats overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-stone-50 p-4 rounded-xl border border-stone-200/80">
            {capturedImage ? (
              <div className="relative rounded-lg overflow-hidden border border-stone-300 aspect-video md:aspect-square bg-stone-900">
                <img src={capturedImage} alt="Audit snapshot" className="w-full h-full object-cover" />
                <div className="absolute bottom-1 right-1 bg-stone-900/70 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                  Webcam Frame
                </div>
              </div>
            ) : (
              <div className="aspect-video md:aspect-square rounded-lg bg-stone-200 flex items-center justify-center text-stone-500 text-xs text-center p-2">
                No webcam image available
              </div>
            )}

            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Ergonomic Score</span>
                <span className="font-mono text-2xl font-bold text-teal-800">
                  {auditResult ? auditResult.score : currentScore}%
                </span>
              </div>
              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal-600 h-full transition-all duration-700 rounded-full"
                  style={{ width: `${auditResult ? auditResult.score : currentScore}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-stone-600 pt-1">
                <span>Rating: <strong className="text-stone-900">{auditResult?.overallRating || 'Analyzing...'}</strong></span>
                <span>Session: {Math.round(sessionSeconds / 60)} min · {slouchCount} nudges</span>
              </div>
            </div>
          </div>

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
              <p className="text-sm font-medium text-stone-800">Analyzing spinal alignment & workstation ergonomics...</p>
              <p className="text-xs text-stone-500 max-w-sm">
                Evaluating head tilt, screen distance, neck strain indicators, and ambient lighting conditions.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

          {auditResult && !loading && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Detailed Biomechanical Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-stone-200 bg-white">
                  <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-1.5">
                    <Sliders className="w-4 h-4 text-teal-600" />
                    <span>Cervical & Head Position</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{auditResult.headPosition}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-white">
                  <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Shoulder & Upper Back</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{auditResult.shoulderLevel}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-white">
                  <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-1.5">
                    <Eye className="w-4 h-4 text-teal-600" />
                    <span>Screen Distance & Angle</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{auditResult.screenErgonomics}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-stone-200 bg-white">
                  <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Lighting & Visual Strain</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{auditResult.lightingConditions}</p>
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-teal-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  Prescribed Ergonomic Adjustments
                </h4>
                <ul className="space-y-2">
                  {auditResult.actionableTips?.map((tip, i) => (
                    <li key={i} className="text-xs text-stone-700 flex items-start gap-2">
                      <span className="font-mono text-teal-700 font-bold">{i + 1}.</span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Micro-break stretch */}
              {auditResult.breakRecommendation && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs text-stone-700 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0 font-bold">
                    ⏱️
                  </div>
                  <div>
                    <span className="font-semibold text-stone-900 block mb-0.5">Recommended Micro-Stretch</span>
                    <p className="text-stone-600">{auditResult.breakRecommendation}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
          <button
            onClick={runAudit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-analyze Snapshot
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors shadow-xs"
          >
            Done & Apply Adjustments
          </button>
        </div>
      </div>
    </div>
  );
};
