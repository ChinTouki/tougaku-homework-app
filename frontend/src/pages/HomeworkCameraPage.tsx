import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface DetectedProblem {
  id: number;
  question_text: string;
  child_answer: string;
  correct: boolean;
  score: number;
  feedback: string;
  hint: string;
  similar_practice?: string[];
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
    formData.append("subject", "算数"); // ここはとりあえず固定

    try {
      const res = await apiClient.post<CheckImageResponse>(
        "/api/check_homework_image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000, // 30秒タイムアウト（万一レンダが遅くても切れる）
        }
      );
      setResult(res.data);
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
          <label className="block text-xs font-semibold text-slate-700">
            宿題の写真
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-xs"
          />
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

            {result.problems.map((p, idx) => (
              <article
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">
                    第{idx + 1}問
                  </div>
                  <div
                    className={
                      "text-xs font-semibold " +
                      (p.correct ? "text-emerald-600" : "text-red-600")
                    }
                  >
                    {p.correct ? "正解" : "まちがいあり"}
                    <span className="ml-1 text-[10px] text-slate-500">
                      ({Math.round(p.score * 100)}%)
                    </span>
                  </div>
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

                <p className="whitespace-pre-wrap text-slate-800">
                  コメント: {p.feedback}
                </p>
                <p className="whitespace-pre-wrap text-amber-700">
                  ヒント: {p.hint}
                </p>

                {p.similar_practice && p.similar_practice.length > 0 && (
                  <div className="pt-1 border-t mt-2">
                    <div className="font-semibold text-slate-800 mb-1">
                      似た練習問題（家でやる用）：
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                      {p.similar_practice.map((sp, i) => (
                        <li key={i}>{sp}</li>
                      ))}
                    </ul>
                  </div>
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
