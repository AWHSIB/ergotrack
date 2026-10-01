export type PostureSensitivity = 'strict' | 'balanced' | 'relaxed';

export type PostureStatus = 
  | 'idle'
  | 'calibrating'
  | 'optimal'
  | 'good'
  | 'mild_slouch'
  | 'severe_slouch'
  | 'forward_tilt'
  | 'leaning'
  | 'no_face';

export interface PostureBaseline {
  headY: number;
  headScale: number;
  tiltAngle: number;
  forwardTiltBase?: number;
  calibratedAt: number;
}

export interface PostureMetrics {
  score: number; // 0-100
  status: PostureStatus;
  verticalDelta: number; // pixels / ratio difference from baseline
  forwardDistanceDelta: number; // scale difference (leaning into screen)
  forwardTiltAngle: number; // degrees of forward pitch (0° neutral, 15°+ forward head tilt)
  forwardTiltStatus: 'neutral' | 'mild_forward' | 'severe_forward';
  tiltAngle: number; // lateral roll degrees (left/right)
  shoulderSymmetry: number; // 0-100%
  inGoodAlignment: boolean;
}

export interface PostureSessionStats {
  sessionStartTime: number | null;
  totalActiveSeconds: number;
  goodPostureSeconds: number;
  slouchCount: number;
  historyScores: { time: number; score: number }[];
}

export interface PostureAuditResult {
  overallRating: string;
  score: number;
  headPosition: string;
  shoulderLevel: string;
  screenErgonomics: string;
  lightingConditions: string;
  actionableTips: string[];
  breakRecommendation: string;
}

export interface WaterLog {
  id: string;
  amountMl: number;
  timestamp: number;
  label?: string;
}

export type MedicationForm = 'pill' | 'capsule' | 'liquid' | 'drops' | 'inhaler' | 'injection';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  instructions: string;
  color: string;
  scheduledTimes: string[]; // ['08:00', '20:00']
  currentQuantity: number;
  refillThreshold: number;
  active: boolean;
}

export interface MedicationDose {
  id: string;
  medicationId: string;
  scheduledTime: string; // '08:00'
  date: string; // 'YYYY-MM-DD'
  status: 'upcoming' | 'due' | 'taken' | 'skipped';
  takenAt: number | null;
}

export interface WellnessOverview {
  overallScore: number;
  postureScore: number;
  hydrationPercent: number;
  medicineAdherencePercent: number;
  activeStreaks: {
    hydration: number;
    medication: number;
    posture: number;
  };
}
