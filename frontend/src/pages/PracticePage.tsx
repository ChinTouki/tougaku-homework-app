import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generatePractice } from "../api/practice";

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [grade, setGrade] = useState("小4");
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generatePractice({
        grade,
        subject: "思考力",
        num_questions: 3,
        skill_focus: "推理パズル",
      });
      setQuestions(data.questions || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button
          className="text-xs text-slate-500"
          onClick={() => navigate(-1)}
        >
          ← 戻る
        </button>

        <h1 className="text-lg font-bold text-slate-900">
          思考力：推理パズル
        </h1>

        <p className="text-xs text-slate-600">
          小３〜小６向けの推理パズルを３問自動でつくります。
        </p>

        <div className="flex gap-2 text-xs">
          <span className="mt-1 text-slate-600">学年:</span>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="px-2 py-1 border rounded-lg"
          >
            {["小3", "小4", "小5", "小6"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-amber-400 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "問題を生成中…" : "推理パズルを3問つくる"}
        </button>

        <div className="space-y-3 mt-3">
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="bg-white border rounded-lg p-3 text-sm"
            >
              <div className="text-xs text-slate-500 mb-1">
                Q{idx + 1}
              </div>
              <div>{q.text}</div>
              {q.answer && (
                <details className="mt-2 text-xs">
                  <summary className="text-amber-700 cursor-pointer">
                    答えと解説を見る
                  </summary>
                  <div className="mt-1">
                    <div>答え: {q.answer}</div>
                    <div className="text-slate-600 mt-1">
                      解説: {q.explanation}
                    </div>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PracticePage;
