import { useState, useCallback, useRef } from "react";
import { Mic, MicOff, Volume2, Bus, Activity } from "lucide-react";
import { useBusContext } from "../lib/bus-context";
import { motion, AnimatePresence } from "motion/react";
import { GlassCard } from "./ui/glass-card";

export function BlindPage() {
  const { buses, busLocations } = useBusContext();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState(
    "Tap the microphone and ask about a bus or route. For example: 'Where is Bus 101?' or 'When will the next bus arrive at Central Station?'"
  );
  const [history, setHistory] = useState<Array<{ query: string; answer: string }>>([]);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const processQuery = useCallback(
    async (query: string): Promise<string> => {
      const q = query.toLowerCase();

      try {
        const res = await fetch("http://localhost:8000/search-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            return data.message;
          }
        }
      } catch (err) {
        console.error("Backend voice search failed:", err);
      }

      // Fallback simple keyword search if backend fails/unreachable
      const busMatch = q.match(/bus\s*(\d+)/);
      if (busMatch) {
        const busNum = busMatch[1];
        const loc = busLocations.find((bl) =>
          bl.busName.toLowerCase().includes(busNum)
        );
        if (loc) {
          return `Bus ${loc.busName} is arriving in ${loc.eta} minutes.`;
        }
      }

      return `There are ${buses.filter((b) => b.status === "running").length
        } buses currently running. You can ask: 'Bus from Pollachi to Coimbatore'.`;
    },
    [buses, busLocations]
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
      const answer = await processQuery(text);
      setResponse(answer);
      setHistory((prev) => [{ query: text, answer }, ...prev].slice(0, 5));
      speak(answer);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        setResponse("Microphone access was denied. Please allow microphone access and try again.");
      } else {
        setResponse("Could not understand. Please try again.");
      }
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [processQuery, speak]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden relative">
      <div className="max-w-2xl w-full space-y-12 z-10">

        {/* Header section */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center justify-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Bus className="w-5 h-5" />
            <span className="font-semibold tracking-wide uppercase text-sm">Voice Assistant</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            How can I help you today?
          </h1>
          <p className="text-lg text-slate-400 max-w-lg mx-auto">
            Tap the microphone and speak your query clearly.
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
            className={`relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400 focus-visible:ring-offset-4 focus-visible:ring-offset-background ${isListening
                ? "bg-red-500 shadow-[0_0_80px_rgba(239,68,68,0.6)] scale-105"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.4)] hover:shadow-[0_0_80px_rgba(79,70,229,0.6)]"
              }`}
            aria-label={isListening ? "Stop listening" : "Start listening"}
            aria-live="polite"
          >
            <motion.div
              animate={{ scale: isListening ? [1, 1.1, 1] : 1 }}
              transition={{ repeat: isListening ? Infinity : 0, duration: 1.5 }}
            >
              {isListening ? (
                <MicOff className="w-16 h-16 text-white" />
              ) : (
                <Mic className="w-16 h-16 text-white" />
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
                  className="flex items-center gap-1.5"
                >
                  {[...Array(7)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: ["16px", `${32 + Math.random() * 32}px`, "16px"]
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                      className="w-1.5 bg-indigo-400 rounded-full"
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-500 font-medium tracking-wide flex items-center gap-2"
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
                <div className="bg-indigo-600/30 text-indigo-50 border border-indigo-500/30 rounded-2xl rounded-tr-sm px-6 py-4 max-w-[85%]">
                  <p className="text-sm text-indigo-300 mb-1 font-medium">You asked</p>
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
              <GlassCard hoverEffect={false} className="max-w-[90%] rounded-tl-sm relative group focus-within:ring-2 focus-within:ring-indigo-400">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Assistant</span>
                </div>
                <p className="text-xl sm:text-2xl text-white leading-relaxed font-medium">
                  {response}
                </p>
                <button
                  onClick={() => speak(response)}
                  className="mt-6 px-5 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 hover:text-white transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  aria-label="Replay audio response"
                >
                  Replay Audio
                </button>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
