import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface MathProblem {
  expression: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  error_type?: string;
}

interface MathCheckResponse {
  problems: MathProblem[];
  summary: {
    total: number;
    correct: number;
    wrong: number;
  };
}

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<MathCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleCheck = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post<MathCheckResponse>(
        "/api/check_homework_image",
        formData
      );
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題チェック（算数）</h1>
        <p className="text-xs text-slate-600">
          ※ 現在は算数の宿題のみ対応しています
        </p>

        <label className="block border-dashed border rounded-xl p-3 bg-white cursor-pointer">
          {file ? file.name : "宿題の写真を選択"}
          <input type="file" accept="image/*" onChange={handleFileChange} hidden />
        </label>

        {preview && (
          <img src={preview} className="w-full max-h-80 object-contain bg-white rounded" />
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "チェック中…" : "この写真でチェックする"}
        </button>

        {result && (
          <div className="space-y-4">
            <div className="bg-white border rounded-xl p-3 text-sm">
              全 {result.summary.total} 問 ／
              <span className="text-emerald-600 font-semibold">
                正解 {result.summary.correct}
              </span>{" "}
              ／
              <span className="text-red-600 font-semibold">
                間違い {result.summary.wrong}
              </span>
            </div>

            {result.problems.map((p, i) => (
              <div
                key={i}
                className={`flex justify-between items-center border rounded-xl px-4 py-3 ${
                  p.is_correct ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <div>
                  <div className="font-semibold">
                    {p.expression} = {p.student_answer}
                  </div>
                  {!p.is_correct && (
                    <div className="text-xs text-slate-600">
                      正しい答え：{p.correct_answer}
                      {p.error_type && (
                        <span className="block text-amber-700">
                          💡 {p.error_type}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold">
                  {p.is_correct ? "✔" : "✕"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
