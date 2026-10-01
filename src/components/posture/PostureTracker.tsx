import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PostureBaseline, PostureMetrics, PostureSensitivity, PostureStatus } from '../../types';
import { wellnessAudio } from '../../utils/audio';
import { loadPostureSettings, savePostureSettings } from '../../utils/storage';
import { AiPostureAuditModal } from './AiPostureAuditModal';
import {
  Camera,
  CameraOff,
  Crosshair,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Activity,
  Play,
  Pause
} from 'lucide-react';

interface Props {
  onScoreUpdate?: (score: number) => void;
}

export const PostureTracker: React.FC<Props> = ({ onScoreUpdate }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Stored state
  const initialSettings = loadPostureSettings();
  const [baseline, setBaseline] = useState<PostureBaseline | null>(initialSettings.baseline);
  const [sensitivity, setSensitivity] = useState<PostureSensitivity>(initialSettings.sensitivity);
  const [alertDelay, setAlertDelay] = useState<number>(initialSettings.alertDelay);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialSettings.soundEnabled);

  // Runtime tracking state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [calibratingCountdown, setCalibratingCountdown] = useState<number | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<PostureMetrics>({
    score: 85,
    status: 'idle',
    verticalDelta: 0,
    forwardDistanceDelta: 0,
    forwardTiltAngle: 0,
    forwardTiltStatus: 'neutral',
    tiltAngle: 0,
    shoulderSymmetry: 92,
    inGoodAlignment: true,
  });

  // Session Stats
  const [sessionActiveSeconds, setSessionActiveSeconds] = useState(0);
  const [goodPostureSeconds, setGoodPostureSeconds] = useState(0);
  const [slouchCount, setSlouchCount] = useState(0);

  // Audit modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

  // Internal tracking refs for animation loop
  const slouchStartTimeRef = useRef<number | null>(null);
  const hasTriggeredAlertForCurrentSlouchRef = useRef(false);
  const lastWarningBeepTimeRef = useRef<number>(0);
  const smoothedHeadRef = useRef<{ x: number; y: number; scale: number; tilt: number }>({
    x: 0.5,
    y: 0.4,
    scale: 0.25,
    tilt: 0,
  });

  // Keep sound synthesizer in sync
  useEffect(() => {
    wellnessAudio.setSoundEnabled(soundEnabled);
    savePostureSettings({ soundEnabled });
  }, [soundEnabled]);

  useEffect(() => {
    savePostureSettings({ sensitivity, alertDelay });
  }, [sensitivity, alertDelay]);

  // Session timer
  useEffect(() => {
    if (!isCameraActive || isPaused) return;

    const interval = setInterval(() => {
      setSessionActiveSeconds((prev) => prev + 1);
      if (metrics.inGoodAlignment && metrics.status !== 'no_face') {
        setGoodPostureSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isCameraActive, isPaused, metrics.inGoodAlignment, metrics.status]);

  // Start webcam
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access is not supported by your browser or environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setIsPaused(false);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Failed to access camera. Please allow camera permissions in your browser.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser bar.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No video camera detected on your device.';
      }
      setCameraError(msg);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setIsCameraActive(false);
    setMetrics((prev) => ({ ...prev, status: 'idle' }));
  };

  // Trigger calibration routine (3 sec countdown)
  const startCalibration = () => {
    setCalibratingCountdown(3);
    const interval = setInterval(() => {
      setCalibratingCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          finishCalibration();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishCalibration = () => {
    const head = smoothedHeadRef.current;
    const newBaseline: PostureBaseline = {
      headY: head.y,
      headScale: head.scale,
      tiltAngle: head.tilt,
      forwardTiltBase: 0,
      calibratedAt: Date.now(),
    };
    setBaseline(newBaseline);
    savePostureSettings({ baseline: newBaseline });
    wellnessAudio.playPostureCalibrated();
  };

  // Reset baseline
  const resetBaseline = () => {
    setBaseline(null);
    savePostureSettings({ baseline: null });
  };

  // Capture snapshot for AI Audit
  const handleOpenAiAudit = () => {
    if (videoRef.current) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = videoRef.current.videoWidth || 640;
      tempCanvas.height = videoRef.current.videoHeight || 480;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
        setCapturedSnapshot(dataUrl);
      }
    }
    setIsAuditModalOpen(true);
  };

  // Computer Vision & Pose Analysis Loop
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isPaused) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video flipped horizontally for mirror effect
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -width, 0, width, height);
    ctx.restore();

    // Use downscaled offscreen canvas for fast pixel analytics
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = 160;
      offscreenCanvasRef.current.height = 120;
    }
    const offCanvas = offscreenCanvasRef.current;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    let detectedHead = { x: 0.5, y: 0.38, scale: 0.28, tilt: 0, confidence: 0 };

    if (offCtx) {
      offCtx.save();
      offCtx.scale(-1, 1);
      offCtx.drawImage(video, -160, 0, 160, 120);
      offCtx.restore();

      const imgData = offCtx.getImageData(0, 0, 160, 120);
      const data = imgData.data;

      // Skin tone and luminance centroid detection in top 70% of frame
      let totalWeight = 0;
      let sumX = 0;
      let sumY = 0;
      let leftEnergy = 0;
      let rightEnergy = 0;

      for (let y = 10; y < 90; y += 2) {
        for (let x = 20; x < 140; x += 2) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Normalized color heuristics for face/head region
          const isSkinLike = r > 70 && g > 40 && b > 25 && r > g && r > b && (r - g) >= 12;
          const brightness = (r + g + b) / 3;

          if (isSkinLike || (brightness > 85 && brightness < 235)) {
            const weight = isSkinLike ? 3 : 1;
            totalWeight += weight;
            sumX += x * weight;
            sumY += y * weight;

            if (x < 80) leftEnergy += weight;
            else rightEnergy += weight;
          }
        }
      }

      if (totalWeight > 120) {
        const normX = sumX / (totalWeight * 160);
        const normY = sumY / (totalWeight * 120);
        const estimatedScale = Math.min(0.45, Math.max(0.18, Math.sqrt(totalWeight / 2800)));
        const tiltApprox = ((rightEnergy - leftEnergy) / (totalWeight || 1)) * 35; // tilt degrees

        detectedHead = {
          x: normX,
          y: normY,
          scale: estimatedScale,
          tilt: tiltApprox,
          confidence: Math.min(1, totalWeight / 300),
        };
      }
    }

    // Temporal smoothing (exponential moving average)
    const smooth = smoothedHeadRef.current;
    const alpha = 0.18; // smooth response
    smooth.x = smooth.x * (1 - alpha) + detectedHead.x * alpha;
    smooth.y = smooth.y * (1 - alpha) + detectedHead.y * alpha;
    smooth.scale = smooth.scale * (1 - alpha) + detectedHead.scale * alpha;
    smooth.tilt = smooth.tilt * (1 - alpha) + detectedHead.tilt * alpha;

    // Evaluate Posture relative to Baseline
    const effectiveBaseline = baseline || {
      headY: 0.36,
      headScale: 0.28,
      tiltAngle: 0,
      calibratedAt: 0,
    };

    // Sensitivity tolerance threshold
    const tolFactor = sensitivity === 'strict' ? 0.75 : sensitivity === 'relaxed' ? 1.35 : 1.0;
    const verticalDelta = (smooth.y - effectiveBaseline.headY); // Positive means head dropped downward (slouching)
    const scaleDelta = (smooth.scale - effectiveBaseline.headScale); // Positive means leaning closer to screen
    const tiltDelta = Math.abs(smooth.tilt - effectiveBaseline.tiltAngle);

    // Forward Head Tilt (Pitch) Detection:
    // Measures cervical spine flexion / forward head posture (tech neck).
    // When tilting head forward: scale increases (approaching screen) and vertical position drops.
    const forwardScaleComp = Math.max(0, scaleDelta * 145);
    const forwardDropComp = Math.max(0, verticalDelta * 75);
    const computedForwardTilt = Math.min(45, Math.max(0, Math.round((forwardScaleComp + forwardDropComp) * 0.95)));

    let forwardTiltStatus: 'neutral' | 'mild_forward' | 'severe_forward' = 'neutral';
    if (computedForwardTilt >= 18) {
      forwardTiltStatus = 'severe_forward';
    } else if (computedForwardTilt >= 11) {
      forwardTiltStatus = 'mild_forward';
    }

    // Compute Posture Score (0 - 100)
    let penalty = 0;
    // Vertical slump penalty (dropping head down is classic desk slump)
    if (verticalDelta > 0.03 * tolFactor) {
      penalty += Math.min(40, ((verticalDelta - 0.03 * tolFactor) / 0.12) * 40);
    }
    // Leaning forward / tech-neck scale penalty
    if (scaleDelta > 0.04 * tolFactor) {
      penalty += Math.min(25, ((scaleDelta - 0.04 * tolFactor) / 0.1) * 25);
    }
    // Dedicated Forward Head Tilt penalty (cervical angle flexion)
    if (computedForwardTilt > 10 * tolFactor) {
      penalty += Math.min(30, ((computedForwardTilt - 10 * tolFactor) / 14) * 30);
    }
    // Lateral head tilt penalty
    if (tiltDelta > 7 * tolFactor) {
      penalty += Math.min(20, ((tiltDelta - 7 * tolFactor) / 15) * 20);
    }

    let calculatedScore = Math.max(20, Math.min(100, Math.round(100 - penalty)));
    let status: PostureStatus = 'optimal';

    if (detectedHead.confidence < 0.25) {
      status = 'no_face';
      calculatedScore = 70;
    } else if (calibratingCountdown !== null) {
      status = 'calibrating';
    } else if (calculatedScore >= 85 && forwardTiltStatus === 'neutral') {
      status = 'optimal';
    } else if (calculatedScore >= 74 && forwardTiltStatus !== 'severe_forward') {
      status = 'good';
    } else if (forwardTiltStatus === 'severe_forward') {
      status = 'forward_tilt';
    } else if (calculatedScore >= 60) {
      status = 'mild_slouch';
    } else {
      status = 'severe_slouch';
    }

    const inGood = status === 'optimal' || status === 'good';
    const isBelow70 = calculatedScore < 70 && status !== 'no_face' && status !== 'calibrating';

    // Posture Warning Beep & Slouch Alert Handler
    // Specifically triggers posture warning beep sound when alignment is below 70%
    if (isBelow70) {
      if (!slouchStartTimeRef.current) {
        slouchStartTimeRef.current = Date.now();
      } else {
        const elapsedSeconds = (Date.now() - slouchStartTimeRef.current) / 1000;
        const now = Date.now();
        const timeSinceLastBeep = (now - lastWarningBeepTimeRef.current) / 1000;

        // Trigger warning beep when delay threshold reached, and repeat every 3.5s if still below 70%
        if (elapsedSeconds >= alertDelay && (timeSinceLastBeep >= 3.5 || !hasTriggeredAlertForCurrentSlouchRef.current)) {
          wellnessAudio.playPostureWarningBeep();
          lastWarningBeepTimeRef.current = now;
          hasTriggeredAlertForCurrentSlouchRef.current = true;
          setSlouchCount((c) => c + 1);
        }
      }
    } else if (!inGood && status !== 'no_face' && status !== 'calibrating') {
      // Mild lean between 70% and 74% - gentle reminder chime
      if (!slouchStartTimeRef.current) {
        slouchStartTimeRef.current = Date.now();
      } else {
        const elapsedSeconds = (Date.now() - slouchStartTimeRef.current) / 1000;
        if (elapsedSeconds >= alertDelay && !hasTriggeredAlertForCurrentSlouchRef.current) {
          wellnessAudio.playPostureAlert();
          hasTriggeredAlertForCurrentSlouchRef.current = true;
          setSlouchCount((c) => c + 1);
        }
      }
    } else {
      // User returned above 70% good posture!
      if (hasTriggeredAlertForCurrentSlouchRef.current) {
        wellnessAudio.playPostureCalibrated();
      }
      slouchStartTimeRef.current = null;
      hasTriggeredAlertForCurrentSlouchRef.current = false;
      lastWarningBeepTimeRef.current = 0;
    }

    setMetrics({
      score: calculatedScore,
      status,
      verticalDelta,
      forwardDistanceDelta: scaleDelta,
      forwardTiltAngle: computedForwardTilt,
      forwardTiltStatus,
      tiltAngle: Math.round(smooth.tilt),
      shoulderSymmetry: Math.max(70, Math.min(100, 100 - Math.round(tiltDelta * 2))),
      inGoodAlignment: inGood,
    });

    if (onScoreUpdate) {
      onScoreUpdate(calculatedScore);
    }

    // DRAW SLEEK ERGONOMIC HUD OVERLAY ON CANVAS
    const headPixelX = smooth.x * width;
    const headPixelY = smooth.y * height;
    const headRadius = (smooth.scale * width) / 2.2;

    const basePixelY = effectiveBaseline.headY * height;
    const baseRadius = (effectiveBaseline.headScale * width) / 2.2;

    // 1. Desired Target Silhouette / Golden Guide Box (calibrated posture)
    ctx.save();
    ctx.strokeStyle = 'rgba(13, 148, 136, 0.45)'; // Teal guide
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

    // Target Head Reference Ellipse
    ctx.beginPath();
    ctx.ellipse(width * 0.5, basePixelY, baseRadius, baseRadius * 1.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Target Shoulder Guide Line
    const shoulderY = basePixelY + baseRadius * 1.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.25, shoulderY);
    ctx.lineTo(width * 0.75, shoulderY);
    ctx.stroke();
    ctx.restore();

    // 2. Real-Time User Head & Spinal Line
    ctx.save();
    let themeColor = 'rgba(16, 185, 129, 0.9)'; // emerald
    if (status === 'mild_slouch') themeColor = 'rgba(245, 158, 11, 0.9)'; // amber
    if (status === 'severe_slouch') themeColor = 'rgba(239, 68, 68, 0.95)'; // coral/red
    if (status === 'no_face') themeColor = 'rgba(168, 162, 158, 0.6)';

    // Vertical spine connection from head down to shoulders
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(headPixelX, headPixelY + headRadius);
    ctx.lineTo(headPixelX, Math.min(height - 10, headPixelY + headRadius * 2.2));
    ctx.stroke();

    // User Head Bounding Ellipse
    ctx.beginPath();
    ctx.ellipse(headPixelX, headPixelY, headRadius, headRadius * 1.25, (smooth.tilt * Math.PI) / 180, 0, Math.PI * 2);
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Crosshair
    ctx.beginPath();
    ctx.arc(headPixelX, headPixelY, 4, 0, Math.PI * 2);
    ctx.fillStyle = themeColor;
    ctx.fill();

    // Subtle alignment halo when in optimal posture
    if (status === 'optimal') {
      ctx.beginPath();
      ctx.ellipse(headPixelX, headPixelY, headRadius + 6, (headRadius * 1.25) + 6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Forward Tilt Pitch Projection Vector (visualizing forward head posture)
    if (computedForwardTilt >= 12) {
      ctx.save();
      const pitchColor = forwardTiltStatus === 'severe_forward' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.85)';
      ctx.strokeStyle = pitchColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(headPixelX, headPixelY);
      // Project forward/downward
      const forwardVecLen = Math.min(headRadius * 1.5, computedForwardTilt * 2.2);
      ctx.lineTo(headPixelX, headPixelY + forwardVecLen);
      ctx.stroke();

      // Small arrowhead / chin projection marker
      ctx.fillStyle = pitchColor;
      ctx.beginPath();
      ctx.arc(headPixelX, headPixelY + forwardVecLen, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Top-left alignment badge on canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(16, 16, 175, 48, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(status === 'no_face' ? 'Seeking Face...' : `${calculatedScore}% Alignment`, 28, 36);

    ctx.fillStyle =
      status === 'optimal' || status === 'good'
        ? '#34d399'
        : calculatedScore < 70
        ? '#f87171'
        : '#fbbf24';
    ctx.font = '500 11px system-ui, sans-serif';
    const subtext =
      status === 'no_face'
        ? 'Center in Frame'
        : calculatedScore < 70
        ? '⚠️ Warning Beep (<70%)'
        : status === 'forward_tilt'
        ? `⚠️ Forward Tilt (${computedForwardTilt}°)`
        : status === 'optimal'
        ? 'Spine Stacked & Tall'
        : status === 'good'
        ? 'Balanced Alignment'
        : 'Chin Dropping Down';
    ctx.fillText(subtext, 28, 52);

    // Top-right Forward Tilt Pitch HUD widget on canvas
    if (status !== 'no_face') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.roundRect(width - 165, 16, 149, 48, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(`📐 Forward Tilt: ${computedForwardTilt}°`, width - 153, 35);

      ctx.fillStyle =
        forwardTiltStatus === 'neutral'
          ? '#34d399'
          : forwardTiltStatus === 'mild_forward'
          ? '#fbbf24'
          : '#f87171';
      ctx.font = '500 11px system-ui, sans-serif';
      const tiltDesc =
        forwardTiltStatus === 'neutral'
          ? 'Stacked (0-10°)'
          : forwardTiltStatus === 'mild_forward'
          ? 'Mild Pitch'
          : 'Tech Neck Pitch ⚠️';
      ctx.fillText(tiltDesc, width - 153, 51);
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [baseline, sensitivity, alertDelay, isPaused, calibratingCountdown, onScoreUpdate]);

  useEffect(() => {
    if (isCameraActive) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const goodPosturePercentage =
    sessionActiveSeconds > 0
      ? Math.round((goodPostureSeconds / sessionActiveSeconds) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>AI Posture Biofeedback & Ergonomics</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <span>Real-time webcam tracking</span>
            <span aria-hidden="true">·</span>
            <span>Spinal curvature & forward head detection</span>
            <span aria-hidden="true">·</span>
            <span>Local privacy (processed in-browser)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-white border-stone-200 text-stone-500 hover:text-stone-800'
            }`}
            title={soundEnabled ? 'Audio alerts active' : 'Audio muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime On' : 'Muted'}</span>
          </button>

          {/* AI Audit Action */}
          <button
            onClick={handleOpenAiAudit}
            disabled={!isCameraActive}
            className="px-3 py-2 rounded-lg bg-teal-800 text-white hover:bg-teal-900 transition-colors text-xs font-medium flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Ergonomic Audit</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Live Camera HUD & Controls / Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Webcam Video + Canvas HUD */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-stone-900 border border-stone-300 shadow-md aspect-4/3 flex items-center justify-center">
            {/* Hidden Video Source */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            />

            {/* Rendered Live Canvas HUD */}
            {isCameraActive && (
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover bg-black"
                style={{ backgroundColor: '#000000' }}
              />
            )}

            {/* Offline / Inactive State */}
            {!isCameraActive && !cameraError && (
              <div className="text-center p-8 max-w-md space-y-4 text-stone-200">
                <div className="w-16 h-16 rounded-2xl bg-stone-800 border border-stone-700 mx-auto flex items-center justify-center text-teal-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-lg text-white">Webcam Monitor is Standby</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Activate your camera to monitor your sitting posture, detect slouching, and receive gentle corrective reminders in real-time.
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-all shadow-md active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Posture Tracking</span>
                </button>
              </div>
            )}

            {/* Permission / Error State */}
            {cameraError && (
              <div className="text-center p-8 max-w-md space-y-3 bg-stone-900 text-stone-200">
                <div className="w-12 h-12 rounded-xl bg-rose-900/60 border border-rose-700 mx-auto flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-white text-sm">Camera Access Needed</h4>
                <p className="text-xs text-stone-400">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-white border border-stone-600"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Calibration Countdown Overlay */}
            {calibratingCountdown !== null && (
              <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 z-20">
                <div className="w-20 h-20 rounded-full border-4 border-teal-400 flex items-center justify-center font-mono text-3xl font-bold text-white mb-4 animate-pulse">
                  {calibratingCountdown}
                </div>
                <h3 className="text-lg font-bold text-white">Sit Upright & Relax Shoulders</h3>
                <p className="text-xs text-teal-200 mt-1 max-w-xs">
                  Stack your spine, tuck your chin gently, and look directly at your screen.
                </p>
              </div>
            )}

            {/* Active Floating Quick Bar on Video */}
            {isCameraActive && (
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between p-2 rounded-xl bg-stone-900/80 backdrop-blur-md border border-white/10 z-10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={startCalibration}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Calibrate your current tall posture as the baseline"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{baseline ? 'Recalibrate' : 'Calibrate Upright'}</span>
                  </button>

                  {baseline && (
                    <button
                      onClick={resetBaseline}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors"
                      title="Reset baseline to defaults"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
                    title={isPaused ? 'Resume tracking' : 'Pause tracking'}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={stopCamera}
                    className="p-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 transition-colors"
                    title="Stop webcam"
                  >
                    <CameraOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Real-time guidance alert banner when slumping or forward tilting */}
          {isCameraActive && metrics.status !== 'no_face' && (
            metrics.score < 70 ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 flex items-center justify-between text-xs animate-pulse">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Posture Warning Beep Active:</strong> Alignment is at <strong className="font-mono font-bold text-rose-700">{metrics.score}%</strong> (below 70% threshold).
                    {metrics.forwardTiltStatus === 'severe_forward'
                      ? ` Excessive forward tilt (${metrics.forwardTiltAngle}° pitch). Tuck your chin and stack your spine.`
                      : ' Straighten your spine and tuck your chin to clear the alarm.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => wellnessAudio.playPostureWarningBeep()}
                  className="px-2.5 py-1 rounded-md bg-rose-200/80 hover:bg-rose-300 text-rose-900 font-medium text-[11px] shrink-0 transition-colors ml-2"
                >
                  🔊 Test Beep
                </button>
              </div>
            ) : metrics.forwardTiltStatus === 'severe_forward' ? (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-center justify-between text-xs animate-pulse">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Forward Head Tilt ({metrics.forwardTiltAngle}° pitch):</strong> Head protruding forward. Perform a chin retraction (glide head straight backward) to align ears over shoulders.
                  </span>
                </div>
                <span className="font-mono text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded shrink-0 ml-2">
                  {metrics.forwardTiltAngle}° Tilt
                </span>
              </div>
            ) : !metrics.inGoodAlignment ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Mild lean detected:</strong> Lengthen your spine and glide your chin backward.
                  </span>
                </div>
                <span className="font-mono text-amber-800 font-semibold">{metrics.score}%</span>
              </div>
            ) : null
          )}
        </div>

        {/* Right Column: Biomechanics Telemetry & Preferences */}
        <div className="lg:col-span-4 space-y-4">
          {/* Posture Health Metric Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Live Posture Score</span>
              <span
                className={`font-mono text-2xl font-bold ${
                  metrics.score >= 80 ? 'text-teal-700' : metrics.score >= 65 ? 'text-amber-600' : 'text-rose-600'
                }`}
              >
                {isCameraActive ? `${metrics.score}%` : '--'}
              </span>
            </div>

            <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  metrics.score >= 80 ? 'bg-teal-600' : metrics.score >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${isCameraActive ? metrics.score : 0}%` }}
              />
            </div>

            {/* Sub-metrics breakdown */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
              {/* Highlighted Forward Head Tilt (Pitch) */}
              <div className="col-span-2 p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-teal-950 text-xs flex items-center gap-1.5">
                    <span>Forward Head Tilt (Pitch)</span>
                  </span>
                  {isCameraActive && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        metrics.forwardTiltStatus === 'neutral'
                          ? 'bg-teal-100 text-teal-800'
                          : metrics.forwardTiltStatus === 'mild_forward'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {metrics.forwardTiltStatus === 'neutral'
                        ? 'Stacked (0-10°)'
                        : metrics.forwardTiltStatus === 'mild_forward'
                        ? 'Mild Forward Lean'
                        : `${metrics.forwardTiltAngle}° Tech Neck ⚠️`}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-teal-900">
                    {isCameraActive ? `${metrics.forwardTiltAngle}°` : '--'}
                  </span>
                  <span className="text-[11px] text-teal-800/80">
                    {isCameraActive
                      ? metrics.forwardTiltAngle <= 10
                        ? '~10-12 lbs cervical load (normal)'
                        : metrics.forwardTiltAngle <= 18
                        ? '~25-30 lbs cervical strain'
                        : '~40+ lbs load (severe strain)'
                      : '0° ideal stacked spine'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                <span className="text-stone-500 block mb-0.5">Spine Drop</span>
                <span className="font-mono font-semibold text-stone-800">
                  {isCameraActive ? `${Math.round(metrics.verticalDelta * 100)}%` : '--'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                <span className="text-stone-500 block mb-0.5">Lateral Tilt (Roll)</span>
                <span className="font-mono font-semibold text-stone-800">
                  {isCameraActive ? `${metrics.tiltAngle}°` : '--'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                <span className="text-stone-500 block mb-0.5">Screen Distance</span>
                <span className="font-mono font-semibold text-stone-800">
                  {isCameraActive
                    ? metrics.forwardDistanceDelta > 0.05
                      ? 'Too Close'
                      : metrics.forwardDistanceDelta < -0.06
                      ? 'Too Far'
                      : 'Optimal'
                    : '--'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                <span className="text-stone-500 block mb-0.5">Shoulder Level</span>
                <span className="font-mono font-semibold text-stone-800">
                  {isCameraActive ? `${metrics.shoulderSymmetry}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Session Statistics */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>Today's Session</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">Active Duration</span>
                <span className="font-mono font-medium text-stone-800">{formatSeconds(sessionActiveSeconds)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">Good Posture Ratio</span>
                <span className="font-mono font-medium text-teal-700">{goodPosturePercentage}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">Slouch Nudges Triggered</span>
                <span className="font-mono font-medium text-stone-800">{slouchCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-stone-500">Baseline Calibration</span>
                <span className="text-xs font-medium text-stone-700">
                  {baseline ? (
                    <span className="text-teal-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Custom
                    </span>
                  ) : (
                    'Default Auto'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Ergonomic Sensor Tuning */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
              <span>Sensitivity & Nudges</span>
            </h4>

            {/* Sensitivity Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600">Slouch Sensitivity</label>
              <div className="flex p-1 bg-stone-100 rounded-lg">
                {(['relaxed', 'balanced', 'strict'] as PostureSensitivity[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSensitivity(mode)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                      sensitivity === mode ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Delay Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-600">Alert Delay Threshold</span>
                <span className="font-mono font-medium text-stone-800">{alertDelay} seconds</span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={alertDelay}
                onChange={(e) => setAlertDelay(parseInt(e.target.value, 10))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-[11px] text-stone-400">
                Waits {alertDelay}s before sounding the gentle alert to prevent nuisance triggers during brief movements.
              </p>
            </div>

            {/* Posture Warning Beep (<70%) Trigger Callout */}
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                  <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                  <span>Warning Beep Trigger</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                  Below 70%
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Plays an audible dual warning beep whenever spinal alignment drops below 70% to prompt an immediate posture correction.
              </p>
              <button
                type="button"
                onClick={() => wellnessAudio.playPostureWarningBeep()}
                className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <span>🔊 Test Warning Beep Sound</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Posture Audit Modal */}
      <AiPostureAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        capturedImage={capturedSnapshot}
        currentScore={metrics.score}
        slouchCount={slouchCount}
        sessionSeconds={sessionActiveSeconds}
      />
    </div>
  );
};
