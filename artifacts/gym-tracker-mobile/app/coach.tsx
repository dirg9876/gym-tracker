import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coachProfileSchema, defaultCoachProfile, equipmentSchema, type CoachProfile, type CoachEnvelope } from "@workspace/ai-coach";
import { useEffect, useState } from "react";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Segmented } from "@/components/Segmented";
import { Stepper } from "@/components/Stepper";
import { AI_CONNECTION_QUERY, AI_BUDGET_QUERY, useAiConnection } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { connectAiCoach, disconnectAiCoach, setAiConsent, setAiEnabled, readAiGatewayStatus, readSavedAiCoachToken, coachGatewayUrl, DEFAULT_COACH_URL } from "@/lib/aiCoachConnection";
import { MAX_CONNECTION_FILE_BYTES, parseAiCoachConnectionFile } from "@/lib/aiCoachCredentials";

const labels = { barbell: "Штанга", dumbbell: "Гантели", bodyweight: "Собственный вес", machine: "Тренажёры", other: "Другое" };
export default function CoachScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const connection = useAiConnection();
  const budget = useQuery<CoachEnvelope["budget"] | null>({ queryKey: AI_BUDGET_QUERY, queryFn: async () => null, enabled: false });
  const stored = useQuery({ queryKey: ["ai-profile"], queryFn: () => coachRequest<CoachProfile>("/api/ai-coach/profile") });
  const [profile, setProfile] = useState(defaultCoachProfile);
  const [url, setUrl] = useState(DEFAULT_COACH_URL);
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof connectAiCoach>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (stored.data) setProfile(stored.data); }, [stored.data]);
  useEffect(() => { if (connection.data?.url) setUrl(connection.data.url); }, [connection.data?.url]);
  useEffect(() => {
    let mounted = true;
    void readSavedAiCoachToken().then(value => { if (mounted) { setToken(value); setSavedToken(value); } }).catch(() => {});
    return () => { mounted = false; };
  }, [connection.data?.url, connection.data?.connected]);
  const operation = useMutation({ mutationFn: async (action: () => Promise<unknown>) => { setError(null); await action(); await client.invalidateQueries({ queryKey: AI_CONNECTION_QUERY }); }, onError: (e: Error) => setError(e.message) });
  const busy = operation.isPending;
  const dirty = JSON.stringify(profile) !== JSON.stringify(stored.data);
  let sameConnection = false;
  try { sameConnection = !!connection.data?.connected && coachGatewayUrl(url) === connection.data.url && token.trim() === savedToken; } catch { /* An edited invalid URL can be corrected before connecting. */ }
  const connected = async (address: string, credential: string) => {
    const next = await connectAiCoach(address, credential);
    const saved = await readSavedAiCoachToken();
    setUrl(address); setToken(saved); setSavedToken(saved); setShowToken(false);
    setStatus(next); client.setQueryData(AI_BUDGET_QUERY, next.budget);
  };
  const importConnection = async () => {
    let picked;
    try { picked = await File.pickFileAsync(undefined, "*/*"); }
    catch (error) { if (/cancelled|canceled/i.test(String(error))) return; throw new Error("Не удалось открыть файл подключения."); }
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return;
    const file = new File(selected.uri);
    if (file.size > MAX_CONNECTION_FILE_BYTES) throw new Error("Файл подключения слишком большой.");
    const value = parseAiCoachConnectionFile(await file.text());
    const confirmed = await new Promise<boolean>(resolve => Alert.alert("Подключить тренера?", value.url, [{ text: "Отмена", style: "cancel", onPress: () => resolve(false) }, { text: "Подключить", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (confirmed) await connected(value.url, value.token);
  };
  const requestConsent = (enableCoach = false) => {
    Alert.alert("Отправка данных тренеру", "Личному шлюзу и OpenAI будут переданы указанные пол и вес тела, упражнения, недавние подходы, оценки RIR/техники, параметры программы и отправленные сообщения тренеру. Резервные копии и ключи не отправляются.", [{ text: "Отмена", style: "cancel" }, { text: "Разрешить", onPress: () => operation.mutate(async () => { await setAiConsent(true); if (enableCoach) await setAiEnabled(true); }) }]);
  };
  const enable = (value: boolean) => {
    if (value && connection.data?.connected && !connection.data.consent) requestConsent(true);
    else operation.mutate(() => setAiEnabled(value));
  };
  const input = { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, paddingHorizontal: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 15 };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScreenHeader title="ИИ-тренер" />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}><Text style={{ flex: 1, color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" }}>ИИ-тренер</Text><Switch accessibilityLabel="ИИ-тренер" value={connection.data?.enabled ?? false} disabled={busy || connection.isPending} trackColor={{ true: colors.primary }} onValueChange={enable} /></View>
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{connection.data?.connected ? "Подключение сохранено" : "Личный шлюз не подключён"}</Text>
      {error || connection.data?.connectionError ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>{error || connection.data?.connectionError}</Text> : null}
      <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>Подключение</Text>
      <TextInput accessibilityLabel="Адрес личного шлюза" placeholder="https://coach.example.com" placeholderTextColor={colors.mutedForeground} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} editable={!busy} keyboardType="url" maxLength={300} style={input} />
      <View style={{ ...input, paddingHorizontal: 0, flexDirection: "row", alignItems: "center" }}>
        <TextInput accessibilityLabel="Токен личного шлюза" placeholder="Токен личного шлюза" placeholderTextColor={colors.mutedForeground} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} editable={!busy} secureTextEntry={!showToken} maxLength={256} style={{ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 12, color: colors.foreground, fontSize: 15 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={showToken ? "Скрыть токен" : "Показать токен"} disabled={busy} onPress={() => setShowToken(value => !value)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name={showToken ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} /></Pressable>
      </View>
      <Button title={sameConnection ? "Шлюз подключён" : "Подключить шлюз"} variant={sameConnection ? "secondary" : "primary"} icon={<Feather name={sameConnection ? "check-circle" : "link"} size={18} color={sameConnection ? colors.success : colors.primaryForeground} />} disabled={sameConnection || busy || !url.trim() || !token.trim()} loading={busy} onPress={() => operation.mutate(() => connected(url, token))} />
      <Button title="Импорт подключения" variant="secondary" icon={<Feather name="upload" size={18} color={colors.foreground} />} disabled={busy} onPress={() => operation.mutate(importConnection)} />
      {connection.data?.connected ? <Button title="Забыть подключение" variant="ghost" icon={<Feather name="trash-2" size={18} color={colors.foreground} />} disabled={busy} onPress={() => operation.mutate(async () => { await disconnectAiCoach(); setToken(""); setShowToken(false); setStatus(null); client.removeQueries({ queryKey: AI_BUDGET_QUERY }); })} /> : null}
      {status ? <View style={{ gap: 6 }}>
        <Text style={{ color: status.ready ? colors.success : colors.amber, fontSize: 13 }}>{status.ready ? status.model : "На сервере не настроен ключ OpenAI"}</Text>
      </View> : null}
      {connection.data?.connected ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 13 }}>{budget.data ? `Лимит: $${budget.data.limitUsd}/мес. · израсходовано: $${budget.data.usedUsd.toFixed(4)} · резерв: $${budget.data.reservedUsd.toFixed(4)}` : "Расходы ИИ"}</Text><Pressable accessibilityRole="button" accessibilityLabel="Обновить расходы ИИ" disabled={busy} onPress={() => operation.mutate(async () => { const next = await readAiGatewayStatus(); setStatus(next); client.setQueryData(AI_BUDGET_QUERY, next.budget); })} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="refresh-cw" size={18} color={colors.mutedForeground} /></Pressable></View> : null}
      <View style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 18, gap: 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>Параметры программы</Text>
        <Segmented label="Цель" value={profile.goal} disabled={busy} options={[{ value: "general", label: "Форма" }, { value: "strength", label: "Сила" }, { value: "hypertrophy", label: "Мышцы" }]} onChange={goal => setProfile(previous => ({ ...previous, goal: goal as CoachProfile["goal"] }))} />
        <Stepper label="Тренировок в неделю" value={profile.daysPerWeek} step={1} min={1} max={7} chips={[2, 3, 4, 5]} disabled={busy} onChange={daysPerWeek => setProfile(previous => ({ ...previous, daysPerWeek }))} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Оборудование</Text>
        <View>{equipmentSchema.options.map(equipment => <Pressable key={equipment} accessibilityRole="checkbox" accessibilityState={{ checked: profile.equipment.includes(equipment), disabled: busy }} disabled={busy} onPress={() => setProfile(previous => ({ ...previous, equipment: previous.equipment.includes(equipment) ? previous.equipment.filter(value => value !== equipment) : [...previous.equipment, equipment] }))} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}><Feather name={profile.equipment.includes(equipment) ? "check-square" : "square"} size={20} color={colors.primary} /><Text style={{ flex: 1, color: colors.foreground, fontSize: 15 }}>{labels[equipment]}</Text></Pressable>)}</View>
        {!coachProfileSchema.safeParse(profile).success ? <Text accessibilityRole="alert" style={{ color: colors.amber }}>Выберите хотя бы один вид оборудования.</Text> : null}
        <Button title="Сохранить параметры" icon={<Feather name="save" size={18} color={colors.primaryForeground} />} disabled={busy || stored.isPending || !dirty || !coachProfileSchema.safeParse(profile).success} onPress={() => operation.mutate(async () => { const saved = await coachRequest<CoachProfile>("/api/ai-coach/profile", "PUT", profile); client.setQueryData(["ai-profile"], saved); })} />
      </View>
      {connection.data?.enabled ? <Button title="Тренировки с ИИ" variant="secondary" disabled={dirty || busy} icon={<Feather name="zap" size={18} color={colors.success} />} onPress={() => router.push("/coach-session")} /> : null}
      <Button title="Месячный план" variant="secondary" icon={<Feather name="calendar" size={18} color={colors.success} />} onPress={() => router.push("/coach-month")} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Рекомендации ИИ не являются медицинским заключением.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
