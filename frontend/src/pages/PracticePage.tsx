import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generatePractice } from "../api/practice";

// LLM から返ってくる 1 問分の型
type PracticeQuestion = {
  id: number;
  question: string;
  answer: string;
  explanation: string;
  difficulty?: string | null;
  skill_tags?: string[] | null;
};

const PracticePage: React.FC = () => {
  const navigate = useNavigate();

  const [grade, setGrade] = useState("小4");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAnswerIds, setOpenAnswerIds] = useState<number[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setOpenAnswerIds([]);
    try {
      const data = await generatePractice({
        grade,
        subject: "思考力",
        num_questions: 3,
        skill_focus: "推理パズル",
      });

      // data.questions があることを前提にする（なければ空配列）
      setQuestions((data.questions ?? []) as PracticeQuestion[]);
    } catch (e) {
      console.error(e);
      setError("問題の生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswer = (id: number) => {
    setOpenAnswerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

        <div className="flex gap-2 text-xs items-center">
          <span className="mt-1 text-slate-600">学年:</span>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="px-2 py-1 border rounded-lg bg-white"
          >
            {["小3", "小4", "小5", "小6"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
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

        {error && (
          <p className="text-xs text-red-500 mt-1">
            {error}
          </p>
        )}

        <div className="space-y-3 mt-3">
          {questions.map((q, idx) => {
            const isOpen = openAnswerIds.includes(q.id);

            return (
              <article
                key={q.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed"
              >
                <div className="font-semibold text-slate-800 mb-1">
                  Q{idx + 1}
                </div>

                {/* ★ 题目文本 */}
                <p className="mb-2 whitespace-pre-wrap text-slate-900">
                  {q.question && q.question.trim().length > 0
                    ? q.question
                    : "（問題文が取得できませんでした）"}
                </p>

                <button
                  type="button"
                  onClick={() => toggleAnswer(q.id)}
                  className="text-xs font-medium text-amber-600 hover:underline"
                >
                  {isOpen ? "▲ 答えと解説をとじる" : "▼ 答えと解説を見る"}
                </button>

                {isOpen && (
                  <div className="mt-2 space-y-1 text-slate-800">
                    <p>
                      <span className="font-semibold">答え：</span>
                      <span className="whitespace-pre-wrap">{q.answer}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700">
                      <span className="font-semibold">解説：</span>
                      {q.explanation}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {q.difficulty && (
                        <span className="rounded-full border border-slate-200 px-2 py-[2px]">
                          難易度: {q.difficulty}
                        </span>
                      )}
                      {q.skill_tags &&
                        q.skill_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 px-2 py-[2px]"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {!loading && questions.length === 0 && (
            <p className="text-xs text-slate-500">
              「推理パズルを3問つくる」を押すと、この下に問題が表示されます。
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticePage;
