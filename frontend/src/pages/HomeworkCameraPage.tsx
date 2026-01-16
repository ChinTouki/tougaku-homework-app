import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= 后端返回 ========= */
interface ApiResponse {
  raw_text: string;
  error?: string;
}

/* ========= 判定结果 ========= */
interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 分数解析 ========= */
function parseFraction(str: string): number | null {
  try {
    str = str.trim();

    // 带分数：3 1/2
    if (str.includes(" ")) {
      const [w, f] = str.split(" ");
      const [n, d] = f.split("/");
      return parseInt(w) + parseInt(n) / parseInt(d);
    }

    // 普通分数：1/3
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

/* ========= raw_text → 判定 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.includes("="))
    .map(line => {
      const [left, right] = line.split("=");
      const expr = left.trim();
      const student = right.trim();

      const correctVal = evalExpression(expr);
      const studentVal = parseFraction(student);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correctVal !== null && studentVal !== null) {
        isCorrect = Math.abs(correctVal - studentVal) < 1e-6;
        correctAnswer = correctVal.toString();
      }

      return {
        expression: expr,
        studentAnswer: student,
        isCorrect,
        correctAnswer,
      };
    });
}

/* ========= 自动重试 POST ========= */
async function postWithRetry(
  formData: FormData,
  retries = 3,
  delayMs = 2000
): Promise<ApiResponse> {
  let lastError: any = null;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await apiClient.post<ApiResponse>(
        "/api/check_homework_image",
        formData,
        {
          timeout: 60000, // 给 Render 冷启动时间
        }
      );
      return res.data;
    } catch (e) {
      lastError = e;
      // 等待再试
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}

/* ========= 页面 ========= */
const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<CheckedItem[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setChecked([]);
    setRawText("");
    setError(null);
  };

  const handleCheck = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const data = await postWithRetry(formData);
      setRawText(data.raw_text || "");

      if (data.raw_text) {
        setChecked(parseAndCheck(data.raw_text));
      } else {
        setChecked([]);
      }
    } catch {
      setError("サーバーが混み合っています。少し待ってもう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-slate-500"
        >
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題チェック（算数）</h1>
        <p className="text-xs text-slate-600">
          ※ 現在は算数の宿題のみ対応しています
        </p>

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

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {/* ===== 原题判定 ===== */}
        {checked.length > 0 && (
          <div className="space-y-3">
            <div className="font-semibold">
              🧮 原題のチェック結果
            </div>

            {checked.map((item, idx) => (
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
                  {item.isCorrect ? "○" : "×"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== raw_text 兜底 ===== */}
        {rawText && checked.length === 0 && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📄 読み取った内容</div>
            {rawText}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
