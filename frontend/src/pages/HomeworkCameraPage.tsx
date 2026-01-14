import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface DebugResponse {
  raw_text: string;
}

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleCheck = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post<DebugResponse>(
        "/api/check_homework_image",
        formData
      );
      setResult(res.data);
    } catch (e) {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500">
          ← 戻る
        </button>

        <h1 className="text-lg font-bold">📸 宿題カメラ（算数）</h1>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />

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

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {result && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📄 読み取った内容</div>
            {result.raw_text}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
