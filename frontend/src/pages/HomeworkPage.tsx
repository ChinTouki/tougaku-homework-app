import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkHomework } from "../api/homework";

const HomeworkPage: React.FC = () => {
  const navigate = useNavigate();
  const [grade, setGrade] = useState("小4");
  const [subject, setSubject] =
    useState<"国語" | "算数" | "英語" | "思考力">("算数");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!question || !answer) return;
    setLoading(true);
    try {
      const data = await checkHomework({
        grade,
        subject,
        question_text: question,
        child_answer: answer,
      });
      setResult(data.result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-slate-900">
            宿題チェック（試作）
          </h1>
          <button
            onClick={() => navigate("/practice")}
            className="text-xs text-amber-600"
          >
            思考力の練習へ →
          </button>
        </div>

        <p className="text-xs text-slate-600">
          問題文とお子さまの答えを入力すると、AIが〇×とヒントを返します。
        </p>

        <div className="flex gap-2 text-xs">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="px-2 py-1 border rounded-lg"
          >
            {["小1", "小2", "小3", "小4", "小5", "小6"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as any)}
            className="px-2 py-1 border rounded-lg flex-1"
          >
            <option value="国語">国語</option>
            <option value="算数">算数</option>
            <option value="英語">英語</option>
            <option value="思考力">思考力</option>
          </select>
        </div>

        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          rows={3}
          placeholder="宿題の問題を入力してください"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          rows={3}
          placeholder="お子さまの答えを入力してください"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-amber-400 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "チェック中…" : "AIにチェックしてもらう"}
        </button>

        {result && (
          <div className="bg-white rounded-lg p-3 border text-xs space-y-1">
            <div>
              判定:{" "}
              <span className="font-semibold">
                {result.correct ? "正解" : "まちがいあり"}
              </span>{" "}
              （{Math.round(result.score * 100)}%）
            </div>
            <div>説明: {result.feedback_message}</div>
            <div className="text-amber-700">ヒント: {result.hint}</div>
            {result.correct_answer_example && (
              <div className="mt-1">
                模範解答例: {result.correct_answer_example}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkPage;
