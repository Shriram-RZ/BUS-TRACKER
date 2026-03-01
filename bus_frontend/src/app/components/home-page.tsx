import { useState, useEffect } from "react";
import { useBusContext } from "../lib/bus-context";
import { BusMap } from "./bus-map";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Navigation, Clock, ChevronUp } from "lucide-react";
import { GlassCard } from "./ui/glass-card";

// Component for smooth number animation
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue}</span>;
}

export function HomePage() {
  const { buses, routes } = useBusContext();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const activeRoute = routes.find(r => r.id === selectedRouteId);
  const activeBuses = buses.filter(b => b.routeId === selectedRouteId);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <BusMap
          buses={buses}
          routes={routes}
          selectedRouteId={selectedRouteId}
        />
      </div>

      {/* Top Floating Stats Layer */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2 pointer-events-none">
        <GlassCard className="pointer-events-auto py-2 px-4 !rounded-full flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse premium-glow-emerald" />
          <span className="text-sm font-medium">
            <AnimatedNumber value={buses.filter(b => b.status === "running").length} /> Active Buses
          </span>
        </GlassCard>
      </div>

      {/* Desktop Side Panel / Mobile Bottom Sheet */}
      <AnimatePresence>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute bottom-0 left-0 right-0 md:top-4 md:bottom-4 md:left-4 md:right-auto md:w-96 z-20 flex flex-col"
        >
          <GlassCard
            hoverEffect={false}
            className="flex-1 rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden border-b-0 md:border-b border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.3)] md:shadow-2xl bg-[#0B0F19]/80 backdrop-blur-2xl"
          >
            {/* Mobile Drag Handle */}
            <div
              className="w-full h-6 flex items-center justify-center md:hidden cursor-pointer -mt-2 mb-2"
              onClick={() => setIsSheetOpen(!isSheetOpen)}
            >
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Navigation className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight m-0">Where to?</h2>
                <p className="text-sm text-slate-400 m-0 mt-0.5">Select a route to track</p>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2 space-y-3 pb-6">
              {routes.length === 0 ? (
                /* Shimmer Skeletons */
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse border border-white/5" />
                ))
              ) : (
                <>
                  <button
                    onClick={() => setSelectedRouteId(null)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${selectedRouteId === null
                      ? "bg-indigo-600/20 border-indigo-500/50"
                      : "bg-white/5 border-white/5 hover:bg-white/10"
                      }`}
                  >
                    <div className="font-semibold text-slate-200">All Routes</div>
                    <div className="text-sm text-slate-400 mt-1">Overview of the entire city fleet</div>
                  </button>

                  {routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedRouteId === route.id
                        ? "bg-indigo-600/20 border-indigo-500/50 premium-glow"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                        }`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: route.color }} />
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-white transition-colors">{route.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                            <MapPin className="w-3 h-3" />
                            <span>{route.stops.length} stops</span>
                          </div>
                        </div>
                        {selectedRouteId === route.id && (
                          <motion.div
                            layoutId="active-check"
                            className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center"
                          >
                            <ChevronUp className="w-4 h-4 text-white rotate-90" />
                          </motion.div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Active Route ETA Panel (Swipe Up effect) */}
            <AnimatePresence>
              {activeRoute && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  <div className="flex items-center justify-between mb-3 text-sm">
                    <span className="text-slate-400">Next arrivals</span>
                    <span className="text-indigo-400 font-medium">{activeBuses.length} buses en route</span>
                  </div>
                  <div className="space-y-2">
                    {activeBuses.length > 0 ? activeBuses.map(bus => (
                      <div key={bus.id} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="font-medium">{bus.name}</span>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Clock className="w-4 h-4" />
                          <span className="font-bold tracking-tight"><AnimatedNumber value={12} /> min</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center p-4 text-slate-500 text-sm bg-black/20 rounded-lg">No buses currently active on this route.</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </GlassCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
