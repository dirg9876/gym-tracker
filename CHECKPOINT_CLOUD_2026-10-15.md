# Gym-Beam: Self-Contained Checkpoint

Дополнение: следующий этап завершён в CHECKPOINT_AUTOCONNECT_2026-10-15.md.
Новый native gym-beam-autoconnect.apk/code2 уже имеет Keystore/autofill/fileimport;
описание RAM-only ниже относится к прежнему gym-tracker-tested.apk. Cloud/ledger
не менялись, новыхpaidcalls0, итоговые154теста/typecheckPASS, прогресснеизменён.

15 октября 2026, Europe/Moscow. Последняя проверка облака 05:33:51 UTC;
экспорт прогресса 05:36:30 UTC. Этот файл заменяет старые статусы «не опубликован».

## Цель и решения

Личное Android-приложение Gym-Beam с опциональным ИИ-тренером: следующий подход,
разбор тренировки, редактируемая следующая тренировка. Пользователь имеет Plus,
но выбрал обычный недорогой API, максимум $5/месяц. Приложение только для него.
Домашний ПК не должен оставаться включённым. Пользователь подтвердил аккаунт
Cloudflare, успешный OAuth Wrangler и тариф Workers Free. Не спрашивать повторно.

Решение выполнено: Cloudflare Worker + SQLite Durable Object, server secrets,
HTTPS, общий постоянный лимит с переносом локальных расходов. Платный тариф,
автопополнение или платный fallback не включались. Вызовы только по кнопке;
отдельные согласие и выключатель, off не мешает offline-дневнику.

## Рабочее окружение

- Workspace C:\gymbeam, PowerShell5, Windows, full filesystem/network access.
- Node24.14.0 и pnpm: C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
- Mobile artifacts/gym-tracker-mobile; API artifacts/api-server; Worker artifacts/ai-coach-worker.
- Java17: C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot.
- ADB artifacts/android-sdk/platform-tools/adb.exe; emulator-5554, AVD gymbeam_test,
  Android36/x86_64,1080x2400,density420,font1.0. ADB unroot UID2000.
- Физический телефон не подключён. Нужных незавершённых exec-сессий нет.
- Worktree содержит множество прежних изменений. Не откатывать чужие файлы.
- Manual edits через apply_patch. pnpm install --ignore-scripts; releaseAge1440 не отключать.
- PowerShell5 UTF8 явно для русских файлов; скобки routes читать через LiteralPath.

## Production

URL: https://gym-beam-coach.dirg9876.workers.dev

Worker gym-beam-coach; account ab718c47aa012fe9787a9d3541cc364d, subdomain dirg9876.
Первый deploy version0df8cda6-0705-4108-b63a-25e3a8cafddf, затем успешный secret bulk.
Wrangler4.149.0, workers-types5.20261011.1, miniflare5.20261006.1-alpha.
Minified upload537.06KiB/gzip128.72KiB, startup24ms. Free подтверждён пользователем;
OAuth billing subscriptions403 не давал независимо прочитать тариф. Не выдавать
account default_usage_modelstandard за проверку billing. Квоты Free конечны.

wrangler.jsonc: nodejs_compat, compatibility_date2026-10-01, workers_devtrue,
preview_urlsfalse, observabilityfalse. Binding COACH -> CoachObject, migrationv1
new_sqlite_classes. Singleton idFromName("owner-v1") неизменяемый.

Frozen seed .cloud-deploy/seed.json:
month2026-10, usedNanoUsd1893100, reservedNanoUsd0.
Этот seed использовать на всех будущих deploy, не обновлять с новым месяцем:
это migration history. DO сохраняет immutable migration и rejects изменённый seed.
Не удалять DO/namespace/seed/ledger/migration ради сброса бюджета.

Локальный paid gateway PID25988 остановлен; listener8787 отсутствует. Создан
api-server/.coach-data/cloud-cutover.json с URL/датой/перенесённым бюджетом. index.ts
отказывается запускаться при marker. Не удалять marker и не запускать второй
платный gateway с независимым лимитом. ADB reverse tcp8787 удалён.

## Секреты

