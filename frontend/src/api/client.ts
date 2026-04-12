import axios from "axios";
import { Platform } from "react-native";

const localFallbackBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3000/api" : "http://localhost:3000/api";
const productionBaseUrl = "https://backend-nine-lime-25.vercel.app/api";

const baseURL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? localFallbackBaseUrl : productionBaseUrl);

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json"
  }
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const getApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
    if (error.message) {
      return error.message;
    }
  }
  return "Something went wrong. Please try again.";
};
