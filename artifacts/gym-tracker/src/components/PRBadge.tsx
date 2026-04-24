import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { PersonalRecordKind } from "@workspace/api-client-react";

interface PRBadgeProps {
  kind: PersonalRecordKind | string;
  value: number;
  delta: number;
  formatFn: (val: number) => string;
  delay?: number;
}

const labels: Record<string, string> = {
  tonnage: "Новый рекорд тоннажа",
  reps: "Рекорд повторений",
  max_weight: "Новый максимальный вес",
  max_reps: "Рекорд повторений (упражнение)",
  max_volume_set: "Рекорд объема в подходе"
};

export function PRBadge({ kind, value, delta, formatFn, delay = 0 }: PRBadgeProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay }}
      className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center gap-4"
    >
      <div className="bg-primary text-primary-foreground w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
        <TrendingUp className="h-6 w-6" />
      </div>
      <div>
        <div className="text-sm font-medium text-primary mb-0.5">{labels[kind] || "Новый рекорд!"}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black">{formatFn(value)}</span>
          <span className="text-sm font-bold text-emerald-500">+{formatFn(delta)}</span>
        </div>
      </div>
    </motion.div>
  );
}
