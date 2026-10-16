# Gym Tracker: checkpoint 2026-10-15

Текущий этап: [CHECKPOINT_2026-10-17_RELEASE_1_1_1.md](CHECKPOINT_2026-10-17_RELEASE_1_1_1.md).
Версия 1.1.1, постоянное повышение patch при готовых изменениях, одноразовое окно «Что нового» и совместимость OTA с APK1.1.0. Проверки и статусы публикации находятся в новом checkpoint.

Новый этап: [CHECKPOINT_2026-10-16_ANY_THREE_VOLUME.md](CHECKPOINT_2026-10-16_ANY_THREE_VOLUME.md).
Категории при создании, тоннаж с массой тела и историческими снимками, уровни по любым3упражнениям. 216тестов и длительная симуляция PASS; текущие статусы OTA/nativeQA в этом новом checkpoint.

Текущий этап ЗАВЕРШЁН: [CHECKPOINT_2026-10-16_CALIBRATION_UPDATES.md](CHECKPOINT_2026-10-16_CALIBRATION_UPDATES.md).
APK6/1.1.0: конкретные веса и подборочный подход, один экран запуска ИИ, Expo Update, публикация master.
205 tests PASS, APK/OTA native QA PASS, реальный прогресс сохранён, production restored/AI OFF.
Статусы сборки, проверок и Git находятся в этом новом checkpoint. Ниже архив прежних этапов.

Актуально, ЗАВЕРШЕНО: [CHECKPOINT_2026-10-16_AI_COACH.md](CHECKPOINT_2026-10-16_AI_COACH.md).
Code5 APK gym-beam-ai-coach.apk: один тумблер, disabledConnect, три сценария,
сохраняемый месячный план, backupv8. 193tests/typecheck/nativeQA/realAIcallsPASS.
История и реальные подходы сохранены; production restored, localQA stopped.
Следующие разделы относятся к прежним этапам, не к текущему APK.
Предыдущий этап: [CHECKPOINT_COACH_DIALOGUE_2026-10-15.md](CHECKPOINT_COACH_DIALOGUE_2026-10-15.md).
Зелёная молния, запуск ИИ с Главной, сообщения/замена оставшегося плана, ACSM2026.
Reconnect fix включён. Проверки и текущее состояние описаны в новом checkpoint.

## Актуально: облачный шлюз работает

Новый этап ЗАВЕРШЁН: [CHECKPOINT_AUTOCONNECT_2026-10-15.md](CHECKPOINT_AUTOCONNECT_2026-10-15.md).
Новый gym-beam-autoconnect.apk/code2: автозаполнение/Keystore/импорт подключения,
nativeforce-stop/upgrade/forget/reimportPASS,154теста/typecheckPASS, прогресснеизменён,
новыхpaidcalls0. Старый gym-tracker-tested.apk остаётся RAM-only; использовать новый.

Самодостаточный текущий checkpoint: [CHECKPOINT_CLOUD_2026-10-15.md](CHECKPOINT_CLOUD_2026-10-15.md).
Production https://gym-beam-coach.dirg9876.workers.dev опубликован; secrets загружены,
Workers Free подтверждён, платный тариф не включался. Эмулятор подключён по HTTPS,
локальный сервер остановлен/заблокирован, ADB reverse удалён. 144теста/typecheckPASS,
реальный synthetic cloud call/cachePASS, итоговый учтённый расход$0.0022081/5,
резерв0. Прогресс неизменён, ИИ/согласие off. Физический телефон ещё не подключался.
Всё ниже этой секции является историей работы, а не текущим состоянием deployment.

## Архив: подготовка переноса Cloudflare

Дополнение: новыйmodule typecheck и fullworkspace typecheckPASS; 8workerdtestsPASS,
12NodegatewaytestsPASS (включая guardпослеcutover). Miniflare5 nativeAPI требует
convertV4MiniflareOptions дляlegacyoptions; persistenceresourcePersistencePath.
NodepaidgatewayPID25988 УЖЕ ОСТАНОВЛЕН; private .cloud-deploy/seed.json заморожен:
month2026-10, usedNanoUsd1893100, reservedNanoUsd0. scripts/deploy.mjs создан,
--prepare/--publish/--secrets, платныеоперациитребуют--free-plan-confirmed;
secretsWranglerstdin безkeyвargv. .cloud-deploy/wrangler.json generated сseed,
absoluteentrypoint; использовать ЭТОТ configдляdeploy, не пустойdefault.
wrangler deploymentslist10007 подтвердилWorker gym-beam-coachещёНЕ существует;
accountworkerssubdomain dirg9876 уже есть. ПокаНЕ опубликован и secretsНЕ загружены.
Ожидается ответasync оWorkers Free/Paid: OAuth subscriptionsGET403непозволяет
читатьbilling. Workersaccountsettingsdefault_usage_modelstandard НЕ доказываетFree.
Не активироватьpaidи не публиковатьдо подтвержденияусловийбесплатноготарифа.
OAuthlogin session79219completed; execsessionsнеосталось. tests/runtimeзакрыты.
Послеreadyоблака создать API .coach-data/cloud-cutover.json {url,month,carried...},
index.ts уже отказывается стартоватьlocal paidgateway при наличииэтогоmarker.
ВходвCFУЖЕподтверждёнпользователем, второйразнепросить OAuth.

Новейший ответ: Cloudflare аккаунт есть, затем пользователь подтвердил вход
Wrangler в браузере. OAuth login SUCCESS; credentials только в системном Wrangler
store C:\Users\Dirg9\AppData\Roaming\xdg.config\.wrangler\config\default.toml,
содержимое НЕ читать/печатать. Account IDab718c47aa012fe9787a9d3541cc364d,
один аккаунт. Не ждать прежнего ответа про аккаунт: он уже получен.

Создан artifacts/ai-coach-worker/{package.json,tsconfig.json,wrangler.jsonc,src/index.ts}.
Wrangler4.149.0 от8октября, workers-types5.20261011.1, miniflare5.20261006.1-alpha
(та же dependency официального Wrangler), releaseAge1440 не отключён.
pnpm install --ignore-scripts PASS до добавления directminiflare, повторитьinstall.
wrangler dryrun bundle PASS:1248.89KiB/gzip204.26, worker typecheckPASS.
Workers nodejs_compat, compatibilityDate2026-10-01, workers_devtrue, previewfalse,
observabilityfalse, DO bindingCOACH/CoachObject, migrationsnew_sqlite_classesv1.

Вынесен portableledger в api-server/src/coach/ledgerCore.ts, Nodeledger.ts теперь
adapter с BEGINIMMEDIATE/WAL к тому жеSQL. После этого11NodegatewaytestsPASS.
Создан api-server/src/coach/core.ts, app.ts теперь общийprocessCoachRequest
(после этого ещё раз rerun11tests). Worker использует тот же core/provider/schema,
DOsqlite.transactionSync, bounded64KBstream, authдоJSON, owner-v1singleDO,
неизменяемыйinitialbudgetseed, resumeunknownreserve, секретыenv.

ЕЩЁ НЕ DONE: workerintegrationtests/realworkerd, fulltypecheckпослеextract,
деплой/secrets/HTTPS/телефон. Cloudflare URL НЕ создан/не придумывать.
INITIAL_BUDGET_JSON обязательныйbootstrap {month,usedNanoUsd,reservedNanoUsd};
дляcutover читатьсвежийlocalSQLite, остановитьPID25988 до активацииоблака,
перенестиactualused1893100nanoUSD(проверить заново) иreserve0. Не обнулятьлимит.
СекретыOpenAI/ownertoken отправлятьчерезWranglerstdin, безplaintextfile/argv/logs.
ЛокальныйgatewayPID25988 покаработает,эмуляторoff/consentoff,прогресснеизменён.
Следующийшаг: локальныеDOtestsсmockoutbound безOpenAI, проверкане существующегодеплоя,
thenclouddeploy+secretbulk+status/importedbudget+ONEsyntheticlivecall+Androidconnect
сadb reverseудалённым; docs/checkpoint/finalURL. Нельзязакончитьнаголоопубликованном
шлюзе: проверитьbudget,secrets,freeplanквоты,отключитьлокальнуюплатнуюкопию.

## Тест ИИ завершён; новый приоритет — телефон без ПК

### Новейший запрос и решение

После «добавил» пользователь попросил небольшой тест и инструкцию для телефона.
Затем уточнил: «это неудобно я не могу постоянно держать компьютер включенным».
Это актуальнее рекомендаций USB/Tailscale к домашнему ПК ниже. Основной путь
должен стать облачным HTTPS gateway; нельзя выдавать включённый домашний ПК
за готовое решение. Бюджет прежний: личный API до$5, платный хостинг не разрешён.

Предложен Cloudflare Workers Free + SQLite-backed Durable Object. Официальные
pricing docs15октября подтверждают поддержку SQLite DO на Free и fail-closed
при исчерпании бесплатных квот, без автоматических overagecharges. Это кандидат,
а НЕ уже развёрнутая функция. Cloudflare аккаунт/авторизация ещё не получены;
задан async вопрос: есть аккаунт / создаст бесплатный / другой хостинг.
Следующий шаг зависит от ответа; не просить OpenAI key или Cloudflare token в чат.
Sources: https://developers.cloudflare.com/durable-objects/platform/pricing/
и https://developers.cloudflare.com/workers/platform/pricing/.

### Что сделано в небольшом тесте

Создан artifacts/gym-tracker-mobile/scripts/evaluate-ai-coach.mjs. Обычный запуск
ничего платного не делает; --paid явно запускает максимум4инференса с резервным
пределом$0.02. --replay воспроизводит захваченные ответы БЕЗ сети и затрат.
Существующий report не перезаписывается, повторный платный прогон запрещён.
Изолированная Map storage/testHarness + настоящий mobile offlineApi + настоящий
production gateway/OpenAI: персональные данные эмулятора в тест НЕ импортировали.

Реальные4сценария: bench40кг x10->8->6 с последнимиRIR0/techniquebreakdown;
планка45сек; review завершённой синтетической тренировки; следующий план30мин
с исключённымbench1 и толькоbarbell/dumbbell/bodyweight. Ответы прошли schema/
numeric guards; вес после breakdown не повышен, plankweight0/reps0/seconds45,
review точно перечисляет записанные подходы, новые весаplan=null требуюткалибровки.
Совет применялся лишь в draft, не создавал performedset. Проверены off/stale,
сохранение шаблона/backupv7/повторное создание тренировки/редактирование черновика.

Исходный прогон закончен ошибкой ТЕСТА: ожидал draft сразу после POST workout,
хотя его инициализирует React screen. Исправлен тест: используется тот же
makeWorkoutDraft как на экране. Offline replay с сопоставлением входных данных
(игнорируются только даты завершения) PASS, без повторных платных вызовов.
Это не исправление приложения и не повод менять API lifecycle.

Обнаружены недостатки текста ИИ: plank ответ отрицал записанную45сек планку,
план обещал15подходов за30мин при неизвестном отдыхе. Исправлен server provider.ts:
input теперь {context,focusEvidence}, где детерминированы selectedexercise,
recordedSetCount и последние3recordedsets, draftIsPerformedSetfalse. Дополнительные
инструкции отличают seconds/reps/наблюдения/черновик и запрещают уверенные обещания
времени при неизвестном отдыхе. PROMPT_VERSION=coach-v2 в cache key, чтобы не
вернуть старый ошибочный cachedtext. Client DTO/fingerprint не изменился.

После рестарта production сделан ОДИН дополнительный live plank recheck:
HTTP200, ответ правильно говорит «одна выполненная планка45сек; черновик отдельный».
45сек/weight0/reps0. Это маленькое подтверждение улучшения, НЕ гарантия всех
будущих текстов или полноценная фитнес-аттестация. Новый план после v2 не генерировали.

### Проверки, параметры, файлы

- 124/124 mobile tests PASS, 11/11 gateway tests PASS, workspace typecheck PASS.
  Новый unit test проверяет focusEvidence и отличие performed timed set/draft.
- 4реальныхevalcalls$0.0013927 +v2recheck$0.000312 =заэтап$0.0017047.
  Общий ledger с предыдущимsmoke:6completedrequests, used$0.0018931/reserved0,
  limit$5. Не удалять/не сбрасывать SQLite. Купон/прайсингдругихклиентов не учитывает.
- Private artifacts/api-server/.coach-data/evaluation-2026-10-15.json содержит
  первичные4ответа и ошибкуТЕСТА; evaluation-replay-2026-10-15.json — PASS0cost;
  focus-evidence-smoke-2026-10-15.json — v2livePASS. Толькоsynthetic, безсекретов.
- artifacts/api-server/PHONE_SETUP.md создан: installation/backup, основной
  облачный путь pending, временныеUSB/Tailscale, использование/ограничения.
  Tailscale не установлен и ничего наружу не публиковали. Телефона в ADB нет,
  толькоemulator-5554. Ни платный тариф, ни аккаунт, ни облако не создавали.
- artifacts/apk/verified/after-ai-evaluation-2026-10-15-v7.json, экспорт
  2026-10-14T21:19:59.955Z(15октября00:19:59МСК), parser/deepEqual state/plans/
  checksum совпадают с after-live-connect copy. 2finishedworkouts/8sets/31exercises,
  0types/0plans/нетactive. Checksum53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
  Никакого nativeimport/restore/тестовых тренировок на эмуляторе не было.
- Screenshot ai-evaluation-budget-2026-10-15.png/xml: реальное соединение,
  budgetrefreshed, тренер остаётсяOFF. APK/Stepper не менялись, хэши ниже актуальны.

### Состояние и следующий шаг

Production gateway теперь скрытый Node PID25988 (старый8528 остановлен после
проверкиpending0), .coach-data/gateway-v2.{stdout,stderr}.log.127.0.0.1:8787,
Node24.14/Express5/SQLite, gpt-6-luna, storefalse/reasoningnone/retries0/timeout45s,
promptcoach-v2. Оставлен работающим пока нет облака; APKбезизменений(см.хэш ниже).
Эмулятор подключён RAMownerToken, consentoff/coachoff, adb uid2000, reverse8787
оставлен. .env.coach/.coach-data приватныйACL owner/SYSTEM/Admin, key не печатать.
Все exec sessions завершены; целей/агентов/автоматизаций нет. Dirtygit не откатывать.

После ответа об аккаунте Cloudflare подготовить/проверить Workers adapter:
не просто запускать Node:sqlite в Workers; использовать постоянный DO SQLite,
atomic reserve/usage/cache/dedup/rate limits, secrets/auth/bodylimits, shared schemas
и provider. Сохранить текущиерасходы при переносе, не копировать secret вrepo/APK.
На cutover остановить локальный paidgateway, чтобы не получить два лимита$5
на один проект. Cloudflare Free CPU/квоты проверить реальным deploy/smoke; не
обещать неограниченную бесплатность. Нужны userlogin, HTTPSURL и mobiletest.
Пока аккаунт/развёртывание отсутствуют: не придумывать облачныйURL и не утверждать,
что телефон уже может пользоваться ИИ безПК. Следующий ответ должен учитывать
этот последний запрос, а не возвращать только инструкциюTailscale/USB.

## Подключён реальный API: 15 октября, Europe/Moscow

### Цель и решения

Пользователь создал OpenAI secret key, добавил его самостоятельно в
C:\gymbeam\artifacts\api-server\.env.coach и написал «добавил».
Задача этого этапа: запустить личный production gateway, подключить эмулятор
и проверить ОДИН короткий платный запрос. Ключ не печатали/не переносили в APK,
чат, backup или исходники. Не менять содержимое .env.coach: там теперь ключ.
Эта секция новее всех отметок «ключ не задан/платных вызовов нет» ниже.
Сохраняется личный режим, opt-in, максимум$5/месяц, без покупки/автопополнения.

### Сделано и проверено

- Read-only проверка env: ключ задан и похож на API key, host127.0.0.1/port8787,
  limit5, dataDir.coach-data. .env.coach и .coach-data по-прежнему gitignored.
- Проверен доступ к gpt-6-luna через models.retrieve, без генерации/токенного
  расхода. Официальные model/Responses docs проверены заново15октября.
- Production gateway (НЕ coach-native-qa.mjs) запущен скрытым Start-Process.
  Node PID8528, команда --env-file-if-exists=.env.coach --experimental-strip-types
  src/coach/index.ts, cwd C:\gymbeam\artifacts\api-server. Слушает127.0.0.1:8787.
  Node24.14: C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe.
  stdout/stderr перенаправлены в приватные .coach-data/gateway.{stdout,stderr}.log.
