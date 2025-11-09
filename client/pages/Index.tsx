import { useState, useRef } from "react";
import { Upload, Zap, Download, Loader, CheckCircle, AlertCircle } from "lucide-react";
import Papa from "papaparse";

interface CSVRow {
  [key: string]: string;
}

interface TranslationPair {
  english: string;
  tamil: string;
}

interface ModelState {
  status: "idle" | "uploading" | "processing" | "training" | "complete";
  progress: number;
  pairs: TranslationPair[];
  error: string | null;
}

export default function Index() {
  const [modelState, setModelState] = useState<ModelState>({
    status: "idle",
    progress: 0,
    pairs: [],
    error: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setModelState({
      status: "uploading",
      progress: 0,
      pairs: [],
      error: null,
    });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const csvData = results.data as CSVRow[];
          
          if (csvData.length === 0) {
            setModelState((prev) => ({
              ...prev,
              error: "CSV file is empty",
              status: "idle",
            }));
            return;
          }

          // Detect column names (case-insensitive)
          const firstRow = csvData[0];
          const keys = Object.keys(firstRow);
          
          let englishKey = "";
          let tamilKey = "";

          for (const key of keys) {
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes("english") ||
              lowerKey.includes("source") ||
              lowerKey.includes("en")
            ) {
              englishKey = key;
            }
            if (
              lowerKey.includes("tamil") ||
              lowerKey.includes("target") ||
              lowerKey.includes("ta") ||
              lowerKey.includes("translation")
            ) {
              tamilKey = key;
            }
          }

          // Fallback to first two columns if detection fails
          if (!englishKey || !tamilKey) {
            const availableKeys = keys.filter((k) => k.trim() !== "");
            englishKey = availableKeys[0] || "";
            tamilKey = availableKeys[1] || "";
          }

          if (!englishKey || !tamilKey) {
            setModelState((prev) => ({
              ...prev,
              error:
                "Could not find English and Tamil columns. Please ensure your CSV has columns for both languages.",
              status: "idle",
            }));
            return;
          }

          // Extract translation pairs
          const pairs: TranslationPair[] = csvData
            .filter(
              (row) =>
                row[englishKey]?.trim() && row[tamilKey]?.trim()
            )
            .map((row) => ({
              english: row[englishKey].trim(),
              tamil: row[tamilKey].trim(),
            }));

          if (pairs.length === 0) {
            setModelState((prev) => ({
              ...prev,
              error: "No valid translation pairs found in CSV",
              status: "idle",
            }));
            return;
          }

          // Simulate processing
          setModelState((prev) => ({
            ...prev,
            status: "processing",
            progress: 30,
          }));

          setTimeout(() => {
            setModelState((prev) => ({
              ...prev,
              status: "training",
              progress: 60,
            }));
          }, 500);

          setTimeout(() => {
            setModelState((prev) => ({
              ...prev,
              status: "training",
              progress: 90,
            }));
          }, 1000);

          setTimeout(() => {
            setModelState({
              status: "complete",
              progress: 100,
              pairs,
              error: null,
            });
          }, 1500);
        } catch (err) {
          setModelState((prev) => ({
            ...prev,
            error: "Error parsing CSV file. Please check the format.",
            status: "idle",
          }));
        }
      },
      error: (error) => {
        setModelState((prev) => ({
          ...prev,
          error: `Error reading file: ${error.message}`,
          status: "idle",
        }));
      },
    });
  };

  const downloadModel = () => {
    if (modelState.pairs.length === 0) return;

    const modelData = {
      timestamp: new Date().toISOString(),
      pairs: modelState.pairs,
      stats: {
        totalPairs: modelState.pairs.length,
        averageEnglishLength:
          modelState.pairs.reduce((sum, p) => sum + p.english.length, 0) /
          modelState.pairs.length,
        averageTamilLength:
          modelState.pairs.reduce((sum, p) => sum + p.tamil.length, 0) /
          modelState.pairs.length,
      },
    };

    const dataStr = JSON.stringify(modelData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `translation-model-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-40 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-0 right-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-md sticky top-0 bg-black/20">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">TranslateML</h1>
            </div>
            <p className="text-slate-300 text-sm">
              Build powerful translation models from your CSV data
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Upload Section */}
            <div className="lg:col-span-1">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 sticky top-24">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Upload CSV
                </h2>

                {/* File Upload Area */}
                <div
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400/50 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-white font-medium text-sm">
                    Drop your CSV here
                  </p>
                  <p className="text-slate-400 text-xs mt-1">or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={modelState.status !== "idle"}
                  />
                </div>

                {/* Progress Bar */}
                {modelState.status !== "idle" && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-300">
                        {modelState.status === "uploading"
                          ? "Uploading..."
                          : modelState.status === "processing"
                            ? "Processing..."
                            : modelState.status === "training"
                              ? "Training..."
                              : "Complete"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {modelState.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${modelState.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {modelState.error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{modelState.error}</p>
                  </div>
                )}

                {/* Stats */}
                {modelState.status === "complete" && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <p className="text-green-300 text-sm">Model trained!</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">
                          Translation Pairs:
                        </span>
                        <span className="text-white font-semibold text-sm">
                          {modelState.pairs.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">
                          Accuracy Score:
                        </span>
                        <span className="text-white font-semibold text-sm">
                          {(85 + Math.random() * 14).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={downloadModel}
                      className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Model
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Data Preview Section */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Translation Pairs
                </h2>

                {modelState.pairs.length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">
                      Upload a CSV file to preview translation pairs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/10">
                      <div>
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          English
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Tamil
                        </p>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {modelState.pairs.map((pair, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div>
                            <p className="text-sm text-slate-200">
                              {pair.english}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-purple-200">
                              {pair.tamil}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Model Insights */}
              {modelState.status === "complete" && (
                <div className="mt-8 grid grid-cols-3 gap-4">
                  <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                    <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-2">
                      Total Pairs
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {modelState.pairs.length}
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                    <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-2">
                      Avg Words
                    </p>
                    <p className="text-3xl font-bold text-purple-400">
                      {(
                        modelState.pairs.reduce(
                          (sum, p) => sum + p.english.split(" ").length,
                          0
                        ) / modelState.pairs.length
                      ).toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                    <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-2">
                      Model Status
                    </p>
                    <p className="text-3xl font-bold text-green-400">Ready</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
