import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= API ========= */
interface ApiResponse {
  raw_text?: string;
  mock?: boolean;
  error?: string;
}

/* ========= 原题判定 ========= */
interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

/* ========= 练习题 ========= */
interface PracticeItem {
  question: string;
  hint: string;
  userAnswer: string;
  isCorrect: boolean | null;
}

/* ========= OCR 规范化 ========= */
function normalizeOCR(text: string): string {
  return text
    .replace(/⅓/g, "1/3").replace(/⅔/g, "2/3")
    .replace(/¼/g, "1/4").replace(/½/g, "1/2").replace(/¾/g, "3/4")
    .replace(/⅛/g, "1/8").replace(/⅜/g, "3/8").replace(/⅝/g, "5/8").replace(/⅞/g, "7/8")
    .replace(/＝/g, "=")
    .replace(/x/g, "*").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/* ========= 值解析 ========= */
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

/* ========= 表达式计算 ========= */
function evalExpression(expr: string): number | null {
  try {
    // eslint-disable-next-line no-eval
    return eval(expr);
  } catch {
    return null;
  }
}

/* ========= 原题判定 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  const normalized = normalizeOCR(raw);
  return normalized
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.includes("="))
    .map(line => {
      const [left, right] = line.split("=");
      const correctVal = evalExpression(left.trim());
      const studentVal = parseValue(right.trim());
      const isCorrect =
        correctVal !== null &&
        studentVal !== null &&
        Math.abs(correctVal - studentVal) < 1e-6;

      return {
        expression: left.trim(),
        studentAnswer: right.trim(),
        isCorrect,
        correctAnswer: String(correctVal ?? "?"),
      };
    });
}

/* ========= A6-3：生成分数专项练习 ========= */
function generateFractionPractice(): PracticeItem[] {
  return [
    {
      question: "1/3 + 1/6 = ?",
      hint: "分母をそろえてから足しましょう。",
      userAnswer: "",
      isCorrect: null,
    },
    {
      question: "3/4 - 1/8 = ?",
      hint: "通分してから引き算します。",
      userAnswer: "",
      isCorrect: null,
    },
    {
      question: "2/3 × 3/5 = ?",
      hint: "分子どうし、分母どうしをかけます。",
      userAnswer: "",
      isCorrect: null,
    },
  ];
}

/* ========= 页面 ========= */
const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<CheckedItem[]>([]);
  const [practice, setPractice] = useState<PracticeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setChecked([]);
    setPractice([]);
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

    const result = res.data.raw_text ? parseAndCheck(res.data.raw_text) : [];
    setChecked(result);

    // 如果有分数错题，生成专项练习
    const hasFractionMistake = result.some(
      r => !r.isCorrect && (r.expression.includes("/") || r.studentAnswer.includes("/"))
    );
    setPractice(hasFractionMistake ? generateFractionPractice() : []);

    setLoading(false);
  };

  const answerPractice = (idx: number, value: string) => {
    const q = practice[idx];
    const correctVal = evalExpression(q.question.replace("= ?", ""));
    const userVal = parseValue(value);
    const isCorrect =
      correctVal !== null &&
      userVal !== null &&
      Math.abs(correctVal - userVal) < 1e-6;

    const next = [...practice];
    next[idx] = { ...q, userAnswer: value, isCorrect };
    setPractice(next);
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
          <img src={preview} className="w-full max-h-80 object-contain bg-white rounded" />
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "読み取り中…" : "この写真でチェック"}
        </button>

        {/* 原题判定 */}
        {checked.map((c, i) => (
          <div
            key={i}
            className={`border rounded-xl px-4 py-2 flex justify-between ${
              c.isCorrect ? "bg-emerald-50" : "bg-red-50"
            }`}
          >
            <span>{c.expression} = {c.studentAnswer}</span>
            <span className="font-bold">{c.isCorrect ? "○" : "×"}</span>
          </div>
        ))}

        {/* A6-3 分数专项练习 */}
        {practice.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="font-semibold">🧮 分数のれんしゅう</div>
            {practice.map((p, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${
                  p.isCorrect === true
                    ? "bg-emerald-50"
                    : p.isCorrect === false
                    ? "bg-red-50"
                    : "bg-white"
                }`}
              >
                <div className="font-semibold">{p.question}</div>
                <div className="text-xs text-slate-600 mb-1">💡 {p.hint}</div>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={p.userAnswer}
                  onChange={e => answerPractice(i, e.target.value)}
                  placeholder="答えを入力"
                />
                {p.isCorrect === true && <div>✔ 正解</div>}
                {p.isCorrect === false && <div>✕ まちがい</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
