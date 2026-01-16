import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= 后端返回 ========= */
interface ApiResponse {
  raw_text: string;
}

/* ========= 判定结果 ========= */
interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 分数结构 ========= */
interface Fraction {
  n: number; // numerator
  d: number; // denominator
}

/* ========= 最大公约数 ========= */
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/* ========= 约分 ========= */
function normalize(f: Fraction): Fraction {
  const g = gcd(f.n, f.d);
  return { n: f.n / g, d: f.d / g };
}

/* ========= 分数字符串 → Fraction ========= */
function parseFractionExact(str: string): Fraction | null {
  try {
    const s = str.trim();

    // 带分数：3 1/2
    if (s.includes(" ")) {
      const [w, f] = s.split(" ");
      const [n, d] = f.split("/");
      return normalize({
        n: Number(w) * Number(d) + Number(n),
        d: Number(d),
      });
    }

    // 普通分数：1/3
    if (s.includes("/")) {
      const [n, d] = s.split("/");
      return normalize({ n: Number(n), d: Number(d) });
    }

    // 整数
    return { n: Number(s), d: 1 };
  } catch {
    return null;
  }
}

/* ========= 表达式 → Fraction ========= */
function evalExpressionExact(expr: string): Fraction | null {
  try {
    let normalized = expr
      .replace("×", "*")
      .replace("÷", "/")
      .replace(/(\d+)\s+(\d+)\/(\d+)/g, "($1*$3+$2)/$3");

    // 普通分数
    normalized = normalized.replace(
      /(\d+)\s*\/\s*(\d+)/g,
      "($1)/($2)"
    );

    // eslint-disable-next-line no-eval
    const value = eval(normalized);

    if (Number.isInteger(value)) {
      return { n: value, d: 1 };
    }

    // 小数 → 分数（有限小数）
    const s = value.toString();
    if (s.includes(".")) {
      const len = s.split(".")[1].length;
      const d = Math.pow(10, len);
      return normalize({ n: Math.round(value * d), d });
    }

    return null;
  } catch {
    return null;
  }
}

/* ========= Fraction 相等 ========= */
function fractionEqual(a: Fraction, b: Fraction): boolean {
  const fa = normalize(a);
  const fb = normalize(b);
  return fa.n === fb.n && fa.d === fb.d;
}

/* ========= raw_text → 判定 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.includes("="))
    .map(line => {
      const [left, right] = line.split("=");
      const expression = left.trim();
      const studentAnswer = right.trim();

      const correctFrac = evalExpressionExact(expression);
      const studentFrac = parseFractionExact(studentAnswer);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correctFrac && studentFrac) {
        isCorrect = fractionEqual(correctFrac, studentFrac);
        correctAnswer =
          correctFrac.d === 1
            ? `${correctFrac.n}`
            : `${correctFrac.n}/${correctFrac.d}`;
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

    setChecked(
      res.data.raw_text
        ? parseAndCheck(res.data.raw_text)
        : []
    );

    setLoading(false);
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
          {loading ? "読み取り中…" : "この写真でチェック"}
        </button>

        {/* ===== 原题判定 ===== */}
        {checked.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <div className="font-semibold">🧮 原題の結果</div>
            {checked.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center"
              >
                <div>
                  {idx + 1}. {item.expression} = {item.studentAnswer}
                  {!item.isCorrect && (
                    <div className="text-xs text-slate-600">
                      正しい答え：{item.correctAnswer}
                    </div>
                  )}
                </div>
                <div
                  className={`font-bold ${
                    item.isCorrect
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
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
