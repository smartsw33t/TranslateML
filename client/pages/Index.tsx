import { useState, useEffect } from "react";
import {
  Zap,
  Download,
  Loader,
  CheckCircle,
  AlertCircle,
  Copy,
} from "lucide-react";
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

interface WordMatch {
  word: string;
  translation: string;
  matches: TranslationSuggestion[];
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
  const [topWords, setTopWords] = useState<Array<{ word: string; count: number }>>([]);

  // Auto-refresh every 5 minutes (300000 ms)
  const REFRESH_INTERVAL = 5 * 60 * 1000;

  // Common English stop words (fillers that don't need individual translation)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "am", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "can", "of", "in",
    "on", "at", "to", "for", "with", "by", "from", "as", "if", "that", "this",
    "it", "which", "who", "whom", "what", "when", "where", "why", "how", "not",
    "no", "yes", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us",
    "them", "my", "your", "his", "her", "its", "our", "their", "what", "all",
    "each", "every", "both", "some", "any", "few", "more", "most", "other",
    "such", "so", "than", "too", "very", "just", "only", "own", "same", "then",
    "now", "here", "there", "about", "above", "after", "again", "against", "any",
    "because", "before", "being", "below", "between", "both", "during", "each",
    "few", "further", "had", "has", "have", "having", "he", "her", "here",
    "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "itself", "just", "me", "might", "more", "most", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "only", "or", "other",
    "our", "ours", "ourselves", "out", "over", "own", "same", "should", "so",
    "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
    "when", "where", "which", "while", "who", "whom", "why", "with", "you",
    "your", "yours", "yourself", "yourselves"
  ]);

  const isContentWord = (word: string): boolean => {
    return !stopWords.has(word.toLowerCase());
  };

  const calculateTemplateSimilarity = (input: string, corpusPhrase: string): { score: number; inputWords: string[]; corpusWords: string[]; diffIndices: number[] } => {
    const inputWords = input.toLowerCase().split(/\s+/);
    const corpusWords = corpusPhrase.toLowerCase().split(/\s+/);

    if (inputWords.length !== corpusWords.length) {
      return { score: 0, inputWords: [], corpusWords: [], diffIndices: [] };
    }

    let matchCount = 0;
    const diffIndices: number[] = [];

    inputWords.forEach((word, idx) => {
      const corpusWord = corpusWords[idx];
      if (word === corpusWord) {
        matchCount++;
      } else if (!isContentWord(word) && !isContentWord(corpusWord)) {
        // Both are filler words but different - treat as partial match
        matchCount += 0.5;
      } else if (isContentWord(word) && isContentWord(corpusWord)) {
        // Both are content words but different - track difference
        diffIndices.push(idx);
      } else {
        diffIndices.push(idx);
      }
    });

    const baseScore = (matchCount / inputWords.length) * 100;
    // Boost score if differences are only in content words
    const onlyContentWordDiffs = diffIndices.every(idx => isContentWord(inputWords[idx]) && isContentWord(corpusWords[idx]));
    const score = onlyContentWordDiffs ? Math.max(baseScore, 10) : baseScore;

    return { score, inputWords, corpusWords, diffIndices };
  };

  const findBestTemplateSentence = (input: string): { match: TranslationPair; similarity: number; diffIndices: number[]; inputWords: string[] } | null => {
    let bestMatch: { pair: TranslationPair; score: number; inputWords: string[]; corpusWords: string[]; diffIndices: number[] } | null = null;

    modelState.pairs.forEach((pair) => {
      const { score, inputWords, corpusWords, diffIndices } = calculateTemplateSimilarity(input, pair.english);

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { pair, score, inputWords, corpusWords, diffIndices };
      }
    });

    if (!bestMatch) return null;

    return {
      match: bestMatch.pair,
      similarity: Math.min(100, bestMatch.score),
      diffIndices: bestMatch.diffIndices,
      inputWords: bestMatch.inputWords,
    };
  };

  const buildTemplateTranslation = (input: string): { result: string; templateMatch: TranslationPair | null; confidence: number; wordReplacements: Array<{ original: string; replacement: string }> } => {
    if (!input.trim()) {
      return { result: "", templateMatch: null, confidence: 0, wordReplacements: [] };
    }

    const templateMatch = findBestTemplateSentence(input);

    if (!templateMatch) {
      return { result: "", templateMatch: null, confidence: 0, wordReplacements: [] };
    }

    const { match, diffIndices, inputWords } = templateMatch;
    const tamilWords = match.tamil.split(/\s+/);
    const corpusWords = match.english.toLowerCase().split(/\s+/);
    const wordReplacements: Array<{ original: string; replacement: string }> = [];

    // For each differing position, find translation of the new content word
    const replacementTamilWords = [...tamilWords];

    diffIndices.forEach((idx) => {
      const newWord = inputWords[idx];
      if (isContentWord(newWord)) {
        // Find translation for this word
        const bestWordMatch = modelState.pairs
          .map((pair) => ({
            english: pair.english,
            tamil: pair.tamil,
            confidence: calculateSimilarity(newWord, pair.english),
          }))
          .filter((s) => s.confidence > 50)
          .sort((a, b) => b.confidence - a.confidence)[0];

        if (bestWordMatch) {
          // Try to replace the corresponding tamil word
          replacementTamilWords[idx] = bestWordMatch.tamil;
          wordReplacements.push({
            original: corpusWords[idx],
            replacement: newWord,
          });
        }
      }
    });

    return {
      result: replacementTamilWords.join(" "),
      templateMatch: match,
      confidence: templateMatch.similarity,
      wordReplacements,
    };
  };

  const calculateWordFrequency = (pairs: TranslationPair[]) => {
    const wordCount: Record<string, number> = {};

    pairs.forEach((pair) => {
      const words = pair.english
        .toLowerCase()
        .match(/\b\w+\b/g) || [];

      words.forEach((word) => {
        if (!stopWords.has(word) && word.length > 1) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(wordCount)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .sort((a, b) => a.count - b.count);

    setTopWords(sorted);
  };

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


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
              calculateWordFrequency(pairs);
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

  useEffect(() => {
    fetchCSV();

    const intervalId = setInterval(() => {
      fetchCSV();
    }, REFRESH_INTERVAL);

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
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">TranslateML</h1>
                </div>
                <p className="text-slate-300 text-sm">
                  Translate text using your CSV-based translation model
                </p>
              </div>
              {lastUpdated && (
                <p className="text-slate-500 text-xs">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
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
                    Make sure you've updated the <code className="bg-white/10 px-2 py-1 rounded">GITHUB_CSV_URL</code> constant in the code with your actual CSV URL.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Translation Section */}
          {modelState.status === "complete" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-8">
                {/* Translation Input */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Translate Text
                  </h2>

                  <input
                    type="text"
                    placeholder="Enter English text to translate..."
                    value={translationInput}
                    onChange={(e) => {
                      setTranslationInput(e.target.value);
                      findSuggestions(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    autoFocus
                  />

                  {translationInput.trim() && (
                    <div className="mt-8 space-y-6">
                      {/* Complete Translation Output */}
                      {(() => {
                        const { result, wordMatches } = buildCompleteTranslation(translationInput);
                        return (
                          <div>
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                              Complete Translation
                            </h3>
                            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-xl border-2 border-blue-500/50 p-6">
                              <div className="flex items-start gap-4">
                                <div className="flex-1">
                                  <textarea
                                    readOnly
                                    value={result}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-sm leading-relaxed focus:outline-none resize-none"
                                    rows={3}
                                  />
                                </div>
                                <button
                                  onClick={() => copyToClipboard(result)}
                                  className="flex-shrink-0 mt-1 p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="w-5 h-5 text-blue-300" />
                                </button>
                              </div>

                              {/* Word-by-word breakdown */}
                              {wordMatches.length > 0 && (
                                <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Word Breakdown
                                  </p>
                                  {wordMatches.map((match, idx) => (
                                    <div key={idx} className="space-y-2">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-sm font-medium text-white bg-white/10 px-3 py-1 rounded">
                                          {match.word}
                                        </span>
                                        <span className="text-sm text-blue-200">→</span>
                                        <span className="text-sm font-medium text-blue-300">
                                          {match.translation}
                                        </span>
                                        {match.matches.length > 1 && (
                                          <span className="text-xs text-slate-400">
                                            +{match.matches.length - 1} alternatives
                                          </span>
                                        )}
                                      </div>
                                      {match.matches.length > 1 && (
                                        <div className="ml-3 space-y-1">
                                          {match.matches.slice(1, 3).map((alt, altIdx) => (
                                            <div
                                              key={altIdx}
                                              className="flex items-center gap-2 text-xs"
                                            >
                                              <span className="text-slate-500">
                                                {alt.tamil}
                                              </span>
                                              <span className="text-slate-600">
                                                ({alt.confidence.toFixed(0)}%)
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Phrase Suggestions */}
                      {suggestions.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Phrase Suggestions
                          </h3>

                          {/* Primary Suggestion */}
                          <div>
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
                            <div className="mt-4">
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
                    </div>
                  )}

                  {translationInput.trim() && suggestions.length === 0 && (
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-300 text-sm">
                        No matching translations found. Try different keywords from your training data.
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
                          0
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

              {/* Side Panel - Top Words */}
              <div className="lg:col-span-1">
                <div className="sticky top-20 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 h-fit">
                  <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                    Top Words
                  </h2>
                  {topWords.length > 0 ? (
                    <div className="space-y-3">
                      {topWords.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {item.word}
                            </p>
                            <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                style={{
                                  width: `${(item.count / Math.max(...topWords.map(w => w.count))) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-purple-300 ml-2 flex-shrink-0">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs">Analyzing corpus...</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
