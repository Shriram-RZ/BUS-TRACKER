import { Outlet, NavLink, useLocation } from "react-router";
import { Bus, Eye, Mic, Settings } from "lucide-react";
import { BusProvider } from "../lib/bus-context";
import { motion } from "motion/react";

const navItems = [
  { to: "/", label: "Home", icon: Bus },
  { to: "/deaf", label: "Visual Mode", icon: Eye },
  { to: "/blind", label: "Voice Mode", icon: Mic },
  { to: "/admin", label: "Admin", icon: Settings },
];

export function Layout() {
  const location = useLocation();

  return (
    <BusProvider>
      <div className="flex flex-col h-screen bg-background relative overflow-hidden text-slate-100">
        {/* Subtle Background Mesh / Noise */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
        </div>

        {/* Top Nav */}
        <header className="border-b border-white/5 bg-[#0B0F19]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-3 text-white no-underline group">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-600/40 transition-colors">
                <Bus className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              </div>
              <span className="hidden sm:inline text-lg font-semibold tracking-tight">BusTracker</span>
            </NavLink>

            <nav className="flex gap-2">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-colors no-underline text-sm font-medium ${isActive
                        ? "text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-indigo-600/20 border border-indigo-500/30 rounded-xl -z-10"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : ""}`} />
                    <span className="hidden md:inline">{label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto relative z-10 hide-scrollbar">
          <Outlet />
        </main>
      </div>
    </BusProvider>
  );
}