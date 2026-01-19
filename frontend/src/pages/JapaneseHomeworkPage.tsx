import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface CheckResponse {
  correct: boolean;
  feedback: string;
  advice: string;
}

const JapaneseHomeworkPage: React.FC = () => {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!question.trim() || !answer.trim()) {
      setError("質問と答えの両方を入力してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.post<CheckResponse>(
        "/api/check_japanese_text",
        {
          question,
          answer,
        },
        { timeout: 30000 }
      );
      setResult(res.data);
    } catch {
      setError("チェックに失敗しました。時間をおいて再度お試しください。");
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
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📘 国語の宿題チェック</h1>
        <p className="text-xs text-slate-600">
          問題文とお子さまの答えを入力すると、先生がチェックします。
        </p>

        {/* 問題文 */}
        <div>
          <label className="text-xs font-semibold">問題</label>
          <textarea
            className="w-full border rounded-lg p-2 text-sm mt-1"
            rows={3}
            placeholder="例：この物語で、主人公はどんな気持ちでしたか。"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        {/* 答え */}
        <div>
          <label className="text-xs font-semibold">こどもの答え</label>
          <textarea
            className="w-full border rounded-lg p-2 text-sm mt-1"
            rows={4}
            placeholder="例：かなしい気持ちだったと思います。"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "チェック中…" : "この内容でチェック"}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="bg-white border rounded-xl p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">判定：</span>
              <span
                className={`font-bold ${
                  result.correct ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {result.correct ? "○ よくできました" : "△ もう一度考えてみよう"}
              </span>
            </div>

            <div>
              <div className="font-semibold">先生からのコメント</div>
              <div className="text-slate-700 mt-1">{result.feedback}</div>
            </div>

            <div>
              <div className="font-semibold">アドバイス</div>
              <div className="text-slate-700 mt-1">{result.advice}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JapaneseHomeworkPage;
