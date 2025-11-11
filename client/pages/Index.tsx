import { useState, useRef, useEffect } from "react";
import { Zap, Download, Loader, CheckCircle, AlertCircle } from "lucide-react";
import Papa from "papaparse";

interface CSVRow {
  [key: string]: string;
}

interface TranslationPair {
  english: string;
  tamil: string;
}

interface ModelState {
  status: "idle" | "loading" | "processing" | "training" | "complete";
  progress: number;
  pairs: TranslationPair[];
  error: string | null;
}

interface TranslationSuggestion {
  english: string;
  tamil: string;
  confidence: number;
}

// CONFIGURE YOUR GITHUB CSV URL HERE
const GITHUB_CSV_URL =
  "https://raw.githubusercontent.com/smartsw33t/corpus/main/English%20Tamil%20Corpus%20Updated%20frequently.csv";

export default function Index() {
  const [modelState, setModelState] = useState<ModelState>({
    status: "idle",
    progress: 0,
    pairs: [],
    error: null,
  });

  const [translationInput, setTranslationInput] = useState("");
  const [suggestions, setSuggestions] = useState<TranslationSuggestion[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh every 5 minutes (300000 ms)
  const REFRESH_INTERVAL = 5 * 60 * 1000;

  const calculateSimilarity = (input: string, target: string): number => {
    const inputWords = input.toLowerCase().trim().split(/\s+/);
    const targetWords = target.toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const inputWord of inputWords) {
      for (const targetWord of targetWords) {
        if (targetWord.includes(inputWord) || inputWord === targetWord) {
          matchCount++;
          break;
        }
      }
    }

    return (matchCount / Math.max(inputWords.length, targetWords.length)) * 100;
  };

  const findSuggestions = (input: string) => {
    if (!input.trim() || modelState.pairs.length === 0) {
      setSuggestions([]);
      return;
    }

    const scored = modelState.pairs
      .map((pair) => ({
        english: pair.english,
        tamil: pair.tamil,
        confidence: calculateSimilarity(input, pair.english),
      }))
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    setSuggestions(scored);
  };

  const handleTranslationInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTranslationInput(value);
    findSuggestions(value);
  };

  const processCSVData = (csvText: string) => {
    try {
      Papa.parse(csvText, {
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
              .filter((row) => row[englishKey]?.trim() && row[tamilKey]?.trim())
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
    } catch (err) {
      setModelState((prev) => ({
        ...prev,
        error: "Error processing CSV data",
        status: "idle",
      }));
    }
  };

  // Fetch CSV from GitHub
  const fetchCSV = async () => {
    setModelState((prev) => ({
      ...prev,
      status: "loading",
      progress: 0,
      error: null,
    }));

    try {
      setModelState((prev) => ({ ...prev, progress: 20 }));

      const response = await fetch(GITHUB_CSV_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`);
      }

      setModelState((prev) => ({ ...prev, progress: 50 }));

      const csvText = await response.text();
      processCSVData(csvText);
      setLastUpdated(new Date());
    } catch (err) {
      setModelState((prev) => ({
        ...prev,
        error: `Unable to load CSV from GitHub. Please check the URL and ensure CORS is enabled.`,
        status: "idle",
      }));
    }
  };

  // Fetch CSV on component mount and set up auto-refresh
  useEffect(() => {
    fetchCSV();

    // Set up interval to refresh CSV every 5 minutes
    const intervalId = setInterval(() => {
      fetchCSV();
    }, REFRESH_INTERVAL);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

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
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">TranslateML</h1>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-slate-300 text-sm">
                Translate text using your CSV-based translation model
              </p>
              {lastUpdated && (
                <p className="text-slate-500 text-xs">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* Loading State */}
          {modelState.status === "loading" && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12">
              <div className="flex flex-col items-center justify-center">
                <Loader className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">
                  Loading Translation Model
                </h2>
                <p className="text-slate-400 text-center mb-6">
                  Fetching and processing CSV from GitHub...
                </p>
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300">Progress</span>
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
              </div>
            </div>
          )}

          {/* Error State */}
          {modelState.error && (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
              <div className="flex gap-4 items-start">
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">
                    Error Loading Model
                  </h2>
                  <p className="text-red-300 text-sm">{modelState.error}</p>
                  <p className="text-slate-400 text-xs mt-4">
                    Make sure you've updated the{" "}
                    <code className="bg-white/10 px-2 py-1 rounded">
                      GITHUB_CSV_URL
                    </code>{" "}
                    constant in the code with your actual CSV URL.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Translation Section */}
          {modelState.status === "complete" && (
            <div className="space-y-8">
              {/* Translation Input */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Translate Text
                </h2>

                <input
                  type="text"
                  placeholder="Enter English text to translate..."
                  value={translationInput}
                  onChange={handleTranslationInput}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  autoFocus
                />

                {suggestions.length > 0 && (
                  <div className="mt-8 space-y-6">
                    {/* Primary Suggestion */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Best Match
                      </h3>
                      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-xl border-2 border-purple-500/50 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <p className="text-base font-semibold text-white mb-2">
                              {suggestions[0].english}
                            </p>
                            <p className="text-lg text-purple-200 font-medium">
                              {suggestions[0].tamil}
                            </p>
                          </div>
                          <div className="ml-6 text-right">
                            <div className="text-xs font-semibold text-slate-300 mb-2">
                              Confidence
                            </div>
                            <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                              {suggestions[0].confidence.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                            style={{ width: `${suggestions[0].confidence}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Alternative Matches */}
                    {suggestions.length > 1 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                          Other Matches
                        </h3>
                        <div className="space-y-2">
                          {suggestions.slice(1, 4).map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate mb-1">
                                    {suggestion.english}
                                  </p>
                                  <p className="text-sm text-purple-200 truncate">
                                    {suggestion.tamil}
                                  </p>
                                </div>
                                <div className="ml-4 text-right flex-shrink-0">
                                  <div className="text-xl font-bold text-purple-400">
                                    {suggestion.confidence.toFixed(0)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {translationInput.trim() && suggestions.length === 0 && (
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-300 text-sm">
                      No matching translations found. Try different keywords
                      from your training data.
                    </p>
                  </div>
                )}
              </div>

              {/* Model Stats */}
              <div className="grid grid-cols-3 gap-4">
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
                        0,
                      ) / modelState.pairs.length
                    ).toFixed(1)}
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                  <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-2">
                    Model Status
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-xl font-bold text-green-400">Ready</p>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={downloadModel}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Model
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
