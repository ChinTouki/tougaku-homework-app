import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

/* ========= API ========= */
interface ApiResponse {
  raw_text?: string;
}

/* ========= 判定结构 ========= */
interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

interface PracticeItem {
  question: string;
  userAnswer: string;
  isCorrect: boolean | null;
}

/* ========= 工具 ========= */
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

/* ========= 判对错 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  return raw
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

/* ========= 错题生成 ========= */
function generatePractice(expr: string): string[] {
  if (expr.includes("×")) return ["6 × 4 = ?", "7 × 3 = ?", "8 × 5 = ?"];
  if (expr.includes("÷")) return ["8 ÷ 2 = ?", "12 ÷ 3 = ?", "15 ÷ 5 = ?"];
  if (expr.includes("+")) return ["7 + 6 = ?", "9 + 8 = ?", "5 + 7 = ?"];
  if (expr.includes("-")) return ["15 - 7 = ?", "14 - 6 = ?", "20 - 9 = ?"];
  return [];
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

    const result = res.data.raw_text
      ? parseAndCheck(res.data.raw_text)
      : [];

    setChecked(result);

    // 生成错题练习
    const exercises: PracticeItem[] = [];
    result.filter(r => !r.isCorrect).forEach(r => {
      generatePractice(r.expression).forEach(q => {
        exercises.push({
          question: q,
          userAnswer: "",
          isCorrect: null,
        });
      });
    });

    setPractice(exercises);
    setLoading(false);
  };

  const answerPractice = (idx: number, value: string) => {
    const q = practice[idx];
    const correctVal = evalExpression(q.question.replace("= ?", ""));
    const isCorrect = correctVal !== null && Number(value) === correctVal;

    const updated = [...practice];
    updated[idx] = { ...q, userAnswer: value, isCorrect };
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

        {/* 判定 */}
        {checked.map((c, i) => (
          <div
            key={i}
            className={`border rounded-xl px-4 py-2 flex justify-between ${
              c.isCorrect ? "bg-emerald-50" : "bg-red-50"
            }`}
          >
            <span>
              {c.expression} = {c.studentAnswer}
            </span>
            <span className="font-bold">
              {c.isCorrect ? "○" : "×"}
            </span>
          </div>
        ))}

        {/* 错题练习 */}
        {practice.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="font-semibold">✏️ まちがえた問題のれんしゅう</div>
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
                <div>{p.question}</div>
                <input
                  type="number"
                  className="mt-1 w-full border rounded px-2 py-1"
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
