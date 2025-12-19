// frontend/src/pages/HomeworkCameraPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  checkHomeworkImage,
  type CheckHomeworkImageResponse,
} from "../api/homeworkImage";

const SUBJECTS = ["auto", "国語", "算数", "英語", "理科"] as const;
type SubjectOption = (typeof SUBJECTS)[number];

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [subject, setSubject] = useState<SubjectOption>("auto");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckHomeworkImageResponse | null>(null);

  // 预览图片 URL 清理
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setResult(null);
    setError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async () => {
    if (!imageFile) {
      setError("まず宿題の写真を選んでください。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("subject", subject === "auto" ? "" : subject);

      const data = await checkHomeworkImage(fd);
      setResult(data);
    } catch (e) {
      console.error(e);
      setError("宿題のチェックに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs text-slate-500"
          >
            ← 戻る
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              宿題カメラでチェック
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              宿題の写真を撮るだけで、○つけ・まちがいの説明・似た練習問題まで自動で出します。
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 左側：画像アップロード & プレビュー */}
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-xs text-slate-600">
                1. 科目（おまかせでもOK）
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    className={`rounded-full px-3 py-1 border text-xs ${
                      subject === s
                        ? "bg-amber-400 border-amber-400 text-slate-900"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    {s === "auto" ? "おまかせ" : s}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-600 pt-1">
                2. 宿題の写真をアップロード
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-full file:border file:border-slate-300 file:bg-white file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-slate-50"
              />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !imageFile}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {loading ? "チェック中…" : "この写真でチェックする"}
              </button>

              {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
            </div>

            {previewUrl && (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-600 mb-2">
                  宿題の写真プレビュー
                </div>
                <div className="relative w-full overflow-hidden rounded-lg bg-slate-100">
                  <img
                    src={previewUrl}
                    alt="宿題の写真"
                    className="w-full h-auto block"
                  />

                  {/* ○ / × のオーバーレイ（ダミー bbox 用） */}
                  {result?.problems.map((p) => (
                    <div
                      key={p.id}
                      className={`absolute border-2 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.9)] ${
                        p.correct ? "border-emerald-400" : "border-red-400"
                      }`}
                      style={{
                        left: `${p.bbox[0] * 100}%`,
                        top: `${p.bbox[1] * 100}%`,
                        width: `${p.bbox[2] * 100}%`,
                        height: `${p.bbox[3] * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 右側：問題ごとの結果・似た練習 */}
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 h-full">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                チェック結果
              </div>

              {!result && (
                <p className="text-xs text-slate-500">
                  宿題の写真を選んで「この写真でチェックする」を押すと、
                  ここに問題ごとの○つけと解説が表示されます。
                </p>
              )}

              {result && (
                <div className="space-y-3 text-sm">
                  <div className="text-xs text-slate-500 mb-1">
                    判定科目:{" "}
                    <span className="font-semibold text-slate-800">
                      {result.subject}
                    </span>{" "}
                    {result.detected_grade && (
                      <>
                        / 想定学年:{" "}
                        <span className="font-semibold">
                          {result.detected_grade}
                        </span>
                      </>
                    )}
                  </div>

                  {result.problems.map((p, idx) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">
                          第{idx + 1}問
                        </div>
                        <div className="text-xs">
                          {p.correct ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-[2px] text-[10px] font-semibold text-emerald-700">
                              正解
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-[2px] text-[10px] font-semibold text-red-700">
                              まちがい
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-slate-800 whitespace-pre-wrap">
                        <span className="font-semibold">問題：</span>
                        {p.question_text}
                      </div>
                      <div className="mt-1 text-xs text-slate-800">
                        <span className="font-semibold">お子さまの答え：</span>
                        <span className="whitespace-pre-wrap">
                          {p.child_answer}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-800 whitespace-pre-wrap">
                        <span className="font-semibold">コメント：</span>
                        {p.feedback}
                      </div>
                      <div className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">
                        <span className="font-semibold">ヒント：</span>
                        {p.hint}
                      </div>

                      {p.similar_practice.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="text-[11px] font-semibold text-slate-700 mb-1">
                            似た練習問題
                          </div>
                          {p.similar_practice.map((sp, i) => (
                            <div
                              key={i}
                              className="mb-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                            >
                              <div className="font-semibold">
                                Q: {sp.question}
                              </div>
                              <div className="mt-1">
                                <span className="font-semibold">答え：</span>
                                {sp.answer}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-700">
                                <span className="font-semibold">解説：</span>
                                {sp.explanation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default HomeworkCameraPage;
