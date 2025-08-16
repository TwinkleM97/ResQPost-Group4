// src/api.js
import axios from "axios";

// Always same-origin: nginx proxies /api and /uploads.
// No envs, no fallbacks, nothing to hardcode.
const http = axios.create({ baseURL: "" });

export default http;

// Helper for image paths the backend returns
export const imgUrl = (u) => {
  if (!u) return "";
  const s = String(u).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("/uploads/") ? s : s.startsWith("uploads/") ? `/${s}` : s;
};
