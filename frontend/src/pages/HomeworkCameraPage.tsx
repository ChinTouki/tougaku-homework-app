import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface DetectedProblem {
  id: number;
  question_text?: string;
  child_answer?: string;
  correct?: boolean;
  score?: number;
  feedback?: string;
  hint?: string;
}

interface CheckImageResponse {
  subject: string;
  detected_grade?: string;
  problems: DetectedProblem[];
}

/* ===== 图片压缩 ===== */
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    img.onload = () => {
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.7);
    };

    img.src = URL.createObjectURL(file);
  });
};

const SUBJECTS = ["算数", "国语", "英语"];

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CheckImageResponse | null>(null);

  /* ===== 文件选择 ===== */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setStatusMsg(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  /* ===== 拍照检查 ===== */
  const handleCheck = async () => {
    if (!file) {
      setStatusMsg("まず宿題の写真を選んでください。");
      return;
    }

    setLoading(true);
    setStatusMsg("写真を確認しています…");

    try {
      const compressed = await compressImage(file);
      setStatusMsg("問題を読み取っています…");

      const formData = new FormData();
      formData.append("image", compressed, "homework.jpg");

      const res = await apiClient.post<CheckImageResponse>(
        "/api/check_homework_image",
        formData,
        { timeout: 90000 }
      );

      setResult(res.data);
      setStatusMsg(null);
    } catch (err) {
      console.error(err);
      setStatusMsg("宿題のチェックに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  /* ===== 总结 ===== */
  const summary = useMemo(() => {
    if (!result || result.problems.length === 0) return null;

    const total = result.problems.length;
    const correct = result.problems.filter((p) => p.correct).length;

    return {
      total,
      correct,
      wrong: total - correct,
    };
  }, [result]);

  /* ===== 思考力跳转 ===== */
  const goToPractice = () => {
    navigate("/practice?subject=思考力&num_questions=3");
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

        <h1 className="text-lg font-bold">📸 宿題カメラチェック</h1>

        {/* ===== 拍照引导 ===== */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
          <div className="font-semibold">📸 撮影のポイント</div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
            <li>紙全体が写るように、近づいて撮影</li>
            <li>文字がぼやけないようにピントを合わせる</li>
            <li>影や反射が入らない明るい場所で</li>
            <li>なるべくまっすぐ上から撮影</li>
          </ul>
        </div>

        {/* ===== 文件选择 ===== */}
        <label className="flex items-center justify-between rounded-xl border border-dashed bg-white px-3 py-2 cursor-pointer">
          <div className="text-xs">
            {file ? file.name : "📎 宿題の写真をえらぶ"}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="preview"
            className="w-full max-h-80 object-contain bg-white rounded"
          />
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "チェック中…" : "この写真でチェックする"}
        </button>

        {statusMsg && (
          <div className="text-xs text-slate-600 bg-slate-100 p-2 rounded">
            {statusMsg}
          </div>
        )}

        {/* ===== 结果 ===== */}
        {result && (
          <div className="space-y-4 text-xs">
            {/* 学科切换 */}
            <div>
              <div className="font-semibold mb-1">教科（タップで切替）</div>
              <div className="flex gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setResult({ ...result, subject: s })}
                    className={`px-3 py-1 rounded-full border ${
                      result.subject === s
                        ? "bg-amber-400 border-amber-400 font-semibold"
                        : "bg-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 总结 */}
            {summary && (
              <div className="rounded-xl border bg-white p-3 space-y-1">
                <div className="font-semibold">👩‍🏫 本日のまとめ</div>
                <div>
                  正解：{summary.correct} / 全体：{summary.total}
                </div>
                <button
                  onClick={goToPractice}
                  className="mt-2 w-full rounded-full bg-indigo-500 py-2 text-white font-semibold"
                >
                  🧠 思考力の練習をする
                </button>
              </div>
            )}

            {/* 各问题 */}
            {result.problems.map((p, idx) => (
              <div
                key={idx}
                className="rounded-xl border bg-white px-3 py-2 space-y-1"
              >
                <div className="font-semibold">第{idx + 1}問</div>
                {p.question_text && <div>問題：{p.question_text}</div>}
                {p.child_answer && <div>答え：{p.child_answer}</div>}
                {p.feedback && (
                  <div className="text-slate-600">💬 {p.feedback}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
