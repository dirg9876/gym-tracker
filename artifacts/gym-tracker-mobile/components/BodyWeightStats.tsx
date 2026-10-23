import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Keyboard, Linking, Pressable, Text, TextInput, View } from "react-native";
import type { bodyWeightForecast } from "@/lib/bodyWeight";
import { localDateKey } from "@/lib/trainingInsights";
import { coachRequest } from "@/lib/coachApi";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg } from "@/lib/format";
import { Button } from "./Button";
import { LineChart } from "./LineChart";

export function BodyWeightStats({ body }: { body: ReturnType<typeof bodyWeightForecast> & { currentKg: number | null } }) {
  const colors = useColors(), client = useQueryClient();
  const [editing, setEditing] = useState(false), [date, setDate] = useState(localDateKey(new Date()));
  const [kg, setKg] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const page = Math.min(historyPage, Math.max(0, Math.ceil(body.history.length / 5) - 1));
  const historyRows = body.history.slice().reverse().slice(page * 5, (page + 1) * 5);
  const text = { color: colors.foreground, fontSize: 14, lineHeight: 21 };
  const muted = { color: colors.mutedForeground, fontSize: 12, lineHeight: 19 };
  const input = { color: colors.foreground, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: 48, fontSize: 16 };
  const save = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await coachRequest("/api/body-weight", "PUT", { date, kg: Number(kg.trim().replace(",", ".")) });
      Keyboard.dismiss(); setEditing(false); await client.invalidateQueries();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить взвешивание."); }
    finally { setBusy(false); }
  };
  const remove = (key: string) => Alert.alert("Удалить взвешивание?", formatDate(`${key}T12:00:00`), [
    { text: "Отмена", style: "cancel" }, { text: "Удалить", style: "destructive", onPress: async () => {
      if (busy) return;
      setBusy(true); setError(null);
      try { await coachRequest(`/api/body-weight/${key}`, "DELETE"); await client.invalidateQueries(); }
      catch { setError("Не удалось удалить запись."); }
      finally { setBusy(false); }
    } },
  ]);
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 }}>Масса тела и прогноз</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Закрыть запись веса" : "Записать вес тела"} disabled={busy} onPress={() => { setDate(localDateKey(new Date())); setKg(body.currentKg == null ? "" : String(body.currentKg)); setEditing(value => !value); setError(null); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name={editing ? "x" : "plus"} size={22} color={colors.accent} /></Pressable>
    </View>
    <Text style={text}>{body.currentKg == null ? "Текущая масса не указана" : `Текущая масса: ${formatKg(body.currentKg)}`}</Text>
    {editing ? <View style={{ gap: 8 }}>
      <Text style={muted}>Дата взвешивания</Text><TextInput accessibilityLabel="Дата взвешивания" value={date} onChangeText={setDate} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={colors.mutedForeground} maxLength={10} editable={!busy} style={input} />
      <Text style={muted}>Масса тела, кг</Text><TextInput accessibilityLabel="Масса тела, кг" value={kg} onChangeText={setKg} keyboardType="decimal-pad" maxLength={7} editable={!busy} style={input} />
      <Button title="Сохранить взвешивание" loading={busy} disabled={busy} icon={<Feather name="check" size={18} color={colors.primaryForeground} />} onPress={() => { void save(); }} />
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={{ ...muted, color: colors.amber }}>{error}</Text> : null}
    {body.history.length ? <LineChart points={body.history.slice(-28).map(row => ({ date: `${row.date}T12:00:00`, value: row.kg }))} color={colors.accent} zeroBaseline={false} label="Записанная масса тела" formatValue={formatKg} /> : null}
    <Text style={muted}>{body.reason}</Text>
    {body.weeklyChangeKg != null ? <Text style={{ ...text, color: colors.success }}>Тренд: {body.weeklyChangeKg > 0 ? "+" : ""}{formatKg(body.weeklyChangeKg)} в неделю</Text> : null}
    {body.points.map(point => <View key={point.date} style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 10, gap: 4 }}>
      <Text style={text}>{formatDate(`${point.date}T12:00:00`)} · около {formatKg(point.value)}</Text>
      <Text style={muted}>Сценарный диапазон: {formatKg(point.low)} – {formatKg(point.high)}</Text>
    </View>)}
    {historyRows.map(row => <View key={row.date} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 6 }}>
      <View style={{ flex: 1 }}><Text style={text}>{formatKg(row.kg)}</Text><Text style={muted}>{formatDate(`${row.date}T12:00:00`)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Изменить вес за ${row.date}`} disabled={busy} onPress={() => { setDate(row.date); setKg(String(row.kg)); setEditing(true); setError(null); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="edit-2" size={18} color={colors.accent} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Удалить вес за ${row.date}`} disabled={busy} onPress={() => remove(row.date)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="trash-2" size={18} color={colors.mutedForeground} /></Pressable>
    </View>)}
    {body.history.length > 5 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Более новые взвешивания" disabled={page === 0 || busy} onPress={() => setHistoryPage(page - 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: page === 0 ? 0.35 : 1 }}><Feather name="chevron-left" size={20} color={colors.accent} /></Pressable>
      <Text style={{ ...muted, flex: 1, textAlign: "center" }}>Записи {page * 5 + 1}–{Math.min(body.history.length, (page + 1) * 5)} из {body.history.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Более ранние взвешивания" disabled={(page + 1) * 5 >= body.history.length || busy} onPress={() => setHistoryPage(page + 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: (page + 1) * 5 >= body.history.length ? 0.35 : 1 }}><Feather name="chevron-right" size={20} color={colors.accent} /></Pressable>
    </View> : null}
    {body.points.length ? <Text style={muted}>{body.method}</Text> : null}
    <Text style={muted}>Тренировки сами по себе не определяют прибавку массы: важны питание и другие условия. Тренд взвешиваний не измеряет прирост мышц.</Text>
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner"); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="external-link" size={15} color={colors.accent} /><Text style={{ ...muted, color: colors.accent, flex: 1 }}>NIH/NIDDK · масса тела, питание и активность</Text></Pressable>
  </View>;
}
