# Gym-Beam: Current Checkpoint

ЗАВЕРШЕНО в ночь15–16 октября2026, Europe/Moscow. Workspace C:\gymbeam, WindowsPowerShell5.
Это актуальное состояние; CHECKPOINT_* от15октября являются историей этапов.

## Цели и Результат

Пользователь запросил: зелёную молнию приON, AIstart с Главной, подсказки/короткие сообщения
во время занятия, затем simplifiedsettings и3 сценария. Всё реализовано в APKcode5:

- Один переключатель ИИ. ПервыйON показывает privacy-confirmation и включает consent+AI.
  Разрешение запоминается; OFF прекращает отправку и отменяет запросы. Forget очищает
  credentials/consent. Отдельного тумблера отправки нет.
- «Шлюз подключён» disabled при совпадении canonicalURL+savedtoken; правки URL/token
  возвращают подключение. Reconnect того же шлюза идемпотентен и не сбрасываетON.
- Исключения/длительность из настроек удалены. Effective exclusions=[], время clamp60..90,
  default75мин. Цель/дни/оборудование остаются; старые backupfields совместимы.
- Три сценария: следующая по плану/истории, короткая офисная, план на месяц.
- Офис: ориентир10–20мин, только bodyweight, weightKg0, до3 подходов/упражнение и9всего.
  Gymhistory сохраняется для анализа восстановления. WorkoutRow.trainingMode=office
  поддерживает ограничения после перезапуска/в диалоге. Без штанг/машин/гантелей/допвеса.
- Месяц =4-недельный блок,1–4 reusabletemplates, расписание по frequency профиля,
  relative weekdays, focus недели, без автоматического повышения веса. Preview/Save/
  Replace/Delete; перезапуск сохраняет план, exportv8 включает его, import1..8 принимается.
- Nextregularcontext получает nextscheduledsession и actualhistory. WorkoutRow.coachCycle
  {planId,slot} связывает старт с планом; только finishedsessions продвигаютslot. Office/
  freeworkouts не продвигают. Завершённые сессии зелёные, не гарантия выполнения targets.
  Удаление месячного плана сохраняет историю; удаление completedworkout снимает отметку.
  Если все упражнения следующего занятия удалены, UI требует новый план, backup не ломается.
- ActiveWorkout «Написать тренеру»: до300символов, busy-machine/muscle-change/fatigue
  действия, ограниченная история в памяти. Замена только оставшегося плана, всегда после
  подтверждения. Actualsets/история не меняются; подходы не записываются автоматически.
- ActiveStepper unchanged, barbell>=20kg, plankseconds, новый неизвестный вес=null до
  калибровки. Никакого нового прямого ввода веса в активной тренировке.

## APK и Проверки

Актуальный C:\gymbeam\artifacts\apk\verified\gym-beam-ai-coach.apk,92123346bytes,
SHA256 708D1E3AA2430901F7B13BD7FB7EE82BBCAEBF10952AB59FBED34BBABF8E4D17.
com.dirg9876.gymtracker,version1.0.0/versionCode5,Android7+,arm64-v8a+x86_64.
Полная nativeGradle сборка, signature verified. CertSHA256
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a совпадает с локальными
code2–4, но НЕ исходной EASподписью. Не советовать uninstall без внешнего backup.
Code4 не выдавался: новый запрос пришёл перед финальным ответом. Code2autoconnect сохранён.