- Реальный OPENAI_API_KEY: приватный artifacts/api-server/.env.coach и Cloudflare secret.
- Личный bearer: artifacts/api-server/.coach-data/owner-token и AI_COACH_OWNER_TOKEN secret.
- Не читать/печатать значения в tool output, чате, логах, APK, backup, URL или argv.
- Deploy helper читает значения в RAM, передаёт Wrangler JSON через stdin,
  redacts captured output. Оба secrets успешно загружены.
- .env.coach/.coach-data ACL ограничены владельцем/SYSTEM/Administrators.
- .env*, .coach-data, .wrangler, .dev.vars*, .cloud-deploy gitignored.
- OAuth автоматически в C:\Users\Dirg9\AppData\Roaming\xdg.config\.wrangler\config\default.toml;
  не cat/печатать/копировать. Не нужен повторный login.
- На мобильном owner token пока RAM-only, после process death повторное подключение.
  URL/согласие/enabled metadata сохраняются, но без RAMtoken effectiveoff.

## Код и созданные файлы

Shared lib/ai-coach: Zod context/reply/envelope, ограничения каталога/единиц/нагрузки.
Mobile lib/aiCoachContext.ts, aiCoachConnection.ts, aiCoachPlan.ts; hooks/useAiCoach.ts;
components/AiCoachPanel.tsx; app/coach.tsx, coach-plan.tsx. Backupv7/profile/планы,
import1..7 выключает ИИ; credentials и соединение не экспортируются.

Node artifacts/api-server/src/coach:
- ledgerCore.ts: portable SqlCoachLedger, CoachHttpError, SQL adapter contract.
- ledger.ts: node:sqlite/WAL/BEGINIMMEDIATE adapter, recoverInterrupted.
- core.ts: общий processCoachRequest, strict request/hash/reserve/provider/usage/cache.
- app.ts: Express transport/auth/bodybounds, делегирование core.
- index.ts: локальный entry и guard cloud-cutover.
- provider.ts: OpenAI SDK, PROMPT_VERSIONcoach-v2, детерминированный focusEvidence.

Worker artifacts/ai-coach-worker:
- package.json/tsconfig.json/wrangler.jsonc, src/index.ts.
- scripts/deploy.mjs: --prepare/--publish/--secrets; publish/secrets требуют
  --free-plan-confirmed. Private generated config содержит exactseed/absoluteentrypoint.
- scripts/worker.test.mjs: настоящие workerd/Miniflare тесты, outbound mocked.
- scripts/cloud-smoke.mjs: явный --paid-once, synthetic captured context, reportguard,
  один inference и один cache replay. Уже выполнен, платно не повторять.
- README.md: дальнейшие deploy/secrets и защита переноса бюджета.

API docs PHONE_SETUP.md и COACH_SETUP.md переписаны для облака; AI_COACH_PLAN.md
обновлён. Root CHECKPOINT.md ссылается сюда, прежние секции там исторические.

## Параметры модели и защиты

gpt-6-luna, Responses API, reasoningnone, storefalse, maxoutput2400, retries0,
fixed official base URL, без tools. Настроенная цена input$0.10/output$0.50 за1M.
Reserve=(UTF8bodybytes+8192)*100nanoUSD +2400*500nanoUSD. Проверять цены перед изменениями.
Месяц UTC, limit>0<=5. Auth constant-time до JSON/DO, streamed body<=64KB.
2pending/6newperminute, cache по model/prompt/fingerprint; knowninvalidoutput charged,
unknownresult сохраняет reserve. Лимит не покрывает другие приложения проекта/налоги.

Bounded context: catalog120,12finished+focus sessions,160sets,3templates; фактические
nullable sex/bodyweight, no inventeddefaults. Barbell>=20kg, timed weight0/reps0,
новые weighted loadnull -> ручная калибровка; рост<=2.5 с RIR>=2/goodtechnique.
Plan setcap floor(minutes/2) продуктовый предел, не клиническая оценка времени.
Применение совета меняет draft под revision/fingerprint lock, не performedset.
focusEvidence различает фактически записанные timedsets и невыполненный draft.

## Результаты проверок

- Cloud health200; без bearer status401; с bearer status200, readytrue.
- До inference cloud used0.0018931/reserve0: локальные расходы перенесены точно.
- Реальный synthetic cloud nextset HTTP200: записана планка45сек; draft45сек ещё
  не выполнен, RIR/техники нет -> повтор45сек, weight0/reps0. Schema/guardPASS.
