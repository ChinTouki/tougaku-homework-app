import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= 类型 ========= */
interface DebugResponse {
  raw_text: string;
  error?: string;
}

interface ParsedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 分数解析 ========= */
// 支持：3 1/2, 1/3, 5
function parseFraction(str: string): number | null {
  try {
    str = str.trim();
    if (str.includes(" ")) {
      const [w, f] = str.split(" ");
      const [n, d] = f.split("/");
      return parseInt(w) + parseInt(n) / parseInt(d);
    }
    if (str.includes("/")) {
      const [n, d] = str.split("/");
      return parseInt(n) / parseInt(d);
    }
    return parseInt(str);
  } catch {
    return null;
  }
}

/* ========= 表达式计算 ========= */
function evalExpression(expr: string): number | null {
  try {
    const normalized = expr
      .replace("×", "*")
      .replace("÷", "/")
      .replace(/(\d+)\s+(\d+)\/(\d+)/g, "($1 + $2/$3)");

    // eslint-disable-next-line no-eval
    return eval(normalized);
  } catch {
    return null;
  }
}

/* ========= raw_text → 算式 ========= */
function parseMathLines(raw: string): ParsedItem[] {
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.includes("="))
    .map(line => {
      const [left, right] = line.split("=");
      const expr = left.trim();
      const student = right.trim();

      const correct = evalExpression(expr);
      const studentVal = parseFraction(student);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correct !== null && studentVal !== null) {
        isCorrect = Math.abs(correct - studentVal) < 1e-6;
        correctAnswer = correct.toString();
      }

      return {
        expression: expr,
        studentAnswer: student,
        isCorrect,
        correctAnswer,
      };
    });
}

/* ========= 页面 ========= */
const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleCheck = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post<DebugResponse>(
        "/api/check_homework_image",
        formData
      );
      setResult(res.data);
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const parsedItems = result?.raw_text
    ? parseMathLines(result.raw_text)
    : [];

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

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />

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

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {/* ===== 判定结果 ===== */}
        {parsedItems.length > 0 && (
          <div className="space-y-3">
            {parsedItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center border rounded-xl px-4 py-2 ${
                  item.isCorrect ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <div>
                  <div className="font-semibold">
                    {item.expression} = {item.studentAnswer}
                  </div>
                  {!item.isCorrect && (
                    <div className="text-xs text-slate-600">
                      正しい答え：{item.correctAnswer}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold">
                  {item.isCorrect ? "✔" : "✕"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* raw_text 兜底显示 */}
        {result && parsedItems.length === 0 && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📄 読み取った内容</div>
            {result.raw_text || "（文字を認識できませんでした）"}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
