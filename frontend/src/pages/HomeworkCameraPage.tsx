import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface ApiResponse {
  raw_text?: string;
}

interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ===== 简单解析 ===== */
function parseValue(str: string): number | null {
  try {
    if (str.includes(" ")) {
      const [w, f] = str.split(" ");
      const [n, d] = f.split("/");
      return Number(w) + Number(n) / Number(d);
    }
    if (str.includes("/")) {
      const [n, d] = str.split("/");
      return Number(n) / Number(d);
    }
    return Number(str);
  } catch {
    return null;
  }
}

function evalExpression(expr: string): number | null {
  try {
    const n = expr.replace("×", "*").replace("÷", "/");
    // eslint-disable-next-line no-eval
    return eval(n);
  } catch {
    return null;
  }
}

function parseAndCheck(raw: string): CheckedItem[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.includes("=") || l.includes("＝"))
    .map(line => {
      // 统一等号
      const normalized = line.replace("＝", "=");
      const [left, right] = normalized.split("=");

      if (!left || !right) {
        return null;
      }

      const expression = left.trim();
      const studentAnswer = right.trim();

      const correctVal = evalExpression(expression);
      const studentVal = parseValue(studentAnswer);

      const isCorrect =
        correctVal !== null &&
        studentVal !== null &&
        Math.abs(correctVal - studentVal) < 1e-6;

      return {
        expression,
        studentAnswer,
        isCorrect,
        correctAnswer: String(correctVal ?? "?"),
      };
    })
    .filter(Boolean) as CheckedItem[];
}


const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<CheckedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setChecked([]);
  };

  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    const res = await apiClient.post<ApiResponse>(
      "/api/check_homework_image",
      formData,
      { timeout: 60000 }
    );

    setChecked(res.data.raw_text ? parseAndCheck(res.data.raw_text) : []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題チェック（算数）</h1>

        <input type="file" accept="image/*" onChange={handleFileChange} />

        {/* ===== 图片 + 伪画圈 ===== */}
        {preview && (
          <div className="relative bg-white rounded-xl border p-2">
            <img
              src={preview}
              className="w-full object-contain rounded"
            />

            {/* 覆盖层 */}
            {checked.map((c, i) => (
              <div
                key={i}
                className="absolute left-2"
                style={{
                  top: `${((i + 1) / (checked.length + 1)) * 100}%`,
                }}
              >
                <span className="text-sm font-bold mr-1">
                  {i + 1}.
                </span>
                <span
                  className={`text-2xl font-bold ${
                    c.isCorrect
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {c.isCorrect ? "○" : "×"}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "読み取り中…" : "この写真でチェック"}
        </button>

        {/* ===== 文字列表（辅助） ===== */}
        {checked.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold">🧮 判定結果</div>
            {checked.map((c, i) => (
              <div
                key={i}
                className={`border rounded-xl px-4 py-2 flex justify-between ${
                  c.isCorrect ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <span>
                  {i + 1}. {c.expression} = {c.studentAnswer}
                </span>
                <span className="font-bold">
                  {c.isCorrect ? "○" : "×"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
