import { create } from "zustand";

export type ToastTone = "default" | "success" | "danger";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

export const useToastStore = create<{
  toast: Toast | null;
  show: (message: string, tone?: ToastTone) => void;
  dismiss: () => void;
}>((set) => ({
  toast: null,
  show: (message, tone = "default") =>
    set({ toast: { id: Date.now(), message, tone } }),
  dismiss: () => set({ toast: null }),
}));

export function showToast(message: string, tone?: ToastTone) {
  useToastStore.getState().show(message, tone);
}
