# Gym-Beam Для Android

Личный Android-трекер тренировок на Expo SDK 54 / React Native. История, программы,
прогнозы, уровни и резервные копии работают локально без сервера и интернета.
ИИ-тренер опционален и подключается через отдельный HTTPS-шлюз.

## Структура

```text
artifacts/gym-tracker-mobile/  Android-приложение, offline API, backup и тесты
artifacts/ai-coach-worker/     Облачный шлюз ИИ для Cloudflare Workers
artifacts/api-server/          Необязательный локальный шлюз ИИ, не сервер тренировок
lib/ai-coach/                  Контракты ИИ и математическая модель
lib/level-data/                Названия, подписи, нормативы и уровни
lib/api-client-react/          Общие типы и React Query hooks для offline API
lib/api-spec/ и api-zod/       Контракт offline API и генерация типов
docs/design/levels/           Исходники оформления и проверки галереи Android
scripts/                     Вспомогательные инструменты и проверки репозитория
```

Единственный клиент приложения: Android. Отдельного сайта, PWA, веб-макетов,
PostgreSQL, Clerk и Replit-развёртывания в актуальном дереве нет. Вся графика,
включая логотип и обе галереи уровней, принадлежит мобильному проекту.

## Разработка

Нужны Node.js 24 и pnpm 10.33.2. Из корня репозитория:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm --filter @workspace/gym-tracker-mobile dev
```

Для локального APK нужны JDK 17, Android SDK и прежний закрытый ключ подписи:

```powershell
cd artifacts/gym-tracker-mobile
pnpm release:check
.\scripts\build-release.ps1
```

Обычный `pnpm build` проверяет типы, экспортирует Android JavaScript bundle и
проверяет сборку шлюзов; это не подписанный APK и не публикация платного сервиса.

## ИИ И Обновления

- [Подключение тренера](AI_COACH_GUIDE.md).
- [Облачный шлюз без включённого компьютера](artifacts/ai-coach-worker/README.md).
- [Необязательный локальный шлюз](artifacts/api-server/COACH_SETUP.md).
- [Обновления APK и OTA](artifacts/gym-tracker-mobile/UPDATES.md).
- [Математическая модель](docs/TRAINING_MODEL.md).
- [Текущий checkpoint](CHECKPOINT.md).

По умолчанию ИИ не требуется для записи тренировок. Реальные API-ключи, owner
tokens, файлы подключения, личные backup, SDK/AVD и ключ подписи не хранятся в Git.
Модель ИИ и месячный лимит контролирует шлюз; не запускайте второй платный журнал
при уже настроенном облачном шлюзе.

CI проверяет структуру Android-only, типы, offline/backup, оба шлюза, галереи
персонажей и свежую Android-сборку JavaScript. Публикационная ветка: `master`.
APK размещаются только в GitHub Releases, не в Git blobs. Старые коммиты и
checkpoints сохраняют историю проекта до перехода на Android-only.
