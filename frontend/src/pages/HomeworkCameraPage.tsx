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

/* ========= A8：老师点评规则 ========= */
function teacherSummary(checked: CheckedItem[]) {
  const total = checked.length;
  const correct = checked.filter(c => c.isCorrect).length;
  const wrong = total - correct;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

  let good = "計算を最後までしっかり考えられています。";
  let improve = "この調子で続けましょう。";

  if (wrong > 0) {
    if (checked.some(c => !c.isCorrect && c.expression.includes("×"))) {
      improve = "かけ算の九九をもう一度れんしゅうしましょう。";
    } else if (checked.some(c => !c.isCorrect && c.expression.includes("÷"))) {
      improve = "わり算の考え方をゆっくり確認しましょう。";
    } else if (checked.some(c => !c.isCorrect && c.expression.includes("/"))) {
      improve = "分数の計算は、通分を意識するとよくなります。";
    }
  }

  return { total, correct, wrong, rate, good, improve };
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

    setChecked(res.data.raw_text ? parseAndCheck(res.data.raw_text) : []);
    setLoading(false);
  };

  const summary = teacherSummary(checked);

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

        {/* ===== A8：今日のまとめ ===== */}
        {checked.length > 0 && (
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <div className="font-semibold">📘 今日の学習まとめ（算数）</div>
            <div>✔ 正解：{summary.correct}問</div>
            <div>✕ まちがい：{summary.wrong}問</div>
            <div>正答率：{summary.rate}%</div>
            <div className="text-sm mt-2">
              <div>できているところ：</div>
              <div className="text-slate-700">{summary.good}</div>
            </div>
            <div className="text-sm mt-2">
              <div>これからのポイント：</div>
              <div className="text-slate-700">{summary.improve}</div>
            </div>
          </div>
        )}

        {/* ===== 原题判定 ===== */}
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
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
