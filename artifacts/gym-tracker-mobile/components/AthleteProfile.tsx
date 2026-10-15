import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateProfile } from "@workspace/api-client-react";
import { weightClass } from "@workspace/level-data/strength";
import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Button } from "./Button";
import { formatNumber } from "@/lib/format";

export function AthleteProfile({ sex, bodyWeightKg, fallback }: { sex: "male" | "female"; bodyWeightKg: number; fallback: boolean }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [weight, setWeight] = useState("");
  const [selectedSex, setSelectedSex] = useState(sex);
  const update = useUpdateProfile();
  const save = async () => {
    const kg = Number(weight.trim().replace(",", "."));
    if (!Number.isFinite(kg) || kg < 20 || kg > 500) {
      Alert.alert("Проверь вес", "Допустимый вес: от 20 до 500 кг.");
      return;
    }
    try {
      await update.mutateAsync({ data: { sex: selectedSex, bodyWeightKg: kg } });
      await queryClient.invalidateQueries();
      setVisible(false);
    } catch {
      Alert.alert("Не удалось сохранить", "Данные не изменены. Попробуй ещё раз.");
    }
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить пол и вес" onPress={() => {
        setWeight(fallback ? "" : String(bodyWeightKg)); setSelectedSex(sex); setVisible(true);
      }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
        <Feather name="user" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 13 }}>{sex === "male" ? "Мужчины" : "Женщины"} · категория {weightClass(bodyWeightKg, sex).label.replace(".", ",")} кг</Text>
          <Text style={{ color: fallback ? colors.amber : colors.mutedForeground, fontSize: 12 }}>
            {fallback ? "Вес не задан: временно 75 кг" : `Вес тела: ${formatNumber(bodyWeightKg)} кг`}
          </Text>
        </View>
        <Feather name="edit-2" size={17} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !update.isPending && setVisible(false)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#00000099" }}>
          <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 8, gap: 16 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>Данные спортсмена</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["male", "female"] as const).map(value => (
                <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: value === selectedSex }} onPress={() => setSelectedSex(value)} style={{ flex: 1, padding: 12, borderRadius: 6, backgroundColor: value === selectedSex ? colors.primarySoft : colors.muted, borderWidth: 1, borderColor: value === selectedSex ? colors.primary : colors.cardBorder }}>
                  <Text style={{ color: colors.foreground, textAlign: "center" }}>{value === "male" ? "Мужской" : "Женский"}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: colors.mutedForeground }}>Вес тела, кг</Text>
            <TextInput accessibilityLabel="Вес тела, кг" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={7} style={{ color: colors.foreground, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 18 }} />
            <Button title="Сохранить" onPress={save} loading={update.isPending} />
            <Button title="Отмена" variant="ghost" onPress={() => setVisible(false)} disabled={update.isPending} />
          </View>
        </View>
      </Modal>
    </>
  );
}
