import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";

interface AddProductSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; description?: string; price: number; category?: string }) => Promise<unknown>;
  submitting?: boolean;
  error?: string | null;
}

/**
 * Add an item to the shop's menu.
 *
 * Matches the API contract exactly (`createProductSchema`): name 1–120, optional
 * description, **positive** price, optional category. Price is validated here as
 * well as server-side so an owner does not lose a filled-in form to a 400.
 *
 * `imageUrl` is deliberately absent. The schema accepts one, but there is no
 * image-upload path from this screen — the `product-images` bucket exists and
 * nothing writes to it yet. Offering a URL field would ask a shop owner in
 * Berekuso to go and find a hosted image, which is not a real workflow.
 */
export function AddProductSheet({ visible, onClose, onSubmit, submitting = false, error }: AddProductSheetProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const priceValue = Number(price.replace(",", "."));
  const priceValid = price.trim() !== "" && Number.isFinite(priceValue) && priceValue > 0;
  const canSave = name.trim().length > 0 && priceValid && !submitting;

  function reset() {
    setName("");
    setPrice("");
    setDescription("");
    setCategory("");
    setLocalError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function save() {
    if (!priceValid) {
      setLocalError("Enter a price greater than 0.");
      return;
    }
    setLocalError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceValue,
        category: category.trim() || undefined,
      });
      close();
    } catch {
      // The parent surfaces the failure via `error`; keep the form filled so the
      // owner can retry without retyping.
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(10,23,7,0.55)" }}>
        <Pressable className="flex-1" onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="rounded-t-[24px] bg-surface px-5 pb-8 pt-5">
            <Text className="mb-4 font-sans-extrabold text-[18px] tracking-tight text-ink">Add item</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              <TextField label="Name" value={name} onChangeText={setName} placeholder="Jollof Rice + Chicken" maxLength={120} />
              <View className="mt-3">
                <TextField
                  label="Price (GHS)"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="35.00"
                  keyboardType="number-pad"
                />
              </View>
              <View className="mt-3">
                <TextField label="Category (optional)" value={category} onChangeText={setCategory} placeholder="main" maxLength={60} />
              </View>
              <View className="mt-3">
                <TextField
                  label="Description (optional)"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Large portion, extra shito on the side"
                  multiline
                  compactMultiline
                  maxLength={1000}
                />
              </View>

              {localError || error ? (
                <Text className="mt-3 text-[12px] text-danger-text">{localError ?? error}</Text>
              ) : null}
            </ScrollView>

            <View className="mt-5 gap-2.5">
              <Button label={submitting ? "Saving…" : "Save item"} disabled={!canSave} onPress={save} />
              <Button label="Cancel" variant="secondary" onPress={close} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
