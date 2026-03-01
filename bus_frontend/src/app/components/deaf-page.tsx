import { useState } from "react";
import { MapPin, Clock, Navigation, Bus as BusIcon, AlertCircle } from "lucide-react";
import { useBusContext } from "../lib/bus-context";
import { BusMap } from "./bus-map";
import { GlassCard } from "./ui/glass-card";
import { motion, AnimatePresence } from "motion/react";

export function DeafPage() {
  const { buses, routes, busLocations } = useBusContext();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const filteredBuses = selectedRouteId
    ? buses.filter((b) => b.routeId === selectedRouteId)
    : buses;

  const currentLocations = busLocations.filter((loc) =>
    filteredBuses.some((b) => b.id === loc.busId)
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Sidebar - Route Card & Live ETA Display */}
      <div className="w-full lg:w-[420px] lg:border-r border-white/10 flex flex-col z-20 bg-[#0B0F19]/95 backdrop-blur-xl relative">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <BusIcon className="w-4 h-4" />
            <span className="font-semibold tracking-wide uppercase text-xs">Visual Tracking</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight m-0">Live Overview</h2>
          <p className="text-sm text-slate-400 mt-1 mb-0">
            Real-time bus positions with visual ETA indicators
          </p>
        </div>

        {/* Route Filter */}
        <div className="p-6 border-b border-white/10">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
            Select Route
          </label>
          <div className="relative">
            <select
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all hover:bg-white/10"
              value={selectedRouteId || ""}
              onChange={(e) => setSelectedRouteId(e.target.value || null)}
              aria-label="Select a route to filter"
            >
              <option value="" className="bg-[#0B0F19] text-slate-200">All Routes Citywide</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#0B0F19] text-slate-200">
                  {r.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <Navigation className="w-4 h-4 text-slate-500 rotate-180" />
            </div>
          </div>
        </div>

        {/* Bus Cards List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {currentLocations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/5"
              >
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
                <p className="text-sm font-medium">No buses currently active<br />on this selection.</p>
              </motion.div>
            ) : (
              currentLocations.map((loc, index) => {
                const bus = buses.find((b) => b.id === loc.busId);
                const route = routes.find((r) => r.id === bus?.routeId);
                const isArrivingSoon = loc.eta <= 5;

                return (
                  <motion.div
                    key={loc.busId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    layout
                  >
                    <GlassCard
                      className={`relative overflow-hidden group cursor-default transition-all duration-300 ${isArrivingSoon ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : ''
                        }`}
                    >
                      {/* Arrival Highlight Indicator */}
                      {isArrivingSoon && (
                        <div className="absolute top-0 left-0 w-1 bottom-0 bg-gradient-to-b from-amber-400 to-orange-500" />
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-inner"
                            style={{ backgroundColor: route?.color || "#4F46E5" }}
                          >
                            <BusIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 block text-lg">{loc.busName}</span>
                            <span className="text-xs text-slate-400">{route?.name || "Unknown Route"}</span>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium tracking-wide uppercase ${bus?.status === "running"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                        >
                          {bus?.status === "running" ? "Active" : "Stopped"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                        <div className={`flex flex-col p-3 rounded-xl border ${isArrivingSoon ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'
                          }`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock className={`w-4 h-4 ${isArrivingSoon ? 'text-amber-400' : 'text-indigo-400'}`} />
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Arriving in</span>
                          </div>
                          <span className={`text-xl font-bold tracking-tight ${isArrivingSoon ? 'text-amber-400' : 'text-slate-100'}`}>
                            {loc.eta} min
                          </span>
                        </div>
                        <div className="flex flex-col p-3 rounded-xl bg-white/5 border border-white/5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Position</span>
                          </div>
                          <span className="text-sm font-semibold tracking-tight text-slate-200 mt-0.5">
                            {loc.lat.toFixed(3)}<br />{loc.lng.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Map Content Right Side */}
      <div className="flex-1 min-h-[300px] lg:h-full relative z-0">
        <BusMap
          buses={buses}
          routes={routes}
          selectedRouteId={selectedRouteId}
        />
        {/* Very subtle gradient overlay linking map and sidebar */}
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0B0F19] to-transparent pointer-events-none z-10 hidden lg:block" />
      </div>
    </div>
  );
}
