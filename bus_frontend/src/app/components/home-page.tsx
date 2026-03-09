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
    <div className="relative h-full w-full p-2 md:p-6 bg-slate-50 flex flex-col md:flex-row gap-4">
      {/* Map Layer in a Section */}
      <div className="relative flex-1 rounded-3xl overflow-hidden shadow-sm border border-black/5 bg-white z-0 h-[60vh] md:h-auto">
        <BusMap
          buses={buses}
          routes={routes}
          selectedRouteId={selectedRouteId}
        />
      </div>

      {/* Top Floating Stats Layer (Inside Map Container) */}
      <div className="absolute top-8 left-8 z-10 hidden md:flex gap-2 pointer-events-none">
        <GlassCard className="pointer-events-auto py-2 px-4 !rounded-full flex items-center gap-3 bg-white/80 shadow-sm border-black/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <span className="text-sm font-medium text-slate-700">
            <AnimatedNumber value={buses.filter(b => b.status === "running").length} /> Active Buses
          </span>
        </GlassCard>
      </div>

      {/* Desktop Side Panel / Mobile Bottom Sheet */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full md:w-96 flex flex-col z-20 shrink-0 h-[40vh] md:h-full"
        >
          <GlassCard
            hoverEffect={false}
            className="flex-1 rounded-3xl flex flex-col overflow-hidden border border-black/5 shadow-sm bg-white/80 backdrop-blur-2xl"
          >
            {/* Mobile Drag Handle */}
            <div
              className="w-full h-6 flex items-center justify-center md:hidden cursor-pointer -mt-2 mb-2"
              onClick={() => setIsSheetOpen(!isSheetOpen)}
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm">
                <Navigation className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight m-0 text-slate-900">Where to?</h2>
                <p className="text-sm text-slate-500 m-0 mt-0.5">Select a route to track</p>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2 space-y-3 pb-6">
              {routes.length === 0 ? (
                /* Shimmer Skeletons */
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse border border-black/5" />
                ))
              ) : (
                <>
                  <button
                    onClick={() => setSelectedRouteId(null)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${selectedRouteId === null
                      ? "bg-indigo-50 border-indigo-200 shadow-sm"
                      : "bg-white border-black/5 hover:bg-slate-50 hover:border-slate-200 shadow-sm"
                      }`}
                  >
                    <div className="font-semibold text-slate-900">All Routes</div>
                    <div className="text-sm text-slate-500 mt-1">Overview of the entire city fleet</div>
                  </button>

                  {routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group shadow-sm ${selectedRouteId === route.id
                        ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                        : "bg-white border-black/5 hover:bg-slate-50 hover:border-slate-200"
                        }`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: route.color }} />
                      <div className="flex justify-between items-start pl-1">
                        <div>
                          <div className="font-semibold text-slate-900 transition-colors">{route.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                            <MapPin className="w-3 h-3" />
                            <span>{route.stops.length} stops</span>
                          </div>
                        </div>
                        {selectedRouteId === route.id && (
                          <motion.div
                            layoutId="active-check"
                            className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shadow-md"
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
                  className="mt-4 pt-4 border-t border-black/5"
                >
                  <div className="flex items-center justify-between mb-3 text-sm">
                    <span className="text-slate-500">Next arrivals</span>
                    <span className="text-indigo-600 font-semibold">{activeBuses.length} buses en route</span>
                  </div>
                  <div className="space-y-2">
                    {activeBuses.length > 0 ? activeBuses.map(bus => (
                      <div key={bus.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-black/5 shadow-sm">
                        <span className="font-semibold text-slate-900">{bus.name}</span>
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Clock className="w-4 h-4" />
                          <span className="font-bold tracking-tight"><AnimatedNumber value={12} /> min</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center p-4 text-slate-500 text-sm bg-slate-50 rounded-lg border border-black/5">No buses currently active on this route.</div>
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
