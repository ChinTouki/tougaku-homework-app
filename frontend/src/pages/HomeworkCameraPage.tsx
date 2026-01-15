import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= 类型 ========= */
interface DebugResponse {
  raw_text: string;
}

interface PracticeItem {
  question: string;
  userAnswer: string;
  correct: boolean | null;
}

/* ========= 生成类似练习题 ========= */
function generatePractice(expr: string): string[] {
  if (expr.includes("×")) {
    return ["6 × 4 = ?", "7 × 3 = ?", "8 × 5 = ?"];
  }
  if (expr.includes("÷")) {
    return ["8 ÷ 2 = ?", "12 ÷ 3 = ?", "15 ÷ 5 = ?"];
  }
  if (expr.includes("+")) {
    return ["7 + 6 = ?", "9 + 8 = ?", "5 + 7 = ?"];
  }
  if (expr.includes("-")) {
    return ["15 - 7 = ?", "14 - 6 = ?", "20 - 9 = ?"];
  }
  return [];
}

/* ========= 表达式计算 ========= */
function evalSimple(expr: string): number | null {
  try {
    const normalized = expr.replace("×", "*").replace("÷", "/");
    // eslint-disable-next-line no-eval
    return eval(normalized);
  } catch {
    return null;
  }
}

/* ========= 页面 ========= */
const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [practice, setPractice] = useState<PracticeItem[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setRawText("");
    setPractice([]);
  };

  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    const res = await apiClient.post<DebugResponse>(
      "/api/check_homework_image",
      formData
    );

    setRawText(res.data.raw_text);
    setLoading(false);

    // 生成练习题（暂时：针对所有算式）
    const lines = res.data.raw_text
      .split("\n")
      .filter((l) => l.includes("="));

    const exercises: PracticeItem[] = [];
    lines.forEach((line) => {
      const expr = line.split("=")[0].trim();
      generatePractice(expr).forEach((q) => {
        exercises.push({
          question: q,
          userAnswer: "",
          correct: null,
        });
      });
    });

    setPractice(exercises);
  };

  const handleAnswer = (idx: number, value: string) => {
    const q = practice[idx];
    const correct = evalSimple(q.question.replace("= ?", ""));
    const isCorrect = correct !== null && Number(value) === correct;

    const updated = [...practice];
    updated[idx] = {
      ...q,
      userAnswer: value,
      correct: isCorrect,
    };
    setPractice(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題チェック（算数）</h1>

        <input type="file" accept="image/*" onChange={handleFileChange} />

        {preview && (
          <img
            src={preview}
            className="w-full max-h-80 object-contain bg-white rounded"
          />
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "読み取り中…" : "この写真でチェック"}
        </button>

        {/* 原始识别结果 */}
        {rawText && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📄 読み取った内容</div>
            {rawText}
          </div>
        )}

        {/* 练习题 */}
        {practice.length > 0 && (
          <div className="space-y-3">
            <div className="font-semibold">✏️ まちがえた問題のれんしゅう</div>
            {practice.map((p, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${
                  p.correct === true
                    ? "bg-emerald-50"
                    : p.correct === false
                    ? "bg-red-50"
                    : "bg-white"
                }`}
              >
                <div className="font-semibold">{p.question}</div>
                <input
                  type="number"
                  className="mt-1 border rounded px-2 py-1 w-full"
                  value={p.userAnswer}
                  onChange={(e) => handleAnswer(i, e.target.value)}
                  placeholder="答えを入力"
                />
                {p.correct === true && (
                  <div className="text-emerald-600 text-sm">✔ 正解</div>
                )}
                {p.correct === false && (
                  <div className="text-red-600 text-sm">✕ まちがい</div>
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