- ОДИН реальный next_set вызов через production HTTP gateway, с bearer,
  schema/fingerprint и постоянным reserve/usage учётом. Только синтетический
  bench20кг x10, RIR2/techniquegood; личная история/пол/вес НЕ отправлялись.
  HTTP200 за4734мс, русский ответ22.5кг x10, plan=null, local validation PASS.
  Факт расхода в ledger $0.0001884, reserved0, limit5. До запроса резерв$0.0027894.
  SQLite проверен read-only: ровно1request, completed, cost188400nanoUSD,
  validated result cached. Никаких автоматических повторов/других LLM calls.
- Отчёт generated .coach-data/live-smoke-2026-10-15.json, без секретов,
  checkedAt2026-10-14T21:03:10.421Z =15октября00:03:10 МСК.
  Это маленький live smoke, НЕ полноценная оценка безопасности/качества тренера.
- Эмулятор emulator-5554 подключён через adb reverse tcp:8787 tcp:8787.
  MobileURL http://127.0.0.1:8787, owner token из .coach-data/owner-token
  введён в masked поле, после connect поле очищено. Статус productionreadytrue,
  modelgpt-6-luna, UIрасход$0.0002. Тренер и отправка истории ОСТАВЛЕНЫ OFF:
  пользователь сам разрешает передачу данных и включает Switch. Сессия RAM,
  после закрытия процесса требуется подключиться снова. APK не менялся.
- Windows ACL .env.coach/.coach-data были слишком широкие (inherited Users/
  AuthenticatedUsers FullControl). Только для этих приватных объектов наследование
  заменено на текущего владельца + SYSTEM + Administrators. Проверены также
  дочерние owner-token/budget.sqlite:3разрешённые entries, нет Users/Everyone.
  Содержимое key/ledger при этом не менялось, права остального repo не затронуты.
- pnpm test:coach повторно10/10 PASS, mocked SDK, без дополнительных платных
  вызовов. Mobile124/typecheck относятся к предыдущему пакету: исходники не меняли.
- Внешний export artifacts/apk/verified/after-live-connect-2026-10-15-v7.json
  parser/deepEqual state/plans/checksum равен after-ai-restored-v7.json.
  Прогресс2finishedworkouts/8sets/31exercises/0types/0plans, нет active.
  Checksum53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
  Никакие snapshots в этом этапе НЕ восстанавливали. Last-export обновлён.
  Screenshots ai-production-{connected,ready,final}-2026-10-15.png/xml в verified;
  JS/AndroidRuntime ошибок не обнаружено. adb uid2000, root не включали.

### Текущее состояние и следующий шаг

Шлюз PID8528 намеренно ОСТАВЛЕН РАБОТАТЬ в фоне, ADB reverse тоже оставлен.
Эмулятор на экране ИИ-тренера с подключением; off/consentoff. Нужных exec sessions
нет, целей/автоматизаций/агентов не создавали. Прежде чем остановить/перезапустить
шлюз, проверить CIMCommandLine PID и порт: PID в будущем может быть другим.
Не запускать второй процесс на один SQLite ledger/порт, не удалять ledger.
Автозапуск после reboot, HTTPS/deployment и native secure session НЕ настроены.
На независимом телефоне этот loopback не доступен без ADB; нужен HTTPS gateway.

Следующее действие пользователя в эмуляторе: разрешить «Отправка данных тренировок»
и включить «ИИ-тренер», затем запрашивать советы явными кнопками. Следующая
инженерная задача: HTTPS для самостоятельного телефона и более широкое live
evaluation только с разрешёнными данными/расходами. Автономного многонедельного
ведения программы ещё нет. A3 release-signing/versionCode, A4 picker recreation,
B7 доступность открыты. Полные параметры/файлы/сборка приведены в следующем разделе.
APK по-прежнему C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk,
SHA256494711E86E74C451AE9EB306D6D22D6F5AF31045BDCC713C2D38D657A2877A6E,
debug подпись, НЕ обновление исходной EAS-подписи. Чужие git изменения не откатывать.

## Завершён первый пакет ИИ-тренера

### Цель и решения

Последний запрос «поехали»: реализовать опционального личного ИИ-тренера.
Пользователь подтвердил ChatGPT Plus, но выбрал отдельный недорогой API,
бюджет до $5/месяц, только для себя. Это не разрешение покупать кредиты,
включать автопополнение или оплачивать хостинг. Реального ключа нет, расходы0.
Этот раздел актуальнее всех исторических планов/B6/B5 ниже.

Сохранены пять вкладок: Виды тренировок / История / Главная / Статистика / Уровни,
оранжевая увеличенная Главная по центру, логотип-стакан, пустые виды по умолчанию,
start/continue на Главной, offline-дневник, WRPF и условные accessory ориентиры,
штанга >=20кг, планка в секундах, все подходы рабочие. Прямой ввод веса в активной
тренировке не добавлен. Stepper.tsx не менялся этим пакетом, SHA256
3BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C.

### Создано и изменено

- lib/ai-coach (@workspace/ai-coach): строгие Zod DTO/profile/reply/envelope,
  инструкции, проверка единиц/оборудования/исключений, новых упражнений и RIR.
- artifacts/api-server/src/coach/{index,app,provider,ledger}.ts: отдельный
  Express5 gateway без PostgreSQL/Clerk, официальный openai SDK7.32.0,
  SQLite node:sqlite с постоянным журналом и предварительными резервами.
- artifacts/api-server/COACH_SETUP.md: самодостаточный запуск и ограничения.
  .env.coach подготовлен с ПУСТЫМ OPENAI_API_KEY, исключён из git; .coach-data/
  тоже игнорируется. Не печатать/коммитить секреты и не просить ключ в чате.
- Mobile lib/aiCoach{Context,Connection,Plan}.ts, hooks/useAiCoach.ts,
  components/AiCoachPanel.tsx, app/{coach,coach-plan}.tsx: настройки с Главной,
  согласие, профиль, next-set, review в отчёте/истории, редактируемый next-workout.
  Результат применяется только по подтверждению; принятый план обычный шаблон.
- offlineApi.ts: локальные profile/context endpoints и fingerprint под progress
  lock при применении draft. useWorkoutDraft: ожидаемая revision, без optimistic
  update для AI. SavedWorkoutPlan: причина предложения и пустая калибровка веса.
- progressBackup.ts: export v7/import1..7, coachProfile, при импорте ИИ выключается
  и RAM proposal удаляется. Соединение/токены не входят в backup. Старые APK,
  поддерживающие только1..6, v7 не импортируют; исходные v6 копии сохранены.
- plugins/withCoachNetworkSecurity.cjs и assets/android/gymbeam_coach_network_security.xml:
  HTTP только localhost/127.0.0.1, остальное HTTPS. app.json/full-build и repack
  используют одну policy. Repack сохраняет старые Android resource IDs.
- scripts/ai-coach.test.mjs, coach-network.test.mjs; api-server/scripts/
  coach-gateway.test.mjs, coach-native-qa.mjs (ТОЛЬКО явно тестовый provider).
  Workspace package refs/lock обновлены; minimumReleaseAge не отключался.

### Параметры и безопасность

gpt-6-luna, Responses API, store=false, reasoning=none, max_output_tokens2400,
timeout45s, SDK retries0, logLeveloff, без tools, фиксированный api.openai.com/v1.
Тарифы конфигурации input$0.10/output$0.50 за1M токенов (nanoUSD/token100/500),
официальные ссылки в AI_COACH_PLAN.md. Перед live проверить актуальность/доступ.
Лимит env больше0 и <=5; SQLite reserve до запроса, usage после, cache по context,
max2pending/6новых запросов в минуту. Неизвестный расход сохраняет резерв, даже
невалидный/incomplete ответ с известным usage оплачивается в учёте. Один процесс
на ledger и постоянный диск. Лимит не покрывает хостинг/налоги/другие API-клиенты.

Owner bearer генерируется в .coach-data/owner-token; OpenAI key ТОЛЬКО env сервера.
На мобильном owner token ТОЛЬКО RAM: после завершения процесса подключиться снова.
Локально хранятся URL/consent/enabled, без токена; cold start effective off.
Нет фоновых LLM calls, явные кнопки; off/consent revoke/import прерывают ожидание
и блокируют позднее применение через generation + context fingerprint/revision.
Контекст read-only: <=120упражнений,12завершённых тренировок+focus,160подходов,
последние3шаблона, реальные nullable bodyweight/sex; не backup/ключи/аккаунты.
Новый вес null требует пользовательской калибровки, повышение ограничено2.5кг
и требует отмеченных RIR>=2/techniquegood. Это guard, не гарантия безопасности.

### Результаты проверок

- pnpm test в mobile:124/124 PASS; pnpm test:coach в api-server:10/10 PASS.
  Включая disabled0calls, stale/off-reenable, abort, профиль/backup, единицы,
  confirm-only draft, auth, cap до вызова, durable reserve/cache, invalid usage,
  incomplete output и официальный SDK с mock fetch без автоматических retries.
- pnpm typecheck из корня: PASS для libs и всех приложений после последних правок.
- git diff --check по tracked файлам этого пакета: PASS. Глобальная проверка
  находит прежние trailing spaces в web components/ExercisePicker.tsx; этот
  посторонний файл не меняли и форматированием чужие правки не затрагивали.
- Journey:624тренировки,8970подходов,208недель, findings[], реалистичный plateau12,
  искусственные elite boundaries до80. Desktop mock, НЕ прогноз человеку/Android
  performance benchmark. Отчёт artifacts/apk/journey/progression-report.json.
- Native QA1080x2400/density420 и720x1280/density320(360dp): opt-in/consent,
  реальный локальный HTTP gateway через adb reverse с явно тестовым provider;
  3вызова next_set/next_workout/review, OpenAI НЕ вызывался. Draft20x10->20x11,
  performed sets осталось8; force-stop требует reconnect. План сохраняется
  после заполнения обоих новых dumbbell weights10кг, plank targets30сек.
  Профиль strength/3days в v7 export, затем4days сохранено/проверено в SQLite.
  Маленький экран: masked token+IME, прокрутка/подключение, budget refresh,
  параметры и compact workout. Нет ReactNativeJS/AndroidRuntime ошибок в logcat.
- Production entry без ключа: readyfalse, auth401, валидный coach request503,
  used/reserved0. Настоящие ответы/качество модели ещё НЕ проверены.

Артефакты в C:\gymbeam\artifacts\apk\verified:
before-ai-v6.json (2026-10-14T20:01:07.152Z), before-ai-RKStorage.db (свежий full
snapshot ДО QA), ai-native-progress-v7.json (проверенный профиль/редактированный
план/draft, без URL/токена), ai-qa-current-RKStorage.db (4days), ai-*.png/xml.
after-ai-restored-v7.json, экспорт2026-10-14T20:30:45.105Z: parser/deepEqual
state+plans+checksum равны before-ai-v6. ВСЯ catalystLocalStorage восстановлена
из СВЕЖЕГО before-ai snapshot; SQL EXCEPT в обе стороны0, integrityok.
Итог2finishedworkouts/8sets/31exercises/0types/0plans/нет active/coachProfile.
Checksum53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
Last-export изменён финальным экспортом; внешние пользовательские копии сохранены.
Только известные AI QA export/fixture перемещены в /sdcard/Download/GymBeam-QA.
Эмулятор оставлен на Главной: gymbeam_test/emulator-5554, Android36,
1080x2400/density420, fontscale1.0, show_ime_with_hard_keyboard0,
stylus_handwriting_enabled1. adb unroot, uid2000; reverse удалён. QA/production
gateway остановлены, Node-процессов не осталось; нужных exec sessions нет.

### APK и запуск

C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk,132064215bytes.
SHA256494711E86E74C451AE9EB306D6D22D6F5AF31045BDCC713C2D38D657A2877A6E.
apksigner v2/v3 PASS, debug cert SHA256
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
com.dirg9876.gymtracker, version1.0.0/versionCode1, локальный repack, НЕ EASrelease.
Установлен install-r на тестовую debug установку, без uninstall. Исходная EAS
подпись отличается; upgrade требует исходного signing key и нового versionCode.
Не советовать удаление оригинального приложения без внешней копии.

Workspace C:\gymbeam, PowerShell5, Node24.14.0:
PATH C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
JAVA_HOME C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot.
ADB C:\gymbeam\artifacts\android-sdk\platform-tools\adb.exe.
pnpm install --ignore-scripts работает; pnpm view ломается из-за standalone npm,
metadata при необходимости читать Invoke-RestMethod registry.npmjs.org.
Repack из mobile: .\scripts\repack-apk.ps1 -BaseApk
C:\gymbeam\artifacts\apk\gym-tracker-expo-link.apk -SdkRoot C:\gymbeam\artifacts\android-sdk
-Keystore C:\gymbeam\artifacts\apk\debug.keystore -OutputDirectory C:\gymbeam\artifacts\apk\verified.
Ручные edits только apply_patch; UTF8 для кириллицы, inline Node Unicode escapes.
Git dirty до задачи, чужие изменения не откатывать. Агентов/целей/автоматизаций нет.

### Нерешённое и следующий шаг

1. Приватно задать API project key в artifacts/api-server/.env.coach, pnpm coach
   из api-server (Node24). Нет ключа, API billing/покупки не настраивались.
   Для эмулятора adb reverse tcp:8787 tcp:8787 и http://127.0.0.1:8787;
   личный токен из .coach-data/owner-token вводить в приложении, не в чат/backup.
2. Провести несколько реальных calls/evaluation: units/нагрузки/известный usage,
   privacy/отказы, качество по целям; не путать QAstub с настоящим тренером.
3. Для независимого телефона разместить личный HTTPS gateway на постоянном диске,
   закрыть ACL/secrets. Deployment/TLS не сделаны. Потом native защищённая сессия.
4. Эта версия предлагает следующую сессию по истории, НЕ ведёт автономный
   многонедельный мезоцикл и не анализирует фоном. Адаптацию недель/расписания
   проектировать/проверять отдельно после реального evaluation.
5. A3 release signing/versionCode/upgrade, A4 picker after Activity recreation,
   B7 TalkBack/fontscale2/полная доступность остаются открытыми.

Перед новым QA снимать НОВЫЙ export/full snapshot, не восстанавливать эти старые
копии автоматически. uiautomator: pause ticking timer, transient null root может
требовать повтор; Find-Scrolled рассчитан на большую высоту, для small ручные
swipes. После density/font cold restart до SAF. SQLite stdin/-bail/busy_timeout,
не shell quoting SQL. Не оставлять тестовый gateway вместо реального.

## Новая цель: опциональный ИИ-тренер, API до $5

Пользователь сменил приоритет с B7 на ИИ-тренера: совет веса следующего подхода,
анализ тренировки, подбор упражнений/подходов следующей, ведение программы и
наблюдение за прогрессом. Тренер должен полностью отключаться.
Пользователь подтвердил ChatGPT Plus, бюджет до$5/месяц и выбрал для первой
версии «Недорогой API, лимит$5», а не подключение подписки.
Последнее уточнение: приложение только для владельца, не для других пользователей.
Лимит$5 для одного человека; общая регистрация не нужна, но доступ к платному
endpoint всё равно должен быть защищён. Последний ответ пользователя именно
про личный режим, не возврат к Plus или согласие на покупку кредитов.

Создан C:\gymbeam\AI_COACH_PLAN.md: самостоятельная спецификация, подтверждённые
решения, официальные источники, стоимость, безопасность, UI, проверка ответов,
хранение/backup, бюджет, этапы внедрения и приёмка. Это НЕ готовая функция.
В этом этапе изменены только эти два документа. Исходники приложения, APK,
эмулятор и прогресс НЕ менялись; новые тесты/реальные модельные запросы не запускали.
Последняя проверенная сборка и111тестов относятся к B6 ниже.

Обследование: mobile app/_layout.tsx перехватывает generated API через offlineApiFetch,
coachApi.ts также offline. trainingCoach.ts содержит обычные правила прогрессии,
не LLM. Existing api-server Express5/Clerk/PostgreSQL; offline APK не имеет
активной Clerk session (sign-in Redirect). Нельзя просто добавить открытый платный
endpoint или положить общий ключ в APK. OpenAI credential tool не доступен,
OPENAI/AI_COACH env names в текущем процессе не найдены; содержимое secrets не читали.

Кандидат API: gpt-6-luna. Текущая официальная цена input$0.10/output$0.50 за1M;
пример500запросов*3000input/600output = $0.30 только за токены, не месячная
гарантия и не стоимость хостинга. Качество фитнес-ответов ещё не оценено.
Ключ только server secrets; необходимы реальная auth, durable budget/reservation,
валидация output/единиц и stale revisions, opt-in/consent, отключение без скрытых
запросов. Принятые планы работают offline, изменения лишь после подтверждения.

Важная находка: НЕ утверждать, что Plus в стороннем приложении вообще невозможен.
На14октября2026 официально есть SIWC для eligible local/OSS apps. Для Android
понадобятся loopback OAuth listener/PKCE/ID-token validation/secure storage;
в текущем APK их нет. Этот вариант сейчас НЕ выбран. Источники и точные ограничения
в AI_COACH_PLAN.md. Не использовать/копировать credentials Codex или backend-api.

