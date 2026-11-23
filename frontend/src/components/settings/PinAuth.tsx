import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { Lock, KeyRound, Loader2, Database, ArrowLeft, AlertCircle } from "lucide-react";

interface PinAuthProps {
  pinDigits: string[];
  pinVerifying: boolean;
  pinError: string | null;
  onDigitChange: (index: number, val: string) => void;
  onDigitKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPastePin: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

export const PinAuth: React.FC<PinAuthProps> = ({
  pinDigits,
  pinVerifying,
  pinError,
  onDigitChange,
  onDigitKeyDown,
  onPastePin,
  onSubmit,
}) => {
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="h-16 px-4 sm:px-8 bg-[#042f2e] border-b-2 border-black flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
            <Database className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-black text-white text-base tracking-tight uppercase">
            MovieLens <span className="text-[#ccff00]">KG</span>
          </span>
        </Link>
        <Link
          to="/"
          className="neo-btn-white px-3 py-1.5 text-xs font-black uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Back to App</span>
        </Link>
      </header>

      {/* PIN Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full neo-box p-8 text-center">
          <div className="w-14 h-14 mx-auto border-2 border-black bg-[#ccff00] flex items-center justify-center text-black mb-5 shadow-[3px_3px_0px_0px_#000]">
            <Lock className="w-7 h-7 stroke-[2.5]" />
          </div>

          <span className="text-xs font-black uppercase text-black/60 tracking-wider">SECURITY ACCESS</span>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight mb-2">
            Settings Access Locked
          </h2>
          <p className="text-xs text-slate-700 font-medium mb-6">
            Enter the 6-digit administration PIN to manage dataset ingestion and LLM configuration.
          </p>

          {/* 6 Digit Inputs */}
          <div className="flex justify-center gap-2 sm:gap-2.5 mb-6" onPaste={onPastePin}>
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  pinInputRefs.current[idx] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                autoFocus={idx === 0}
                onChange={(e) => {
                  onDigitChange(idx, e.target.value);
                  if (e.target.value && idx < 5) {
                    pinInputRefs.current[idx + 1]?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !pinDigits[idx] && idx > 0) {
                    pinInputRefs.current[idx - 1]?.focus();
                  }
                  onDigitKeyDown(idx, e);
                }}
                disabled={pinVerifying}
                className="w-11 h-14 text-center text-xl font-black border-2 border-black bg-[#FAF8F5] focus:bg-white text-black shadow-[2px_2px_0px_0px_#000] outline-none"
              />
            ))}
          </div>

          {/* Error Message */}
          {pinError && (
            <div className="mb-4 p-2.5 border-2 border-black bg-red-100 text-red-900 text-xs font-bold flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000]">
              <AlertCircle className="w-4 h-4 stroke-[2.5] text-red-600 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          {/* Unlock Button */}
          <button
            onClick={onSubmit}
            disabled={pinVerifying || pinDigits.some((d) => !d)}
            className="neo-btn-lime w-full py-3 text-xs uppercase tracking-wider"
          >
            {pinVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                <span>Verifying PIN...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 stroke-[2.5]" />
                <span>Unlock Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-black/60 font-bold border-t-2 border-black bg-white">
        Protected administration portal &bull; MovieLens Knowledge Graph Agent
      </footer>
    </div>
  );
};
