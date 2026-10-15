# Gym-Beam: Checkpoint автоподключения

15 октября 2026, Europe/Moscow. ЗАВЕРШЕНО: новая native сборка установлена и проверена.
Предыдущий завершённый этап: CHECKPOINT_CLOUD_2026-10-15.md.

## Итог и точка продолжения

Новейший запрос выполнен безопасным вариантом: defaultURL, первый импорт личного
connection JSON без ручного набора, далее токен автоматически восстанавливается
из Android Keystore. Есть edit/masked/eye/forget. На вопрос про import vs embedded
пользователь ещё не ответил; встроенных credentials в APK нет, выбран рекомендуемый
вариант. Не утверждать, что новый телефон получит токен без первого импорта файла.

Готовый APK: C:\gymbeam\artifacts\apk\verified\gym-beam-autoconnect.apk,
92091838bytes, SHA2568525353E7CB225F2AF6410504DBDF15C95B1EC82246413AE7FA34C35610F587E.
com.dirg9876.gymtracker/version1.0.0/code2, minSDK24/target36, arm64-v8a+x86_64,
signaturev2PASS, certSHA256dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Подпись совпадает с прежним локальным testedAPK, обновлён adb install-r без uninstall.
От исходной EAS-подписи отличается: телефон не удалять без проверенного export.
Старый verified/gym-tracker-tested.apk сохранён и остаётся RAM-only.

Native QA PASS: firstfileimport/hostconfirmation, masked/autofilledtoken,
force-stop+coldstart, upgradepreservesconnection, fake-token edit/show/hide,
возврат к сохранённому verifiedtoken после перезапуска, forget/coldstart не
восстанавливает забытый токен, reimport. Найден/исправлен UIbug: после coldstart
кнопка refresh расходов исчезала без cachedbudget; теперь она всегда есть при
сохранённом подключении, nativecoldrefresh200/gpt-6-lunaPASS. Fake401text из-за
раннего snapshot не утверждать как отдельно проверенный native error-text.
Финальный токен скрыт, AI/consentoff. Физический телефон ещё не подключался.

134mobile +12Node +8workerd =154/154 PASS, fullworkspace typecheckPASS.
20ai-coach tests включают securepersistence, off, invalidfile/key, hostmismatch,
forget, locked/damagedKeystore, savefailure, metadataackrollback, forgetduringwrite.
3network/config tests включают backup exclusion и .easignorecredentialexclusions.

Fresh before export: verified/before-persistent-coach-2026-10-15-v7.json.
Fresh after export: verified/after-persistent-coach-2026-10-15-v7.json,
exported2026-10-15T06:56:33.204Z. Parsed/deepEqual state+plansPASS, noownertoken.
2workouts/8sets/31exercises/0types/noactive, checksum
53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3.
Ничего не импортировали/восстанавливали из progressbackup в этой QA, не подменять
актуальный прогресс старой копией. StepperSHA2563BD6545FA3068711357F36B574D1C8CE2A693C957477BAD1AFE6848DA01D948C,
не изменён. Из /sdcard/Download временный connection JSON удалён после reimport.

Cloud status финально проверен13:10:44UTC, readytrue, used$0.0022081/reserve0/limit5.
Новых paidcalls0. Private report api-server/.coach-data/persistent-session-qa-2026-10-15.json.
Worker/cloudledger/seed не менялись, local8787off/cloudmarker, ADBreverse отсутствует.
Скриншоты/XML verified/persistent-coach-{home,imported,restarted,valid-after-invalid,final}-2026-10-15.*;
logcatReactNativeJS/AndroidRuntimeбезошибок. Secret scan распакованных APKentriesPASS,
nativeSecureStoredexpresent; compiledbackupXML исключают только SecureStore,
в т.ч. cloud/device transfer, не progressdatabase/files.

Финальные native build fixes: Ninja1.12.1 +shortCMakepaths описаны ниже; native
Expo/RNGP monorepo bundle требует absoluteentryFile (extraPackagerArgs в plugin).
Добавлен directbabel-preset-expo~54.0.10: transitive preset не резолвился после
pnpminstall. После этих правок buildSUCCESS, финальный incrementalbuild22sec.
Log verified/native-secure-build-final.log. Нужных running exec sessions нет.
В старых блоках ниже ID83125/28189 являются историей failedattempts, НЕ активными.

