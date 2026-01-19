// frontend/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomeworkPage from "./pages/HomeworkPage";
import PracticePage from "./pages/PracticePage";
import HomeworkCameraPage from "./pages/HomeworkCameraPage";
import JapaneseHomeworkPage from "./pages/JapaneseHomeworkPage";
import EnglishHomeworkPage from "./pages/EnglishHomeworkPage";


const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeworkPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/camera" element={<HomeworkCameraPage />} />
        <Route path="/japanese" element={<JapaneseHomeworkPage />} />
        <Route path="/english" element={<EnglishHomeworkPage />} />


      </Routes>
    </BrowserRouter>
  );
};

export default App;
