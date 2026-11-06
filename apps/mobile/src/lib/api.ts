import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/v1",
  // Axios defaults to no timeout, which meant a request that hung never
  // resolved and never rejected: every screen waiting on it sat in its loading
  // state forever, with no error, no retry and nothing to tell the user. It is
  // how the rider feed came to show three blank cards indefinitely whenever the
  // API was cold or the connection dropped mid-flight — the ordinary case on
  // Ghanaian mobile data, not an edge case.
  //
  // 20s is chosen to sit above a slow-but-working request (a cold API answering
  // the order feed took ~5s) and below the point where a person has decided the
  // app is broken. Past it react-query's retry runs and then the screen's error
  // state offers a retry, which is the outcome a hang should have had.
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
