import { useLocalInference } from "../localInference.native";
export function useLocalCoach(active: boolean) {
  return useLocalInference(active, "chat");
}
