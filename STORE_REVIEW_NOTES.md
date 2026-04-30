# Gym-Beam Store Review Notes

Use this file when submitting Gym-Beam to RuStore or Google Play.

## App

- App name: Gym-Beam
- Android package: `com.dirg9876.gymbeam`
- Production API: `https://gym-beam.ru`

## Reviewer Test Account

Create this account in the production Clerk dashboard before submitting the app.

- Email: `<reviewer email>`
- Password: `<reviewer password>`

Recommended Clerk settings for moderation:

- Email/password sign-in is enabled.
- The reviewer account has a verified email address.
- The account is not blocked and does not require MFA.

## Text for RuStore / Google Play

```
Для проверки приложения используйте тестовый аккаунт:

Email: <reviewer email>
Пароль: <reviewer password>

После входа доступны основные разделы приложения: тренировки, упражнения,
уровни, статистика, история и профиль.
```

## Production Build Checklist

- `EXPO_PUBLIC_API_ORIGIN` in EAS production environment points to `https://gym-beam.ru`.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in EAS production environment is a live Clerk publishable key that starts with `pk_live`.
- The API server uses the matching live Clerk secret key that starts with `sk_live`.
- The APK/AAB is rebuilt after changing EAS environment variables.
