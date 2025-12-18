import React from "react";
import { Routes, Route } from "react-router-dom";
import HomeworkPage from "./pages/HomeworkPage";
import PracticePage from "./pages/PracticePage";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomeworkPage />} />
      <Route path="/practice" element={<PracticePage />} />
    </Routes>
  );
};

export default App;
