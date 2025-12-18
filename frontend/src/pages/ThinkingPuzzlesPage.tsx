import { useState } from "react";
import { apiClient } from "../api/client";

type PracticeQuestion = {
  id: number;
  question: string;
  answer: string;
  explanation: string;
  difficulty?: string | null;
  skill_tags?: string[] | null;
};

type GeneratePracticeResponse = {
  grade: string;
  subject: string;
  skill_focus?: string | null;
  questions: PracticeQuestion[];
};

const GRADES = ["小3", "小4", "小5", "小6"];

export function ThinkingPuzzlesPage() {
  const [grade, setGrade] = useState<string>("小4");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [openAnswerIds, setOpenAnswerIds] = useState<number[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setOpenAnswerIds([]);
    try {
      const payload = {
        grade,
        subject: "思考力",
        num_questions: 3,
        skill_focus: "推理パズル",
      };

      const res = await apiClient.post<GeneratePracticeResponse>(
        "/api/generate_practice",
        payload
      );
      setQuestions(res.data.questions ?? []);
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">
            思考力：推理パズル
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            小3〜小6 向けの推理パズルを 3 問自動でつくります。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {/* 条件選択 */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                学年
              </label>
              <select
                className="mt-1 w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              {loading ? "作成中..." : "推理パズルを3問つくる"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-500">
              {error}
            </p>
          )}
        </section>

        {/* 問題リスト */}
        <section className="space-y-3">
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

              <p className="mb-2 whitespace-pre-wrap text-slate-900">
                      {q.question && q.question.trim().length > 0
                     ? q.question
                    : (() => {
                   try {
                 // question が空なら、answer/explanation 以外の情報を全部まとめて表示（デバッグ＆暫定表示用）
                  const { answer, explanation, ...rest } = q as any;
                  const text = JSON.stringify(rest, null, 2);
                    return text.length > 0
                     ? text
                    : "（問題文が取得できませんでした）";
                       } catch {
                      return "（問題文が取得できませんでした）";
                       }
                           })()}
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
        </section>
      </main>
    </div>
  );
}

export default ThinkingPuzzlesPage;
