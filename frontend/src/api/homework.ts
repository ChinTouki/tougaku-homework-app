// src/api/homework.ts
import { apiClient } from "./client";

export interface CheckHomeworkParams {
  grade: string;
  subject: "国語" | "算数" | "英語" | "思考力";
  question_text: string;
  child_answer: string;
}

export async function checkHomework(params: CheckHomeworkParams) {
  const res = await apiClient.post("/api/check_homework", params);
  return res.data;
}
