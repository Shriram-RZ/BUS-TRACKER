import { Outlet, NavLink, useLocation } from "react-router";
import { Bus, Eye, Mic, Settings } from "lucide-react";
import { BusProvider, useBusContext } from "../lib/bus-context";
import { motion } from "motion/react";
import { VoiceAssistant } from "./voice-assistant";

const navItems = [
  { to: "/", label: "Home", icon: Bus },
  { to: "/deaf", label: "Visual Mode", icon: Eye },
  { to: "/blind", label: "Voice Mode", icon: Mic },
  { to: "/admin", label: "Admin", icon: Settings },
];

function CitySelector() {
  const { cities, selectedCityId, setSelectedCityId } = useBusContext();

  if (cities.length === 0) return null;

  return (
    <select
      className="ml-4 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-sm"
      value={selectedCityId ?? ""}
      onChange={(e) => setSelectedCityId(e.target.value || null)}
    >
      {cities.map((city) => (
        <option key={city.id} value={city.id}>
          {city.name}
        </option>
      ))}
    </select>
  );
}

export function Layout() {
  const location = useLocation();

  return (
    <BusProvider>
      <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
        {/* Top Nav */}
        <header className="border-b border-black/5 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-3 text-slate-900 no-underline group">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center group-hover:bg-indigo-200 transition-colors shadow-sm">
                <Bus className="w-5 h-5 text-indigo-600 group-hover:text-indigo-700 transition-colors" />
              </div>
              <span className="hidden sm:inline text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">BusTracker</span>
            </NavLink>

            <nav className="flex gap-2 items-center">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-colors no-underline text-sm font-medium ${isActive
                      ? "text-indigo-700"
                      : "text-slate-500 hover:text-slate-900 hover:bg-black/5"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-indigo-100 border border-indigo-200 rounded-xl -z-10"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : ""}`} />
                    <span className="hidden md:inline">{label}</span>
                  </NavLink>
                );
              })}
              <CitySelector />
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto relative z-10 hide-scrollbar">
          <Outlet />
          <VoiceAssistant />
        </main>
      </div>
    </BusProvider>
  );
}