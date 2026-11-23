import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { checkHealth, ReadinessResponse } from "../api/client";
import {
  Bot,
  Film,
  Share2,
  Terminal,
  Info,
  Home,
  Menu,
  X,
  Database
} from "lucide-react";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [health, setHealth] = useState<ReadinessResponse | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkHealth().then(setHealth);
    const interval = setInterval(() => {
      checkHealth().then(setHealth);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: "Overview", path: "/", icon: Home },
    { label: "AI Agent", path: "/agent", icon: Bot },
    { label: "Movies", path: "/movies", icon: Film },
    { label: "Graph Explorer", path: "/explore", icon: Share2 },
    { label: "SPARQL Console", path: "/sparql", icon: Terminal },
    { label: "About", path: "/about", icon: Info },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(path);
  };

  const isKgReady = health?.status === "ready";

  return (
    <header className="sticky top-0 z-50 bg-[#042f2e] border-b-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000] group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-black text-white text-lg tracking-tight uppercase">
                MovieLens <span className="text-[#ccff00]">KG</span>
              </span>
              <span className="hidden sm:inline-block text-xs font-black text-black bg-[#ccff00] border-2 border-black px-2 py-0.5 shadow-[1.5px_1.5px_0px_0px_#000]">
                DEMO
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide font-extrabold transition-all ${
                    active
                      ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                      : "text-white hover:text-[#ccff00] hover:bg-black/30 border-2 border-transparent hover:border-black"
                  }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.5] ${active ? "text-black" : "text-[#ccff00]"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status Badge & Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div
              className="flex items-center gap-2 text-xs text-black font-extrabold px-3 py-1 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]"
              title={`Knowledge Graph status: ${health?.checks?.knowledge_graph || "checking"}`}
            >
              <span
                className={`w-2.5 h-2.5 border border-black rounded-full ${isKgReady ? "bg-[#ccff00]" : "bg-amber-400"}`}
              />
              <span className="hidden sm:inline uppercase">{isKgReady ? "KG Connected" : "Connecting..."}</span>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] focus:outline-none cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t-2 border-black bg-[#042f2e] px-4 pt-3 pb-4 space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-xs uppercase font-extrabold transition-all ${
                  active
                    ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "text-white hover:text-[#ccff00] bg-black/20 border-2 border-black"
                }`}
              >
                <Icon className={`w-4 h-4 stroke-[2.5] ${active ? "text-black" : "text-[#ccff00]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
