import { Medication, MedicationDose, WaterLog, PostureBaseline, PostureSensitivity } from '../types';

export const getTodayKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    name: 'Vitamin D3 & K2',
    dosage: '1000 IU',
    form: 'capsule',
    instructions: 'Take with breakfast and healthy fat',
    color: 'amber',
    scheduledTimes: ['08:30'],
    currentQuantity: 24,
    refillThreshold: 7,
    active: true,
  },
  {
    id: 'med-2',
    name: 'Omega-3 EPA/DHA',
    dosage: '1200 mg',
    form: 'capsule',
    instructions: 'Take with lunch or main meal',
    color: 'emerald',
    scheduledTimes: ['13:00'],
    currentQuantity: 18,
    refillThreshold: 5,
    active: true,
  },
  {
    id: 'med-3',
    name: 'Magnesium Glycinate',
    dosage: '200 mg',
    form: 'pill',
    instructions: 'Take 45 mins before sleep for relaxation',
    color: 'indigo',
    scheduledTimes: ['21:30'],
    currentQuantity: 14,
    refillThreshold: 5,
    active: true,
  },
];

export const loadStoredMedications = (): Medication[] => {
  try {
    const raw = localStorage.getItem('align_medications');
    if (!raw) return DEFAULT_MEDICATIONS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MEDICATIONS;
  } catch {
    return DEFAULT_MEDICATIONS;
  }
};

export const saveStoredMedications = (meds: Medication[]) => {
  try {
    localStorage.setItem('align_medications', JSON.stringify(meds));
  } catch {}
};

export const loadTodayDoses = (medications: Medication[]): MedicationDose[] => {
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem(`align_doses_${today}`);
    let doses: MedicationDose[] = raw ? JSON.parse(raw) : [];

    // Ensure all active medications have doses initialized for today
    const existingDoseKeys = new Set(doses.map((d) => `${d.medicationId}_${d.scheduledTime}`));

    let addedAny = false;
    for (const med of medications) {
      if (!med.active) continue;
      for (const time of med.scheduledTimes) {
        const key = `${med.id}_${time}`;
        if (!existingDoseKeys.has(key)) {
          doses.push({
            id: `dose_${med.id}_${time}_${Date.now()}`,
            medicationId: med.id,
            scheduledTime: time,
            date: today,
            status: 'upcoming',
            takenAt: null,
          });
          addedAny = true;
        }
      }
    }

    if (addedAny || !raw) {
      localStorage.setItem(`align_doses_${today}`, JSON.stringify(doses));
    }
    return doses;
  } catch {
    return [];
  }
};

export const saveTodayDoses = (doses: MedicationDose[]) => {
  const today = getTodayKey();
  try {
    localStorage.setItem(`align_doses_${today}`, JSON.stringify(doses));
  } catch {}
};

export const loadTodayWaterLogs = (): { target: number; logs: WaterLog[] } => {
  const today = getTodayKey();
  try {
    const rawTarget = localStorage.getItem('align_water_target');
    const target = rawTarget ? parseInt(rawTarget, 10) : 2500;

    const rawLogs = localStorage.getItem(`align_water_${today}`);
    if (rawLogs) {
      return { target, logs: JSON.parse(rawLogs) };
    } else {
      // Starter log for today so users see instant progress
      const initialLogs: WaterLog[] = [
        {
          id: `water_${Date.now() - 3600000 * 3}`,
          amountMl: 350,
          timestamp: Date.now() - 3600000 * 3,
          label: 'Morning wake-up glass',
        },
        {
          id: `water_${Date.now() - 3600000}`,
          amountMl: 250,
          timestamp: Date.now() - 3600000,
          label: 'Desk hydration',
        },
      ];
      localStorage.setItem(`align_water_${today}`, JSON.stringify(initialLogs));
      return { target, logs: initialLogs };
    }
  } catch {
    return { target: 2500, logs: [] };
  }
};

export const saveTodayWaterLogs = (logs: WaterLog[], target?: number) => {
  const today = getTodayKey();
  try {
    localStorage.setItem(`align_water_${today}`, JSON.stringify(logs));
    if (target) {
      localStorage.setItem('align_water_target', target.toString());
    }
  } catch {}
};

export const loadPostureSettings = (): {
  baseline: PostureBaseline | null;
  sensitivity: PostureSensitivity;
  alertDelay: number;
  soundEnabled: boolean;
} => {
  try {
    const rawBaseline = localStorage.getItem('align_posture_baseline');
    const baseline = rawBaseline ? JSON.parse(rawBaseline) : null;
    const sensitivity = (localStorage.getItem('align_posture_sensitivity') as PostureSensitivity) || 'balanced';
    const rawDelay = localStorage.getItem('align_posture_delay');
    const alertDelay = rawDelay ? parseInt(rawDelay, 10) : 3;
    const rawSound = localStorage.getItem('align_posture_sound');
    const soundEnabled = rawSound !== null ? rawSound === 'true' : true;

    return { baseline, sensitivity, alertDelay, soundEnabled };
  } catch {
    return { baseline: null, sensitivity: 'balanced', alertDelay: 3, soundEnabled: true };
  }
};

export const savePostureSettings = (settings: {
  baseline?: PostureBaseline | null;
  sensitivity?: PostureSensitivity;
  alertDelay?: number;
  soundEnabled?: boolean;
}) => {
  try {
    if (settings.baseline !== undefined) {
      localStorage.setItem('align_posture_baseline', JSON.stringify(settings.baseline));
    }
    if (settings.sensitivity) {
      localStorage.setItem('align_posture_sensitivity', settings.sensitivity);
    }
    if (settings.alertDelay) {
      localStorage.setItem('align_posture_delay', settings.alertDelay.toString());
    }
    if (settings.soundEnabled !== undefined) {
      localStorage.setItem('align_posture_sound', settings.soundEnabled.toString());
    }
  } catch {}
};
