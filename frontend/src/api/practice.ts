// src/api/practice.ts
import { apiClient } from "./client";

export interface GeneratePracticeParams {
  grade: string;        // 例："小4"
  subject: string;      // 例："思考力"
  num_questions: number;
  skill_focus?: string; // 例："推理パズル"
}

export async function generatePractice(params: GeneratePracticeParams) {
  const payload = {
    grade: params.grade,
    subject: params.subject,
    num_questions: params.num_questions,
    skill_focus: params.skill_focus,
  };

  const res = await apiClient.post("/api/generate_practice", payload);
  return res.data;
}
