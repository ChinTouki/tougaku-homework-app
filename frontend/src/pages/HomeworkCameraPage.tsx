import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";

interface ApiResponse {
  raw_text?: string;
  error?: string;
}

const HomeworkCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setResponse(null);
  };

  const handleCheck = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post<ApiResponse>(
        "/api/check_homework_image",
        formData,
        { timeout: 60000 }
      );
      setResponse(res.data);
    } catch (e) {
      setResponse({ error: "request_failed" });
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

        <h1 className="text-lg font-bold">📸 宿題チェック（診断）</h1>

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

        {response && (
          <div className="bg-white border rounded p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">📦 API Response</div>

            <div className="text-xs text-slate-500 mb-1">
              raw_text:
            </div>
            <pre className="bg-slate-100 p-2 rounded">
{response.raw_text ?? "(undefined)"}
            </pre>

            {response.error && (
              <>
                <div className="text-xs text-red-600 mt-2">
                  error:
                </div>
                <pre className="bg-red-50 p-2 rounded">
{response.error}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeworkCameraPage;
