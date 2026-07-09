import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Checkpoint, University } from "../types";

export function useUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await api.get<{ universities: University[] }>("/universities");
      return data.universities;
    },
  });
}

export function useCheckpoints(universityId: string | undefined) {
  return useQuery({
    queryKey: ["checkpoints", universityId],
    queryFn: async () => {
      const { data } = await api.get<{ checkpoints: Checkpoint[] }>(`/universities/${universityId}/checkpoints`);
      return data.checkpoints;
    },
    enabled: !!universityId,
  });
}