- Повтор точно того же body вернулся изcache без изменения budget.
- Облачный тест cost$0.000315; итог used$0.0022081, reserve0, limit5.
- Всего7реальных synthetic calls: дооблака6/$0.0018931 +облако1/$0.000315.
  Личную историю пользователя модели не отправляли. Unit tests API не расходуют.
- Mobile124/124, Node12/12, Worker8/8 =144/144 PASS; full pnpm typecheckPASS.
- Worker tests: auth/key/seedfailclosed, carry/cache/IDs, cap, body/hash,
  invalidusagecharged, restartpersistence/immutablemigration, unknownreserve/noRetry,
  concurrentdedup. Miniflare5 требует convertV4MiniflareOptions/resourcePersistencePath.
- Native emulator HTTPS connect PASS без server8787/ADB reverse; model/budget видны,
  tokenfield очищен послеconnect, AI/consentcheckedfalse. ReactNativeJS/AndroidRuntime
  logcat без новых ошибок. Скриншот/XML artifacts/apk/verified/coach-cloud-connected-2026-10-15.*.

Приватные generated reports в api-server/.coach-data:
live-smoke-2026-10-15.json; evaluation-2026-10-15.json;
evaluation-replay-2026-10-15.json; focus-evidence-smoke-2026-10-15.json;
cloud-smoke-2026-10-15.json; cloud-cutover.json. Платные reports не удалять для retry.
Первый evaluationfailed был из-за testharness draftinitialization, исправлен тем же
makeWorkoutDraft что React; offline replayPASS/0cost. Prompt timed evidence исправлен
после замечания про несуществующее отсутствие истории; реальные rechecksPASS.

## APK и сохранность данных

Текущий APK не менялся при cloud migration:
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
132064215bytes, SHA256494711E86E74C451AE9EB306D6D22D6F5AF31045BDCC713C2D38D657A2877A6E.
com.dirg9876.gymtracker,version1.0.0/code1. v2/v3signaturePASS, debugcertificate
SHA256dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Отличается от исходногоEASreleasekey: НЕ удалять старуюверсию без externalbackup.

Прогресс:2finishedworkouts/8sets/31exercises/0types, noactive.
Новый nativeSAF export artifacts/apk/verified/after-cloud-connect-2026-10-15-v7.json
parsed/verified и deepEqual state/plans к after-ai-evaluation-2026-10-15-v7.json PASS.
Checksum53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
Импорт/восстановление в этом cloud phase не выполнялись. Старую копию не навязывать
поверх новых тренировок пользователя. APK/Stepper в этом этапе не редактировались.
StepperSHA2563BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C.

## Оставшиеся вопросы и следующий шаг

Цель «ИИ без домашнего ПК» выполнена. Телефон подключить по PHONE_SETUP.md:
Главная/молния -> actualHTTPSURL + privateownertoken -> connect -> consent/on -> параметры.
Не OpenAI key. Нужен интернет только дляИИ, прогресс phone/emulator не синхронизируется.
Пока проверен эмулятор, не физический телефон/его мобильный оператор.

Остаются RAM-onlysession/reconnect, исходная releaseподпись/versionCode для обновлений,
более широкая оценка качества/безопасности, автономное ведение недель. Старые A4
recreation Androidpicker/B7a11y также не закрыты этой работой. Сохранить UIrequirements:
5tabs Виды тренировок/История/Главная/Статистика/Уровни; увеличеннаяцентральнаяГлавная;
видытренировок emptydefault; стеклянныйлоготип; все setsworking; barbell20/plankseconds;
officialWRPFraw/dopingcontrolтолько3lifts; аксессуары условные. Прямой ввод веса
пользователь отверг: существующий Stepper не менять радиИИ.

Для обновлений Worker: из artifacts/ai-coach-worker с NodePATH выполнить
node scripts/deploy.mjs --publish --free-plan-confirmed; secretsаналогично --secrets.
Использовать helper/exactseed; bare baseconfig не публиковать. Для тестов pnpm test,
api-server pnpm test:coach, mobile pnpm test, root pnpm typecheck. Не повторять paid
evaluation без явной необходимости/учёта лимита. Итог текущей работы сообщить
пользователю с URL, краткой инструкцией и честным ограничением session.