Репродукция native: с NodePATH/JAVA_HOME/ANDROID_HOME/CI1/NODE_ENVproduction выполнить
из mobile pnpm exec expo prebuild --platform android --no-install; проверить
generatedandroid/app/debug.keystore совпадает с artifacts/apk/debug.keystore,
local.properties SDKpath. Из android gradlew.bat assembleRelease
-PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --console=plain.
Android folder ignored, plugins переносят backup/network/path/entry изменения.
Старый APK без SecureStore нельзя использовать для JS-only repack этой версии.

PHONE_SETUP.md переписан с one-timeimport/whereURLtoken/phoneeye/edit/forget,
COACH_SETUP.md/AI_COACH_PLAN.md/workerREADME обновлены. Следующий шаг для пользователя:
перенести новыйAPK и PRIVATE api-server/.coach-data/gym-beam-coach-connection.json
на телефон; exportстарогопрогресса ->install ->Главная/молния/Импортподключения ->
confirmhost ->consent/on ->параметры. Удалить temporarypublicphonefile послеимпорта.
URL публичен; token localowner-token и на телефоне eye. Не OpenAI key.
Осталось вне этого запроса: физический телефон, исходная EASreleaseподпись,
широкоеqualityevaluation, многонедельное ведение, старые A4/B7 accessibilityissues.

## История реализации

Ниже сохранены промежуточные записи; их «в процессе» не отменяет итог выше.

## Цель и решения

Новейший запрос: автоматически подставлять адрес/токен личного ИИ-шлюза, позволять
их менять, подготовить инструкцию первого запуска и указать, где взять значения.
По умолчанию URL https://gym-beam-coach.dirg9876.workers.dev.
Выбран expo-secure-store15.0.8 (Android Keystore), не plaintext AsyncStorage.
Для первой настройки подготовлен отдельный личный JSON и кнопка импорта без
ручного набора. Через async задан выбор: импорт личного файла (рекомендуемый)
или буквально встроенный токен в APK. Ответ пока не получен; продолжать безопасный
вариант с импортом. НЕ вшивать настоящий токен/API-key в source/APK без учёта ответа.
После успешного подключения настройки сохраняются; explicitenabled/consent
восстанавливаются, off остаётся off. Импорт прогресса выключает ИИ, не стирает токен.

## Окружение

C:\gymbeam, Windows PowerShell5. Node24/pnpm в
C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
Java17 C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot; SDK artifacts/android-sdk.
Mobile artifacts/gym-tracker-mobile. Dirtyworktree, не откатывать unrelatedchanges.
Manual edits apply_patch; releaseAge1440 не отключать; русские файлы Get-Content UTF8.

## Сделано в коде

- package.json expo-secure-store~15.0.8, pnpm lock установлен --ignore-scripts.
- app.json plugin expo-secure-store, androidversionCode2. expo prebuild Android
  --no-install создал ignored android/, добавил generatedandroid/ios scripts.
- lib/aiCoachCredentials.ts: URLdefault, canonical URL guard, strict credential/file
  schemas, SecureStore key gymbeam.ai-coach.connection.v1/service gymbeam-ai-coach,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY. Файл<=8192, formatgym-beam-coach-connection/version1.
  OpenAI sk-keys отклоняются. Credentialpair URL+token хранится вместе.
- lib/aiCoachConnection.ts: secure hydration, URL/tokenmatch before network, queue
  для save/rollback, invalidate stale replies, failclosed/read error, savedtoken
  getter только для UI, disconnect deletescredential/consent. DefaultURL заполнен.
- app/coach.tsx: autoprefill, mask/eye, edit/connect/import/forget; файл через тот же
  Expo File picker как backup. Перед connect из файла подтверждение адреса.
- scripts/testHarness.mjs: отдельный SecureStore mockMap/fault injection.
- scripts/ai-coach.test.mjs:18тестов, теперь persistence вместо RAM-only; всего
  mobile131/131 PASS до последнего backup-test, fullworkspace pnpm typecheckPASS.
  Последний targeted coach-network3/3PASS; fullsuite ожидается132. API не вызывался.
- .easignore теперь явно исключает credentials (.env*/.coach-data/.cloud-deploy/
  .wrangler), node_modules/nativegenerated/.cache: .easignore заменяет .gitignore.
- assets/android/gymbeam_{backup_rules,data_extraction_rules}.xml и plugin
  withCoachSecureStorage.cjs исключают только SecureStore из Android backup,
  не исключают progress databases/files. ExpoSecureStoreconfigureAndroidBackupfalse.
  Эти последние nativeизменения требуют повторного prebuild/build после текущего.
