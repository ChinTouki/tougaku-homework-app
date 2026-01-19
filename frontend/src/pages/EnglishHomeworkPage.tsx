import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface CheckResponse {
  correct: boolean;
  feedback: string;
  advice: string;
}

const EnglishHomeworkPage: React.FC = () => {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!question.trim() || !answer.trim()) {
      setError("Please enter both the question and the child's answer.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.post<CheckResponse>(
        "/api/check_english_text",
        {
          question,
          answer,
        },
        { timeout: 30000 }
      );
      setResult(res.data);
    } catch {
      setError("Check failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-slate-500"
        >
          ← Back
        </button>

        <h1 className="text-lg font-bold">🔤 English Homework Check</h1>
        <p className="text-xs text-slate-600">
          Enter the question and your child's answer. A teacher will check it.
        </p>

        {/* Question */}
        <div>
          <label className="text-xs font-semibold">Question</label>
          <textarea
            className="w-full border rounded-lg p-2 text-sm mt-1"
            rows={3}
            placeholder="Example: What is your favorite food?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        {/* Answer */}
        <div>
          <label className="text-xs font-semibold">Child's Answer</label>
          <textarea
            className="w-full border rounded-lg p-2 text-sm mt-1"
            rows={4}
            placeholder="Example: My favorite food is pizza."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "Checking…" : "Check Answer"}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white border rounded-xl p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Result:</span>
              <span
                className={`font-bold ${
                  result.correct ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {result.correct ? "✔ Good job!" : "△ Let's improve"}
              </span>
            </div>

            <div>
              <div className="font-semibold">Teacher's Feedback</div>
              <div className="text-slate-700 mt-1">{result.feedback}</div>
            </div>

            <div>
              <div className="font-semibold">Advice</div>
              <div className="text-slate-700 mt-1">{result.advice}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnglishHomeworkPage;
