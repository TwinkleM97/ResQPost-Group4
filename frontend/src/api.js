import axios from "axios";

// Build-time var for React. If not set, use relative "/api" which works with nginx proxy.
const API_BASE = (process.env.REACT_APP_API_URL || "/api").trim();

const http = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

// If the backend returns relative paths for images, let nginx redirect /uploads/* to S3.
// If it's an absolute http(s) URL, just return it.
export const imgUrl = (u) => {
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : u;
};

export default http;