Текущее незавершённое: API key, размещение защищённого gateway и мобильная
авторизация не настроены. Не обещать рабочий ИИ, лимит или новую APK до реализации.
Следующий шаг: безопасный setup API project/key и gateway, затем schemas/контекст/
бюджет/adapter с mock tests и UI opt-in. Не просить API key в чате. Варианты
хранения с новыми native modules потребуют full Android build, не JS repack.
B7/A3/A4 и прежние фиксированные решения пользователя сохраняются; детали ниже.

## Актуально: B6, компактная тренировка и ошибки форм

### Цель и решения

Пользователь попросил продолжить план консилиума. Реализован B6: поднять ввод
и Add, раскрывать второстепенные блоки, исправить прокрутку редактора упражнений
и адресовать ошибки шаблона конкретным полям. Визуальная/native-приёмка завершена;
фактическое озвучивание TalkBack ещё не проверено и входит в следующий B7.
Этот раздел новее всех секций ниже: их APK, хэши, число тестов и отметки
«B6 ещё не делали» являются историческими.

Обязательные решения пользователя:
- Gym-Beam, логотип со стаканом из репозитория.
- Пять вкладок: Виды тренировок / История / Главная / Статистика / Уровни.
  Главная по центру, увеличена, оранжевая, открывается при запуске; Start/Continue
  на ней. Виды тренировок пусты по умолчанию, предустановленных программ нет.
- Все подходы рабочие. Старые скрытые warmup tags сохранять в backup без потерь.
- WRPF без экипировки, с допинг-контролем для официальных дисциплин; аксессуары
  только расчётные ориентиры. Ближайший разряд по таблице, не процент от МСМК.
  Штанга минимум20кг; планка в секундах, не в кг/повторах.
- Полный импорт/экспорт и автоматическая внешняя копия после завершения.
- Прямой ввод веса НЕ нужен. Stepper, шаг, пресеты и плюс/минус не менять.
  SHA256 всё ещё3BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C.

Уже завершены A1/A2/B2/B3/B4 и B5. Карантин без сброса, транзакционное
finish/plan/jobs, verified backup, error/retry, persisted draft, идемпотентные
commit/transfer остаются. Backup v6, import1..6, offline state v1. Новой миграции,
dependencies или изменений web/API-server в B6 нет. Коммита нет, git dirty.

### Изменённые и созданные файлы

Пути относительно C:\gymbeam\artifacts\gym-tracker-mobile:
- app/workout/[id]/index.tsx: убран внешний Card формы. ExercisePicker -> короткая
  цель ближайшего разряда -> прежние Stepper -> статус/error -> Add. RIR/техника
  под «Оценка подхода», текущие оценки видны в сводке. Метаданные WRPF и совет
  рабочего веса под «Цель и рабочий вес». Ближайшая цель остаётся видимой всегда.
  Таймер после формы, единственный footer по-прежнему Finish.
- components/TrainingTimer.tsx: компактный idle header с запуском отдыха;
  +30с, pause/reset в одной строке активного таймера, controls48dp. Длительность
  и перезапуск отдыха под настройками. Перенос секунд активной планки открыт.
  Атомарность/API/absolute deadline/pause/автоотдых не менялись.
- components/ExerciseEditor.tsx: ScrollView flexShrink1/minHeight0, header/footer
  не сжимаются. Пункты оборудования прокручиваются над CTA, не под ним.
- components/SavedWorkoutPlan.tsx: KeyboardAvoidingView; ошибки возле названия,
  конкретного параметра прогрессии или подхода. Общая ошибка про штангу удалена.
  Поля прогрессии в2адаптивных столбца без фиксированных высот подписей.
  У NumberField error border/hint/alert; save guard; picker блокируется при busy.
- lib/workoutTemplates.ts: прежние schema constraints сохранены, refinements
  получили конкретные issue paths. templateInputErrors использует общий Zod
  parser плюс проверки единиц/минимума оборудования, возвращает ошибки по path.
- Новый scripts/template-validation.test.mjs:6тестов адресных ошибок и согласования
  формы с schemas: название, список, диапазон/RIR/шаг, штанга, повторы/секунды,
  дубликаты и число targets.
- C:\gymbeam\IMPROVEMENT_PLAN.md и этот checkpoint обновлены.

### Проверки

- pnpm test:111/111 PASS; pnpm -r typecheck всего workspace PASS.
- Journey:624обычные тренировки/8970подходов/208недель, уровень12; elite fixtures
  проверяют80, findings[]. wallSeconds101 на desktop с mock storage одновременно
  с emulator QA; НЕ Android benchmark и не тренировочный прогноз.
- Android36/emulator-5554: install-r без uninstall, пользовательская база заранее
  сохранена целиком. Fixture создана только из свежей копии.
- На1080x2400/density420 Add виден без прокрутки. На720x1280/density320
  (360x640dp), scale1: после ОДНОГО swipe650px/325dp Add целиком в viewport.
  Масштаб1,3: форма/таймер проверены скриншотами.
- RIR2/хорошая техника и22,5кгx10 сохранены в set; следующий draft очистил оценки.
  Timer pause и+30с работают. Подсказка III разряда обновляется при выборе веса.
- Шаблон: пустое имя показывает только ошибку у имени; 2,5кг у штанги ошибку
  у нужного подхода. Save disabled при ошибке, после исправления сохранён LayoutQA.
  Клавиатура не закрывает нижнюю CTA, ошибки выводятся прокруткой. TalkBack не включали.
- Редактор: «Другое» целиком выше CTA на360dp; то же при font scale2. Создание
  LayoutExercise с dropdown группы «Грудь»/оборудованием other успешно.
- Picker: поиск Layout при открытой IME показывает доступную строку LayoutExercise.
- Планка: pause/transfer26с -> один timed set, weight0/reps0. Finish неполного
  плана требует подтверждения. Проверенная автокопия v6 содержит2новых sets,
  завершённый workout3 без draft/plan, сохранённый шаблон и созданное упражнение.
- Scale2: редактор прокручивается, раскрытия не накладываются; общие заголовки
  сокращаются и счётчики неудобно переносятся. Это открытая задача B7, не полный
  PASS доступности. Ориентацию, TalkBack и все экраны наscale2 ещё не проверяли.

Артефакты в C:\gymbeam\artifacts\apk\verified:
- before-layout-v6.json, exportedAt2026-10-14T18:47:19.284Z, свежий source.
- before-layout-RKStorage.db, полный snapshot catalystLocalStorage.
- layout-qa.json, отдельная fixture созданная существующим create-draft-qa.mjs.
- layout-native-auto.json, checksum552fe3c97c0a87b50308c1348c2c8c45645c93c2afd9de00a91c5a386b738059.
- layout-*.png/xml: большие/360dp формы, errors+IME, редактор, picker, scale1,3/2,
  timer, transfer, finished report и финальная Главная.
- after-layout-restored-v6.json, exportedAt2026-10-14T19:01:12.899Z.
- Journey report: C:\gymbeam\artifacts\apk\journey\progression-report.json.

### APK и восстановление

APK: C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk,132031359bytes.
SHA256ECE803AEE4B79495C8CD11902002B10049D73BA1F4462E5B1A5EA4C60EEE5AFD.
apksigner verify v2/v3 PASS; certificate SHA256
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a (Android Debug).
Package com.dirg9876.gymtracker, version1.0.0/versionCode1. Локальный repack,
НЕ EAS release. Обновление исходной EAS-установки требует исходного signing key;
не советовать uninstall без внешней копии. Новые Expo-ссылки не создавались.

После QA ВСЯ catalystLocalStorage возвращена из СВЕЖЕГО before-layout snapshot.
SQL EXCEPT в обе стороны0отличий, integrity_check=ok. Финальный экспорт проверен
parser и deepEqual: state/plans/checksum совпадают с before-layout-v6.
Checksum53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
Итог:2завершённые тренировки,8sets,31упражнение,0видов/планов/active. Last-export
обновлён финальным экспортом. QAfixture/autofile перенесены в
/sdcard/Download/GymBeam-QA; пользовательские внешние копии не удалялись.

### Среда и следующий шаг

Workspace C:\gymbeam, PowerShell5; чтение UTF8, manual edits только apply_patch.
Node PATH=C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot.
ADB=C:\gymbeam\artifacts\android-sdk\platform-tools\adb.exe.
Repack из mobile: scripts/repack-apk.ps1 -BaseApk C:\gymbeam\artifacts\apk\gym-tracker-expo-link.apk
-SdkRoot C:\gymbeam\artifacts\android-sdk -Keystore C:\gymbeam\artifacts\apk\debug.keystore
-OutputDirectory C:\gymbeam\artifacts\apk\verified.

Эмулятор оставлен включённым на Главной, gymbeam_test/emulator-5554, Android36,
1080x2400/density420, font_scale1.0, show_ime_with_hard_keyboard0,
stylus_handwriting_enabled1; adb unroot, uid2000. Нужные exec sessions закрыты.
Новых агентов/целей/автоматизаций не было. Чужие изменения git не откатывать.

Далее B7: реальные touch targets/контраст/TalkBack, font scale1/1,3/2 и подписи
навигации/счётчиков/заголовков, сохраняя пять вкладок и текущий выбор веса.
Не считать весь B7 выполненным по нескольким screenshots B6. A3 (release key,
versionCode, upgrade test), A4 (native picker после Activity recreation) открыты.
C1/C2/C3 отдельно; C2 требует замера до виртуализации, C3 не включать автоматически.

Перед следующим native QA снять НОВЫЙ export/full snapshot: пользователь мог
тренироваться. Не восстанавливать старые before-layout/before-draft автоматически.
UI dump не достигает idle при ticking timer: pause до uiautomator; слишком ранний
tap Finish после Add блокируется pending. Ждать готовности, затем нажать снова.
У picker ScrollView начинается ниже search: swipe начинать внутри списка; helper
Find-Scrolled с большими шагами способен проскочить «Планка» и дойти до конца.
После смены density/font cold restart перед SAF из-за известного A4.
SQLite: -bail, PRAGMA busy_timeout=5000; dot .backup на отдельной строке; SQL через
stdin (adb shell quoting иначе ломает parentheses). Unicode escapes для кириллицы
inline Node. Полные прежние решения/границы данных описаны в B5 ниже.

## Завершено: B5, сохранение черновика тренировки

### Цель и решение пользователя

После первого пакета пользователь попросил «продолжай», затем явно отказался
от прямого ввода веса: «текущий вариант ввода веса нормальный». B1 numeric input
НЕ внедрять. Способ выбора веса, плюс/минус, пресеты и текущий шаг оставлены.
Stepper.tsx не редактировался; SHA256 до и после совпадает:
3BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C.

Вместо B1 выполнен B5: сохранять подтверждённый ввод активной тренировки,
особенно секунды после таймера планки. Черновик не является выполненным подходом.
Этот раздел актуальный: старые версии backup, APK-хэши и очередь ниже исторические.
B6/массовый редизайн ещё не делали. Бренд, пять вкладок, пустые виды по умолчанию,
все рабочие подходы, WRPF, вес штанги от20кг и секунды планки сохранены.

### Устройство данных и поведение

1. Новый lib/workoutDraft.ts: Zod schema, unit/reference checks, default factory,
   сравнение timer/draft и bounded retry только для идемпотентных операций.
   WorkoutRow хранит optional draft/draftRevision/lastDraftCommit. Draft:
   exerciseId, weightKg, reps, optional durationSeconds, rir, technique,
   optional sourceTimer. Все данные находятся в существующем offline state v1,
   дополнительных storage keys нет. Обычный Workout API contract не расширяли.
2. Local API GET/PUT /api/workouts/:id/draft; POST /draft/commit и /draft/transfer.
   PUT проверяет revision, существование/доступность упражнения, единицы и поля.
   Устаревший revision не может затереть новую форму; ошибки400/409 не повторяются.
3. Transfer считает elapsed по сохранённому timer, сохраняет timed draft и удаляет
   timer ОДНОЙ записью state. До успешной записи таймер не пропадает. sourceTimer
   позволяет повтору после потерянного acknowledgement вернуть прежние секунды,
   не повторить измерение. Перенос не добавляет set и не меняет статистику.
4. Commit берёт только сохранённый draft, создаёт set, сбрасывает RIR/технику и
   сохраняет следующую цель плана ОДНОЙ записью state. В свободной тренировке
   вес/повторы остаются. lastDraftCommit связывает revision с setId: повтор того
   же подтверждения возвращает тот же set, несовместимый старый revision даёт409.
   Клиент повторяет неизвестный I/O failure один раз только на этих endpoints.
5. Finish удаляет draft/revision/lastCommit вместе с timer/plan/jobs в прежней
   защищённой транзакции. Удаление упражнения чистит связанный draft/timer и
   повышает revision; смена единиц занятого в draft упражнения запрещена.
   Удаление set чистит lastCommit; удаление workout убирает всё вместе с ним.
6. Backup теперь v6, import1..6; draft/commit references валидируются и хэшируются.
   Старые копии v5 без draft импортируются без миграции данных. Новую v6-копию
   нельзя импортировать в старый APK с parser1..5; использовать новую версию.
   Автокопия и ручной экспорт сохраняют весь state, включая незавершённый draft.
7. Новый hooks/useWorkoutDraft.ts управляет persisted form, optimistic input,
   pending/error, revision и повтором именно неудавшейся операции. При неизвестном
   результате обычного PUT сначала сверяется сохранённое значение. Начальная
   ошибка загрузки имеет рабочий retry. Успех повторного commit/transfer обновляет
   cache/таймер так же, как первый успех. Пока идёт запись, конфликтующие действия
   блокируются. Пока виден pending, последнее изменение ещё НЕ подтверждено
   хранилищем и при немедленном process death может не успеть записаться.
8. ActiveWorkoutScreen восстанавливает draft ДО автозаполнения legacy-плана,
   поэтому цель45с не перезаписывает перенесённые4с. TrainingTimer больше не
   удаляет timer перед callback в React-state, а вызывает атомарный transfer.
   Ошибка оставляет ввод видимым, есть «Повторить действие» и явная загрузка
   сохранённого варианта. Pending status имеет постоянную высоту без прыжка Add.

### Изменённые файлы и проверки

Workspace C:\gymbeam, mobile artifacts/gym-tracker-mobile, PowerShell5.
Новые исходники этого пакета относительно mobile:
- lib/workoutDraft.ts.
- hooks/useWorkoutDraft.ts.
- scripts/workout-draft.test.mjs:15 новых тестов.
- scripts/create-draft-qa.mjs: отдельная fixture из свежего backup; отказывается
  менять копию при пользовательской active workout, источник не перезаписывает.

Изменены lib/offlineApi.ts/progressBackup.ts, app/workout/[id]/index.tsx,
components/TrainingTimer.tsx/ExercisePicker.tsx, scripts/testHarness.mjs;
3 assertions версии backup в offline-api/coach/deletion tests обновлены на6.
Новых dependencies нет; web/API-server/generated API schemas не менялись.
Git HEAD496db9d, dirty worktree сохранять, ничего не откатывать. Коммита нет.

Проверки завершены:
- pnpm test105/105 PASS, было90. Typecheck ВСЕГО workspace PASS.
- Journey624 обычные тренировки/8970 подходов/208 недель PASS, уровень12;
  отдельные elite fixtures проверяют80. Findings=[], wallSeconds69. Это mock
  desktop run, не прогноз тренировок и не замер FPS Android.
- Unit: backup round trip, invalid units/references/revisions, частичная потеря
  подтверждения записи до/после setItem, повтор commit/transfer, parallel commit,
  reset RIR/техники, next target, finish/delete cleanup, import v5 и испорченные
  draft/commit links при пересчитанном checksum.
- Native Android36: install-r без uninstall, обе стороны сравнения исходного
  storage после установки0 отличий. Legacy active plan инициализировал draft.
- Native: сохранены22,5кг/8повторов/RIR2/хорошая техника, force-stop/relaunch
  восстановил всё, план не затёр ручной ввод. Имитированный отказ чтения state
  оставил22,5 в форме; после восстановления источника retry записал его.
- Native:2подхода жима продвинули сохранённую цель к планке45с; оценки сбросились.
  После4с таймер перенесён и сразу process stopped. После restart форма содержит
  ровно4с, timer отсутствует, в истории ещё только2новых set. Экспорт v6 включает
  этот draft и не изобретает планку. Одно Add создаёт ровно1timed set с4с.
- Native: finish очистил draft/lastCommit/timer и создал проверенную автокопию v6.
  Import предыдущей pending v6 вернул4с и2sets без выполненной планки. После всех
  тестов восстановлены исходные пользовательские данные. Logcat без
  ReactNativeJS errors/FATAL EXCEPTION. UI snapshots draft-*.png/xml сохранены.

