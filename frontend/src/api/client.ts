// src/api/client.ts
import axios from "axios";

// 本地：默认连 127.0.0.1:8000，将来 Render 上用 VITE_API_BASE_URL 覆盖
const baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL,
});
