import type { Equipment } from "@workspace/api-client-react";
import { View } from "react-native";
import { Stepper } from "./Stepper";
import { Segmented } from "./Segmented";
import { WEIGHT_STEP_PRESETS, type EquipmentSettings } from "@/lib/equipmentSettings";

export function EquipmentSettingsFields({ equipment, value, onChange, disabled }: { equipment: Equipment; value: EquipmentSettings; onChange: (value: EquipmentSettings) => void; disabled?: boolean }) {
  return <View style={{ gap: 16 }}>
    <Stepper label="Шаг веса" unit="кг" value={value.weightStepKg ?? 2.5} min={0.25} max={20} step={0.25} chips={WEIGHT_STEP_PRESETS} disabled={disabled} onChange={weightStepKg => onChange({ ...value, weightStepKg })} />
    {equipment === "dumbbell" ? <Segmented label="Гантелей в подходе" value={String(value.dumbbellCount ?? 1)} options={[{ value: "1", label: "Одна" }, { value: "2", label: "Две" }]} disabled={disabled} onChange={count => onChange({ ...value, dumbbellCount: Number(count) as 1 | 2 })} /> : null}
    {equipment === "machine" ? <Segmented label="Тип нагрузки" value={value.loadMode ?? "weight"} options={[{ value: "weight", label: "Вес" }, { value: "assisted", label: "Противовес" }]} disabled={disabled} onChange={loadMode => onChange({ ...value, loadMode: loadMode as EquipmentSettings["loadMode"] })} /> : null}
  </View>;
}