### Итоговый APK и восстановление

APK C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
Размер132027263 bytes, SHA256:
ECDAFB22C4FDC205B2000CC7F2784F78B5898C95189722D4F95F6F27BBB54300.
apksigner v2/v3 PASS, debug certificate SHA256:
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Package com.dirg9876.gymtracker, version1.0.0/versionCode1. Это локальный repack,
НЕ новый EAS release; исходные Expo-ссылки неизменны. Для обновления исходной
EAS-установки нужен её signing key; нельзя советовать uninstall без внешней копии.

Свежие артефакты пакета в C:\gymbeam\artifacts\apk\verified\:
- before-draft-v5.json, exportedAt2026-10-14T06:27:09.124Z, до установки/QA.
- before-draft-RKStorage.db, snapshot ВСЕЙ catalystLocalStorage.
- draft-qa.json, draft-before-confirmation.json, draft-native-auto.json.
- draft-journey-final.json; также artifacts/apk/journey/progression-report.json.
- after-draft-restored-v6.json, exportedAt2026-10-14T18:16:35.030Z, финальный экспорт.

ИТОГОВЫЕ данные эмулятора:2завершённые тренировки1/2,8sets,31упражнение,
0видов/планов, нет active workout/draft. Полная catalystLocalStorage восстановлена
из СВЕЖЕГО snapshot; обе стороны SQL-сравнения0, PRAGMA integrity_check=ok.
Финальный экспорт v6 и исходный v5 имеют ТОЧНО одинаковые state/plans/checksum:
53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
Экспорт закономерно обновил last-export. QA draft/sets/jobs/quarantine/recovery
убраны из внутреннего store; QA-файлы и тестовая автокопия перенесены в
/sdcard/Download/GymBeam-QA, пользовательские копии не удаляли.

Эмулятор gymbeam_test/emulator-5554, Android36 x86_64,1080x2400/density420,
приложение оставлено на Главной. Временно использовали adb root для тестового
SQLite; в конце adb unroot. Все нужные exec sessions завершены, агентов/целей/
автоматизаций не создавали.

### Остаточные задачи и следующий шаг

Далее B6: компактная форма и адресные ошибки, затем B7 a11y/large fonts. Прямой
ввод веса не возвращать в очередь. A3 (релиз/исходный ключ/версия), A4 (native
picker после Activity recreation) остаются не исправлены. C1/C2/C3 отдельно.
TalkBack/font scale2/orientation в этом пакете не проверяли; полного RN renderer
теста hook нет. Бounded native write faults проверены mock storage; реальный
Android process death и error/retry формы проверены отдельно.

Перед следующим native QA снять НОВЫЙ backup: после checkpoint пользователь мог
тренироваться. Не восстанавливать автоматически before-draft-v5 или старые копии.
Runtime/команда repack/ADB и правила UI QA приведены ниже в предыдущем пакете:
Node PATH C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin,
JAVA_HOME C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot,
ADB C:\gymbeam\artifacts\android-sdk\platform-tools\adb.exe.
PowerShell чтение UTF8; inline Node с кириллицей требует Unicode escapes.
При ticking timer сначала pause; после навигации дождаться layout до swipe.
SQLite использовать -bail/PRAGMA busy_timeout=5000 и проверять exit code.

## Завершено: первый пакет A1/A2/B2/B3/B4

### Цель и границы

14 октября 2026 пользователь ответил «начинаем» на план консилиума.
Реализован первый пакет: сохранность повреждённого прогресса, атомарное
завершение с автокопией и точечные исправления форм/оценок/cache. НЕ весь план.
Текущий раздел главнее всех исторических статусов, задач и хэшей ниже.
План с обновлёнными статусами: C:\gymbeam\IMPROVEMENT_PLAN.md.

Код: C:\gymbeam\artifacts\gym-tracker-mobile, offline Expo/React Native Android.
Git HEAD496db9d, грязное рабочее дерево с предыдущих этапов. Ничего не откатывать.
Коммит не создавался, новые dependencies не добавлялись. Web/API-server,
навигация, нормативы WRPF и бренд в этом пакете не менялись. Все подходы рабочие;
Виды тренировок пустые по умолчанию; пять вкладок, центральная Главная и Start/
Continue на ней сохраняются. Новых агентов в реализации не запускали.

### Принятые решения

1. loadState отличает отсутствие данных при первом запуске от повреждения.
   JSON, структура, ID, ссылки подходов/таймеров/программ/планов проверяются.
   Повреждённое состояние НЕ заменяется пустым. Обычные операции блокируются
   ProgressRecoveryRequired(status503), Home предлагает восстановление.
2. Карантин: gym-tracker:quarantine:<ISO>:<suffix>, immutable JSON envelope
   format=gym-tracker-damaged-data, version1, entries с ТОЧНЫМИ исходными строками.
   Повторные чтения того же повреждения не плодят копии. Время ключей монотонно
   даже при одном миллисекундном timestamp/переводе часов назад. Архив можно
   выгрузить из Резервной копии; это диагностический архив, не обычный backup.
3. backup v5 сохраняется, import v1..v5 совместим. Входящая копия проверяется
   до замены. Исправная старая запись сохраняется как RECOVERY_KEY; повреждённая
   сохраняется raw в карантин и не блокирует импорт. Кнопка называется
   «Предыдущая копия прогресса», а не обещает точную отмену повреждённого импорта.
   Import доступен даже при ошибке текущего экспорта/повреждённом journal.
4. Журнал PENDING_RESTORE_KEY теперь {version:2,previous:[key,raw][]}; scope:
   progress state + plans + durable copy jobs. Старые journals-массивы совместимы
   и откатывают только прежний scope progress/plans. Все locked-операции сначала
   восстанавливают незавершённый журнал. Неправильный/пустой журнал архивируется;
   лишь явные recovery actions могут обойти его, но НЕ ошибки чтения/записи I/O.
5. Finish API одной журналируемой операцией сохраняет finishedAt, убирает timer,
   удаляет active plan и записывает job автокопии, если она включена. UI больше
   не выполняет отдельные clearPlan/queue. Повтор finish идемпотентен. Удаление
   тренировки убирает её job в той же транзакции.
6. Новый key gym-tracker:auto-backup:pending:v2 хранит {workoutId,finishedAt}[];
   legacy pending IDs читаются до следующей записи. Настройки и SAF permissions
   остаются в gym-tracker:auto-backup:v1 вне переносимого backup/transaction.
   Import очищает jobs, не переносит и не отнимает локальную папку. Ack после
   экспорта учитывает finishedAt и папку, не удаляет новые jobs с повторным ID.
   Новые задания, появившиеся во время копирования, обрабатываются тем же run.
7. Ручной и автоматический экспорт читают записанный файл, проверяют формат,
   checksum и совпадение checksum с исходным прогрессом. Неудачная запись не
   очищает jobs. Автокопия повторяется при запуске/report/ручном повторе; это НЕ
   отдельная ОС-background service и не запись файла при выключенном процессе.
8. После успешного Add RIR/техника сбрасываются; вес/повторы сохраняются либо
   переходят к следующей заданной цели плана. Ошибка ничего не очищает.
   Создание упражнения ждёт mutateAsync: pending блокирует повтор/закрытие,
   error сохраняет название и dropdown-группу, success выбирает новое упражнение.
   Finish сразу обновляет workout query cache; История различает error/empty
   и имеет retry/переход к резервной копии. Ошибка настроек автокопии не оставляет
   вечный spinner. Неинтерактивные Toast больше не перехватывают касания.
9. Длинный прогон выявил регрессию полной валидации на каждом запросе. В offlineApi
   кэшируются точные строки проверенного state/plans и успешных API-записей под
   общим lock, НЕ изменяемые объекты. На чтении JSON разбирается заново; любое
   изменение raw state/plan, добавление/удаление ключа включает полную валидацию.
   Ошибки записи/rollback не помечают несохранённый объект проверенным.

### Файлы и проверки

Новые исходники этого пакета, относительно artifacts/gym-tracker-mobile:
- lib/automaticBackupState.ts: pure storage/schema для настроек и durable jobs.
- scripts/progress-safety.test.mjs: corruption, quarantine, journal boundaries,
  rollback/replay, import, legacy jobs, cache, порядок архивов.
- scripts/create-safety-qa.mjs: отдельная native QA-копия из исходного backup;
  отказывается работать при active workout, не удаляет пользовательский черновик.

Основные изменённые файлы: lib/progressStorage.ts, progressBackup.ts, offlineApi.ts,
automaticBackup.ts; app/backup.tsx, app/(tabs)/index.tsx, history.tsx,
app/workout/[id]/index.tsx; components/ExercisePicker.tsx,
AutomaticBackupSettings.tsx, Toast.tsx. TestHarness получил точечные I/O faults;
automatic-backup.test.mjs расширен; deletion.test.mjs больше не ждёт plan после finish.

Проверки завершены:
- pnpm test:90/90 PASS, было71. Старые подходы/копии/удаления/планка/WRPF проходят.
- C:\gymbeam pnpm typecheck: PASS для libraries и всех проектов workspace.
- pnpm test:journey:624 обычные тренировки,8970 подходов,208 недель, уровень12;
  отдельные elite boundary fixtures доходят до80. Нормативы не обходятся обычными
  весами. Backup round trips и полная старая история сохранены, findings=[].
  После cache74с, до него501с, прежний baseline56с. Это desktop mock benchmark,
  не FPS/latency телефона. Последние Toast/quarantine изменения отдельно unit/native
  проверены; они не участвуют в обычном journey без повреждений.
- Fault injection проверил сбои до/после journal, state, jobs, удаления plan и
  commit acknowledgement. Replay после имитированного process death возвращает
  целое старое состояние; после commit повтор не дублирует job.
- Native Android36: обновление install-r без uninstall, сброс оценок и сохранение
  null во втором подходе, ошибка создания с сохранением текста/группы, ровно одно
  созданное упражнение, завершение/сохранение шаблона, отказ папки с pending job,
  реальный force-stop/relaunch и последующая успешная автокопия, error/retry Истории.
- Native: одновременно повреждённые state/journal не сброшены, raw-архив выгружен
  и содержит точно '{native-corrupt' и '{broken-journal'; UI импорт исправной копии
  успешно восстановил прогресс. Прогретый cache также обнаружил live corruption
  '{cache-corrupt', не перезаписал его и создал карантин. Нажатие Backup во время
  Toast после импорта работает. Logcat без ReactNativeJS errors/FATAL EXCEPTION.

### Итоговый APK и устройство

APK: C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
Размер132019071 bytes, SHA256:
FAFC7A94F55A52CD50CC2F3A7650A07C64CB36F08A14317EFA675A27FF731A9B.
apksigner v2/v3 PASS, CN=Android Debug. Certificate SHA256:
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Версия1.0.0/versionCode1; package com.dirg9876.gymtracker. Это локальный repack,
не новый EAS release. Ссылки старых Expo-артефактов не обновлены. Для обновления
исходной EAS-установки нужен исходный signing key; нельзя советовать удаление
приложения без внешней копии. Совместимое обновление доказано для тестовой подписи.

Эмулятор gymbeam_test, emulator-5554, Android36 x86_64,1080x2400/density420.
Приложение оставлено открытым на Главной, программных/шрифтовых настроек не меняли.
Для контролируемого SQLite QA временно использовали adb root, в конце adb unroot.
Все exec sessions завершены; задач/автоматизаций не создавали.

Свежие артефакты этого этапа: C:\gymbeam\artifacts\apk\verified\
- before-safety-v5.json, исходная копия перед установкой; exportedAt
  2026-10-13T21:41:21.866Z, это14октября00:41поМоскве.
- before-safety-RKStorage.db, полный SQLite snapshot четырёх исходных keys.
- after-safety-upgrade.json: state/plans точно равны исходным после install-r.
- after-safety-restored.json: финальный экспорт после всего QA, exportedAt
  2026-10-13T22:11:18.660Z; state/plans снова точно равны исходным.
- checksum всех трёх копий прогресса:
  53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
- safety-native-auto.json, safety-native-quarantine.json, safety-qa.json,
  safety-journey-baseline.json, safety-journey-before-cache.json,
  safety-journey-final.json; screenshots/XML safety-*.png/xml.
  Последний journey также artifacts/apk/journey/progression-report.json.

ИТОГОВЫЕ данные устройства:2 завершённые тренировки1/2,8 подходов,31 упражнение,
0 видов/планов, нет active workout. Перед финальным экспортом восстановлена ВСЯ
catalystLocalStorage из свежего snapshot: обе стороны SQL-сравнения0 отличий,
PRAGMA integrity_check=ok. Экспорт затем закономерно обновил last-export.
QA-прогресс, его jobs/quarantine/recovery полностью убраны из внутреннего store.
QA fixture и его автокопия перенесены из обычной папки копий в
/sdcard/Download/GymBeam-QA; исходный JSON для восстановления оставлен в Download.

### Остаточные задачи и следующий шаг

A3 release с исходным ключом и возрастающей версией, A4 native picker после
пересоздания Activity НЕ исправлены. Не проверялись заново font-scale2/TalkBack/
ориентация; не заявлять готовность B7. Crash на каждой native-инструкции не
инструментирован: границы transaction проверены mock faults, реальный restart
после commit/отказа SAF проверен на Android. Неинтерактивный долгий pending/double
tap создания защищён ref guard и disabled state; отдельного RN renderer test нет.

Следующий пакет: B1 прямой числовой ввод веса/шага, затем B5 durable draft и
B6 компактная форма с адресными ошибками; сохранять минимум20кг для штанги,
секунды для планки и все пользовательские решения. C1/C2/C3 позже по плану.
Перед ЛЮБЫМ следующим native QA снять НОВЫЙ backup: после этого checkpoint
пользователь мог тренироваться. Не восстанавливать автоматически копию этого этапа.

Runtime для продолжения:
- PowerShell5, cwd C:\gymbeam; Node/pnpm PATH:
  C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
- JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot.
- ADB=C:\gymbeam\artifacts\android-sdk\platform-tools\adb.exe.
- Из mobile: .\scripts\repack-apk.ps1 -BaseApk
  'C:\gymbeam\artifacts\apk\gym-tracker-expo-link.apk' -SdkRoot
  'C:\gymbeam\artifacts\android-sdk' -Keystore
  'C:\gymbeam\artifacts\apk\debug.keystore' -OutputDirectory
  'C:\gymbeam\artifacts\apk\verified'. Секреты/ключи не коммитить.
- . .\scripts\android-ui-helpers.ps1 для UI QA. При ticking timer uiautomator
  не получает idle: сперва pause. Toast больше не мешает кнопкам. После cold
  launch/deep link дождаться Home; при ошибке null root повторить Read-Ui.
  Для SQLite QA использовать -bail и PRAGMA busy_timeout=5000, проверять exit code.

## История: план консилиума четырёх ИИ-ролей до реализации

Последний запрос14октября: создать консилиум разработчика приложения,
frontend-инженера, тренера и дизайнера и получить ПЛАН улучшений, не реализацию.
Запущены4независимых read-only subagents; выводы сведены и проверены модератором,
все агенты завершены/закрыты. Никаких изменений приложения/сборок/установок/QA
на устройстве в этом этапе не выполнялось, прогресс и эмулятор не трогали.

Создан C:\gymbeam\IMPROVEMENT_PLAN.md: ограничения пользователя, четыре позиции,
задачи A1–A4/B1–B7/C1–C3 с основаниями, P0/P1/P2, объёмом S/M/L, приёмкой,
зависимостями и границами доказательств. Обновлён только этот checkpoint.

Главные следующие задачи (ещё НЕ внедрены):
- A1: карантин повреждённого state вместо createInitialState в catch loadState;
  разрешить восстановление valid backup при повреждении прежнего progress.
- A2: atomic finish/clearPlan/durable auto-backup job. Сейчас finishedAt сохраняется
  раньше, чем UI ставит задание копии; process-death последствие ещё надо воспроизвести.
- B2/B3/B4: не переносить оценки RIR/техники на следующий подход; ждать успеха
  создания упражнения, показывать ошибки; обновлять workout cache после finish,
  различать ошибку истории и пустой список.
- B1/B5/B6/B7: произвольный числовой ввод/реальный шаг веса, durable draft включая
  перенос секунд планки, компактная форма, адресные ошибки, IME/large font/a11y.
- A4/A3: native picker lifecycle и полноценный подписанный upgrade без удаления app.
- C1/C2: сопоставимый прогресс/контекст оборудования и измеренная виртуализация;
  C3 личные цели/режим без повышения только после отдельного согласования.

Повторно14октября pnpm test71/71PASS. Native/typecheck в этом запросе не запускали;
прошлые проверки ниже датированы13октября. Git HEAD496db9d, dirty worktree сохранять.
SHA256 APK перепроверен, неизменен:
374608D355E0BDE2838CEB0FCBE0FFF248FAE54C32AD5DE04B2CD88DCA6960CF.
Первичные Android/Expo sources проверены, ссылки находятся в плане. Спорное
обвинение общего contrast3,54:1 снято: нужно учитывать размер/жирность текста.

