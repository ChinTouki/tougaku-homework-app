import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeworkPage from "./pages/HomeworkPage";
import PracticePage from "./pages/PracticePage";
import HomeworkCameraPage from "./pages/HomeworkCameraPage";
import { useNavigate } from "react-router-dom";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="...">
      {/* 原来的内容 */}

      <button
        type="button"
        onClick={() => navigate("/camera")}
        className="mt-4 w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
      >
        📸 宿題カメラでチェック
      </button>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeworkPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/camera" element={<HomeworkCameraPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
