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

/* ========= 分数解析（暂不深究） ========= */
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

/* ========= raw_text → 判定 ========= */
function parseAndCheck(raw: string): CheckedItem[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.includes("="))
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

/* ========= 先生コメント（规则） ========= */
function teacherComment(correct: number, wrong: number): string {
  if (wrong === 0) {
    return "とてもよくできました！この調子で続けましょう。";
  }
  if (wrong === 1) {
    return "少しまちがいがありましたが、全体的によくできています。";
  }
  return "計算のしかたをもう一度見直してみましょう。";
}

/* ========= 页面 ========= */
const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [checked, setChecked] = useState<CheckedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setRawText("");
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

    setRawText(res.data.raw_text || "");
    setChecked(res.data.raw_text ? parseAndCheck(res.data.raw_text) : []);
    setLoading(false);
  };

  const correctCount = checked.filter(c => c.isCorrect).length;
  const wrongCount = checked.length - correctCount;
  const rate =
    checked.length > 0
      ? Math.round((correctCount / checked.length) * 100)
      : 0;

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

        {/* ===== 今日のまとめ ===== */}
        {checked.length > 0 && (
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <div className="font-semibold">📊 今日の算数まとめ</div>
            <div>✔ 正解：{correctCount}問</div>
            <div>✕ 間違い：{wrongCount}問</div>
            <div>正答率：{rate}%</div>
            <div className="text-sm text-slate-700 mt-2">
              👩‍🏫 {teacherComment(correctCount, wrongCount)}
            </div>
          </div>
        )}

        {/* ===== 原题判定 ===== */}
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
    </div>
  );
};

export default HomeworkCameraPage;
