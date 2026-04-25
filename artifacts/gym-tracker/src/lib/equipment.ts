import type { Equipment } from "@workspace/api-client-react";

export const EQUIPMENT_OPTIONS: ReadonlyArray<{
  value: Equipment;
  label: string;
  short: string;
}> = [
  { value: "barbell", label: "Штанга", short: "Штанга" },
  { value: "dumbbell", label: "Гантели", short: "Гантели" },
  { value: "bodyweight", label: "Свой вес", short: "Свой вес" },
  { value: "machine", label: "Тренажёр", short: "Тренажёр" },
  { value: "other", label: "Другое", short: "Другое" },
];

const LABEL_BY_VALUE: Record<Equipment, string> = EQUIPMENT_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.value] = opt.label;
    return acc;
  },
  {} as Record<Equipment, string>,
);

export function equipmentLabel(eq: Equipment): string {
  return LABEL_BY_VALUE[eq] ?? "Другое";
}

export function isBodyweight(eq: Equipment | undefined | null): boolean {
  return eq === "bodyweight";
}
