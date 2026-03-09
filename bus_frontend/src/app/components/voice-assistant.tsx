import { useEffect, useState, useRef, useCallback } from "react";
import { Mic, Bot, Volume2, X } from "lucide-react";
import { useBusContext } from "../lib/bus-context";
import { motion, AnimatePresence } from "motion/react";

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

interface AudioChunk {
    data: Blob;
    timestamp: number;
}

export function VoiceAssistant() {
    const { buses, routes, selectedCityId } = useBusContext();
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [assistantMessage, setAssistantMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [micLevel, setMicLevel] = useState(0);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [frequencyBars, setFrequencyBars] = useState<number[]>(Array(20).fill(0));
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initializeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const listeningRef = useRef(false);
    const userIdRef = useRef<string>(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

    const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            mediaStreamRef.current = stream;
            setHasPermission(true);
            return true;
        } catch (err) {
            console.error("Microphone permission denied:", err);
            setHasPermission(false);
            setError("Microphone access denied. Enable it in your browser settings.");
            return false;
        }
    }, []);

    const speak = useCallback((text: string) => {
        if (!synth) return;

        synth.cancel();
        setIsSpeaking(true);
        setAssistantMessage(text);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            setIsSpeaking(false);
            resumeListening();
        };

        utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error);
            setIsSpeaking(false);
            resumeListening();
        };

        synth.speak(utterance);
    }, [synth]);

    const resumeListening = useCallback(() => {
        if (initialized && listeningRef.current) {
            startRecording();
        }
    }, [initialized]);

    const startRecording = useCallback(async () => {
        if (!mediaStreamRef.current) {
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) return;
        }

        try {
            const mediaRecorder = new MediaRecorder(mediaStreamRef.current!, {
                mimeType: "audio/webm;codecs=opus",
            });

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunks, { type: "audio/webm" });
                if (audioBlob.size > 0) {
                    setIsProcessing(true);
                    await transcribeAndProcess(audioBlob);
                    setIsProcessing(false);
                }
                if (listeningRef.current && initialized) {
                    recordingTimerRef.current = setTimeout(() => {
                        startRecording();
                    }, 500);
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsListening(true);

            recordingTimerRef.current = setTimeout(() => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
            }, 5000);

            setupAudioVisualization(mediaStreamRef.current);
        } catch (err) {
            console.error("Recording error:", err);
            setError("Failed to start recording");
        }
    }, [requestMicrophonePermission, initialized]);

    const setupAudioVisualization = useCallback((stream: MediaStream) => {
        try {
            const audioContext = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            analyzerRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVisualization = () => {
                analyser.getByteFrequencyData(dataArray);

                // Calculate average for mic level
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setMicLevel(Math.min(average / 255, 1));

                // Generate 20 frequency bars from the data
                const barCount = 20;
                const binStep = Math.floor(dataArray.length / barCount);
                const bars = Array.from({ length: barCount }).map((_, i) => {
                    const binIndex = i * binStep;
                    const binValue = dataArray[binIndex];
                    return Math.min(binValue / 255, 1);
                });

                setFrequencyBars(bars);
                animationRef.current = requestAnimationFrame(updateVisualization);
            };

            updateVisualization();
        } catch (err) {
            console.error("Audio visualization setup error:", err);
        }
    }, []);

    const transcribeAndProcess = useCallback(async (audioBlob: Blob) => {
        try {
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.webm");

            const transcribeRes = await fetch("http://localhost:8000/transcribe-audio", {
                method: "POST",
                body: formData,
            });

            if (!transcribeRes.ok) {
                throw new Error(`Transcribe failed: ${transcribeRes.statusText}`);
            }

            const transcribeData = await transcribeRes.json();
            const recognizedText = transcribeData.text?.trim();

            if (!recognizedText) {
                setTranscript("(silence detected)");
                return;
            }

            setTranscript(recognizedText);

            const voiceQueryRes = await fetch("http://localhost:8000/voice-query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: recognizedText,
                    city_id: selectedCityId ? parseInt(selectedCityId) : null,
                    user_lat: userLat,
                    user_lng: userLng,
                    user_id: userIdRef.current,
                }),
            });

            if (!voiceQueryRes.ok) {
                throw new Error(`Voice query failed: ${voiceQueryRes.statusText}`);
            }

            const voiceData = await voiceQueryRes.json();
            const response = voiceData.message || "I understood you, but I couldn't process your request.";
            speak(response);
        } catch (err) {
            console.error("Processing error:", err);
            setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
            resumeListening();
        }
    }, [selectedCityId, speak, resumeListening]);

    const stopListening = useCallback(() => {
        listeningRef.current = false;
        setIsListening(false);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }

        if (recordingTimerRef.current) {
            clearTimeout(recordingTimerRef.current);
        }

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        setMicLevel(0);
    }, []);

    const initializeAssistant = useCallback(async () => {
        const permission = await requestMicrophonePermission();
        if (!permission) {
            setInitialized(true);
            return;
        }

        listeningRef.current = true;
        setInitialized(true);

        // Fetch a dynamic greeting from the backend NLP pipeline
        try {
            const res = await fetch("http://localhost:8000/voice-query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: "hello",
                    city_id: selectedCityId ? parseInt(selectedCityId) : null,
                    user_id: userIdRef.current,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                speak(data.message || "Welcome to BusTracker! How can I help you?");
                return;
            }
        } catch (err) {
            console.warn("Backend greeting failed, using fallback:", err);
        }

        // Fallback if backend is unreachable
        const activeBusCount = buses.filter((b) => b.status === "running").length;
        speak(`Welcome to BusTracker. There are ${activeBusCount} active buses. How can I help you?`);
    }, [buses, selectedCityId, requestMicrophonePermission, speak]);

    useEffect(() => {
        if (!initialized) {
            initializeTimerRef.current = setTimeout(() => {
                initializeAssistant();
            }, 500);
        }

        return () => {
            if (initializeTimerRef.current) {
                clearTimeout(initializeTimerRef.current);
            }
        };
    }, [initialized, initializeAssistant]);

    useEffect(() => {
        return () => {
            stopListening();
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (synth) {
                synth.cancel();
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [stopListening, synth]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLat(position.coords.latitude);
                    setUserLng(position.coords.longitude);
                },
                (error) => {
                    console.warn("Could not get user location:", error);
                }
            );
        }
    }, []);

    if (hasPermission === false && error) {
        return (
            <div className="fixed bottom-6 right-6 z-50 max-w-sm">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start"
                >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">Microphone Access Required</p>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-600 hover:text-red-700"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
            <AnimatePresence>
                {(assistantMessage || transcript || isListening || isSpeaking) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg mb-4"
                    >
                        {/* Microphone Status Header with Listening Indicator */}
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                            <div className="relative">
                                {isListening && (
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1], opacity: [1, 0.6, 1] }}
                                        transition={{ duration: 0.6, repeat: Infinity }}
                                        className="absolute inset-0 w-6 h-6 border-2 border-red-500 rounded-full"
                                    />
                                )}
                                <Mic className={`w-5 h-5 ${isListening ? 'text-red-600' : 'text-indigo-600'}`} />
                            </div>
                            <span className={`text-xs font-bold ${isSpeaking ? 'text-blue-600' :
                                    isListening ? 'text-red-600 animate-pulse' :
                                        isProcessing ? 'text-amber-600' : 'text-slate-600'
                                }`}>
                                {isSpeaking ? "🔊 Speaking…" :
                                    isListening ? "🎤 ACTIVELY LISTENING..." :
                                        isProcessing ? "⚙️ Processing…" : "✅ Ready"}
                            </span>
                        </div>

                        {/* Real-Time Frequency Graph Visualization */}
                        {isListening && (
                            <div className="mb-4 p-3 bg-slate-900 rounded-lg overflow-hidden">
                                <div className="flex gap-0.5 items-end justify-center h-20">
                                    {frequencyBars.map((level, i) => (
                                        <motion.div
                                            key={i}
                                            className={`flex-1 rounded-t-sm transition-all ${level > 0.7 ? 'bg-red-500' :
                                                    level > 0.4 ? 'bg-yellow-500' :
                                                        level > 0.2 ? 'bg-cyan-500' :
                                                            'bg-blue-500'
                                                }`}
                                            style={{
                                                height: `${Math.max(level * 100, 3)}%`,
                                                opacity: Math.max(0.5, level)
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 text-center text-xs text-slate-400 font-mono">
                                    Frequency Analysis • {Math.round(micLevel * 100)}% Level
                                </div>
                            </div>
                        )}

                        {/* Transcript */}
                        {transcript && (
                            <div className="mb-3">
                                <p className="text-xs text-slate-500 font-medium mb-1">You said:</p>
                                <p className="text-sm text-slate-800 bg-slate-50 rounded-lg px-3 py-2">{transcript}</p>
                            </div>
                        )}

                        {/* Assistant Response */}
                        {assistantMessage && (
                            <div className="flex gap-3 items-start">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 font-medium mb-1">Assistant:</p>
                                    <p className="text-sm text-slate-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                                        {assistantMessage}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                                {error}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Main Control Button */}
                <motion.button
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    onClick={isListening ? stopListening : initializeAssistant}
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors ${isSpeaking
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                            : isListening
                                ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                                : "bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                        }`}
                >
                    {isSpeaking ? (
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                            <Volume2 className="w-7 h-7 text-white" />
                        </motion.div>
                    ) : (
                        <Mic className="w-7 h-7 text-white" />
                    )}
                </motion.button>
            </AnimatePresence>
        </div>
    );
}