- scripts/create-coach-connection.mjs создал приватный
  artifacts/api-server/.coach-data/gym-beam-coach-connection.json. Там owner token,
  не OpenAI key. Не печатать/публиковать. Каталог ACLrestricted/gitignored.

## Native build в процессе

В старом APK SecureStore отсутствует (проверены все3dex). JS repack НЕ подходит.
Gradle8.14.3 скачан, NDK27.1.12297006, CMake3.22.1, buildtools35 установлены.
Prebuild Android compile/target36, min24, newArchtrue/Hermes, arm64-v8a+x86_64.
android/local.properties SDKpath создан; существующий artifacts/apk/debug.keystore
скопирован в generatedandroid/app/debug.keystore, чтобы сохранить подпись.
Первая сессия83125 ЗАВЕРШЕНА failed: Ninja1.10.2/длинные .pnpm paths. Ninja обновлён
до1.12.1 из officialgithub/ninja-build; oldexebackupSDKcmake/bin/ninja.exe.1.10.2.bak.
Добавлены scripts/windows-native-paths.gradle и pluginwithWindowsNativePaths.cjs:
CMakebuildStagingDirectory C:\gymbeam\.cache\native-cxx/<projectname>, до rootplugins.
Первый apply после rootplugin дал "too late", исправлен на apply ДО expo-root-project.
RegistryLongPathsEnabled уже1, не менялся. Source/NewArch/dependencies не downgrade.
Теперь активный exec session28189:
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --console=plain
JavaGradledaemonPID29408, wrappers могут меняться. Nativecompile проходит, сейчас
MetrocreateBundleReleaseJsAndAssets. Log artifacts/apk/verified/native-secure-build.log.
NODE_ENVproduction на втором запуске установлен. Не заканчивать пока нужная
сессия28189 идёт. Не публиковать/устанавливать
новый APK до успешной сборки/проверки подписи и свежей копии прогресса.

## Состояние данных и облака

CloudWorker уже работает, Free подтверждён, auth401/200, бюджетlimit5,
used$0.0022081/reserve0 после7syntheticcalls. Не делать новых платных запросов.
Node8787 остановлен/cloud-cutovermarker, ADB reverse отсутствует. Не сбрасывать DO
owner-v1/immutable seed month2026-10 usedNano1893100 reserve0.
Секреты api-server/.env.coach и .coach-data/owner-token: НЕ печатать/URL/argv/APK.
OAuth Wrangler в системномstore уже настроен, повторный login не нужен.

Эмулятор emulator-5554/gymbeam_test/Android36, UID2000,1080x2400,density420/font1.0.
Старый APK установлен, AI/consentoff. FreshnativeSAF export уже создан:
artifacts/apk/verified/before-persistent-coach-2026-10-15-v7.json,
exported2026-10-15T06:33:06.492Z. Не восстанавливать старые копии поверх данных пользователя.
Ожидаемый state2workouts/8sets/31exercises/0types/noactive, checksum
53962f1fd58d7f3c3e93bc01bd8b2664787910a2714c427537082d4bd15a32e3; заново проверить.
Текущий verified/gym-tracker-tested.apk SHA256494711E86E74C451AE9EB306D6D22D6F5AF31045BDCC713C2D38D657A2877A6E,
code1/debugcertdfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Stepper не редактировался; прямой ввод веса пользователь отверг.

## Следующий шаг

Дождаться/починить полную native сборку, rerun после финальных JSизменений при необходимости.
Проверить manifest/securebackup-excludes/подпись/code2/архитектуры/отсутствие секретов.
Установить adb install -r без uninstall; импортировать личный connection JSON через
nativepicker, status/budget, force-stop/launch автоподстановка, off persistence,
редактирование/forget/reimport. Не включать отправку личной истории ради тестов.
Удалить временный connectionfile с публичного /sdcard после импорта.
Экспорт прогресса после QA deepEqual/checksum к freshbefore; не restore автоматически.
Подготовить PHONE_SETUP/COACH_SETUP/AI_COACH_PLAN/README/checkpoint с фактическими
результатами и ссылкой на новый APK. Финальная инструкция:APK+one-timeprivatefile,
import/connect/consent/on/параметры; адрес/токен где найти, на телефоне eye/edit.
