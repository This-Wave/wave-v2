import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Product } from "../../types";
import { Button, Field, Sheet } from "../v6";

export interface ProductFormInput {
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
}

interface ProductFormSheetProps {
  visible: boolean;
  mode: "create" | "edit";
  initial?: Product | null;
  onClose: () => void;
  onSubmit: (input: ProductFormInput) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  onChangeStatus?: () => void;
  submitting?: boolean;
  deleting?: boolean;
  error?: string | null;
}

/**
 * Create or edit a menu item. Uses v6 Sheet + Field (M5 / M8).
 * `imageUrl` accepts a hosted link — full camera upload is a follow-up.
 */
export function ProductFormSheet({
  visible,
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
  onChangeStatus,
  submitting = false,
  deleting = false,
  error,
}: ProductFormSheetProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (mode === "edit" && initial) {
      setName(initial.name);
      setPrice(String(initial.price));
      setDescription(initial.description ?? "");
      setCategory(initial.category ?? "");
      setImageUrl(initial.imageUrl ?? "");
    } else {
      setName("");
      setPrice("");
      setDescription("");
      setCategory("");
      setImageUrl("");
    }
    setLocalError(null);
  }, [visible, mode, initial]);

  const priceValue = Number(price.replace(",", "."));
  const priceValid = price.trim() !== "" && Number.isFinite(priceValue) && priceValue > 0;
  const canSave = name.trim().length > 0 && priceValid && !submitting && !deleting;

  function close() {
    onClose();
  }

  async function save() {
    if (!priceValid) {
      setLocalError("Enter a price greater than 0.");
      return;
    }
    const trimmedUrl = imageUrl.trim();
    if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
      setLocalError("Image link must start with http:// or https://");
      return;
    }
    setLocalError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceValue,
        category: category.trim() || undefined,
        imageUrl: trimmedUrl || undefined,
      });
      close();
    } catch {
      // Parent shows `error`; keep form filled for retry.
    }
  }

  async function remove() {
    if (!onDelete) return;
    try {
      await onDelete();
      close();
    } catch {
      // Parent handles error toast.
    }
  }

  const title = mode === "edit" ? "Edit item" : "Add item";

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title}
      footer={
        <View className="gap-2.5">
          <Button
            label={submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Save item"}
            disabled={!canSave}
            loading={submitting}
            onPress={save}
            accessibilityLabel={mode === "edit" ? "Save item changes" : "Save new menu item"}
          />
          {mode === "edit" && onChangeStatus ? (
            <Button
              label="Change menu status"
              variant="ghost"
              onPress={() => {
                onChangeStatus();
              }}
              accessibilityLabel="Change whether this item is on the menu"
            />
          ) : null}
          {mode === "edit" && onDelete ? (
            <Button
              label={deleting ? "Removing…" : "Remove item"}
              variant="inverse"
              loading={deleting}
              disabled={submitting || deleting}
              onPress={remove}
              accessibilityLabel="Remove this menu item"
            />
          ) : null}
          <Button label="Cancel" variant="quiet" onPress={close} accessibilityLabel="Cancel and close" />
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Jollof Rice + Chicken" maxLength={120} />
        <View className="mt-3">
          <Field
            label="Price (GHS)"
            value={price}
            onChangeText={setPrice}
            placeholder="35.00"
            keyboardType="decimal-pad"
          />
        </View>
        <View className="mt-3">
          <Field
            label="Category (optional)"
            value={category}
            onChangeText={setCategory}
            placeholder="main"
            maxLength={60}
          />
        </View>
        <View className="mt-3">
          <Field
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Large portion, extra shito on the side"
            multiline
            maxLength={1000}
          />
        </View>
        <View className="mt-3">
          <Field
            label="Photo link (optional)"
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            keyboardType="default"
            hint="Paste a link to a photo hosted online."
          />
        </View>
        {localError || error ? (
          <Text className="mt-3 font-sans text-body text-danger">{localError ?? error}</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
