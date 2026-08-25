import AsyncStorage from "@react-native-async-storage/async-storage";

const CHECKPOINT_KEY = "wave_last_checkpoint_id";

export async function getLastCheckpointId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHECKPOINT_KEY);
  } catch {
    return null;
  }
}

export async function setLastCheckpointId(checkpointId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECKPOINT_KEY, checkpointId);
  } catch {
    // Non-critical — checkout still works with a default.
  }
}
