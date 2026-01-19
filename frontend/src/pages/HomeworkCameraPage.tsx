import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface ApiResponse {
  raw_text?: string;
  error?: string;
}

interface CheckedItem {
  rawLine: string;
  expression?: string;
  studentAnswer?: string;
  isCorrect?: boolean;
  correctAnswer?: string;
}

/* ===== 简单数值解析 ===== */
function parseValue(str: string): number | null {
  try {
    const s = str.trim();
    if (s.includes(" ")) {
      const [w, f] = s.split(" ");
      const [n, d] = f.split("/");
      return Number(w) + Number(n) / Number(d);
    }
    if (s.includes("/")) {
      const [n, d] = s.split("/");
      return Number(n) / Number(d);
    }
    return Number(s);
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
function normalizeOCR(text: string): string {
  return text
    // Unicode 分数 → 普通分数
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8")

    // 乘除号统一
    .replace(/×/g, "*")
    .replace(/x/g, "*")
    .replace(/÷/g, "/")

    // 全角等号
    .replace(/＝/g, "=")

    // 多余空格
    .replace(/\s+/g, " ")
    .trim();
}


/* ===== 解析 + 判题（允许失败） ===== */
function parseAndCheck(raw: string): CheckedItem[] {
  const normalizedRaw = normalizeOCR(raw);

  return normalizedRaw
    .split("\n")

    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const normalized = line.replace("＝", "=");

      if (!normalized.includes("=")) {
        // 无法解析的行，也保留
        return { rawLine: line };
      }

      const [left, right] = normalized.split("=");

      if (!left || !right) {
        return { rawLine: line };
      }

      const expression = left.trim();
      const studentAnswer = right.trim();

      const correctVal = evalExpression(expression);
      const studentVal = parseValue(studentAnswer);

      if (correctVal === null || studentVal === null) {
        return { rawLine: line, expression, studentAnswer };
      }

      const isCorrect = Math.abs(correctVal - studentVal) < 1e-6;

      return {
        rawLine: line,
        expression,
        studentAnswer,
        isCorrect,
        correctAnswer: String(correctVal),
      };
    });
}

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<CheckedItem[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setItems([]);
    setRawText("");
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

    const text = res.data.raw_text ?? "";
    setRawText(text);
    setItems(text ? parseAndCheck(text) : []);

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

        {/* ===== 一定显示 raw_text ===== */}
        {rawText && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📄 読み取った文字</div>
            {rawText}
          </div>
        )}

        {/* ===== 判定 / 兜底显示 ===== */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold">🧮 判定結果</div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className={`border rounded-xl px-4 py-2 flex justify-between ${
                  item.isCorrect === true
                    ? "bg-emerald-50"
                    : item.isCorrect === false
                    ? "bg-red-50"
                    : "bg-slate-100"
                }`}
              >
                <span>
                  {item.expression
                    ? `${item.expression} = ${item.studentAnswer}`
                    : item.rawLine}
                </span>
                <span className="font-bold">
                  {item.isCorrect === true
                    ? "○"
                    : item.isCorrect === false
                    ? "×"
                    : "？"}
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
