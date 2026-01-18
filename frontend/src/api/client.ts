import axios from "axios";

export const apiClient = axios.create({
  baseURL: "https://tougaku-homework-app.onrender.com",
});
