# Личный шлюз Gym-Beam

15 октября 2026. Production: https://gym-beam-coach.dirg9876.workers.dev

Cloudflare Workers Free + SQLite Durable Object, без постоянно включённого ПК.
Телефон: PHONE_SETUP.md. Развёртывание: ../ai-coach-worker/README.md.
Ключ OpenAI только в серверном secret, не в APK/git/URL/backup.
[Безопасность API](https://developers.openai.com/api/docs/guides/production-best-practices).

## Состояние

- Владелец подтвердил аккаунт, OAuth и Workers Free. Платный тариф не включался.
- Health200, без токена401, авторизованный status200/readytrue.
- Перенесены month2026-10, usedNanoUsd1893100, reserve0.
- Реальный synthetic запрос и cache replay прошли. Общий расход $0.0022081,
  резерв0, лимит5. Эмулятор подключён без локального сервера/ADB reverse.
- Локальный шлюз остановлен. .coach-data/cloud-cutover.json блокирует его запуск,
  чтобы не появились два независимых бюджета. Не удалять marker.
- Прогресс эмулятора неизменён, согласие и ИИ выключены.

Приватные .env.coach и .coach-data имеют ограниченные Windows ACL. OPENAI_API_KEY
в .env.coach; личный bearer-токен в .coach-data/owner-token. Не печатать/коммитить
секреты и не передавать через argv. Cloudflare secrets загружены через stdin.
OAuth находится в системном Wrangler store; не копировать его.

## Архитектура

core.ts/provider.ts/ledgerCore.ts общие для Node и Worker. Worker не использует
node:sqlite или ephemeral filesystem. Singleton DO owner-v1 и неизменяемый seed
сохраняют общий бюджет. Не удалять namespace, объект, migration или ledger.

Модель gpt-6-luna, Responses API, store=false, reasoningnone, без tools,
maxoutput2400, SDK retries0. Цена input$0.10/output$0.50 за1M токенов.
[Актуальные цены](https://developers.openai.com/api/docs/models/gpt-6-luna).
AI_COACH_MONTHLY_LIMIT_USD допускает >0 и <=5, календарный месяц UTC.

До запроса резервируется консервативная стоимость; после учитывается usage,
даже при отказе схемы/правил. Неизвестный исход оставляет резерв до нового месяца.
Cache по модели/prompt/fingerprint; максимум2pending и6новых запросов в минуту.
Auth до JSON, body<=64KB. Ответ проходит Zod и ограничения единиц/нагрузки/каталога.

Лимит не охватывает другие приложения API-проекта, хостинг и налоги. Автопополнение
не включалось. Plus не оплачивает выбранный обычный API-маршрут. Free имеет квоты;
при исчерпании возможна недоступность ИИ, платный fallback не настроен.

## Проверки без расходов API

С Node24 и pnpm в PATH, из этого каталога:

```powershell
pnpm test:coach
pnpm --dir ../ai-coach-worker test
pnpm --dir ../gym-tracker-mobile test
pnpm --dir ../.. typecheck
```

12Node +8workerd/Miniflare +134mobile тестов прошли. Тесты используют mock provider,
не загружают .env.coach. scripts/coach-native-qa.mjs также только stub.
Платные evaluation/cloud smoke не повторять: отчёты уже существуют, есть guard.
Status/health не вызывают OpenAI.

Локальный entry pnpm coach сохранён для кода/тестов, но после cutover на этой машине
намеренно не запускается. Изолированным тестам нужен временный каталог без настоящего
ключа; не использовать второй платный ledger.

## Мобильные ограничения

В новом gym-beam-autoconnect.apk/code2 токен сохраняется через expo-secure-store15.0.8
в Android Keystore и автоматически восстанавливается, включая после process death.
URL заполнен по умолчанию, credentialpair URL+token проверяется перед отправкой.
Первый импорт приватного .coach-data/gym-beam-coach-connection.json не требует набора.
Создать этот файл: mobile/scripts/create-coach-connection.mjs; реальные значения не
печатаются. Настройки editable/masked/eye/forget. Credentials исключены из Android
backup, но остальные progressdatabases/files не исключаются. .easignore явно
исключает секреты из cloudarchive. Старый gym-tracker-tested.apk ещё RAM-only.
Любой внешний gateway обязан использовать HTTPS, HTTP только loopback для тестов.
История/принятые планы локальны, облачной синхронизации нет. Backup v7 содержит
профиль и принятые шаблоны, но не credentials/соединение; import1..7 выключает ИИ.
Запросы только по кнопке. Off запрещает применение поздних ответов, но не возвращает
потраченные токены. Автономного ведения недель и аттестации качества советов нет.
