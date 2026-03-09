import { useState } from "react";
import {
  Plus,
  Trash2,
  Bus as BusIcon,
  MapPin,
  Route as RouteIcon,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Settings2
} from "lucide-react";
import { useBusContext } from "../lib/bus-context";
import type { Route, Bus } from "../lib/types";
import { BusMap } from "./bus-map";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedButton } from "./ui/animated-button";

export function AdminPage() {
  const {
    buses,
    routes,
    addRoute,
    addBus,
    toggleBusStatus,
    deleteBus,
    deleteRoute,
  } = useBusContext();

  const [tab, setTab] = useState<"routes" | "buses">("routes");
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showAddBus, setShowAddBus] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: "", show: false });

  // Add route form
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteColor, setNewRouteColor] = useState("#4F46E5");
  // always maintain at least start + destination entries
  const [newStops, setNewStops] = useState<
    Array<{ name: string; lat: string; lng: string }>
  >([{ name: "", lat: "", lng: "" }, { name: "", lat: "", lng: "" }]);

  // Track which stop index is currently focused for map clicking
  const [focusedStopIndex, setFocusedStopIndex] = useState<number | null>(null);

  // Temporary marker on the map for the current click
  const [clickMarker, setClickMarker] = useState<{ lat: number, lng: number } | null>(null);

  // Add bus form
  const [newBusName, setNewBusName] = useState("");
  const [newBusRouteId, setNewBusRouteId] = useState("");
  const [newBusSpeed, setNewBusSpeed] = useState("30");

  const showToast = (message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast({ message: "", show: false }), 3000);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setClickMarker({ lat, lng });

    // If we're adding a route and a stop is focused, auto-fill it
    if (showAddRoute && focusedStopIndex !== null) {
      const s = [...newStops];
      s[focusedStopIndex].lat = lat.toFixed(6);
      s[focusedStopIndex].lng = lng.toFixed(6);
      setNewStops(s);
    }
  };

  const handleAddRoute = () => {
    // ensure name and at least two filled waypoints
    if (!newRouteName.trim()) {
      showToast("Route must have a designation");
      return;
    }

    const validStops = newStops.filter((s) => s.name && s.lat && s.lng);
    if (validStops.length < 2) {
      showToast("Provide both start and destination with coordinates");
      return;
    }

    // create a stable id for this route so stops share it in UI (not used by backend)
    const clientRouteId = `route-${Date.now()}`;

    const route: Route = {
      id: clientRouteId,
      name: newRouteName,
      color: newRouteColor,
      stops: validStops.map((s, i) => ({
        id: `s-${Date.now()}-${i}`,
        route_id: clientRouteId,
        name: s.name,
        lat: parseFloat(s.lat),
        lng: parseFloat(s.lng),
        order: i + 1, // backend requires 1-based ordering
      })),

    };

    // attempt to save and notify user on failure/success
    addRoute(route)
      .then(() => {
        setNewRouteName("");
        setNewRouteColor("#4F46E5");
        setNewStops([{ name: "", lat: "", lng: "" }, { name: "", lat: "", lng: "" }]);
        setShowAddRoute(false);
        setClickMarker(null);
        setFocusedStopIndex(null);
        showToast("Route created successfully");
      })
      .catch((err) => {
        console.error("Route creation failed", err);
        showToast("Failed to create route, please try again");
      });
  };

  const handleAddBus = () => {
    if (!newBusName.trim() || !newBusRouteId) return;

    const route = routes.find((r) => r.id === newBusRouteId);
    if (!route) return;

    const bus: Bus = {
      id: `bus-${Date.now()}`,
      name: newBusName,
      routeId: newBusRouteId,
      speed: parseFloat(newBusSpeed) || 30,
      status: "running",
    };

    addBus(bus);
    setNewBusName("");
    setNewBusRouteId("");
    setNewBusSpeed("30");
    setShowAddBus(false);
    showToast("Bus deployed successfully");
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-slate-50 overflow-hidden relative">

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 backdrop-blur-xl shadow-[0_8px_30px_rgba(16,185,129,0.15)]"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Settings / Control Panel */}
      <div className="w-full lg:w-[460px] bg-white border-r border-slate-200 flex flex-col z-20">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center border border-indigo-200">
              <Settings2 className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight m-0">Command Center</h2>
          </div>
          <p className="text-sm text-slate-600 ml-11">Fleet & Route Management</p>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex gap-6">
            <button
              onClick={() => setTab("routes")}
              className={`pb-4 text-sm font-medium transition-colors relative ${tab === "routes" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                }`}
            >
              Routes
              <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded-full">{routes.length}</span>
              {tab === "routes" && (
                <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => setTab("buses")}
              className={`pb-4 text-sm font-medium transition-colors relative ${tab === "buses" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                }`}
            >
              Fleet
              <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded-full">{buses.length}</span>
              {tab === "buses" && (
                <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
              )}
            </button>
          </div>
        </div>

        {/* Panel Content Area */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 relative bg-white">

          <AnimatePresence mode="wait">
            {tab === "routes" ? (
              <motion.div
                key="routes-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Active Routes</h3>
                  <AnimatedButton onClick={() => {
                    setShowAddRoute(true)
                    setShowAddBus(false)
                  }} variant="primary" className="py-2 px-3 text-xs w-auto">
                    <Plus className="w-3.5 h-3.5" /> Create Route
                  </AnimatedButton>
                </div>

                {routes.map((route) => {
                  const routeBuses = buses.filter((b) => b.routeId === route.id);
                  const isExpanded = expandedRoute === route.id;

                  return (
                    <div key={route.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-colors hover:border-slate-300">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]" style={{ backgroundColor: route.color, boxShadow: `0 0 10px ${route.color}80` }} />
                          <div>
                            <span className="text-sm font-semibold text-slate-900 block">{route.name}</span>
                            <span className="text-xs text-slate-600 mt-0.5 block">{route.stops.length} Stops · {routeBuses.length} Buses deployed</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Permanently delete ${route.name} and its active fleet?`)) {
                                deleteRoute(route.id);
                                showToast("Route and fleet deleted");
                              }
                            }}
                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label={`Delete ${route.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center ml-1">
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-100 bg-slate-50"
                          >
                            <div className="p-4 pl-9 space-y-3 relative">
                              {/* Route Line Indicator */}
                              <div className="absolute left-6 top-6 bottom-6 w-1 bg-slate-300 rounded-full" />

                              {route.stops.map((stop, i) => {
                                const isStart = i === 0;
                                const isDest = i === route.stops.length - 1;
                                const dotColor = isStart ? "bg-emerald-400" : isDest ? "bg-red-400" : "bg-slate-600";
                                const label = isStart ? "START" : isDest ? "DESTINATION" : `STOP ${i}`;
                                const labelColor = isStart ? "text-emerald-400" : isDest ? "text-red-400" : "text-slate-400";

                                return (
                                  <div key={stop.id} className="flex items-center gap-3 text-sm relative z-10">
                                    <div className={`w-3 h-3 rounded-full ${dotColor} outline outline-4 outline-white`} />
                                    <div className="flex-1">
                                      <p className="text-slate-800 font-medium">{stop.name}</p>
                                      <p className={`text-xs ${labelColor} uppercase tracking-wider font-semibold`}>{label}</p>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono hidden sm:block">
                                      {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="buses-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Deployed Fleet</h3>
                  <AnimatedButton onClick={() => {
                    setShowAddBus(true)
                    setShowAddRoute(false)
                  }} variant="primary" className="py-2 px-3 text-xs w-auto">
                    <Plus className="w-3.5 h-3.5" /> Deploy Bus
                  </AnimatedButton>
                </div>

                {buses.map((bus) => {
                  const route = routes.find((r) => r.id === bus.routeId);
                  const isRunning = bus.status === "running";

                  return (
                    <div key={bus.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4 transition-colors hover:border-slate-300">
                      <div className="relative">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-200"
                          style={{ backgroundColor: route ? `${route.color}20` : "rgba(226,232,240,0.5)" }}
                        >
                          <BusIcon className="w-6 h-6" style={{ color: route?.color || "#94a3b8" }} />
                        </div>
                        {isRunning && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0B0F19]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{bus.name}</p>
                        <p className="text-xs text-slate-600 truncate mt-0.5">
                          {route?.name || "Unassigned"} &middot; {bus.speed} km/h base speed
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBusStatus(bus.id)}
                          className={`p-2.5 rounded-lg transition-colors border ${isRunning
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                              : "text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200"
                            }`}
                          aria-label={isRunning ? "Suspend operations" : "Resume operations"}
                        >
                          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 pl-0.5" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Recall and decommission ${bus.name}?`)) deleteBus(bus.id);
                          }}
                          className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                          aria-label={`Decommission ${bus.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Adding Modals overlaying the map on desktop / full screen on mobile */}
      <AnimatePresence>
        {(showAddRoute || showAddBus) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute lg:inset-y-0 lg:right-0 lg:w-[480px] inset-0 bg-white z-30 border-l border-slate-200 flex flex-col shadow-xl"
          >
            {showAddRoute && (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Create New Route</h3>
                    <p className="text-xs text-slate-600 mt-1">Define route waypoints by clicking on the map</p>
                  </div>
                  <button onClick={() => setShowAddRoute(false)} className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-500 transition-all duration-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Route Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Central City Loop"
                      value={newRouteName}
                      onChange={(e) => setNewRouteName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Brand Color</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={newRouteColor}
                        onChange={(e) => setNewRouteColor(e.target.value)}
                        className="w-14 h-14 rounded-xl cursor-pointer border-2 border-slate-200 hover:border-slate-400 transition-all"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1">Selected Color</p>
                        <p className="text-sm font-mono font-bold text-slate-900">{newRouteColor.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Waypoints</label>
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg w-fit inline-block border border-indigo-200 font-medium">
                        <MapPin className="w-3 h-3 inline mr-1.5" /> Click map to auto-fill
                      </span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {newStops.map((stop, i) => {
                        const isStart = i === 0;
                        const isDest = i === newStops.length - 1;
                        const iconColor = isStart ? "text-emerald-400" : isDest ? "text-red-400" : "text-indigo-400";
                        const placeholderStr = isStart ? "Origin terminal" : isDest ? "Terminus" : `Stop ${i}`;
                        const isFocused = focusedStopIndex === i;

                        return (
                          <div
                            key={i}
                            className={`flex gap-3 p-3 rounded-lg transition-all border ${isFocused ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              }`}
                            onClick={() => setFocusedStopIndex(i)}
                          >
                            <MapPin className={`w-5 h-5 shrink-0 mt-2.5 ${iconColor}`} />
                            <div className="flex-1 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide" style={{color: isStart ? '#16a34a' : isDest ? '#dc2626' : '#64748b'}}>
                                {isStart ? 'Start Location' : isDest ? 'Destination' : `Stop ${i}`}
                              </p>
                              <input
                                type="text"
                                placeholder={placeholderStr}
                                value={stop.name}
                                onChange={(e) => {
                                  const s = [...newStops];
                                  s[i].name = e.target.value;
                                  setNewStops(s);
                                }}
                                onFocus={() => setFocusedStopIndex(i)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-200"
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Lat"
                                  value={stop.lat}
                                  onChange={(e) => {
                                    const s = [...newStops];
                                    s[i].lat = e.target.value;
                                    setNewStops(s);
                                  }}
                                  onFocus={() => setFocusedStopIndex(i)}
                                  className="w-1/2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
                                />
                                <input
                                  type="text"
                                  placeholder="Lng"
                                  value={stop.lng}
                                  onChange={(e) => {
                                    const s = [...newStops];
                                    s[i].lng = e.target.value;
                                    setNewStops(s);
                                  }}
                                  onFocus={() => setFocusedStopIndex(i)}
                                  className="w-1/2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
                                />
                              </div>
                            </div>

                            {i !== 0 && i !== newStops.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewStops(newStops.filter((_, j) => j !== i));
                                  if (focusedStopIndex === i) setFocusedStopIndex(null);
                                }}
                                className="p-2 self-start mt-1 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        // insert before last element (destination)
                        const beforeDest = newStops.slice(0, -1);
                        const dest = newStops[newStops.length - 1];
                        const updated = [...beforeDest, { name: "", lat: "", lng: "" }, dest];
                        setNewStops(updated);
                        setFocusedStopIndex(updated.length - 2);
                      }}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Append Waypoint
                    </button>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 gap-3 flex">
                  <button
                    onClick={() => setShowAddRoute(false)}
                    className="flex-1 py-3 bg-white text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-semibold transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                  <AnimatedButton onClick={handleAddRoute} variant="primary" className="flex-1">
                    Establish Route
                  </AnimatedButton>
                </div>
              </div>
            )}

            {showAddBus && (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Deploy New Bus</h3>
                    <p className="text-xs text-slate-600 mt-1">Add a vehicle to an existing route</p>
                  </div>
                  <button onClick={() => setShowAddBus(false)} className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-500 transition-all duration-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-white">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Bus Designation / Callsign</label>
                    <input
                      type="text"
                      placeholder="e.g. Bus 401 Alpha"
                      value={newBusName}
                      onChange={(e) => setNewBusName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Assign to Route</label>
                    <div className="relative">
                      <select
                        value={newBusRouteId}
                        onChange={(e) => setNewBusRouteId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none transition-all"
                      >
                        <option value="" className="bg-white text-slate-800">Select a route destination</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id} className="bg-white text-slate-800">
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Base Operating Speed (km/h)</label>
                    <input
                      type="number"
                      placeholder="40"
                      value={newBusSpeed}
                      onChange={(e) => setNewBusSpeed(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 gap-3 flex mt-auto">
                  <button
                    onClick={() => setShowAddBus(false)}
                    className="flex-1 py-3 bg-white text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-semibold transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                  <AnimatedButton onClick={handleAddBus} variant="primary" className="flex-1">
                    Deploy Fleet Unit
                  </AnimatedButton>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map section */}
      <div className="flex-1 h-full relative z-0 mt-4 lg:mt-0">
        <BusMap
          buses={buses}
          routes={routes}
          onMapClick={handleMapClick}
          clickMarker={clickMarker}
          draftStops={
            showAddRoute
              ? newStops
                  .filter((s) => s.lat && s.lng)
                  .map((s) => ({
                    name: s.name,
                    lat: parseFloat(s.lat),
                    lng: parseFloat(s.lng),
                  }))
              : undefined
          }
        />
      </div>
    </div>
  );
}
