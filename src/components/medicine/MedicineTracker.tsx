import React, { useState, useEffect } from 'react';
import { Medication, MedicationDose, MedicationForm } from '../../types';
import { wellnessAudio } from '../../utils/audio';
import {
  loadStoredMedications,
  saveStoredMedications,
  loadTodayDoses,
  saveTodayDoses,
  getTodayKey,
} from '../../utils/storage';
import {
  Pill,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  X,
  Package,
  RotateCcw,
  Check,
  AlertTriangle,
  Send,
  HelpCircle,
  Trash2
} from 'lucide-react';

interface Props {
  onAdherenceUpdate?: (takenCount: number, totalCount: number) => void;
}

export const MedicineTracker: React.FC<Props> = ({ onAdherenceUpdate }) => {
  const [medications, setMedications] = useState<Medication[]>(loadStoredMedications);
  const [doses, setDoses] = useState<MedicationDose[]>(() => loadTodayDoses(medications));
  const [activeTab, setActiveTab] = useState<'schedule' | 'cabinet'>('schedule');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // AI Assistant state
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Form state for adding new medication
  const [newMed, setNewMed] = useState<{
    name: string;
    dosage: string;
    form: MedicationForm;
    instructions: string;
    timeInput: string;
    scheduledTimes: string[];
    quantity: number;
    refillThreshold: number;
  }>({
    name: '',
    dosage: '',
    form: 'capsule',
    instructions: '',
    timeInput: '08:00',
    scheduledTimes: ['08:00'],
    quantity: 30,
    refillThreshold: 5,
  });

  // Calculate adherence
  const totalDoses = doses.length;
  const takenDoses = doses.filter((d) => d.status === 'taken').length;
  const adherencePercent = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;

  // Persist doses and notify parent
  useEffect(() => {
    saveTodayDoses(doses);
    if (onAdherenceUpdate) {
      onAdherenceUpdate(takenDoses, totalDoses);
    }
  }, [doses, takenDoses, totalDoses, onAdherenceUpdate]);

  // Persist medications
  useEffect(() => {
    saveStoredMedications(medications);
  }, [medications]);

  // Determine current dose urgency
  const getDoseUrgency = (scheduledTime: string, status: string) => {
    if (status === 'taken') return 'taken';
    if (status === 'skipped') return 'skipped';

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);

    const diffMinutes = (scheduledDate.getTime() - now.getTime()) / (1000 * 60);

    // If within 45 mins before or after
    if (diffMinutes <= 45 && diffMinutes >= -90) {
      return 'due';
    } else if (diffMinutes < -90) {
      return 'overdue';
    }
    return 'upcoming';
  };

  const markDoseStatus = (doseId: string, medId: string, newStatus: 'taken' | 'skipped' | 'upcoming') => {
    setDoses((prev) =>
      prev.map((dose) => {
        if (dose.id === doseId) {
          return {
            ...dose,
            status: newStatus,
            takenAt: newStatus === 'taken' ? Date.now() : null,
          };
        }
        return dose;
      })
    );

    if (newStatus === 'taken') {
      wellnessAudio.playPillTaken();
      // Decrement inventory
      setMedications((prev) =>
        prev.map((med) => {
          if (med.id === medId && med.currentQuantity > 0) {
            return { ...med, currentQuantity: med.currentQuantity - 1 };
          }
          return med;
        })
      );
    }
  };

  const refillMedication = (medId: string, amount: number = 30) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, currentQuantity: m.currentQuantity + amount } : m))
    );
    wellnessAudio.playPostureCalibrated();
  };

  const deleteMedication = (medId: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== medId));
    setDoses((prev) => prev.filter((d) => d.medicationId !== medId));
  };

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name.trim() || newMed.scheduledTimes.length === 0) return;

    const medId = `med_${Date.now()}`;
    const created: Medication = {
      id: medId,
      name: newMed.name.trim(),
      dosage: newMed.dosage.trim() || '1 dose',
      form: newMed.form,
      instructions: newMed.instructions.trim() || 'Take with water',
      color: 'teal',
      scheduledTimes: newMed.scheduledTimes,
      currentQuantity: newMed.quantity,
      refillThreshold: newMed.refillThreshold,
      active: true,
    };

    const updatedMeds = [...medications, created];
    setMedications(updatedMeds);

    // Create doses for today
    const today = getTodayKey();
    const newDoses: MedicationDose[] = created.scheduledTimes.map((time) => ({
      id: `dose_${medId}_${time}_${Date.now()}`,
      medicationId: medId,
      scheduledTime: time,
      date: today,
      status: 'upcoming',
      takenAt: null,
    }));

    setDoses((prev) => [...prev, ...newDoses]);
    setShowAddModal(false);
    setNewMed({
      name: '',
      dosage: '',
      form: 'capsule',
      instructions: '',
      timeInput: '08:00',
      scheduledTimes: ['08:00'],
      quantity: 30,
      refillThreshold: 5,
    });
  };

  const addTimeToNewMed = () => {
    if (!newMed.scheduledTimes.includes(newMed.timeInput)) {
      setNewMed({
        ...newMed,
        scheduledTimes: [...newMed.scheduledTimes, newMed.timeInput].sort(),
      });
    }
  };

  const removeTimeFromNewMed = (time: string) => {
    setNewMed({
      ...newMed,
      scheduledTimes: newMed.scheduledTimes.filter((t) => t !== time),
    });
  };

  // AI Wellness Assistant query
  const askAiAssistant = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    try {
      const response = await fetch('/api/wellness-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery,
          userContext: {
            medications: medications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              times: m.scheduledTimes,
              instructions: m.instructions,
            })),
          },
        }),
      });

      const data = await response.json();
      setAiResponse(data.advice || 'Follow consistent daily timing for optimal habit formation.');
    } catch {
      setAiResponse(
        'For general supplements: Vitamin D3 & Omega-3 are best absorbed with meals containing healthy fats. Magnesium is ideal in the evening before bed. Always review specific medications with your pharmacist.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Sort doses chronologically
  const sortedDoses = [...doses].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Medicine & Supplement Intake Schedule</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <span>Precision adherence timing</span>
            <span aria-hidden="true">·</span>
            <span>Adherence today: {adherencePercent}%</span>
            <span aria-hidden="true">·</span>
            <span>{takenDoses} of {totalDoses} doses taken</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Helper Button */}
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 transition-colors text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Timing Assistant</span>
          </button>

          {/* Add Medication */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white transition-colors text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Segmented View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex p-1 bg-stone-100 rounded-lg max-w-xs">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'schedule' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Today's Timeline ({sortedDoses.length})
          </button>
          <button
            onClick={() => setActiveTab('cabinet')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'cabinet' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Medicine Cabinet ({medications.length})
          </button>
        </div>

        {/* Refill warning badge if any med has low supply */}
        {medications.some((m) => m.currentQuantity <= m.refillThreshold) && (
          <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Refill supplies needed</span>
          </div>
        )}
      </div>

      {/* Tab 1: Today's Timeline View */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {sortedDoses.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-400 space-y-2">
              <Pill className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-sm font-medium text-stone-700">No scheduled doses for today</p>
              <p className="text-xs">Click "Add Medication" to configure your daily supplements or prescriptions.</p>
            </div>
          ) : (
            sortedDoses.map((dose) => {
              const med = medications.find((m) => m.id === dose.medicationId);
              if (!med) return null;

              const urgency = getDoseUrgency(dose.scheduledTime, dose.status);
              const isTaken = dose.status === 'taken';
              const isSkipped = dose.status === 'skipped';
              const isDueNow = urgency === 'due' || urgency === 'overdue';

              return (
                <div
                  key={dose.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isTaken
                      ? 'bg-stone-50/70 border-stone-200 opacity-80'
                      : isDueNow
                      ? 'bg-amber-50/40 border-amber-300 shadow-xs ring-1 ring-amber-200'
                      : 'bg-white border-stone-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Time indicator */}
                    <div
                      className={`w-14 h-12 rounded-xl flex flex-col items-center justify-center font-mono shrink-0 border ${
                        isTaken
                          ? 'bg-stone-100 border-stone-200 text-stone-500'
                          : isDueNow
                          ? 'bg-amber-500 border-amber-600 text-white font-bold'
                          : 'bg-teal-50 border-teal-200 text-teal-800'
                      }`}
                    >
                      <span className="text-xs font-semibold leading-none">{dose.scheduledTime}</span>
                      <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-80">
                        {parseInt(dose.scheduledTime.split(':')[0], 10) >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>

                    {/* Medication info */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`font-semibold text-sm ${
                            isTaken ? 'line-through text-stone-500' : 'text-stone-900'
                          }`}
                        >
                          {med.name}
                        </h4>
                        <span className="text-xs text-stone-500 font-mono">({med.dosage})</span>
                      </div>
                      <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="capitalize">{med.form}</span>
                        <span aria-hidden="true">·</span>
                        <span>{med.instructions}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {isTaken ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-teal-700 flex items-center gap-1 font-medium bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                        </span>
                        <button
                          onClick={() => markDoseStatus(dose.id, med.id, 'upcoming')}
                          className="p-1.5 text-stone-400 hover:text-stone-700 text-xs rounded hover:bg-stone-100"
                          title="Undo taken status"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isSkipped ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500 italic bg-stone-100 px-2.5 py-1 rounded-lg">
                          Skipped
                        </span>
                        <button
                          onClick={() => markDoseStatus(dose.id, med.id, 'upcoming')}
                          className="p-1.5 text-stone-400 hover:text-stone-700 text-xs rounded hover:bg-stone-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => markDoseStatus(dose.id, med.id, 'skipped')}
                          className="px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                          Skip
                        </button>

                        <button
                          onClick={() => markDoseStatus(dose.id, med.id, 'taken')}
                          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shadow-xs ${
                            isDueNow
                              ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                              : 'bg-teal-700 hover:bg-teal-800 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark as Taken</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Medicine Cabinet & Inventory View */}
      {activeTab === 'cabinet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medications.map((med) => {
            const isLow = med.currentQuantity <= med.refillThreshold;
            return (
              <div
                key={med.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-stone-900 text-sm">{med.name}</h4>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">{med.dosage}</p>
                    </div>
                    <span className="capitalize text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                      {med.form}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{med.instructions}</p>

                  <div className="mt-3 text-xs text-stone-500">
                    <span className="text-stone-400 block mb-1">Scheduled Times:</span>
                    <div className="flex flex-wrap gap-1">
                      {med.scheduledTimes.map((time, idx) => (
                        <span key={idx} className="font-mono bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded text-[11px]">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">Remaining Inventory:</span>
                    <span
                      className={`font-mono font-semibold ${
                        isLow ? 'text-amber-600' : 'text-stone-900'
                      }`}
                    >
                      {med.currentQuantity} doses left
                    </span>
                  </div>

                  {isLow && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Low stock alert! Consider refilling soon.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => refillMedication(med.id, 30)}
                      className="px-2.5 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md border border-teal-200 transition-colors"
                    >
                      + Refill (30 pills)
                    </button>

                    <button
                      onClick={() => deleteMedication(med.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 transition-colors rounded"
                      title="Remove medication"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleAddMedication}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-semibold text-stone-900 text-base">Add New Medication or Supplement</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-stone-700 font-medium">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zinc Picolinate or Blood Pressure"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-700 font-medium">Dosage</label>
                  <input
                    type="text"
                    placeholder="e.g. 50 mg or 1 tablet"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-stone-700 font-medium">Form</label>
                  <select
                    value={newMed.form}
                    onChange={(e) => setNewMed({ ...newMed, form: e.target.value as MedicationForm })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-600 capitalize bg-white"
                  >
                    <option value="capsule">Capsule</option>
                    <option value="pill">Pill / Tablet</option>
                    <option value="liquid">Liquid</option>
                    <option value="drops">Drops</option>
                    <option value="inhaler">Inhaler</option>
                    <option value="injection">Injection</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-stone-700 font-medium">Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Take with breakfast / empty stomach"
                  value={newMed.instructions}
                  onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-600"
                />
              </div>

              {/* Scheduled Times Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-stone-700 font-medium">Daily Scheduled Times</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newMed.timeInput}
                    onChange={(e) => setNewMed({ ...newMed, timeInput: e.target.value })}
                    className="px-3 py-1.5 border border-stone-200 rounded-lg font-mono text-xs focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={addTimeToNewMed}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium"
                  >
                    + Add Time
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {newMed.scheduledTimes.map((time) => (
                    <span
                      key={time}
                      className="inline-flex items-center gap-1 font-mono text-xs bg-teal-50 border border-teal-200 text-teal-800 px-2 py-0.5 rounded"
                    >
                      {time}
                      {newMed.scheduledTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeFromNewMed(time)}
                          className="hover:text-rose-600"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Supply Quantity */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-stone-700 font-medium">Initial Stock (units)</label>
                  <input
                    type="number"
                    min="1"
                    value={newMed.quantity}
                    onChange={(e) => setNewMed({ ...newMed, quantity: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-700 font-medium">Refill Alert Under</label>
                  <input
                    type="number"
                    min="1"
                    value={newMed.refillThreshold}
                    onChange={(e) => setNewMed({ ...newMed, refillThreshold: parseInt(e.target.value, 10) || 5 })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
              >
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 text-base leading-tight">AI Medication & Timing Coach</h3>
                  <p className="text-[11px] text-stone-500">Ask about absorption, optimal meal timing, or habit cues</p>
                </div>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1">
              <span className="text-[11px] text-stone-400">Sample questions:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Should I take Vitamin D with food or empty stomach?',
                  'Best time to take magnesium for sleep?',
                  'Can I take supplements together?',
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAiQuery(q);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md text-stone-700 text-left transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Query Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about your routine, timing, or supplement pairing..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAiAssistant()}
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-600"
              />
              <button
                onClick={askAiAssistant}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-3 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 transition-colors disabled:opacity-50 text-xs flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* AI Response Display */}
            {aiLoading && (
              <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-100 text-center text-xs text-stone-600">
                Analyzing clinical timing and pharmacokinetics guidelines...
              </div>
            )}

            {aiResponse && !aiLoading && (
              <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-100 space-y-2 text-xs text-stone-800 leading-relaxed">
                <p>{aiResponse}</p>
                <p className="text-[10px] text-stone-400 pt-1 border-t border-teal-100">
                  Disclaimer: This tool assists with personal wellness scheduling. Consult a healthcare provider or licensed pharmacist for medical diagnoses or drug interactions.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
