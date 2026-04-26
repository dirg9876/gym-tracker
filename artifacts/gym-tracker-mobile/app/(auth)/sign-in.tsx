import { useAuth, useSSO, useSignIn } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
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

WebBrowser.maybeCompleteAuthSession();

const c = colors.dark;

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignInPage() {
  useWarmUpBrowser();

  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            router.replace(decorateUrl("/") as "/");
          },
        });
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [startSSOFlow, router]);

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          router.replace(decorateUrl("/") as "/");
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
          router.replace(decorateUrl("/") as "/");
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

          <Pressable
            style={({ pressed }) => [styles.oauthButton, pressed && styles.buttonPressed]}
            onPress={handleGoogleSignIn}
          >
            <Text style={styles.oauthButtonText}>Войти через Google</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>или</Text>
            <View style={styles.dividerLine} />
          </View>

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
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginBottom: 24 },
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
  oauthButton: {
    backgroundColor: c.secondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  oauthButtonText: { color: c.foreground, fontSize: 15, fontFamily: "Inter_500Medium" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: c.mutedForeground, marginHorizontal: 10 },
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
