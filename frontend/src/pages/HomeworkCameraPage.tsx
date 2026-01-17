import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= API 返回 ========= */
interface ApiResponse {
  raw_text?: string;
  error?: string;
}

/* ========= 判定结构 ========= */
interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 简单分数/整数解析 ========= */
function parseValue(str: string): number | null {
  try {
    const s = str.trim();

    // 带分数 3 1/2
    if (s.includes(" ")) {
      const [w, f] = s.split(" ");
      const [n, d] = f.split("/");
      return Number(w) + Number(n) / Number(d);
    }

    // 分数 1/3
    if (s.includes("/")) {
      const [n, d] = s.split("/");
      return Number(n) / Number(d);
    }

    // 整数
    return Number(s);
  } catch {
    return null;
  }
}

/* ========= 计算表达式 ========= */
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

/* ========= raw_text → 判题 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.includes("="))
    .map(line => {
      const [left, right] = line.split("=");
      const expression = left.trim();
      const studentAnswer = right.trim();

      const correctVal = evalExpression(expression);
      const studentVal = parseValue(studentAnswer);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correctVal !== null && studentVal !== null) {
        isCorrect = Math.abs(correctVal - studentVal) < 1e-6;
        correctAnswer = String(correctVal);
      }

      return {
        expression,
        studentAnswer,
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
  const [checked, setChecked] = useState<CheckedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setChecked([]);
    setError(null);
  };

  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post<ApiResponse>(
        "/api/check_homework_image",
        formData,
        { timeout: 60000 }
      );

      if (res.data.raw_text) {
        setChecked(parseAndCheck(res.data.raw_text));
      } else {
        setChecked([]);
        setError("文字を読み取れませんでした。");
      }
    } catch {
      setError("サーバー通信に失敗しました。");
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
          {loading ? "判定中…" : "この写真でチェック"}
        </button>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {/* ===== 判定结果 ===== */}
        {checked.length > 0 && (
          <div className="space-y-3">
            <div className="font-semibold">🧮 判定結果</div>

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
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
