import React, { useState } from "react";
import { Cpu, Eye, EyeOff, Loader2, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { LlmSettingsData, LlmTestResult } from "../../api/client";

interface LlmConfigFormProps {
  llmSettings: LlmSettingsData | null;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  llmLoading: boolean;
  llmSaving: boolean;
  llmSaveMsg: { type: "success" | "error"; text: string } | null;
  testingLlm: boolean;
  testResult: LlmTestResult | null;
  onBaseUrlChange: (val: string) => void;
  onModelChange: (val: string) => void;
  onApiKeyChange: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
  onTest: () => void;
}

export const LlmConfigForm: React.FC<LlmConfigFormProps> = ({
  llmSettings,
  llmBaseUrl,
  llmModel,
  llmApiKey,
  llmLoading,
  llmSaving,
  llmSaveMsg,
  testingLlm,
  testResult,
  onBaseUrlChange,
  onModelChange,
  onApiKeyChange,
  onSave,
  onTest,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="neo-box p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        <div>
          <span className="text-xs font-black uppercase text-black/60 tracking-wider">02 / LLM INTEGRATION</span>
          <h2 className="font-black text-black text-lg uppercase tracking-tight">Language Model Configuration</h2>
        </div>
        <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
          <Cpu className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {llmLoading ? (
        <div className="py-8 flex items-center justify-center text-black font-bold gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
          <span>Loading configuration...</span>
        </div>
      ) : (
        <form onSubmit={onSave} className="space-y-4">
          {/* Model Name */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-black mb-1">
              LLM Model Name <span className="text-red-600 font-black">*</span>
            </label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g. inclusionai/ling-3.2-flash:free or gpt-4o-mini"
              className="w-full text-xs font-bold px-3 py-2.5 border-2 border-black bg-[#FAF8F5] focus:bg-white outline-none shadow-[2px_2px_0px_0px_#000]"
              required
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-black mb-1">
              API Base URL <span className="text-red-600 font-black">*</span>
            </label>
            <input
              type="url"
              value={llmBaseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="https://openrouter.ai/api/v1 or http://localhost:11434/v1"
              className="w-full text-xs font-bold px-3 py-2.5 border-2 border-black bg-[#FAF8F5] focus:bg-white outline-none shadow-[2px_2px_0px_0px_#000]"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold uppercase text-black">API Key</label>
              {llmSettings?.has_api_key && (
                <span className="neo-badge">
                  Configured ({llmSettings.masked_api_key})
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={llmApiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={
                  llmSettings?.has_api_key ? "Leave blank to keep current key" : "sk-..."
                }
                className="w-full text-xs font-mono font-bold px-3 py-2.5 pr-10 border-2 border-black bg-[#FAF8F5] focus:bg-white outline-none shadow-[2px_2px_0px_0px_#000]"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-3 text-black hover:text-slate-700 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4 stroke-[2.5]" /> : <Eye className="w-4 h-4 stroke-[2.5]" />}
              </button>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1">
              For local endpoints (e.g. Ollama or vLLM), API Key can be left blank.
            </p>
          </div>

          {/* Save Status Feedback */}
          {llmSaveMsg && (
            <div
              className={`p-3 border-2 border-black text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_0px_#000] ${
                llmSaveMsg.type === "success"
                  ? "bg-[#ccff00] text-black"
                  : "bg-red-100 text-red-900 border-red-600"
              }`}
            >
              {llmSaveMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>{llmSaveMsg.text}</span>
            </div>
          )}

          {/* Buttons: Save & Test */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={llmSaving}
              className="neo-btn-lime flex-1 py-2.5 px-4 text-xs uppercase tracking-wider"
            >
              {llmSaving ? <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" /> : null}
              <span>{llmSaving ? "Saving..." : "Save Settings"}</span>
            </button>

            <button
              type="button"
              onClick={onTest}
              disabled={testingLlm}
              className="neo-btn-white py-2.5 px-4 text-xs uppercase tracking-wider"
            >
              {testingLlm ? (
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
              ) : (
                <Play className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>{testingLlm ? "Testing..." : "Test Connection"}</span>
            </button>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`mt-3 p-3.5 border-2 border-black text-xs shadow-[2px_2px_0px_0px_#000] ${
                testResult.status === "ok"
                  ? "bg-[#ccff00]/25 text-black"
                  : "bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black uppercase flex items-center gap-1.5">
                  {testResult.status === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-black" />
                  ) : (
                    <AlertCircle className="w-4 h-4 stroke-[2.5] text-red-600" />
                  )}
                  {testResult.status === "ok" ? "Connection Successful" : "Connection Failed"}
                </span>
                {testResult.latency_ms > 0 && (
                  <span className="text-xs font-mono font-bold text-black border border-black bg-white px-2 py-0.5">
                    {testResult.latency_ms} ms
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-800 break-words mt-1">{testResult.detail}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
