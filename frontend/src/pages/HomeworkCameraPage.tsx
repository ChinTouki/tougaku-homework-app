import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface ApiResponse {
  raw_text: string;
}

interface CheckedItem {
  expression: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
}

function parseFraction(str: string): number | null {
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
      const studentVal = parseFraction(studentAnswer);

      let isCorrect = false;
      let correctAnswer = "?";

      if (correctVal !== null && studentVal !== null) {
        isCorrect = Math.abs(correctVal - studentVal) < 1e-6;
        correctAnswer = String(correctVal);
      }

      return { expression, studentAnswer, isCorrect, correctAnswer };
    });
}

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

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題チェック（算数）</h1>

        <input type="file" accept="image/*" onChange={handleFileChange} />

        {preview && (
          <div className="bg-white rounded-xl border p-2">
            <img
              src={preview}
              className="w-full max-h-80 object-contain rounded"
            />
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full rounded-full bg-amber-400 py-2 font-semibold"
        >
          {loading ? "読み取り中…" : "この写真でチェック"}
        </button>

        {/* === A5-2：贴近图片的原题结果 === */}
        {checked.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <div className="font-semibold">🧮 原題の結果</div>
            {checked.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  {idx + 1}. {item.expression} = {item.studentAnswer}
                </div>
                <div
                  className={`font-bold ${
                    item.isCorrect ? "text-emerald-600" : "text-red-600"
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