Следующий шаг: ждать решения пользователя о внедрении; при разрешении начать
с A1/A2 и точечных B2/B3/B4, затем согласовать прототип рабочего экрана.
Сохранить все рабочие подходы, пустые виды по умолчанию, бренд/пять вкладок,
WRPF и offline-прогресс. Никаких дополнительных cloud/автопрограмм без запроса.
Данные устройства после13октября НЕ проверялись: указанные ниже8sets/2workouts
являются последним известным состоянием, НЕ доказательством текущего. Перед
следующим native QA нужен НОВЫЙ backup, а не восстановление старого13октября.

## История этапа13октября

## Завершено: удаление, поиск, автокопии, группы, все подходы рабочие

Актуальные запросы пользователя, выполненные в этом этапе:
- Удалять тренировки и упражнения, даже использованные в тренировках.
- Не перекрывать результаты поиска экранной клавиатурой.
- Автоматически экспортировать весь прогресс после завершения тренировки.
- Выбирать группу мышц из выпадающего списка при создании упражнения.
- ПОСЛЕДНЕЕ указание: убрать разделение разминка/рабочие, все подходы рабочие.

Все изменения включены в итоговый APK и проверены. Этот раздел главнее всех
исторических статусов/хэшей ниже. Никаких задач восстановления больше не осталось.
Рабочая папка C:\gymbeam, приложение artifacts/gym-tracker-mobile, PowerShell5.
Node/JDK, команда repack и Apktool особенности приведены ниже. Никаких новых
package dependencies; web/server и таблицы WRPF в этом этапе не менялись.
Репозиторий грязный с прежних этапов: не сбрасывать пользовательские изменения.

Решения и поведение:
1. У тренировки есть корзина в Истории, деталях и активной тренировке, с
   подтверждением. Удаляются workout, его sets/timer и сохранённый active plan;
   отдельный вид тренировки остаётся. Статистика/уровни пересчитываются.
2. Удаление упражнения разрешено и встроенным, и своим, независимо от истории.
   ExerciseRow.deletedAt скрывает его из каталога/выбора, удаляет из видов и
   текущих планов, сбрасывает привязанный таймер. Исторические sets, название,
   результаты и уровни сохраняются. DELETE повторно безопасен. Новые sets,
   stale editor и plank timer не могут ссылаться на удалённое упражнение.
   Оба удаления атомарны со state/plans через PENDING_RESTORE_KEY и rollback.
   Пустой после удаления вид остаётся редактируемым, запуск пустого UI блокирует.
3. ExercisePicker: KeyboardAvoidingView на Android/iOS, сжимаемый список,
   прокрутка и выбор при открытой клавиатуре. Исправлен сброс выбора только что
   созданного упражнения во время refetch каталога. Editor тоже учитывает IME.
4. MuscleGroupPicker: стандартные8 групп + существующие названия + текущая
   группа; выпадающий прокручиваемый список, «Своя группа» для нового названия.
   Используется и при создании из тренировки, и в управлении упражнениями.
5. Автокопия включена по умолчанию, но нужен один явный выбор папки SAF.
   Запрос папки появляется после первого завершения без настройки; либо
   Резервная копия -> Выбрать папку автокопий. Есть Switch, смена папки,
   ручной повтор, последний успешный экспорт и ошибка/ожидающие записи.
   Создаётся отдельный gym-tracker-auto-<UTC timestamp>.json со ВСЕМ прогрессом,
   checksum проверяется чтением записанного файла. Старые копии не затираются.
   Ошибка экспорта не отменяет завершение тренировки. Pending jobs сохраняются,
   повтор при следующем запуске/ручном запросе, параллельные экспорты объединены.
   Папка/разрешение и очередь локальны: key=gym-tracker:auto-backup:v1, не входят
   в переносимый progress backup. На другом телефоне папку нужно выбрать заново.
6. Разминка/рабочие больше не различаются НИГДЕ в UI: форма, шаблон, история,
   weekly. Все старые и новые подходы учитываются в плане/статистике/прогрессии.
   Новые sets и template targets записываются setType=working; старые hidden
   warmup/undefined допустимы в backup и НЕ переписываются при импорте.
   RIR/техника/таймеры остаются. Подсказка прогрессии по-прежнему требует полный
   сопоставимый сеанс с одинаковой нагрузкой, верхом диапазона, RIR и техникой;
   отсутствие оценок не повышает вес. Старый лёгкий подход не исключается.

Созданные файлы относительно artifacts/gym-tracker-mobile:
- components/DeleteWorkoutButton.tsx: подтверждение, mutation/cache refresh.
- components/MuscleGroupPicker.tsx: общий dropdown, известные и свои группы.
- lib/automaticBackup.ts: локальные settings/pending, SAF write/verify/retry.
- components/AutomaticBackupSettings.tsx, AutomaticWorkoutBackup.tsx.
- scripts/deletion.test.mjs (6тестов), automatic-backup.test.mjs (5тестов),
  all-working.test.mjs (3теста).

Изменённые файлы:
- lib/offlineApi.ts: архивирование, очистка ссылок, атомарное удаление workout,
  запрет новых ссылок на deleted, нормализация новых sets/targets в working.
- lib/progressBackup.ts: экспорт v5, импорт1..5; deletedAt дата и отношения
  валидируются. Архивное упражнение допустимо в истории, но не в будущих планах.
- lib/trainingCoach.ts, workoutTemplates.ts, workoutMeasurement.ts: все подходы
  рабочие, совместимость старых меток, нет разделения в подсчётах/подписях.
- app/workout/[id]/index.tsx: удаление, enqueue после finish/clearPlan, без type UI.
  app/workout/[id]/report.tsx: AutomaticWorkoutBackup; app/_layout.tsx: retry.
- app/(tabs)/history.tsx, app/history/[id].tsx, app/exercises/index.tsx,
  app/backup.tsx: корзины, keyboard/search, настройки и summary архивных записей.
- components/ExercisePicker.tsx, ExerciseEditor.tsx, SavedWorkoutPlan.tsx,
  SaveWorkoutTemplate.tsx, SetCard.tsx, WeeklyTraining.tsx: dropdown/IME/working.
  SaveWorkoutTemplate не возвращает удалённые упражнения в будущий шаблон.
- scripts/coach.test.mjs, offline-api.test.mjs, testHarness.mjs, FITNESS_REVIEW.md,
  CHECKPOINT.md. Старые проверки заменены только при смене поведения по запросу.

Проверки:
- Финальные71/71 unit tests PASS, mobile и whole workspace typecheck PASS,
  scoped git diff --check PASS (только CRLF предупреждения).
- Проверены оба типа workout deletion, встроенное/своё использованное exercise,
  rollback при прерванных multiSet/multiRemove, недопустимые backup со checksum,
  старые версии1..4, сохранение истории, отсутствие старых классификаций.
- Auto tests: выбор/отмена папки, отключение, write/read failure, pending retry,
  coalescing, удалённые jobs, отдельность device permissions от progress restore.
- Полный repack повторялся после добавлений пользователя; ФИНАЛЬНЫЙ код собран,
  Hermes/branding/native resource IDs/zipalign/apksigner PASS, install-r PASS.
- Native Android36: поиск/выбор при IME на1080x2400 и360dp(720x1280/320);
  screenshots delete-search-filtered-keyboard.png, delete-picker-360dp-keyboard.png.
- Native: удаление used QA press и встроенного bench сохранило все14sets;
  template очистился до plank. Cancel не удаляет. completed4 и active6 удалены
  с sets/plans, вид сохранён; after-delete-qa-v5.json и Node assertions PASS.
- Native dropdowns: Грудь сохранена из Picker, Бицепс из Editor; screenshots
  muscle-group-picker-workout/editor.png, muscle-group-editor-saved.png.
- Native auto: первая папка выбрана один раз, после cold restart следующая
  законченная тренировка создала новый файл без повторного permission prompt.
  Проверены checksum/full-state в automatic-first-v5.json,
  automatic-after-restart-v5.json и automatic-all-working-v5.json.
- Native финального APK: нет type controls в тренировке/шаблоне/weekly;
  новый set working, автокопия содержит9sets (8исходных +1тестовый).
  Screenshots all-working-form/template/weekly/completed.png.
- Последний холодный запуск после QA: Home с «Начать тренировку», logcat только
  Running main, без ReactNativeJS/AndroidRuntime ошибок.

Прогресс полностью восстановлен, QA-копии в приложении НЕТ:
- Пользователь тренировался после прошлого этапа. Источник для восстановления
  ТОЛЬКО artifacts/apk/verified/before-delete-v4.json (12675bytes), экспорт
  2026-10-13T20:02:36.852Z. Старые coach backups уже НЕ актуальный прогресс.
- After-delete-install-v5.json доказал неизменность state/plans после установки.
- После QA оригинал импортирован обратно ДВАЖДЫ, recovery snapshot тоже оригинал.
- Итог artifacts/apk/verified/after-delete-final-v5.json (12675bytes), экспорт
  2026-10-13T20:37:38.698Z: deepStrictEqual state+plans с before-delete-v4 PASS.
- Текущие workouts1 и2 ОБА завершены;8sets,31exercises,0deleted,0types/0plans,
  nextWorkoutId3. Никакой active id2 больше нет. Не использовать старый статус.
- Создана внешняя копия ТОЧНО исходного прогресса, checksum и deep compare PASS:
  automatic-original-v5.json, Android Documents/GymTracker/
  gym-tracker-auto-2026-10-13T20-38-34-722Z.json (12675bytes).
- SAF auto enabled, folder=Documents/GymTracker; pending пуст. Это намеренная
  новая настройка устройства, не изменение тренировочного прогресса.
- Download/delete-qa.json,3наших QA auto files и2QA manual exports удалены
  с устройства. Локальные QA artifacts оставлены для доказательства проверок.
  Download/delete-original.json сохранён как свежий источник v4.

ИТОГОВЫЙ APK, заменяет все хэши ниже:
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
132010879bytes; SHA256
374608D355E0BDE2838CEB0FCBE0FFF248FAE54C32AD5DE04B2CD88DCA6960CF
DEBUG подпись, не исходный EAS release key. Поверх прошлых debug APK install-r
проверен. Поверх исходной EAS версии на телефоне не обновится без её ключа;
НЕ удалять приложение без внешней резервной копии.

Среда и ограничения:
- AVD gymbeam_test, emulator-5554, Android36x86_64, запущен на Home;
  ANDROID_AVD_HOME=C:\gymbeam\artifacts\android-avd,1080x2400/density420.
  ADB=artifacts/android-sdk/platform-tools/adb.exe. Software keyboard QA settings
  возвращены в прежнее поведение: show_ime_with_hard_keyboard0, handwriting1.
- Native Expo FileSystem ActivityResultLauncher дефект после пересоздания
  Activity остаётся: полный restart восстанавливает picker, сообщение понятное.
  Автозапись в ранее выбранную SAF папку переживает restart, проверено.
- Автокопия выполняется внутри приложения, не отдельной OS background-службой;
  pending повторяется при следующем запуске. Нет автоматического cloud upload.
- Сигнал таймера только foreground; elapsed/deadline при restart восстанавливается.
- iOS/EAS cloud build не запускались. package/EAS identity/версия/навигация
  сохранены, native code/manifest не переписывались.

Следующий шаг: текущие запросы завершены. Для публикации нужен полноценный
EAS release с исходным ключом, проверка обновления на телефоне. Для новых QA
сначала свежий backup, тестовая копия, возврат state/plans и новый checkpoint.

## История: шесть согласованных тренерских улучшений

Запрос предыдущего этапа: «внедри эти предложения», то есть
редактор видов заранее; разминка/рабочие подходы и RIR; отдельная рабочая
прогрессия; таймеры; недельная статистика; корректный статус нормативов.
Все шесть внедрены, проверены в Android-эмуляторе и включены в итоговый APK.
Ниже историческая фиксация до новых указаний об удалении/автоэкспорте/всех рабочих.

Рабочая папка: C:\gymbeam, мобильное приложение: artifacts/gym-tracker-mobile.
PowerShell5, Node из C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin,
JDK17: C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot.
Репозиторий содержит много прежних незакоммиченных изменений: не сбрасывать их.
В этом этапе web/server и таблицы WRPF не менялись, новые зависимости не нужны.

Сохранены решения пользователя:
- Название Gym-Beam, логотип со стаканом, package=com.dirg9876.gymtracker,
  slug/scheme=gym-tracker-mobile, version1.0.0/versionCode1.
- EAS projectId=dabd3128-415f-4a2f-8c73-3b0a52585149, owner=dirg9508.
- Виды тренировок / История / Главная / Статистика / Уровни; Главная посередине,
  увеличенная и оранжевая, открывается при запуске. Start/Continue на Главной.
- Виды пустые по умолчанию, без встроенных программ. WRPF без экипировки,
  с допинг-контролем; аксессуары условные. Штанга минимум20кг, планка в секундах.

Реализовано и параметры:
1. Создание вида до тренировки через /programs/new: название, выбор/удаление/
   перестановка упражнений, отдельные веса/повторы/секунды и типы подходов.
   По умолчанию3 рабочих подхода, диапазон8-12; явное сохранение, защита выхода
   с несохранёнными изменениями через экран, Home и Android Back.
2. Необязательные setType=warmup|working, rir=0..5|null (UI5+),
   technique=good|breakdown|null. Старые подходы остаются «тип не указан».
   У разминки и планки нет RIR. Дополнительная разминка не выполняет рабочий план.
3. Подсказка рабочего веса отделена от спортивной цели и не меняет вес сама.
   Берётся последняя завершённая тренировка: нужно ровно запланированное число
   рабочих подходов с одинаковым весом, все повторы >= верхней границы, техника
   good и RIR >= целевого. Иначе нет предложения повысить нагрузку.
   Целевой RIR по умолчанию2, шаг гантелей1кг, остальных весовых упражнений2,5кг;
   шаг настраивается0,25..20кг, целевой RIR0..5. Без плана нет автопрогрессии.
4. Отдых автоматически после подхода, ручной запуск/пауза/продление/сброс;
   default120с, настройка30..900с. Планка: countdown и перенос измеренных секунд
   в форму без автоматической записи подхода. Абсолютный deadline и пауза
   хранятся в прогрессе, переживают background/process death. Завершение
   тренировки удаляет таймер. Тики только на focused экране в AppState active.
5. Последние7 локальных календарных дней: рабочие подходы и уникальные дни
   тренировки по основной мышечной группе. Разминки и старые неизвестные
   подходы отдельно, только завершённые тренировки. Нет общего тоннажа/серии.
6. WRPF подписан как сравнение тренировочного результата с нормативом,
   а не официально присвоенный разряд. e1RM не засчитывает официальный норматив;
   условные цели аксессуаров отделены. Таблицы/пороговая логика не изменены.

Созданные файлы (пути относительно mobile):
- lib/trainingCoach.ts: схемы, progression/timers/weeklyWork.
- lib/coachApi.ts: типизированный адаптер mobile-only offline endpoints.
- components/Segmented.tsx, TrainingTimer.tsx, WeeklyTraining.tsx.
- scripts/coach.test.mjs (10тестов), coach-backup-validation.test.mjs (1тест),
  create-coach-qa.mjs (отдельная mock-копия), android-ui-helpers.ps1 (ADB/SAF QA).

Основные изменённые файлы:
- lib/offlineApi.ts: coach fields, working-load/weekly/timer endpoints,
  progression settings, защита упражнений, используемых таймером.
- lib/progressBackup.ts: экспорт v4, импорт1/2/3/4, строгая валидация новых полей
  и ссылок таймера, прежний transactional restore/rollback сохранён.
- lib/workoutTemplates.ts, workoutMeasurement.ts: контекст подхода, выполнение
  плана, сохранение типа без копирования фактического RIR/техники в будущий план.
- components/SavedWorkoutPlan.tsx, app/programs/[id].tsx, (tabs)/programs.tsx,
  app/_layout.tsx, ExercisePicker.tsx, ScreenHeader.tsx, Stepper.tsx: редактор.
- app/workout/[id]/index.tsx: поля подходов, подсказки, таймер, подтверждение
  окончания неполного плана, защита одновременных add/delete/finish.
- app/(tabs)/stats.tsx, history/[id].tsx, SetCard.tsx, StandardsPanel.tsx,
  app/(tabs)/levels.tsx: статистика, контекст истории, логичные подписи целей.
- app/backup.tsx: понятное сообщение о известной ошибке SDK file picker.
- scripts/testHarness.mjs, offline-api.test.mjs, FITNESS_REVIEW.md, CHECKPOINT.md.

