import { Link } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-40 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-0 right-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative z-10 text-center px-6">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full border border-white/20">
          <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            404
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Page not found
        </h1>

        <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
          This page doesn't exist. Let's get you back to your translation model.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back Home
        </Link>
      </div>
    </div>
  );
}
