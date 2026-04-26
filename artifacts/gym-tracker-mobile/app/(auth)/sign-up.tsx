import { useAuth, useSignUp } from "@clerk/expo";
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

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) return;
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          router.replace(url.startsWith("http") ? "/" : (url as "/"));
        },
      });
    }
  };

  if (signUp.status === "complete" || isSignedIn) return null;

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Подтверди email</Text>
          <Text style={styles.subtitle}>Введи код из письма на {emailAddress}</Text>
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
            onPress={() => signUp.verifications.sendEmailCode()}
          >
            <Text style={styles.secondaryButtonText}>Отправить новый код</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Создай аккаунт</Text>
          <Text style={styles.subtitle}>Начни отслеживать тренировки уже сегодня</Text>

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
          {errors.fields.emailAddress && <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>}

          <Text style={styles.label}>Пароль</Text>
          <TextInput
            style={styles.input}
            value={password}
            placeholder="Придумай пароль"
            placeholderTextColor={c.mutedForeground}
            secureTextEntry
            onChangeText={setPassword}
            autoComplete="new-password"
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
            <Text style={styles.buttonText}>Зарегистрироваться</Text>
          </Pressable>

          <View nativeID="clerk-captcha" />

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Уже есть аккаунт? </Text>
            <Link href="/(auth)/sign-in">
              <Text style={styles.link}>Войти</Text>
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
