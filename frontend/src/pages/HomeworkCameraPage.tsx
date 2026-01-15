import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= 类型 ========= */
interface DebugResponse {
  raw_text: string;
  error?: string;
}

interface Fraction {
  n: number; // numerator
  d: number; // denominator
}

interface ParsedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 分数字符串 → Fraction ========= */
function parseFractionExact(str: string): Fraction | null {
  try {
    str = str.trim();

    // 带分数：3 1/2
    if (str.includes(" ")) {
      const [w, f] = str.split(" ");
      const [n, d] = f.split("/");
      return {
        n: parseInt(w) * parseInt(d) + parseInt(n),
        d: parseInt(d),
      };
    }

    // 普通分数：1/3
    if (str.includes("/")) {
      const [n, d] = str.split("/");
      return { n: parseInt(n), d: parseInt(d) };
    }

    // 整数
    return { n: parseInt(str), d: 1 };
  } catch {
    return null;
  }
}

/* ========= 最大公约数 ========= */
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/* ========= 约分 ========= */
function normalizeFraction(f: Fraction): Fraction {
  const g = gcd(f.n, f.d);
  return { n: f.n / g, d: f.d / g };
}

/* ========= Fraction 相等判断 ========= */
function fractionEqual(a: Fraction, b: Fraction): boolean {
  const fa = normalizeFraction(a);
  const fb = normalizeFraction(b);
  return fa.n === fb.n && fa.d === fb.d;
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
    const val = eval(normalized);

    // val 一定是 number，这里转成 Fraction
    const str = val.toString();
    if (str.includes(".")) {
      const decimals = str.split(".")[1].length;
      const d = Math.pow(10, decimals);
      return normalizeFraction({
        n: Math.round(val * d),
        d,
      });
    }

    return { n: val, d: 1 };
  } catch {
    return null;
  }
}

/* ========= raw_text → 判定 ========= */
function parseMathLines(raw: string): ParsedItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const [left, right] = line.split("=");
      const expr = left.trim();
      const student = right.trim();

      const correctFrac = evalExpressionExact(expr);
      const studentFrac = parseFractionExact(student);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correctFrac && studentFrac) {
        isCorrect = fractionEqual(correctFrac, studentFrac);
        if (correctFrac.d === 1) {
          correctAnswer = correctFrac.n.toString();
        } else {
          correctAnswer = `${correctFrac.n}/${correctFrac.d}`;
        }
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
  const [result, setResult] = useState<DebugResponse | null>(null);
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

    const res = await apiClient.post<DebugResponse>(
      "/api/check_homework_image",
      formData
    );

    setResult(res.data);
    setLoading(false);
  };

  const parsed = result?.raw_text ? parseMathLines(result.raw_text) : [];

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

        {parsed.map((item, idx) => (
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
    </div>
  );
};

export default HomeworkCameraPage;
