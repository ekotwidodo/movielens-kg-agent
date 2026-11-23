import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock, Database, ArrowLeft } from "lucide-react";
import {
  verifySettingsPin,
  fetchLlmSettings,
  saveLlmSettings,
  testLlmConnection,
  uploadDatasetFiles,
  downloadSampleDataset,
  streamTransformation,
  LlmSettingsData,
  LlmTestResult,
  TransformValidationIssue,
} from "../api/client";
import { PinAuth } from "../components/settings/PinAuth";
import { LlmConfigForm } from "../components/settings/LlmConfigForm";
import { DatasetUploader, SelectedFiles } from "../components/settings/DatasetUploader";
import { TransformLogs } from "../components/settings/TransformLogs";

const PIN_STORAGE_KEY = "movielens_kg_settings_pin";

/**
 * Main Settings & Ingestion Management Page.
 * Orchestrates PIN security, LLM configurations, and dataset uploads.
 */
export const SettingData: React.FC = () => {
  // Authentication PIN state
  const [pin, setPin] = useState<string>("");
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);

  // LLM settings state
  const [llmSettings, setLlmSettings] = useState<LlmSettingsData | null>(null);
  const [llmBaseUrl, setLlmBaseUrl] = useState<string>("");
  const [llmModel, setLlmModel] = useState<string>("");
  const [llmApiKey, setLlmApiKey] = useState<string>("");
  const [llmLoading, setLlmLoading] = useState<boolean>(false);
  const [llmSaving, setLlmSaving] = useState<boolean>(false);
  const [llmSaveMsg, setLlmSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testingLlm, setTestingLlm] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);

  // Dataset Upload state
  const [files, setFiles] = useState<SelectedFiles>({
    movies: null,
    ratings: null,
    tags: null,
    links: null,
  });
  const [strictMode, setStrictMode] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "uploading" | "transforming" | "complete" | "error">("idle");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<TransformValidationIssue[]>([]);
  const [completionReport, setCompletionReport] = useState<Record<string, unknown> | null>(null);

  const timerRef = useRef<number | null>(null);

  // Check stored PIN on load
  useEffect(() => {
    const savedPin = sessionStorage.getItem(PIN_STORAGE_KEY);
    if (savedPin && savedPin.length === 6) {
      verifyPinOnServer(savedPin, false);
    }
  }, []);

  // Timer effect during active transformation
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      const interval = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      timerRef.current = interval;
      return () => clearInterval(interval);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isProcessing]);

  // Load LLM configuration from API
  const loadSettingsData = async (validPin: string) => {
    setLlmLoading(true);
    try {
      const data = await fetchLlmSettings(validPin);
      setLlmSettings(data);
      setLlmBaseUrl(data.base_url);
      setLlmModel(data.model);
      setLlmApiKey("");
    } catch (e: unknown) {
      console.warn("Could not load LLM settings:", e);
    } finally {
      setLlmLoading(false);
    }
  };

  const verifyPinOnServer = async (testPin: string, showMsg = true) => {
    setPinVerifying(true);
    setPinError(null);
    try {
      const ok = await verifySettingsPin(testPin);
      if (ok) {
        setIsAuthenticated(true);
        setPin(testPin);
        sessionStorage.setItem(PIN_STORAGE_KEY, testPin);
        loadSettingsData(testPin);
      } else {
        if (showMsg) setPinError("Incorrect 6-digit PIN. Please try again.");
        setIsAuthenticated(false);
        sessionStorage.removeItem(PIN_STORAGE_KEY);
      }
    } catch {
      if (showMsg) setPinError("Unable to connect to server for PIN check.");
    } finally {
      setPinVerifying(false);
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...pinDigits];
    newDigits[index] = val.slice(-1);
    setPinDigits(newDigits);

    const fullPin = newDigits.join("");
    if (fullPin.length === 6 && newDigits.every((d) => d !== "")) {
      verifyPinOnServer(fullPin);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      // Focus handled in PinAuth
    }
  };

  const handlePastePin = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setPinDigits(pasted.split(""));
      verifyPinOnServer(pasted);
    }
  };

  const handleLockOut = () => {
    sessionStorage.removeItem(PIN_STORAGE_KEY);
    setIsAuthenticated(false);
    setPin("");
    setPinDigits(["", "", "", "", "", ""]);
  };

  // LLM Save and Test
  const handleSaveLlm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!llmBaseUrl.trim() || !llmModel.trim()) {
      setLlmSaveMsg({ type: "error", text: "Base URL and Model name are required." });
      return;
    }
    setLlmSaving(true);
    setLlmSaveMsg(null);
    try {
      await saveLlmSettings(
        {
          base_url: llmBaseUrl.trim(),
          model: llmModel.trim(),
          api_key: llmApiKey.trim() ? llmApiKey.trim() : undefined,
        },
        pin
      );
      setLlmSaveMsg({ type: "success", text: "LLM configuration saved successfully!" });
      loadSettingsData(pin);
    } catch (err: unknown) {
      setLlmSaveMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings.",
      });
    } finally {
      setLlmSaving(false);
    }
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setTestResult(null);
    try {
      const res = await testLlmConnection(
        {
          base_url: llmBaseUrl.trim() || undefined,
          model: llmModel.trim() || undefined,
          api_key: llmApiKey.trim() || undefined,
        },
        pin
      );
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        status: "error",
        latency_ms: 0,
        detail: err instanceof Error ? err.message : "Connection failed.",
      });
    } finally {
      setTestingLlm(false);
    }
  };

  // Dataset file handlers
  const handleFileSelect = (key: keyof SelectedFiles, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const newFiles = { ...files };
    selected.forEach((f) => {
      const name = f.name.toLowerCase();
      if (name.includes("movies")) newFiles.movies = f;
      else if (name.includes("ratings")) newFiles.ratings = f;
      else if (name.includes("tags")) newFiles.tags = f;
      else if (name.includes("links")) newFiles.links = f;
    });
    setFiles(newFiles);
  };

  const startIngestionPipeline = async () => {
    if (!files.movies || !files.ratings) {
      alert("movies.csv and ratings.csv are required to build the knowledge graph.");
      return;
    }

    setIsProcessing(true);
    setUploadStep("uploading");
    setProgressPercent(5);
    setStatusMessage("Uploading CSV files to server...");
    setTransformError(null);
    setValidationIssues([]);
    setCompletionReport(null);

    try {
      const formData = new FormData();
      if (files.movies) formData.append("files", files.movies, "movies.csv");
      if (files.ratings) formData.append("files", files.ratings, "ratings.csv");
      if (files.tags) formData.append("files", files.tags, "tags.csv");
      if (files.links) formData.append("files", files.links, "links.csv");

      const uploadRes = await uploadDatasetFiles(formData, pin);

      setUploadStep("transforming");
      setProgressPercent(10);
      setStatusMessage("Transforming CSV records into RDF Knowledge Graph...");

      await streamTransformation(uploadRes.upload_id, strictMode, pin, (event) => {
        if (event.type === "progress") {
          setProgressPercent(event.percent);
          setStatusMessage(event.message);
        } else if (event.type === "complete") {
          setProgressPercent(100);
          setStatusMessage(event.message);
          setUploadStep("complete");
          if (event.report) setCompletionReport(event.report);
        } else if (event.type === "error") {
          setUploadStep("error");
          setTransformError(event.message);
          if (event.issues) setValidationIssues(event.issues);
        }
      });
    } catch (err: unknown) {
      setUploadStep("error");
      setTransformError(err instanceof Error ? err.message : "Dataset processing failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = async () => {
    setIsProcessing(true);
    setUploadStep("uploading");
    setProgressPercent(15);
    setStatusMessage("Downloading official MovieLens dataset from GroupLens...");
    setTransformError(null);
    setValidationIssues([]);
    setCompletionReport(null);

    try {
      const res = await downloadSampleDataset(pin);
      setUploadStep("transforming");
      setProgressPercent(25);
      setStatusMessage("Transforming dataset & loading into Apache Jena Fuseki...");
      await streamTransformation(res.upload_id, strictMode, pin, (event) => {
        if (event.type === "progress") {
          setProgressPercent(event.percent);
          setStatusMessage(event.message);
        } else if (event.type === "complete") {
          setProgressPercent(100);
          setStatusMessage(event.message);
          setUploadStep("complete");
          if (event.report) setCompletionReport(event.report);
        } else if (event.type === "error") {
          setUploadStep("error");
          setTransformError(event.message);
          if (event.issues) setValidationIssues(event.issues);
        }
      });
    } catch (err: unknown) {
      setUploadStep("error");
      setTransformError(err instanceof Error ? err.message : "Failed to load sample dataset.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <PinAuth
        pinDigits={pinDigits}
        pinVerifying={pinVerifying}
        pinError={pinError}
        onDigitChange={handleDigitChange}
        onDigitKeyDown={handleDigitKeyDown}
        onPastePin={handlePastePin}
        onSubmit={() => verifyPinOnServer(pinDigits.join(""))}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-[#042f2e] border-b-2 border-black text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000] group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-black text-white text-base tracking-tight uppercase">
                MovieLens <span className="text-[#ccff00]">KG</span>
              </span>
              <span className="text-xs font-black text-black bg-[#ccff00] border-2 border-black px-2 py-0.5 shadow-[1.5px_1.5px_0px_0px_#000]">
                ADMIN
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="neo-btn-white px-3 py-1.5 text-xs font-black uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Back to App</span>
            </Link>
            <button
              onClick={handleLockOut}
              className="neo-btn-white px-3 py-1.5 text-xs font-black uppercase tracking-wider"
            >
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-xs font-black uppercase text-black/60 tracking-wider">SYSTEM CONFIGURATION</span>
            <span className="neo-badge">
              <Unlock className="w-3 h-3 stroke-[2.5]" />
              UNLOCKED
            </span>
          </div>
          <h1 className="text-3xl font-black text-black uppercase tracking-tight">
            Settings & Data Management
          </h1>
          <p className="text-xs text-slate-700 font-medium mt-1">
            Configure LLM connections, auto-load official MovieLens datasets, or upload custom CSVs to build the RDF triplestore.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LLM Configuration Form (Left column) */}
          <div className="lg:col-span-5 space-y-6">
            <LlmConfigForm
              llmSettings={llmSettings}
              llmBaseUrl={llmBaseUrl}
              llmModel={llmModel}
              llmApiKey={llmApiKey}
              llmLoading={llmLoading}
              llmSaving={llmSaving}
              llmSaveMsg={llmSaveMsg}
              testingLlm={testingLlm}
              testResult={testResult}
              onBaseUrlChange={setLlmBaseUrl}
              onModelChange={setLlmModel}
              onApiKeyChange={setLlmApiKey}
              onSave={handleSaveLlm}
              onTest={handleTestLlm}
            />
          </div>

          {/* Dataset Upload & Transformation Logs (Right column) */}
          <div className="lg:col-span-7 space-y-6">
            <DatasetUploader
              files={files}
              strictMode={strictMode}
              isProcessing={isProcessing}
              onFileSelect={handleFileSelect}
              onBatchFiles={handleBatchFiles}
              onToggleStrictMode={setStrictMode}
              onStartIngestion={startIngestionPipeline}
              onDownloadSample={handleDownloadSample}
            />
            <TransformLogs
              uploadStep={uploadStep}
              progressPercent={progressPercent}
              statusMessage={statusMessage}
              elapsedSeconds={elapsedSeconds}
              transformError={transformError}
              validationIssues={validationIssues}
              completionReport={completionReport}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        MovieLens KG Agent &bull; Administration Panel
      </footer>
    </div>
  );
};

export default SettingData;