Проверки и найденные/исправленные дефекты:
- 57/57 unit tests PASS, workspace typecheck PASS, повторный mobile typecheck
  PASS; scoped git diff --check PASS (только предупреждения CRLF).
- test:journey PASS:624тренировки/8970подходов/208недель, level12, findings[].
  Это сценарий средней прогрессии, не утверждение, что средний человек дошёл
  до МСМК; прежние проверки максимального уровня80 сохранены.
- Native Android36: создание/порядок/редактирование вида; warmup20x10 отдельно
  от3x40x12/RIR2/good; следующий рабочий вес42,5 отдельно от WRPF82,5;
  автоотдых, pause/resume, paused0:39 после process death, работающий deadline
  после relaunch; планка передала5секунд, подход не записался сам; история.
- Недельные числа проверены на fixture: грудь3working/1day/1warmup/3old,
  пресс1working/1day; после второй native тренировки6/2warmup/3old и2working.
- Найден и исправлен сброс диапазона8-12 до8-8 при повторном открытии редактора.
  Очистка числового поля больше не записывает NaN/0 в диапазон прогрессии.
- Исправлены учёт лишней разминки, защита несохранённого выхода, ссылки таймера
  при удалении упражнения; проверен отказ от повреждённых backup без смены данных.
- Интерфейс редактора/статистики проверен визуально на360dp и исходном экране.
- Полный repack-apk.ps1 успешно повторён на финальном коде: Hermes, native
  resource IDs, zipalign/signature verify PASS; install-r PASS. Финальный logcat
  без ReactNativeJS/AndroidRuntime ошибок. Нативный код/manifest не менялись.

Пользовательский прогресс СОХРАНЁН И ВОССТАНОВЛЕН, QA-копии в приложении НЕТ:
- До установки: artifacts/apk/verified/before-coach-v3.json (11388bytes), Android
  Documents/GymTracker/gym-tracker-2026-10-12T21-54-58-236Z.json.
- После первой установки: after-coach-install-v4.json; deepStrictEqual state
  и plans с исходным v3 PASS. Версия envelope стала4, данные не мигрировали.
- Native QA проводился на отдельной coach-qa-v4.json. После QA исходник
  импортирован обратно, затем ещё раз, чтобы recovery snapshot тоже был исходным.
- После последней сборки/install-r: after-coach-final-v4.json (11388bytes),
  Android Documents/GymTracker/gym-tracker-2026-10-12T22-24-04-611Z.json.
  Финальный deepStrictEqual state+plans с before-coach-v3.json PASS.
- В приложении1completed(id1),1пустаяactive(id2),3sets,31exercises,
  0customPrograms/0plans, nextWorkoutId3. НЕ завершать/удалять active id2 для QA.
- /sdcard/Download/coach-original.json сохранён; наш coach-qa.json удалён.
  Время в именах backup UTC, дата работы по Москве13октября2026.
- Screenshots в artifacts/apk/verified/: coach-final-home.png,
  coach-editor-range-fixed.png, coach-editor-360dp.png, coach-weekly-360dp.png,
  coach-plank-transferred.png, coach-timer-paused-2.png, coach-timer-restored.png.

APK этапа шести улучшений (исторический, заменён APK выше):
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
132002687bytes; SHA256
62E21BE4BBA1B9BB2D7DD66945DE79CBDF1A21A6E08DFFC6F9C6D0E2F698D779
Подписан локальным DEBUG keystore, не исходным EAS release key. install-r
поверх прежнего debug APK проверен. Поверх исходного EAS APK на телефоне
не установится без его ключа: НЕ удалять приложение без внешнего backup.
Полная команда сборки и особенности Apktool/aapt2/resources.arsc описаны ниже.

Состояние среды и ограничения:
- Эмулятор запущен: AVD gymbeam_test, emulator-5554, Android36x86_64,
  ANDROID_AVD_HOME=C:\gymbeam\artifacts\android-avd,1080x2400/density420,
  оставлен на Главной. ADB: artifacts/android-sdk/platform-tools/adb.exe.
- Таймер восстанавливает отсчёт, но вибрация завершения только в foreground;
  OS background alarms/notifications не реализованы.
- Существующая native ошибка Expo FileSystem ActivityResultLauncher при
  пересоздании Activity (например, смене плотности экрана) мешает выбору файла.
  Полный перезапуск приложения восстанавливает picker; это проверено импортом.
  JS показывает понятное сообщение, native SDK дефект не исправлен repack.
- iOS/EAS cloud build не запускались. Дополнительные идеи FITNESS_REVIEW.md
  о целях профиля, конкретном оборудовании и спортивных протоколах не входили
  в шесть согласованных пунктов и пока не реализованы.

Следующий шаг: текущий запрос завершён; перед публикацией собрать полноценный
EAS release с исходным ключом подписи и проверить обновление на телефоне.
При новых изменениях сначала делать свежий backup; тестировать на копии,
возвращать исходные state/plans и обновлять этот checkpoint.

## История: системный брендинг Gym-Beam и анализ тренера

На предыдущем этапе пользователь попросил заменить иконку приложения на
стакан из репозитория, системное имя на Gym-Beam, проанализировать приложение
с позиции фитнес-тренера и дать советы. Изменён только брендинг; рекомендации
по тренировкам НЕ внедрялись автоматически. Навигация прошлого этапа сохранена:
Виды тренировок / История / Главная / Статистика / Уровни, Главная в центре.

Решения и изменённые/созданные файлы:
- artifacts/gym-tracker-mobile/app.json: name=Gym-Beam, icon/splash/favicon ->
  assets/images/gymbeam-icon.png; adaptiveIcon -> gymbeam-adaptive.png, фон чёрный.
  НЕ менялись package=com.dirg9876.gymtracker, slug/scheme=gym-tracker-mobile,
  EAS projectId=dabd3128-415f-4a2f-8c73-3b0a52585149, owner=dirg9508,
  version=1.0.0/versionCode=1.
- assets/images/gymbeam-icon.png: производная иконка со стаканом, штангой и
  молнией без мелкой надписи, создана imagegen из существующего логотипа.
  Исходник artifacts/gym-tracker/src/assets/gymbeam-logo.png и Home не изменены.
- scripts/prepare-brand-assets.cjs: повторяемая генерация gymbeam-adaptive.png,
  1024x1024, исходник768 по центру с полями128. Использует установленный
  jimp-compact через зависимости Expo; новых package dependencies нет.
  Круглую Android-маску проверили визуально: стакан и штанга различимы.
- scripts/brand-android-resources.cjs: структурный Expo XML API меняет app_name
  и iconBackground; Expo prebuild helper генерирует launcher/round/foreground
  для5 плотностей. Splash PNG заменены при сохранении исходных размеров.
  Всего22 icon/splash ресурса. AndroidManifest.xml и DEX не переписываются.
- scripts/brand-android-apk.ps1: Apktool decode/compile, замена полного res/
  и resources.arsc, проверка неизменности native resource IDs. Это необходимо:
  исходный EAS APK использует сокращённые пути ресурсов, Apktool восстанавливает
  нормальные имена. Нельзя подложить только изменённые22 картинки.
- scripts/repack-apk.ps1: native branding перед zipalign/sign, параметр ApktoolJar.
  Старые JS/Hermes и raw Home asset правила сохранены.
- scripts/branding.test.mjs:2 новых теста имени, идентичности приложения,
  привязки PNG, геометрии и полей Android-иконки.
- FITNESS_REVIEW.md: полный анализ8 приоритетов с источниками ACSM2026 и
  Singer2024. Первый шаг рекомендаций: редактор видов до первой тренировки,
  разминка/рабочие подходы, необязательный RIR, таймеры; затем двойная прогрессия
  и недельная статистика. Отличать тренировочный результат от присвоения разряда.
- CHECKPOINT.md: этот самодостаточный checkpoint. Web/server не менялись.

Инструменты и особенности сборки:
- Apktool2.12.1: artifacts/apk/tools/apktool_2.12.1.jar,
  https://github.com/iBotPeaches/Apktool/releases/download/v2.12.1/apktool_2.12.1.jar
  SHA256 66cf4524a4a45a7f56567d08b2c9b6ec237bcdd78cee69fd4a59c8a0243aeafa
  проверен по digest официального GitHub release API. Jar ignored в git.
- Использовать bundled patched aapt2 из Apktool: Android SDK aapt2 отвергает
  исходные generated $avd... имена. Не добавлять --aapt с SDK бинарником.
- WorkDirectory приводится к абсолютному пути ДО вычисления ZIP путей.
- .NET Framework NoCompression всё равно создаёт DEFLATE(method8).
  Android R+ отвергает сжатый resources.arsc. Скрипт вызывает JDK jar
  --update --file <apk> --no-compress -C <compiled> resources.arsc, затем
  zipalign/sign. Таблица в итоговом APK STORED,1366844bytes.
- После этих исправлений ПОЛНЫЙ repack-apk.ps1 повторён успешно без ручных
  исправлений. Последний native decoded build:
  artifacts/apk/verified/branding-<guid>/decoded/build/apk.

Проверки итогового результата:
-46/46 unit tests PASS; whole workspace typecheck PASS, затем повторный mobile
  typecheck PASS; новые CJS node --check PASS; scoped git diff --check PASS.
- Hermes bundle/Apktool/native resource IDs/zipalign/apksigner verify PASS.
-96 файлов AndroidManifest.xml + classes*.dex + lib/**/*.so побайтно совпадают
  с исходным EAS APK. Нативная логика и идентификаторы ресурсов сохранены.
- Повторная установка итогового APK через adb install -r PASS, без удаления app.
  aapt2 badging: application-label=Gym-Beam, package прежний.
- Native Android36 emulator-5554: меню приложений показывает новый стакан и
  Gym-Beam; холодный запуск открывает Home, исходный большой логотип виден,
  пять иконок сохранены, Continue открывает пользовательскую active id2,
  Уровни открываются с прежними названиями. Logcat без JS/AndroidRuntime ошибок.
  Splash ресурсы проверены при генерации; отдельный кадр короткого splash
  при холодном запуске не фиксировали. iOS сборку не запускали.
- Screenshots artifacts/apk/verified/launcher-brand-home.png,
  launcher-brand-drawer.png, launcher-brand-levels.png.
- До изменений и ПОСЛЕ последней повторной сборки/установки сделан полный
  backup v3 (оба11388bytes): artifacts/apk/verified/before-launcher-brand-v3.json
  и after-launcher-brand-v3.json. assert.deepStrictEqual по state и plans PASS.
  Android Documents/GymTracker/gym-tracker-2026-10-12T20-56-47-846Z.json и
  gym-tracker-2026-10-12T21-19-26-604Z.json (время UTC в названиях).
  По-прежнему1completed +1active(id2),3sets,31exercises,0customPrograms,0plans.
  Import не выполнялся; active id2 НЕ удалять/НЕ завершать для QA.
- Эмулятор запущен в фоне: AVD gymbeam_test, ANDROID_AVD_HOME=
  C:\gymbeam\artifacts\android-avd,1080x2400/density420, оставлен на Home.

APK предыдущего этапа брендинга (исторический, заменён итоговым APK выше):
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
131982207bytes; SHA256
913C689C40B7188CB973AE303827FAEF30CD727429A5194D2D67FBF42F7845E3
Локальная DEBUG подпись, НЕ исходный EAS release key. Поверх предыдущего
локального debug APK устанавливается. Поверх исходного EAS APK на телефоне
не установится без его ключа; НЕ удалять исходное приложение без внешнего backup.

Как повторить сборку в PowerShell из C:\gymbeam\artifacts\gym-tracker-mobile:
```powershell
$env:Path='C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot'
node scripts/prepare-brand-assets.cjs
pnpm test
pnpm typecheck
.\scripts\repack-apk.ps1 -BaseApk 'C:\gymbeam\artifacts\apk\gym-tracker-expo-link.apk' -SdkRoot 'C:\gymbeam\artifacts\android-sdk' -Keystore 'C:\gymbeam\artifacts\apk\debug.keystore' -OutputDirectory 'C:\gymbeam\artifacts\apk\verified'
```

Происхождение производной PNG:
imagegen source=C:\gymbeam\artifacts\gym-tracker\src\assets\gymbeam-logo.png;
output=C:\Users\Dirg9\.codex\generated_images\01a0111b-d08e-7400-873c-37ce9649d0ad\exec-912c763d-a018-4d1e-b22e-681481761ba6.png;
transparent_background=false. Prompt:
```
Edit the supplied Gym-Beam logo into an Android launcher icon. Use the exact existing pixel-art orange drink-glass character with ice, muscular arms holding a barbell, and orange lightning bolt. Preserve the character identity, face, pose, proportions, pixel-art style and colors as closely as possible. Remove all lettering and the bottom wordmark/slogan from this icon ONLY. Center the complete glass/barbell/lightning composition on a plain solid black square canvas. Allow generous black margin around all edges so the core character fits inside the central 66% safe area of an adaptive Android icon; no pre-rounded corners, no frame, no gradients, no extra objects. This is a derivative launcher icon for the same brand, not a logo redesign. Square high resolution PNG.
```

Нерешённое и следующий шаг:
- Для штатного обновления телефона собрать EAS APK с исходной release подписью,
  используя обновлённый app.json/assets. В этой задаче EAS build не запускали.
- Тренерские предложения описаны, не реализованы. Следующий продуктовый этап
  согласовать с пользователем, начиная с редактора видов/типа подхода/RIR/таймеров.
- Данные/нормативы/навигацию прежних этапов не переделывать без нового запроса.
  Worktree содержит много прежних изменений; не reset/revert чужую работу.

## Текущий этап завершён: пять вкладок и запуск с Главной

Актуальный запрос пользователя выполнен. Он ЗАМЕНЯЕТ прежние решения о скрытой
Главной, трёх вкладках и статистике внутри Истории.

Цель и принятые решения:
- Пять вкладок в порядке: Виды тренировок / История / Главная / Статистика / Уровни.
- Главная открывается при запуске (initialRouteName=index), третья, точно по
  центру. Цветная круглая иконка44dp с home28dp, остальные иконки22dp.
  Home активная заливка primary, неактивная primarySoft + цветная рамка.
- На Главной сохранены стакан, бело-оранжевый GYM-BEAM и резервная копия;
  Start/Continue под логотипом. Loading/error/retry, cache invalidation и guard
  активной тренировки сохранены. Continue повторно открывает пользовательскую id2.
- Виды тренировок по умолчанию пустые. GET /api/programs выдаёт ТОЛЬКО
  customPrograms. Пользовательские сохранённые шаблоны НЕ удаляются.
  Встроенные определения оставлены только для legacy direct links и старых планов.
- Видами становятся ранее сохранённые пользователем шаблоны завершённых
  тренировок. Управление упражнениями доступно из этого раздела, стартовой
  кнопки там больше нет.
- Статистика снова самостоятельная вкладка. Кнопка из Истории убрана.
  URL /stats сохранён. Стрелка назад из активной тренировки возвращает на Home
  через returnToBrand; аппаратный Back из Stats также возвращает на Home.
- Панель80dp + safe bottom. Обычные подписи10px/lineHeight12/height24, Home12px,
  «Виды тренировок» в две строки. На360dp первоначально обрезались длинные
  подписи и низ второй строки: учтён внутренний padding5 у React Navigation,
  убраны лишние внешние4+8dp. Повторная сборка и native QA подтвердили исправление.
- Логотип не редактировался. Repack/EAS asset handling описан в предыдущем этапе.

Изменённые файлы в artifacts/gym-tracker-mobile:
- app/(tabs)/_layout.tsx: пять вкладок, видимый index по центру.
- app/(tabs)/index.tsx: перенесён Start/Continue, бренд адаптируется к месту.
- app/(tabs)/programs.tsx: WorkoutTypesScreen, пустой список/custom types/editor.
- app/stats.tsx перемещён обратно в app/(tabs)/stats.tsx, удалён вложенный header.
- app/_layout.tsx: удалена root Stack регистрация stats.
- app/(tabs)/history.tsx: нет кнопки Stats, исправлены отступы под tab header.
- app/workout/[id]/index.tsx: back -> returnToBrand.
- lib/navigation.ts: только уточнён комментарий, обе команды сохранены.
- lib/offlineApi.ts: listPrograms только custom, никакой миграции/удаления данных.
- scripts/offline-api.test.mjs: новый тест пустого списка, пользовательского
  шаблона и его backup restore/delete; legacy weight test теперь проверяет
  явные8ID, поэтому не становится пустой проверкой после нового listPrograms.
- CHECKPOINT.md: текущий самодостаточный checkpoint. Новых зависимостей нет.

Проверки:
- 44/44 unit tests PASS; whole workspace typecheck PASS; после финальной правки
  панели повторно mobile typecheck PASS; scoped git diff --check PASS.
