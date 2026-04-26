import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const c = colors.dark;

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.replace(url.startsWith("http") ? "/" : (url as "/"));
        },
      });
    } else if (signIn.status === "needs_client_trust") {
      await signIn.mfa.sendEmailCode();
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.replace(url.startsWith("http") ? "/" : (url as "/"));
        },
      });
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Подтверди аккаунт</Text>
          <Text style={styles.subtitle}>Введи код из письма</Text>
          <TextInput
            style={styles.input}
            value={code}
            placeholder="Код подтверждения"
            placeholderTextColor={c.mutedForeground}
            onChangeText={setCode}
            keyboardType="numeric"
          />
          {errors.fields.code && <Text style={styles.error}>{errors.fields.code.message}</Text>}
          <Pressable
            style={({ pressed }) => [styles.button, (fetchStatus === "fetching" || !code) && styles.buttonDisabled, pressed && styles.buttonPressed]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching" || !code}
          >
            <Text style={styles.buttonText}>Подтвердить</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => signIn.mfa.sendEmailCode()}
          >
            <Text style={styles.secondaryButtonText}>Отправить новый код</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => signIn.reset()}
          >
            <Text style={styles.secondaryButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>С возвращением</Text>
          <Text style={styles.subtitle}>Войди, чтобы продолжить тренировки</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Введи email"
            placeholderTextColor={c.mutedForeground}
            onChangeText={setEmailAddress}
            keyboardType="email-address"
            autoComplete="email"
          />
          {errors.fields.identifier && <Text style={styles.error}>{errors.fields.identifier.message}</Text>}

          <Text style={styles.label}>Пароль</Text>
          <TextInput
            style={styles.input}
            value={password}
            placeholder="Введи пароль"
            placeholderTextColor={c.mutedForeground}
            secureTextEntry
            onChangeText={setPassword}
            autoComplete="current-password"
          />
          {errors.fields.password && <Text style={styles.error}>{errors.fields.password.message}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!emailAddress || !password || fetchStatus === "fetching") && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || fetchStatus === "fetching"}
          >
            <Text style={styles.buttonText}>Войти</Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Нет аккаунта? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.link}>Зарегистрироваться</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: c.foreground, marginBottom: 6 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginBottom: 32 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: c.foreground, marginBottom: 6 },
  input: {
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: c.foreground,
    marginBottom: 12,
  },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", color: c.destructive, marginBottom: 8, marginTop: -4 },
  button: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: c.primaryForeground, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryButton: { alignItems: "center", paddingVertical: 10 },
  secondaryButtonText: { color: c.primary, fontSize: 14, fontFamily: "Inter_500Medium" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular", color: c.mutedForeground },
  link: { fontSize: 14, fontFamily: "Inter_500Medium", color: c.primary },
});
