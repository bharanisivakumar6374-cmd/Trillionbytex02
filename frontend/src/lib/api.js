import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach bearer from localStorage as a fallback (cross-domain cookie may be blocked)
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("session_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
