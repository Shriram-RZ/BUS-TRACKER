import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, Bus, Activity } from "lucide-react";
import { useBusContext } from "../lib/bus-context";
import { motion, AnimatePresence } from "motion/react";
import { GlassCard } from "./ui/glass-card";
import { BusMap } from "./bus-map";

export function BlindPage() {
  const { buses, routes, busLocations, selectedCityId } = useBusContext();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<Array<{ query: string; answer: string }>>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(false);
  const userIdRef = useRef<string>(`blind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Get user location
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

  // Fetch dynamic initial greeting from backend
  useEffect(() => {
    const fetchGreeting = async () => {
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
          setResponse(data.message || "Tap the microphone and ask about a bus or route.");
          return;
        }
      } catch (err) {
        console.warn("Backend greeting failed:", err);
      }
      setResponse("Tap the microphone and ask about a bus or route. For example: 'Next bus to Gandhipuram' or 'Bus from Pollachi to Coimbatore'.");
    };
    fetchGreeting();
  }, [selectedCityId]);

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1;

      // After speaking, auto-restart listening if continuous mode is on
      utterance.onend = () => {
        if (continuousListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const processQuery = useCallback(
    async (query: string): Promise<string> => {
      try {
        const res = await fetch("http://localhost:8000/voice-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            city_id: selectedCityId ? parseInt(selectedCityId) : null,
            user_lat: userLat,
            user_lng: userLng,
            user_id: userIdRef.current,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            return data.message;
          }
        }
      } catch (err) {
        console.error("Backend voice query failed:", err);
      }

      return "I'm having trouble connecting to the server. Please try again in a moment.";
    },
    [selectedCityId, userLat, userLng]
  );

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg = "Speech recognition is not supported in your browser. Please try Chrome or Edge.";
      setResponse(msg);
      speak(msg);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      const answer = await processQuery(text);
      setResponse(answer);
      setHistory((prev) => [{ query: text, answer }, ...prev].slice(0, 10));
      speak(answer);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        setResponse("Microphone access was denied. Please allow microphone access and try again.");
      } else if (event.error === "no-speech") {
        // No speech detected, auto-restart if continuous
        if (continuousListeningRef.current) {
          setTimeout(() => startListening(), 500);
        }
      } else {
        setResponse("Could not understand. Please try again.");
        if (continuousListeningRef.current) {
          setTimeout(() => startListening(), 1000);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    continuousListeningRef.current = true;
  }, [processQuery, speak]);

  const stopListening = useCallback(() => {
    continuousListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex flex-col items-center p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-12 z-10">

        {/* Header section */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center justify-center gap-3 px-6 py-2 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
            <Bus className="w-5 h-5" />
            <span className="font-semibold tracking-wide uppercase text-sm">Voice Assistant</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            How can I help you today?
          </h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto">
            Tap the microphone and speak your query clearly. I'll keep listening continuously.
          </p>
        </div>

        {/* Central Mic area */}
        <div className="flex flex-col items-center justify-center relative py-10">
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-64 h-64 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="absolute w-80 h-80 rounded-full bg-indigo-500/10 animate-ping max-duration-1000" />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={isListening ? stopListening : startListening}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-50 ${isListening
              ? "bg-red-500"
              : "bg-indigo-600 hover:bg-indigo-500"
              }`}
            aria-label={isListening ? "Stop listening" : "Start listening"}
            aria-live="polite"
          >
            <motion.div
              animate={{ scale: isListening ? [1, 1.1, 1] : 1 }}
              transition={{ repeat: isListening ? Infinity : 0, duration: 1.5 }}
            >
              {isListening ? (
                <MicOff className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
            </motion.div>
          </button>

          {/* Waveform indicator */}
          <div className="h-16 mt-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-slate-600 text-sm"
                >
                  Listening continuously...
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-600 font-medium tracking-wide flex items-center gap-2"
                >
                  <Activity className="w-5 h-5" /> Ready to listen
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Response Area */}
        <div className="space-y-4">
          <AnimatePresence>
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-end"
              >
                <div className="bg-indigo-50 text-slate-900 border border-indigo-100 rounded-2xl rounded-tr-sm px-6 py-4 max-w-[85%]">
                  <p className="text-sm text-indigo-600 mb-1 font-medium">You asked</p>
                  <p className="text-lg leading-relaxed">{transcript}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start"
            >
              <GlassCard hoverEffect={false} className="max-w-[90%] rounded-tl-sm relative group focus-within:ring-2 focus-within:ring-indigo-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Assistant</span>
                </div>
                <p className="text-xl sm:text-2xl text-slate-900 leading-relaxed font-medium">
                  {response}
                </p>
                <button
                  onClick={() => speak(response)}
                  className="mt-6 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  aria-label="Replay audio response"
                >
                  Replay Audio
                </button>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Map section */}
      <div className="w-full max-w-4xl mt-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          Map view
        </h2>
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white h-[320px]">
          <BusMap buses={buses} routes={routes} />
        </div>
      </div>
    </div>
  );
}