- APK Hermes/zipalign/apksigner verify PASS, install -r PASS.
- Native QA Android36 emulator-5554, 1080x2400/density420 и720x1280/density320:
  холодный запуск Home, пять иконок, Home по центру/цветная/крупнее;
  пустые виды без пресетов/Start, доступ к управлению упражнениями;
  История без отдельной кнопки Stats; самостоятельная Stats с725кг/30повторами;
  Уровни с реальными названиями; Continue открывает активную id2.
- Стрелка назад из id2 -> Home; следующий Android Back выходит из приложения,
  не открывает старую страницу. Deep link /stats работает после переноса, Back
  из Stats -> Home. Ветка создания новой тренировки покрыта API tests; в native
  QA пользовательскую активную тренировку не удаляли и не завершали.
- Все подписи/кнопка/логотип проверены по screenshots на360dp: нет обрезки или
  пересечений. Финальный logcat ReactNativeJS/AndroidRuntime без ошибок.
- Свежие полные backup v3, оба11388bytes:
  artifacts/apk/verified/before-five-tabs-v3.json
  Android Documents/GymTracker/gym-tracker-2026-10-11T20-12-07-901Z.json;
  artifacts/apk/verified/after-five-tabs-v3.json
  Android Documents/GymTracker/gym-tracker-2026-10-11T20-21-20-021Z.json.
  assert.deepStrictEqual(after.state,before.state) и plans PASS.
  По-прежнему1completed +1active(id2),3sets,31exercises,0customPrograms,0plans.
  Import не выполнялся, пользовательские данные не изменяли.
- Эмулятор восстановлен1080x2400/density420, font_scale1,
  show_ime_with_hard_keyboard=0, оставлен на Главной. Shell sessions завершены.

Итоговый НОВЫЙ APK:
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
SHA256 E08BC6AE8203D21F5A141BF6E29117D4E50616CEB05BDB9CF6C5A678CD6A708C
131523555bytes. Локальная DEBUG подпись, НЕ исходный EAS release signing key.
Обновляется поверх предыдущего локального debug APK. Поверх оригинального EAS
APK без его ключа не установится. Не удалять оригинал на телефоне без внешнего backup.

Доказательства artifacts/apk/verified:
five-tabs-home-final.png/xml, five-tabs-small-home.png/xml,
five-tabs-types.png/xml, five-tabs-history.png/xml, five-tabs-stats.png/xml,
five-tabs-levels.png/xml, five-tabs-active.png/xml,
five-tabs-small-types/history/stats/levels/active.png и соответствующие XML.
Большие screenshots без -final сняты на первой сборке, до исправления подписей;
small и home-final относятся к финальному APK.

Нерешённые ограничения и следующий шаг:
- Требуемые изменения локально завершены. Практический следующий шаг для телефона:
  EAS release-сборка с исходной подписью (не запускалась), чтобы обновиться без
  удаления приложения. Все прежние ограничения перечислены в конце checkpoint.
- Отдельный web/server не переводился на custom-only список; mobile offline.
- Для новой задачи сначала экспортировать свежие данные, читать git diff и
  работать с текущим dirty worktree; не откатывать чужие изменения.

## Предыдущий этап: Gym-Beam, оптимизация и дизайн

Последние запросы пользователя выполнены в мобильном приложении:
- Стартовый экран вместо прежнего dashboard: стакан со штангой из репозитория,
  отдельно стилизованный бело-оранжевый GYM-BEAM. Только три видимых вкладки:
  Тренировки / История / Уровни. Главная как вкладка отсутствует.
- app/(tabs)/index.tsx остаётся скрытым маршрутом (href:null), открывается при
  запуске. Там нет Start/Continue; иконка резервной копии сохранена.
- Начать/Продолжить тренировку перенесены в Тренировки. Существующая активная
  тренировка открывается повторно, ожидание/ошибки обработаны. Мои шаблоны
  отделены от встроенных программ, управление упражнениями сохранено.
- Общий ScreenHeader для трёх вкладок и вложенных разделов, кнопка home с
  accessibilityLabel «На стартовый экран Gym-Beam». Из активной тренировки
  стрелка назад возвращает в Тренировки; из отчёта есть «К Gym-Beam».
- Новый lib/navigation.ts: returnToBrand вызывает dismissTo('/(tabs)') и затем
  navigate('/(tabs)'). Первый закрывает вложенные экраны, второй явно выбирает
  скрытый index. Один dismissTo оставлял текущую вкладку, один navigate
  накапливал экраны и возвращал старый раздел по Android Back. Оба дефекта
  выявлены native QA и исправлены. Helper также используется после импорта.
- Уровни: FlatList вместо ScrollView с 81 заранее смонтированной строкой,
  initialNumToRender/maxToRenderPerBatch8, windowSize5. Прокрутка до80 проверена.
- Card/Button/Stepper/ExercisePicker/SetCard унифицированы по radius6..8,
  умеренным отступам/теням. Ввод56dp, +/-52dp, delete44dp, состояния границ
  веса видны. Accessibility роли/подписи/selected/busy добавлены. Чипы дробного
  веса используют русское formatNumber. Зелёные выполненные подходы сохранены.
- Подсказка ближайшего разряда теперь сразу под выбранным упражнением:
  на360dp видна до ввода веса, не скрывается ниже повторений.
- BarChart больше не накладывает текст на полосы; подпись и значение над полосой.
- Во всех25 местах точечный импорт Feather. В root _layout точечно подключены
  четыре Inter вместо barrel import всех начертаний. Обычный Metro export:
  шрифты37 ->5 (Inter4 +Feather), fontBytes10294436 ->1428600,
  JS3682176 ->3214855 bytes, примерно467KB меньше. Это измерение обычного export
  до последних небольших UI правок; repack APK сохраняет старые native ресурсы,
  поэтому НЕ утверждать, что локальный APK уменьшился на эти8.87MB.

Логотип и параметры упаковки:
- Исходник artifacts/gym-tracker/src/assets/gymbeam-logo.png,1254x1254,1315109bytes.
  Его wordmark имеет почти нулевой alpha: preview показывал RGB, Android его
  скрывал. Сам PNG не менялся. UI показывает верхние880/1254 со стаканом,
  отдельно Text GYM-BEAM. Размер изображения ограничен реальным доступным местом.
- Обычная EAS/Metro сборка использует require PNG из соседнего web проекта,
  normal Expo export проверен и содержит байт-в-байт исходный PNG.
- scripts/repack-apk.ps1 временно устанавливает EXPO_PUBLIC_GYM_REPACK_ASSETS=1,
  добавляет PNG как assets/branding/gymbeam-logo.png. Native экран использует
  file:///android_asset/branding/gymbeam-logo.png. Env после сборки восстановлен.
  Хэш вложенного PNG совпал с исходником. Все остальные native assets, включая
  Feather, по-прежнему разрешаются scripts/native-asset-plugin.cjs.
- Промежуточный normal export до оптимизации: artifacts/apk/verified/before-brand-export.
  После оптимизации: artifacts/apk/verified/standard-brand. Новых зависимостей нет.

Проверки:
- 43/43 unit tests PASS; whole workspace typecheck PASS, после последних
  мобильных правок mobile typecheck повторно PASS; git diff --check PASS.
- APK Hermes/zipalign/apksigner verify PASS, install -r на emulator-5554 PASS.
- Native QA 1080x2400/density420 и720x1280/density320: бренд при холодном запуске,
  ровно три иконки вкладок, Start/Continue только в Тренировках; каталог,
  статистика, программа, история, результаты упражнения, активная тренировка,
  резервная копия возвращаются к бренду. Hardware Back после возврата из
  backup/stats/workout2/report1 выходит из приложения и НЕ открывает старый экран.
- Незавершённая пустая тренировка id2 повторно открывается, завершение заблокировано.
  Жим: минимум20кг, ввод22.5 отображается22,5; III82.5, остаток60кг. На360dp
  подсказка видна (native bounds114,556..654,594). Планка: секунды, условный
  ориентир, без поля кг/повторов. Никаких подходов в пользовательскую id2 не добавляли.
- Лестница до уровня80 «Атлас»/МСМК доступна после виртуализации.
- Свежий before-brand-v3.json и финальный after-brand-v3.json: assert.deepStrictEqual
  state и plans PASS. Не только счётчики, весь прогресс совпадает; import не нужен.
- Финальный logcat ReactNativeJS/AndroidRuntime пустой. 1080x2400/density420 и
  show_ime_with_hard_keyboard=0 восстановлены. Эмулятор оставлен на Gym-Beam.
  Выполняющихся shell-сессий нет.

Итоговый APK: C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
SHA256 DA5F5E9D837C1E697D0948AABC45044AF02E842039D10C5D874469581987DEB8
131523555bytes, локальная DEBUG подпись (не исходный EAS signing key).

Результаты QA/скриншоты в artifacts/apk/verified:
brand-launch-final.png/xml, brand-home-final.png, brand-history.png,
brand-levels.png, brand-stats.png, brand-small-home.png,
brand-small-workouts.png, brand-small-picker.png, brand-small-bench-final.png,
brand-small-plank-final.png, brand-levels-end.xml и brand-*.xml.
Некоторые ранние brand-* скриншоты относятся к промежуточным вариантам;
ориентироваться на *final и brand-launch-final.

Нерешённые ограничения: EAS release APK с исходной подписью не собирался;
обычный export проверяет JS/assets, но не заменяет production native build.
Web/server здесь не перерабатывались. Актуальность нормативов2026 не проверялась
повторно: см. раздел источников ниже. Функциональных блокеров последнего запроса нет.
Следующий шаг при продолжении: получить новый запрос или подготовить полноценный
EAS APK с исходным signing key для обновления телефона. Перед любым новым QA
экспортировать свежее состояние: пользователь мог внести новые тренировки.

## Предыдущий этап: навигация до бренд-экрана (историческая запись)


Последний запрос выполнен и проверен в установленном APK:
- Ровно четыре вкладки: Главная / Тренировки / История / Уровни, с иконками.
  Главная первая и по-прежнему увеличена, открывается при запуске.
- С Главной убраны «Серия» и «Общий тоннаж»; показатели отдельных тренировок
  и подробная статистика сохранены.
- Программы переименованы в Тренировки. Кнопка «Управление упражнениями» открывает
  вложенный экран каталога, отдельной вкладки Упражнения больше нет.
- История содержит список тренировок и кнопку «Статистика», открывающую отдельный
  экран со стрелкой назад. Возврат возвращает в Историю.
- app/(tabs)/stats.tsx перенесён в app/stats.tsx;
  app/(tabs)/exercises.tsx перенесён в app/exercises/index.tsx.
  Старые deep links /stats и /exercises работают; обновлены root Stack и typed routes.
- Новый components/ExerciseEditor.tsx: имя, группа, radio выбора оборудования,
  создание/редактирование своих упражнений. Встроенные названия/оборудование
  защищены, чтобы не ломать привязку к нормативам. Прогресс доступен из каталога.
- Offline PATCH расширен name/group. Переименование сохраняет ID и результаты;
  нельзя менять единицы/оборудование у упражнения с подходами/шаблонами/планами.
  Нельзя удалять упражнение с историей. Удаление свободного своего - с подтверждением.
  Эти расширения контракта mobile-only, generated UpdateExerciseInput не менялся.
- Исправлен сдвиг модального редактора при фокусе Android: KeyboardAvoidingView
  включён только на iOS, Android использует нативное изменение окна.
- 43/43 unit tests PASS, whole workspace typecheck PASS, native QA 1080x2400/420
  и 720x1280/320 PASS: вкладки, добавление/изменение/перезапуск/удаление упражнения,
  статистика/возврат, клавиатура (IME показан как плавающий toolbar), иконки.
- Свежий снимок перед QA before-navigation-v3.json восстановлен в конце.
  После этого сделан after-navigation-v3.json; Node assert.deepStrictEqual
  подтвердил полное равенство state и plans до/после QA, не только счётчиков.
- Эмулятор на Главной, 1080x2400/420 восстановлены, keyboard preference снова0.
  Ошибок ReactNativeJS/AndroidRuntime в проверенном logcat нет.
  Незавершённых shell-сессий нет. «Srskunk» пользователь подтвердил как опечатку.

## Цель и статус

Пользователь просил запустить Android APK в эмуляторе, найти/исправить ошибки
интерфейса и логики, добавить резервные копии всего прогресса и тест многолетних
тренировок. Последние уточнения: реальные разряды WRPF вместо процентов МСМК,
подсказка ближайшего разряда в уровнях/выборе упражнения/вводе веса, сохранение
выполненной тренировки как редактируемого шаблона; расчётные ориентиры для всех
остальных упражнений; зелёные выполненные нормативы и упражнения.

Все эти изменения реализованы, проверены и установлены в локальный Android APK.
Эмулятор оставлен работающим на стартовом Gym-Beam. Исходные пользовательские данные
восстановлены после QA, включая начатую пустую тренировку. Нет выполняющихся
shell-сессий. Ничего не закоммичено/не staged. Dirty worktree содержит много
предшествующих изменений web/server/generated/assets: НЕ откатывать и не включать
их в общий commit без разбора.

## Последние решения пользователя

- Основа: WRPF, без экипировки, с допинг-контролем.
- Использовать каждый реальный разряд III/II/I/КМС/МС/МСМК, НЕ проценты от МСМК.
- Официальные сравнения только для жима штанги лёжа, приседа и становой тяги.
  Приложение сравнивает тренировочные результаты, НЕ присваивает спортивное звание.
- Последнее уточнение разрешило аксессуарам расчётные ориентиры по похожему
  официальному движению и коэффициенту. Это НЕ официальные нормы WRPF.
- Пользователь явно подтвердил отдельные условные шкалы секунд для планки и
  повторов для собственного веса. Их не выдавать за доказанную эквивалентность WRPF.
- Названия/описания всех 81 уровней для обоих полов сохранить как в репозитории.
- Гриф 20 кг входит в вес штанги; планка измеряется временем.
- История открывает статистику по кнопке. По последнему запросу три вкладки;
  теперь только Тренировки / История / Уровни; скрытый стартовый Gym-Beam
  открывается при запуске и по home из любого раздела.
- Поддерживать самодостаточный CHECKPOINT.md для продолжения в другом чате.

## Пользовательские данные и резервные копии

Текущее восстановленное состояние emulator-5554:
- 1 завершённая тренировка id1: жим 20x10 + 22.5x10 + 30x10, 725 кг, 30 повторов.
- 1 начатая пустая тренировка id2, создана пользователем до последнего QA.
- 3 подхода, 31 упражнение, 0 своих шаблонов, 0 сохранённых активных планов.
- Профиль male, bodyWeightKg=null; явно обозначенный fallback 75 кг.
- Уровень 0: для следующего уровня выполнен жим, отсутствуют присед и тяга.
  История не потеряна; прежний уровень 1 относился к старой формуле.

Свежая исходная резервная копия перед последним этапом:
C:\gymbeam\artifacts\apk\verified\before-brand-v3.json
Android: /sdcard/Documents/GymTracker/gym-tracker-2026-10-11T19-39-58-185Z.json
11388 байт, envelope v3. Сохраняет и пользовательскую активную тренировку.
НЕ восстанавливать вместо неё старую v1 копию без активной тренировки!
Повторный экспорт после QA: artifacts/apk/verified/after-brand-v3.json,
Android /sdcard/Documents/GymTracker/gym-tracker-2026-10-11T20-00-09-124Z.json.
state/plans полностью совпадают с before-brand-v3.json (Node assertion PASS).
В последнем этапе restore не требовался: QA менял только несохранённый ввод и навигацию.
Старые before/after-navigation-v3.json и Android копии13:06/13:15 сохранены как история QA.

Старые внешние файлы оставлены:
- gym-tracker-2026-10-10T21-37-17-046Z.json: v1, 1 завершённая, без active.
- gym-tracker-2026-10-11T12-04-50-461Z.json: v2 QA fixture, жим + планка 60с,
  2 завершённых/4 подхода. Локально artifacts/apk/verified/timed-backup-v2.json.
- gym-tracker-2026-10-11T12-36-18-686Z.json: before-templates-v3.json, исходный
  снимок предыдущего этапа, тоже с пустой активной тренировкой.
- Отмена последнего импорта сейчас вернёт временные QA данные, не исходное состояние.
  Не нажимать её без необходимости.
Не очищать app data, не удалять приложение. При следующем QA снова экспортировать
актуальное состояние: пользователь может создать новые записи после checkpoint.

## Среда

