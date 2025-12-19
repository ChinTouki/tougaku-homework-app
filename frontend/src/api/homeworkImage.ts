// frontend/src/api/homeworkImage.ts
import { apiClient } from "./client";

export interface SimilarPractice {
  question: string;
  answer: string;
  explanation: string;
}

export interface ImageProblemResult {
  id: number;
  bbox: number[]; // [x, y, width, height] (0〜1)
  question_text: string;
  child_answer: string;
  correct: boolean;
  score: number;
  feedback: string;
  hint: string;
  similar_practice: SimilarPractice[];
}

export interface CheckHomeworkImageResponse {
  subject: string;
  detected_grade?: string | null;
  problems: ImageProblemResult[];
}

export async function checkHomeworkImage(
  formData: FormData
): Promise<CheckHomeworkImageResponse> {
  const res = await apiClient.post<CheckHomeworkImageResponse>(
    "/api/check_homework_image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return res.data;
}
