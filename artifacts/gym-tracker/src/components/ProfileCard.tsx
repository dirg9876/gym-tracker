import { useEffect, useState } from "react";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
  getGetLevelsQueryKey,
  getGetLevelForecastQueryKey,
  type BMICategory,
  type Profile,
} from "@workspace/api-client-react";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pencil, Scale, Ruler, X, Check, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

import { Stepper } from "@/components/Stepper";
import { formatNumber } from "@/lib/format";

type Sex = "male" | "female";

const BMI_LABEL: Record<BMICategory, string> = {
  underweight: "Недовес",
  normal: "Норма",
  overweight: "Избыток",
  obese: "Ожирение",
};

const BMI_BADGE: Record<BMICategory, string> = {
  underweight: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  normal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  overweight: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  obese: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

const DEFAULT_WEIGHT = 80;
const DEFAULT_HEIGHT = 178;
const DEFAULT_SEX: Sex = "male";

const SEX_LABEL: Record<Sex, string> = {
  male: "Мужчина",
  female: "Женщина",
};

export function ProfileCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetProfile();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState<number>(DEFAULT_WEIGHT);
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [sex, setSex] = useState<Sex>(DEFAULT_SEX);

  useEffect(() => {
    if (data && !editing) {
      setWeight(data.bodyWeightKg ?? DEFAULT_WEIGHT);
      setHeight(data.heightCm ?? DEFAULT_HEIGHT);
      setSex((data.sex as Sex) ?? DEFAULT_SEX);
    }
  }, [data, editing]);

  const update = useUpdateProfile({
    mutation: {
      onSuccess: (next: Profile) => {
        queryClient.setQueryData(getGetProfileQueryKey(), next);
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelForecastQueryKey() });
        setEditing(false);
      },
    },
  });

  if (isLoading || !data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
    );
  }

  const hasWeight = data.bodyWeightKg != null;
  const hasHeight = data.heightCm != null;

  if (!hasWeight && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3 hover:bg-amber-500/15 transition-colors"
      >
        <Scale className="h-6 w-6 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground">Укажи свой вес</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Без него нормативы считаются по умолчанию (80 кг, мужчина). Вес и пол влияют на
            требуемые штанги и тоннаж.
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {editing ? (
        <motion.div
          key="editor"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-card border border-border rounded-2xl p-4 space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Твой профиль
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(false)}
                aria-label="Отменить"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Sex toggle */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-medium">Пол</div>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as Sex[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${
                      sex === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {SEX_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            <Stepper
              label="Вес тела"
              value={weight}
              onChange={setWeight}
              min={30}
              max={250}
              step={1}
              chips={[60, 70, 80, 90, 100]}
              unit="кг"
            />

            <Stepper
              label="Рост (для BMI)"
              value={height}
              onChange={setHeight}
              min={100}
              max={230}
              step={1}
              chips={[160, 170, 180, 190]}
              unit="см"
            />

            <Button
              className="w-full h-12 rounded-xl font-bold"
              onClick={() =>
                update.mutate({
                  data: { bodyWeightKg: weight, heightCm: height, sex },
                })
              }
              disabled={update.isPending}
            >
              <Check className="h-5 w-5 mr-2" />
              {update.isPending ? "Сохраняю..." : "Сохранить"}
            </Button>

            {update.isError && (
              <div className="text-xs text-destructive text-center">
                Не получилось сохранить. Попробуй ещё раз.
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="display"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setEditing(true)}
          className="w-full text-left bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3 hover:bg-card/80 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-sm">
            <Scale className="h-4 w-4 text-primary" />
            <span className="font-bold tabular-nums">
              {formatNumber(data.bodyWeightKg ?? 0)}
            </span>
            <span className="text-muted-foreground text-xs">кг</span>
          </div>

          {hasHeight && (
            <div className="flex items-center gap-1.5 text-sm">
              <Ruler className="h-4 w-4 text-primary" />
              <span className="font-bold tabular-nums">
                {formatNumber(data.heightCm ?? 0)}
              </span>
              <span className="text-muted-foreground text-xs">см</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{SEX_LABEL[(data.sex as Sex) ?? "male"]}</span>
          </div>

          {data.bmi !== null && data.bmiCategory && (
            <div
              className={`ml-auto text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${BMI_BADGE[data.bmiCategory]}`}
            >
              BMI {data.bmi} · {BMI_LABEL[data.bmiCategory]}
            </div>
          )}

          {!hasHeight && (
            <span className="ml-auto text-xs text-muted-foreground">
              + рост для BMI
            </span>
          )}

          <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
