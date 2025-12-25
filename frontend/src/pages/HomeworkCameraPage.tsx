// frontend/src/pages/HomeworkCameraPage.tsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

type SimilarPracticeItem =
  | string
  | {
      question?: string;
      answer?: string;
      explanation?: string;
    };

interface DetectedProblem {
  id: number;
  question_text?: string;
  child_answer?: string;
  correct?: boolean;
  score?: number;
  feedback?: string;
  hint?: string;
  similar_practice?: SimilarPracticeItem[];
}

interface CheckImageResponse {
  subject: string;
  detected_grade?: string;
  problems: DetectedProblem[];
}

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CheckImageResponse | null>(null);

  /* ========= 文件选择 ========= */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setErrorMsg(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  /* ========= 拍照检查 ========= */
  const handleCheck = async () => {
    if (!file) {
      setErrorMsg("まず宿題の写真を選んでください。");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("subject", "算数"); // 后面可改为 auto

    try {
      const res = await apiClient.post<CheckImageResponse>(
        "/api/check_homework_image",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 90000,
        }
      );

      const data = res.data || ({} as any);
      const safeProblems = Array.isArray(data.problems)
        ? data.problems
        : [];

      setResult({
        subject: data.subject || "算数",
        detected_grade: data.detected_grade,
        problems: safeProblems,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "宿題のチェックに失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ========= E3：跳转到思考力练习 ========= */
  const goToPractice = (skillFocus?: string) => {
    const grade = result?.detected_grade || "小4";
    const subject = "思考力";

    const params = new URLSearchParams({
      grade,
      subject,
      num_questions: "3",
    });

    if (skillFocus) {
      params.set("skill_focus", skillFocus);
    }

    navigate(`/practice?${params.toString()}`);
  };

  /* ========= E1：本日のまとめ ========= */
  const summary = useMemo(() => {
    if (!result || !result.problems || result.problems.length === 0) {
      return null;
    }

    const total = result.problems.length;
    const correctCount = result.problems.filter((p) => p.correct).length;
    const wrongCount = total - correctCount;

    const avgScore =
      Math.round(
        (result.problems.reduce((sum, p) => sum + (p.score ?? 0), 0) / total) *
          100
      ) || 0;

    let pointMessage = "よくがんばりました。";
    let recommendMessage = "この調子で続けましょう。";

    if (wrongCount > 0) {
      if (result.subject === "算数") {
        pointMessage = "計算の考え方で少し迷っているところがあります。";
        recommendMessage = "条件を整理する練習がおすすめです。";
      } else if (result.subject === "国語") {
        pointMessage = "文章の読み取りでつまずいています。";
        recommendMessage = "文を区切って考える練習をしましょう。";
      } else if (result.subject === "英語") {
        pointMessage = "単語や意味の理解があいまいです。";
        recommendMessage = "声に出して読む練習がおすすめです。";
      }
    }

    return {
      total,
      correctCount,
      wrongCount,
      avgScore,
      pointMessage,
      recommendMessage,
    };
  }, [result]);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button
          type="button"
          className="text-xs text-slate-500"
          onClick={() => navigate(-1)}
        >
          ← 戻る
        </button>

        <h1 className="text-lg font-bold text-slate-900">
          📸 宿題カメラチェック
        </h1>
        <p className="text-xs text-slate-600">
          宿題を撮影すると、先生がチェックしたように結果を表示します。
        </p>

        {/* ファイル選択 */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            宿題の写真
          </label>

          <label className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs cursor-pointer hover:border-amber-400 hover:bg-amber-50">
            <div className="flex flex-col">
              <span className="font-medium">
                {file ? "📎 写真が選択されました" : "📎 宿題の写真をえらぶ"}
              </span>
              <span className="text-[10px] text-slate-500">
                {file ? file.name : "明るく、まっすぐ写してください"}
              </span>
            </div>
            <span className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-900">
              ファイル選択
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {previewUrl && (
            <div className="border rounded-lg bg-white overflow-hidden">
              <img
                src={previewUrl}
                alt="宿題プレビュー"
                className="w-full object-contain max-h-80"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "チェック中…" : "この写真でチェックする"}
        </button>

        {errorMsg && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {errorMsg}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="space-y-4 text-xs">
            <div className="text-slate-700">
              教科：<span className="font-semibold">{result.subject}</span>
              {result.detected_grade && (
                <>
                  {" "}
                  / 推定学年：
                  <span className="font-semibold">
                    {result.detected_grade}
                  </span>
                </>
              )}
            </div>

            {/* 👩‍🏫 本日のまとめ + E3 总入口 */}
            {summary && (
              <div className="rounded-xl border bg-white p-3 space-y-2">
                <div className="font-semibold">👩‍🏫 本日のまとめ</div>

                <div>
                  ・チェックした問題：{summary.total}問
                  <br />
                  ・正解：{summary.correctCount}問 ／ まちがい：
                  {summary.wrongCount}問
                  <br />
                  ・理解度の平均：{summary.avgScore}%
                </div>

                <div className="rounded bg-slate-50 p-2">
                  <div className="font-semibold">📌 きょうのポイント</div>
                  <div>{summary.pointMessage}</div>
                </div>

                <div className="rounded bg-amber-50 p-2 text-amber-800">
                  <div className="font-semibold">👉 おすすめ</div>
                  <div>{summary.recommendMessage}</div>
                </div>

                <button
                  onClick={() => goToPractice("条件整理")}
                  className="mt-2 w-full rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  🧠 思考力の練習をする
                </button>
              </div>
            )}

            {/* 各题目 */}
            {result.problems.map((p, idx) => (
              <article
                key={p.id ?? idx}
                className="rounded-xl border bg-white px-4 py-3 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold">第{idx + 1}問</div>
                  <div className="flex items-center gap-2">
                    {p.correct ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                        ○ 正解
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                        × まちがい
                      </span>
                    )}
                  </div>
                </div>

                {p.question_text && (
                  <div>
                    <strong>【問題】</strong>
                    <div className="whitespace-pre-wrap">
                      {p.question_text}
                    </div>
                  </div>
                )}

                {p.child_answer && (
                  <div>
                    <strong>【お子さまの答え】</strong>
                    <div className="whitespace-pre-wrap">
                      {p.child_answer}
                    </div>
                  </div>
                )}

                {p.feedback && (
                  <div className="rounded bg-slate-50 p-2">
                    <strong>👩‍🏫 先生のコメント</strong>
                    <div>{p.feedback}</div>
                  </div>
                )}

                {p.hint && (
                  <div className="rounded bg-amber-50 p-2 text-amber-800">
                    <strong>💡 ヒント</strong>
                    <div>{p.hint}</div>
                  </div>
                )}

                {/* E3：单题跳转 */}
                {!p.correct && (
                  <button
                    onClick={() => goToPractice("条件整理")}
                    className="text-xs font-semibold text-indigo-600 underline"
                  >
                    👉 この問題に似た思考力練習をする
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