193testsPASS =167mobile+16Nodegateway+10workerd. RootpnpmtypecheckPASS. Логи в verified/
month-coach-{tests,gateway-tests,worker-tests,typecheck,build}.log. Headlessjourney12sessions/
4weeks, officeнепродвигаетмесяц, stalecontext, backupv8/oldimport, budgetsPASS.
Native: oneSwitch/noexclusions/notime, disabledConnect/editreenables, rememberedconsent,
3options, monthsave/coldrestart/nextsession, officepreview/start, cleanupPASS. Screenshots/
XMLmonth-coach-*. No AndroidRuntime/ReactNativeJS errors. Restoreautomation initially failed
due asyncfilepicker/offscreen timing, final restore verified; это не ошибка приложения.
Real synthetic office+month callsPASS cost$0.0014358. Ранее busy-machine+muscle-change
PASS cost$0.0007126. No autoretries. Private reports .coach-data/*smoke-2026-10-15.json;
НЕ повторять guardedpaidscripts с существующими отчётами.

Fresh before-month-coach-v7.json / after-month-coach-v8.json deepEqual allstate+plans,
кроме nextWorkoutId4->6 от двух удалённых QAworkouts. Настоящие2finished/8sets/31exercises/
0templates/noactive неизменны. QAmonth удалён. Не восстанавливать oldbackup автоматически.
StepperSHA256 3BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C unchanged.
APKassets+manifest scan against actualowner/providersecretsPASS, credentials не в backup.

## Архитектура / Файлы

- lib/ai-coach/src/index.ts: strictschemas, personalprofile, officeguards, monthplan/runtime
  validation. Normalreply остаётся4fields(summary,cautions,nextSet,plan) для oldAPKcompat.
  month_plan отдельный reply.monthly. JSONformat использует coachMonthShapeSchema без
  ZodEffects (SDK7.32.0 их запрещает); coachMonthSchema.superRefine только runtime.
- evidence.ts curatedACSM2026, PMID41843416; не live websearch, не выдумывать источники.
- Mobile lib/aiCoachContext.ts:12finished+focus,160sets,120catalog,3templates; messages<=7,
  remainingPlan/performedSetCount/scheduled. Officepreferencesbodyweight, но gymhistory
  остаётся. lib/coachMonth.ts derivedslots/completion/unavailable.
- OfflineState.coachMonth {idfingerprint,createdAt,plan}, WorkoutRow.coachCycle/trainingMode,
  normalizeState сохраняет их. lib/progressBackup.ts validates units/relations/markers,
  exportv8/import1..8, nullinitialweights допустимы только до калибровки.
- lib/offlineApi.ts POSTcontext/POSTapply-plan/GET-PUT-DELETEmonth. Progresslock,
  freshfingerprint и atomicstate+planwrites. Actualsets не трогаются. Remainingtargets
  объединяются с completedtargets без двойного засчитывания и с новым порядком.
  Legacyplank безseconds не может внести invalidplan.
- lib/aiCoachPlan.ts in-memory session/month proposals. app/coach-plan.tsx и
  components/SavedWorkoutPlan.tsx existingeditor+confirmstart/apply. Nullweight требует ввода.
- app/coach-session.tsx3modes/chat/keyboard/source; coach-month.tsx preview/save/read/delete;
  coach.tsx simplifiedsettings; Home/ActiveWorkout buttons; _layout routes. useAiCoach.ts
  validates snapshot with same messages/mode, discards lateanswers. SecureStore unchanged.
- api-server/src/coach/{provider,core}.ts promptcoach-v4-month-office, defaultoutput2400,
  month6000. Весь потолок резервируется, actualmonthlyusage>2400 учитывается корректно.
- Newtests mobile/scripts/coach-month.test.mjs(13), Node/Worker monthlyformat/usage.
  Worker/scripts/month-office-smoke.mjs и dialogue-smoke.mjs guardedpaidreports.
- AI_COACH_GUIDE.md / api-server/PHONE_SETUP.md актуальны code5/backupv8.

## Cloud / Credentials / Budget

Production https://gym-beam-coach.dirg9876.workers.dev, worker gym-beam-coach, WorkersFree
подтверждён. Version83722f75-87b9-4612-a057-eb966675b731. MODELgpt-6-luna, reasoningnone,
service_tierdefault(Standard), storefalse, retries0, timeout45s, без tools. Sol6.1 лишь
предложен для futureweeklyeval, не включён. Luna$0.10/$0.50 иSol6.1$2/$10 per1Minput/output
проверены по официальным docs (guide содержит ссылки); Sol6.1 не поддерживает none.
Limit5USD/UTCmonth только для этого шлюза. После тестов used$0.0054111,
reserved$0.0034804. Старый unknownreserve существовал до работы, НЕ сбрасывать.
DOsingletonowner-v1/COACH. Immutable .cloud-deploy/seed.json month2026-10,
usedNanoUsd1893100,reservedNanoUsd0 — НЕ редактировать/resetnamespace. Deployhelper
node scripts/deploy.mjs --publish --free-plan-confirmed из ai-coach-worker. Secretshelper
--secrets throughstdin. Localpaidgateway запрещён .coach-data/cloud-cutover.json.

OpenAIkey api-server/.env.coach; owner api-server/.coach-data/owner-token; privateconnection
.coach-data/gym-beam-coach-connection.json для разового импорта на телефон. НЕ печатать
keys/токены/OAuthTOML, не в APK/backup/чат/argv. OAuthWrangler alreadyauthorized.
Android SecureStorekeygymbeam.ai-coach.connection.v1, servicegymbeam-ai-coach,
URL+token JSONpair в Keystore. AsyncStorage только enabled/consent/url. Androidbackup
исключает только SecureStoresharedprefs, не userDB/files. Не включать paidCloudflareplan.

## Состояние / Следующий Шаг

Эмуляторgymbeam_test/emulator5554 открыт с latestcode5, productionconnection restored,
AI/consentOFF после смены QAhost обратно. QAserverPID3324 stopped, reverse8787removed,
temporarypublicconnectionJSONdeleted,8787/8089listenersnone. Оставить эмулятор открытым.
Gradledaemon остановлен после последней сборки; все нужные execsessions завершены.
Следующий пользовательский шаг: внешний backup -> updateAPK поверх matchingcert ->
включить ИИ -> выбрать сценарий. При необходимости connectionfile, НЕ OpenAIkey на телефон.
Физический телефон не автотестировался; пользователь сообщил об успешном подключении.
Нет календарных уведомлений/автономных правок программы/диагнозов/видеооценки техники.
Месяц=4недели с относительными днями. Curatedresearch, не live literaturesearch. Больше
eval нужны перед более дорогой моделью. Не переносить данные эмулятора на телефон.

Node/pnpm PATH C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;
JAVA_HOME C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot; SDK C:\gymbeam\artifacts\android-sdk;
AVDhome C:\gymbeam\artifacts\android-avd. Build expo prebuild --platform android --no-install;
android/gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2
--console=plain. KeepNinja1.12.1/WindowsNativePaths/CMake.cache staging/absoluteentryplugin;
no clean/downgrades. Manualedits apply_patch, UTF8Russianreads. Dirty worktree содержит
много прежних изменений; не откатывать/не коммитить без запроса.