Workspace C:\gymbeam; PowerShell; branch offline-apk-corrections.
Node 24.14 / pnpm 10.33:
C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin
Добавлять этот каталог в начало PATH каждой новой shell-команды.
JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot
Android SDK: C:\gymbeam\artifacts\android-sdk, build-tools 36.0.0.
ADB: artifacts/android-sdk/platform-tools/adb.exe
ANDROID_AVD_HOME=C:\gymbeam\artifacts\android-avd, AVD gymbeam_test.
Устройство emulator-5554, Android 36 x86_64, package com.dirg9876.gymtracker.
Восстановлены 1080x2400 / density420; show_ime_with_hard_keyboard=0 как до QA.
У эмулятора клавиатура обычно аппаратная: Android Back закрывает экран, если
экранная клавиатура не открыта. Для ввода ADB сначала tap, затем input text;
TextInput шаблона выделяет значение при фокусе. Не посылать Back вслепую.

Читать русские файлы Get-Content -Encoding UTF8, пути [id] через -LiteralPath.
Ручные правки через apply_patch. Не reset/checkout чужих изменений.
Mobile: artifacts/gym-tracker-mobile, Expo54 / RN0.81.5 / Expo Router6.
app/_layout.tsx устанавливает offlineApiFetch; Android полностью офлайн.
lib/api-client-react - generated hooks + custom fetch.
artifacts/api-server и artifacts/gym-tracker - отдельные backend/web.

## APK, сборка и запуск

Исходный APK пользователя:
https://expo.dev/artifacts/eas/mvNyCgyCDYIVOaWPTfEdxitdVN_J6iEQSGTp87bhhN0.apk
Локально artifacts/apk/gym-tracker-expo-link.apk.

Итоговый установленный APK:
C:\gymbeam\artifacts\apk\verified\gym-tracker-tested.apk
SHA256 DA5F5E9D837C1E697D0948AABC45044AF02E842039D10C5D874469581987DEB8

Это локальная тестовая debug-подпись, НЕ EAS release. На телефон с оригинальной
EAS-подписью не установится поверх старой версии. Для обычного обновления нужна
сборка с исходным signing key. Не предлагать удалять оригинал без внешнего backup.
Локальный эмулятор обновлялся install -r, данные сохранены.

Из корня, после установки PATH и JAVA_HOME:
& artifacts/gym-tracker-mobile/scripts/repack-apk.ps1 -BaseApk artifacts/apk/gym-tracker-expo-link.apk -SdkRoot artifacts/android-sdk -Keystore artifacts/apk/debug.keystore -OutputDirectory artifacts/apk/verified
& artifacts/android-sdk/platform-tools/adb.exe -s emulator-5554 install -r artifacts/apk/verified/gym-tracker-tested.apk

Keystore artifacts/apk/debug.keystore; alias androiddebugkey / password android.
repack-apk.ps1: aapt2 resource map, Expo export:embed/Hermes, bundle replacement,
zipalign, sign, verify. Native модули исходного APK переиспользуются.
expo-file-system19.0.21 уже был в исходном APK.
scripts/native-asset-plugin.cjs отображает имена Windows/pnpm assets в native
ресурсы APK, включая Feather. Без этого иконки исчезают.
Старые APK вне verified не являются финальным результатом.

Deep links (adb shell am start -a android.intent.action.VIEW -d ... package):
gym-tracker-mobile://levels
gym-tracker-mobile://backup
gym-tracker-mobile://exercises/30
gym-tracker-mobile://programs/1
gym-tracker-mobile://history/1
gym-tracker-mobile://workout/2
Сейчас шаблона id1 нет: он был временным QA и убран восстановлением backup.

## Нормативы и уровни

lib/level-data/src/index.ts: исходные 81 male/female названия и описания.
lib/level-data/src/strength.ts: реальные таблицы WRPF по полу/весовой категории,
включая мужскую140+ и женскую90+, без интерполяции между категориями.
lib/level-data/SOURCES.md: происхождение данных, коэффициенты, шкалы, ограничения.

Глобальная игровая прогрессия по минимуму результатов трёх обязательных движений.
III=уровень14, II=27, I=40, КМС=54, МС=67, МСМК=80; уровень1=20кг в каждом.
Промежуточные ступени соединяют соседние разряды в кг с округлением вверх2.5.
Результат - реально записанный вес завершённого подхода, НЕ расчётный1RM.
Уровни не растут от тоннажа/повторов/accessories, не зависят от favorite/isMain,
не падают от перерыва/повторного GET. Изменение профиля/удаление истории меняет их.
Custom-клоны с названием обязательного движения не засчитываются.

Мужчины75: III жим82.5 / присед112.5 / тяга127.5;
МСМК155 / 222.5 / 237.5. Женщины60 МСМК77.5 / 130 / 150.
Levels показывает ближайший следующий разряд в каждой дисциплине, а не вечный МСМК.
Бессмысленная подпись «Без разряда · все три дисциплины» удалена.
AthleteProfile.tsx: пол/вес20..500, валидация, invalidation зависимых данных.
Незаданный вес явно отмечен.

Источники, проверенные в предыдущем этапе:
https://wrpf.pro/razryadnye-normativy-wrpf-wepf-waf-wsf/
https://wsf-federation.ru/files/Normativy_WRPF_2019.pdf (жим10-11, тяга15-16)
https://frs24.ru/st/prisedaniya-so-shtangoj-normativ/ (присед, пометка2025).
Последний OneDrive/viewer федерации вернул404; актуальность редакции2026 НЕ
подтверждена. Присед - вторичная транскрипция, МСМК сверен с прежним репозиторием.
Даты источников показаны в приложении. scripts/fetch-wrpf.mjs и
artifacts/apk/norm-sources сохраняют предыдущую попытку проверки.

## Расчётные ориентиры всех упражнений

Новый mobile lib/exerciseStandards.ts:
ExerciseStandard {official,unit:kg|reps|seconds,description,entries:[rank,target]}.
RankedExercise расширяет Exercise стандартом и rankBest - лучший завершённый подход.
Только три основных встроенных штанговых движения official=true.
Коэффициенты перенесены из прежнего server sport-norms.ts, применены к КАЖДОМУ
реальному рангу, не процентам МСМК. Например жим гантелей=.28 жима (одна гантель),
наклонный жим=.85 жима, румынская=.75 тяги, жим ногами=1.8 приседа.
Полный набор в exerciseStandards.ts / SOURCES.md; округление вверх2.5,
минимум штанги20, остальных весовых2.5. Небольшие соседние ориентиры могут совпасть
после округления под доступный шаг веса. Для неизвестного custom - коэффициент
по группе мышц, у гантелей половина. Это явно подписанная условная оценка;
не верифицированная спортивная эквивалентность, тренажёры различаются.

Планка: III/II/I/КМС/МС/МСМК =30/45/60/90/120/180секунд.
Собственный вес: база подтягиваний мужчины5/8/12/16/20/25,
женщины2/4/6/8/10/15 повторов; брусья×1.5, узкие отжимания×2,
скручивания×3, подъём ног×1.2; вверх до целого, за ОДИН подход.
Базовые шкалы условные, одобрены пользователем, НЕ нормативы WRPF.

standardProgress/formatStandard общие для UI; rankHint.ts использует ближайший
более высокий порог, при верхнем достигнутом нет выдуманного следующего ранга.
components/StandardsPanel.tsx: все шесть порогов, зелёные выполненные строки,
источник коэффициента/единиц, ближайшее оставшееся значение.
ExercisePicker: подсказки до выбора упражнения; активная тренировка - живая
подсказка под весом/секундами/повторами. Аксессуары явно расчётные.
app/exercises/[id].tsx: графики собственного веса по повторам, планки по секундам;
topSet определяется по соответствующей единице, не всегда по кг.
Legacy getExerciseNorms.mcKg/rankNorms для аксессуаров остаются null/[],
а новая standard содержит их условные ориентиры. Не класть секунды в поля кг.
Глобальный уровень по-прежнему только по трём официальным движениям.

## Сохранённые тренировки

Новый lib/workoutTemplates.ts:
setTargets - точный массив {weightKg,reps,durationSeconds?} каждого подхода;
TemplateExercise/TemplatePlan, Zod, validateTargets, templateFromWorkout,
withSetTargets и plannedSet. Валидация количества, единиц, штанги>=20.
Нельзя создавать шаблон незавершённой/пустой тренировки, угадывать секунды
старой записи планки. Отдельные веса каждого подхода сохраняются.

components/SaveWorkoutTemplate.tsx на отчёте и в истории.
components/SavedWorkoutPlan.tsx: название, веса, повторы/секунды, добавить/удалить
подход (минимум1), сохранить изменения, повторить, удалить шаблон.
Старт блокируется при несохранённых/неверных изменениях.
app/programs/[id].tsx использует редактор для сохранённых тренировок;
свои шаблоны идут первыми в списке программ.

offlineApi.ts принимает programId при createWorkout, атомарно сохраняет НОВУЮ
ПУСТУЮ тренировку и snapshot плана через общий durable journal.
Существующая active и её план не перезаписываются. План не помечает подходы
выполненными. После добавления сета подставляется следующий индивидуальный target,
в том числе внутри того же упражнения. Можно вручную изменить вес/повторы.
Редактирование/удаление шаблона не меняет исходную историю или уже начатый план.
Удаление упражнения, используемого шаблоном/планом, отклоняется409 вместо
повреждения связей backup.
Прямая ссылка на завершённый workout теперь ведёт к history, не форме добавления.
Finish по-прежнему открывает отчёт (проверено после исправления).

## Резервные копии и единицы

lib/progressStorage.ts: общая очередь API/планов/backup, durable rollback journal.
lib/progressBackup.ts: envelope v3, импорт v1/v2/v3; state.version=1.
SHA256, Zod, уникальность/связи ID, один active, лимит25МБ, setTargets включены.
Весь offline прогресс: профиль, упражнения, тренировки, подходы, программы,
активные планы, счётчики/уровень. Предыдущий валидный снимок хранится для отмены.
Сбой частичной записи откатывается, journal восстанавливается после перезапуска.
app/backup.tsx: внешний JSON через системные pickers, проверка после записи,
preview/подтверждение импорта/отмена. Посторонние AsyncStorage keys не удаляются.

lib/workoutMeasurement.ts:
- штанга>=20кг включая гриф; одна гантель; собственный вес - дополнительный вес.
- Планка/боковая планка: durationSeconds целое1..86400, weightKg=0/reps=0.
- Старые неверные записи не переписываются и не получают выдуманного времени.
- Время не попадает в тоннаж/повторы; календарь учитывает любые подходы.
- Старые generic планы используют repsMin/repsMax как секунды для планки30..60.
Новые template targets имеют явное durationSeconds.
Новые расширения контрактов mobile-only; generated общий API не менялся для них.

## Другие изменения интерфейса

Tabs: Тренировки / История / Уровни. Скрытый index - стартовый бренд Gym-Beam,
доступный по home из разделов; History открывает отдельный экран Статистика.
Каталог упражнений открывается кнопкой управления из Тренировок, не из tab bar.
История подгружает записи после первых50, active открывается для продолжения.
Feather preload/native resource mapping исправляют пропавшие иконки.
success #62C995: выполненные нормы, подходы, завершённые по плану упражнения
и счётчик подходов, success toast/отчёт. Неоконченный план не помечается выполненным.
Длинные названия/подсказки переносятся; footer не накладывается на scroll content.
Подписи тоннажа/рекордов/завершённых тренировок и дат уточнены.
Параллельные сохранения не теряют подходы; неверные числовые значения отклоняются.

## Проверки и воспроизведение

После установки Node PATH, из корня:
pnpm --filter @workspace/gym-tracker-mobile test
pnpm --filter @workspace/gym-tracker-mobile test:journey
pnpm run typecheck

Итоги:
- 43/43 Node tests PASS: все81 названия обоих полов, точные ranks/categories,
  единицы/20кг/планка, concurrency, backup v1/v2/v3, atomic plan start, индивидуальные
  targets, независимость истории, неправильный checksum/связи/targets, best-set
  по повторам/времени, все31 упражнение x2пола x5весов.
  Четыре последних теста: безопасное редактирование custom, защита встроенных
  нормативных названий, защита истории/единиц и ссылок шаблонов/активных планов.
- Whole workspace typecheck PASS после последних правок.
- Scoped git diff --check mobile/shared/checkpoint PASS, только CRLF warnings.
  Общий diff --check находит старые trailing spaces в web ExercisePicker.tsx;
  несвязанные правки не трогались.
- Journey PASS:624 тренировок,8970 подходов,4 617 835кг,87секунд, findings=[].
  Прогон предыдущего этапа норм/шаблонов; после изменений навигации/редактора
  повторены unit/typecheck/native QA, многолетняя симуляция повторно не запускалась.
  208 недель,3раза/неделю,5упражнений,3x8..10,шаг2.5,замедление после24недель,
  каждая8-я неделя разгрузочная,два14-дневных перерыва.
  Это тестовый сценарий, не обещание физиологического результата.
- Финал среднестатистического fixture уровень12 (присед100<III112.5);
  отдельный elite fixture достигает80, недобор0.01кг в любой дисциплине запрещает80.
- Каждые30 тренировок backup round-trip, проверка сумм/стабильности после каждой.
- scripts/simulate-progression.mjs, scripts/testHarness.mjs, scripts/offline-api.test.mjs.
  Изолированная Node Map storage, не данные эмулятора.
- artifacts/apk/journey/progression-report.json итог;
  baseline-failure.json исходное падение уровня при повторном GET, устранено.

Предыдущий нативный QA нормативов/шаблонов (последний бренд-QA описан в начале):
- Из истории сохранены20x10/22.5x10/30x10; отредактированы до25x12/30x10,
  удаление/добавление подходов и перезапуск сохранили значения.
- Повтор стартует с0подходов/0кг; после25x12 подставляет30x10;
  ручной выбор32.5x10 даёт итог625кг/22повтора. Исходная история не изменяется.
- Второй повтор25x12+30x10=600кг;2/2 и упражнение отмечены зелёным.
- Планка60с: зелёные III/II/I, следующий ориентирКМС90с, осталось30с.
- Picker подсказки до выбора, аксессуары помечены ориентиром; Levels ближайшийIII,
  неМСМК. Нет бессмысленного «Без разряда · все три дисциплины».
- 360dp (720x1280 density320): шаблон, picker, активная подсказка, Levels без
  наложений. Полный1080x2400/420 восстановлен.
- Последний APK install-r; finished deep link -> history, finish -> report.
- Исходный v3 backup восстановлен через системный picker с preview:
 1completed +1active,3sets,725кг,0templates. Эмулятор на Главной.
- В проверенном logcat нет ReactNativeJS/AndroidRuntime ошибок.

Доказательства в artifacts/apk/verified:
nav-final-home.png/xml, nav-workouts.png, nav-workouts-small.png,
nav-history.png, nav-history-small.png, nav-stats.png, nav-stats-small.png,
nav-stats-back.xml, nav-editor-small.png, nav-editor-keyboard.png,
nav-edit-final.xml, nav-delete-confirm.xml, nav-deleted.xml,
nav-restore-preview.xml, before-navigation-v3.json, after-navigation-v3.json.
Доказательства предыдущего этапа норм/шаблонов:
saved-template.png, saved-template-edited.png, template-reloaded.xml,
template-repeat.png, completed-exercise-green.png, final-finish-report.xml,
completed-route.xml, picker-standards.png, picker-small.png,
plank-standards-green.png, all-ranks-levels.png, levels-small.png,
dumbbell-hint-small.png, template-small.png,
final-original-v3-preview.xml, restored-template-original.xml/png.
Старые rank-levels.png и остальные изображения до последнего QA могут показывать
предыдущую редакцию. Исходные резервные копии перечислены выше.

## Нерешённые ограничения и следующий шаг

Текущая локальная Android задача завершена. Практический следующий шаг для
основного телефона - EAS APK с исходной release-подписью; такая сборка не запускалась.
Не удалять пользовательский оригинал без внешнего backup.

- Новая прогрессия/условные нормы/шаблоны не синхронизированы с отдельными server/web.
  Не переключать offline mobile на server без согласования контрактов и миграций.
- Редакция WRPF2026 не подтверждена; при доступности проверить первоисточник приседа.
- Коэффициенты и шкалы аксессуаров условные, не научно проверенные нормативы.
- Нет встроенного секундомера; длительность планки задаётся числом.
- Отдельные PR badges времени/сравнение удержаний ещё не добавлены.
- Старые иллюстрации уровней мужские также при женском профиле.
- iOS, очень большая native AsyncStorage база и физический телефон не проверены;
  многолетний8970-set тест выполнен в Node mock storage.
- При выходе из редактора шаблона несохранённые изменения не сохраняются автоматически.
  Есть явная кнопка сохранения, но предупреждение об уходе пока не реализовано.
- Native клавиатурный ввод проверен через ADB с аппаратной клавиатурой;
  отдельный прогон редактора с реально открытой экранной клавиатурой не выполнен.

При следующей задаче: прочитать checkpoint и git diff, экспортировать актуальный
progress перед QA, менять только необходимое, прогнать tests/typecheck/journey
сообразно затронутой логике, собрать/install-r, проверить нативно, вернуть
пользовательский snapshot и обновить этот документ.
