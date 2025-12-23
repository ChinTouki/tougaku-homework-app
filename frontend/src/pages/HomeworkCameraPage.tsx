// frontend/src/pages/HomeworkCameraPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

// 后端可能返回：string 或 { question, answer, explanation } 这样的对象
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setErrorMsg(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleCheck = async () => {
    if (!file) {
      setErrorMsg("まず宿題の写真を選んでください。");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("subject", "算数"); // とりあえず固定

    try {
      const res = await apiClient.post<CheckImageResponse>(
        "/api/check_homework_image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );

      const data = res.data || ({} as any);

      const safeProblems: DetectedProblem[] = Array.isArray(
        (data as any).problems
      )
        ? (data as any).problems
        : [];

      setResult({
        subject: data.subject || "算数",
        detected_grade: data.detected_grade,
        problems: safeProblems,
      });
    } catch (err) {
      console.error("check_homework_image error:", err);
      setErrorMsg(
        "宿題のチェックに失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setLoading(false);
    }
  };

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
          宿題ノートやプリントを撮影してアップロードすると、
          AIが「正解・まちがい」や似た練習問題を提案します。
        </p>

        {/* 写真選択 */}
        <div className="space-y-2">
  <label className="block text-xs font-semibold text-slate-700 mb-1">
    宿題の写真
  </label>

  {/* カスタムファイル選択ボタン */}
  <label className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 cursor-pointer hover:border-amber-400 hover:bg-amber-50">
    <div className="flex flex-col">
      <span className="font-medium">
        {file ? "📎 写真が選択されました" : "📎 宿題の写真をえらぶ"}
      </span>
      <span className="text-[10px] text-slate-500">
        {file
          ? file.name
          : "ノートやプリントをなるべく明るく・まっすぐ写してください。"}
      </span>
    </div>
    <span className="ml-3 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-900">
      ファイル選択
    </span>
    {/* 本物の input は非表示 */}
    <input
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
    />
  </label>

  {previewUrl && (
    <div className="mt-2 border rounded-lg overflow-hidden bg-white">
      <img
        src={previewUrl}
        alt="宿題プレビュー"
        className="w-full object-contain max-h-80"
      />
    </div>
  )}
</div>

        {/* チェックボタン */}
        <button
          type="button"
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {loading ? "チェック中…" : "この写真でチェックする"}
        </button>

        {/* エラーメッセージ */}
        {errorMsg && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="text-slate-700">
              教科: <span className="font-semibold">{result.subject}</span>{" "}
              {result.detected_grade && (
                <>
                  / 推定学年:{" "}
                  <span className="font-semibold">
                    {result.detected_grade}
                  </span>
                </>
              )}
            </div>

            {result.problems && result.problems.length > 0 ? (
              result.problems.map((p, idx) => (
                <article
                  key={p.id ?? idx}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">
                      第{idx + 1}問
                    </div>
                    {typeof p.correct === "boolean" && (
                      <div
                        className={
                          "text-xs font-semibold " +
                          (p.correct ? "text-emerald-600" : "text-red-600")
                        }
                      >
                        {p.correct ? "正解" : "まちがいあり"}
                        {typeof p.score === "number" && (
                          <span className="ml-1 text-[10px] text-slate-500">
                            ({Math.round(p.score * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {p.question_text && (
                    <p className="whitespace-pre-wrap text-slate-900">
                      問題: {p.question_text}
                    </p>
                  )}

                  {p.child_answer && (
                    <p className="whitespace-pre-wrap text-slate-800">
                      お子さまの答え: {p.child_answer}
                    </p>
                  )}

                  {p.feedback && (
                    <p className="whitespace-pre-wrap text-slate-800">
                      コメント: {p.feedback}
                    </p>
                  )}

                  {p.hint && (
                    <p className="whitespace-pre-wrap text-amber-700">
                      ヒント: {p.hint}
                    </p>
                  )}

                  {/* 这里修掉：similar_practice 可能是 string 或对象 */}
                  {p.similar_practice && p.similar_practice.length > 0 && (
                    <div className="pt-1 border-t mt-2">
                      <div className="font-semibold text-slate-800 mb-1">
                        似た練習問題（家でやる用）：
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                        {p.similar_practice.map((sp, i) => {
                          if (typeof sp === "string") {
                            return <li key={i}>{sp}</li>;
                          }
                          const q = sp.question ?? "";
                          const a = sp.answer ?? "";
                          const ex = sp.explanation ?? "";
                          return (
                            <li key={i}>
                              {q && (
                                <>
                                  <span className="font-semibold">Q:</span>{" "}
                                  {q}
                                  <br />
                                </>
                              )}
                              {a && (
                                <>
                                  <span className="font-semibold">A:</span>{" "}
                                  {a}
                                  <br />
                                </>
                              )}
                              {ex && (
                                <>
                                  <span className="font-semibold">ヒント:</span>{" "}
                                  {ex}
                                </>
                              )}
                              {!q && !a && !ex && "[練習問題]"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="text-slate-500">
                問題が検出されませんでした。写真が暗すぎないか、ピントが合っているかを確認してみてください。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
