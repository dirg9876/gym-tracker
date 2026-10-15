# Gym-Beam: reconnect fix checkpoint

15 октября 2026, Europe/Moscow. Этап объединён с CHECKPOINT_COACH_DIALOGUE_2026-10-15.md.
Code3 собран/установлен, native повторный Connect сохраняет ON; 139 mobile + 12 Node
+ 8 Worker тестов и typecheck PASS. Session51289 завершена, QA PID7068 остановлен.
Отдельный APK code3 не выпускался; fix включён в новый code4.

## Запрос и причина

Пользователь установил gym-beam-autoconnect.apk/code2, подключил шлюз, включил
ИИ-тренера и повторно нажал «Подключить шлюз». ИИ выключается и советы не работают.
Причина подтверждена в lib/aiCoachConnection.ts: connectAiCoach всегда записывал
enabled:false. На старом APK эмулятора bug воспроизведён нативно с mock gateway:
consent/on -> Connect -> checkedfalse. screenshot/XML verified/reconnect-bug-reproduced-code2.*.
Пользователю уже дан workaround: Connect один раз -> consent -> AIon, без повторного
Connect. Асинхронно задан вопрос, есть ли ошибка у совета при таком порядке;
ответа пока нет, не останавливать основной fix в ожидании.

## Изменения

- lib/aiCoachConnection.ts: после validate/readAiConnection при совпадении
  нормализованных URL+token и savedconnected вызывается только readAiGatewayStatus.
  Нет settings/Keystore write, invalidateRequests или выключения ИИ. Изменённые
  credentials по-прежнему требуют explicitenable, новыйhost сбрасывает consent.
- scripts/ai-coach.test.mjs +5regressiontests: sameconnect keepsON/consent/answer,
  новый inference проходит послеsameconnect, не прерывается pending inference,
  OFF/нетсогласия не включаются, failedstatus не выключаетON, changecredentialsOFF.
- app/coach.tsx: если AIon запрошен при savedconnection безconsent, nativeAlert
  предлагает согласие; confirm -> consent+enabled, cancel ничего не разрешает.
- app.json versionCode3, package/name/version unchanged. Других source edits нет.
- Полный mobile139/139PASS, targeted25AI testsPASS, mobiletypecheckPASS.

## Окружение и процессы

C:\gymbeam, PowerShell5. Node/pnpm
C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
Java17 C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot; SDK artifacts/android-sdk.
Native Androidgenerated alreadyexists; Ninja1.12.1/shortCMakepath/absoluteentry/
directbabelpreset fixes из AUTOCONNECT checkpoint сохранить. Existingdebug.keystore
совпадает с локальным code2 cert. Sourcemanualeditsapply_patch, unrelateddirtyfiles
не откатывать. releaseAge1440 не отключать.

Эмулятор при старте был выключен. Запущен gymbeam_test с ANDROID_AVD_HOME
C:\gymbeam\artifacts\android-avd, coldboot/no-snapshot-load/no-snapshot-save,
hiddenconsole, process18516, emulator-5554/bootcompleted1. Старый code2 установлен.
Не wipe/uninstall: данные сохранены. Freshbackupbefore:
artifacts/apk/verified/before-reconnect-fix-v7.json,
exported2026-10-15T19:42:20.466Z. Ещё сравнить/checksum послеQA; не restore автоматически.

QA-only Node server запущен Hidden PID7068 изapi-server/scripts/coach-native-qa.mjs.
Это mockprovider/memoryledger, OpenAI не вызывается даже приenvkey. Порт8787,
ADBreverse8787 ВРЕМЕННО включён. В конце ОБЯЗАТЕЛЬНО stopPID7068/removeReverse.
Private dummycredentials api-server/.coach-data/native-qa/owner-token и generated
gym-beam-coach-connection.json. Pushнаemulator /sdcard/Download/gym-beam-reconnect-qa.json.
Эмулятор сейчас подключён к http://127.0.0.1:8787 сdummycredential, consenttrue,
AIoff после воспроизведения code2bug. ПослеQA восстановить настоящуюcloudconnection
из private api-server/.coach-data/gym-beam-coach-connection.json, consent/AIoff;
удалить временные connectionfiles из публичногоsdcard.

Native prebuild --no-install повторён с code3. Первый build session80736SUCCESS1m25sec.
Второй с UIchange сейчас51289, log artifacts/apk/verified/reconnect-build.log.
Нельзя финализировать с runningbuild/server, carrythrough nativeverification.

## Облако и секреты

URL https://gym-beam-coach.dirg9876.workers.dev, Free уже подтверждён. Не redeploy/reset
Worker/DOowner-v1/immutable migration seed и не запускать productionNodeindex.
Cloud status200/readytrue, used$0.0022081, reserved$0.0034804 (в двух чтениях).
Этот резерв появился ДО наших modeltests; вероятно запрос пользователя/unknownfailure,
не списывать/не сбрасывать и не утверждать, что reserve0. paidcalls этого turn0.
Если пользователь сообщит ошибку модели, investigate отдельно; statusready доказывает
наличие ключа, не успех текущего inference. Не называть mocknativeanswer реальнымИИ.
Сохранён .coach-data/reconnect-budget-before.json. Реальную историю вOpenAI не отправлять
для этих tests. Все nativepaidroutes сейчас через localmock, modeloutputявнотестовый.
OPENAI_API_KEY вapi-server/.env.coach иCloudflaresecret, owner-token приватный,
НЕ печатать/URL/argv/APK/backup. OAuthWrangleralreadyauthorized. ACLrestricted/gitignored.

## Следующий шаг

Дождаться build51289, проверить code3/cert/secretScan, adb install-r безuninstall.
Nativecase: consentoff -> AIon -> cancel(noenable), thenallow(consent+on), повторConnect
ONостаётся; нажать «Следующая тренировка с ИИ» вCoachScreen, mockplan отображается;
не сохранять план и не создавать реальные sets. Coldrestart ON persists/reconnectON,
OFF persists/reconnectOFF. Затем cloudrestore/off, stopmock/removeReverse/deletefiles.
Freshafterbackup deepEqual state/plans/checksum к before. SourceStepperнеизменён.
Root typecheck +fullmobiletests, API12+Worker8 optionalunchanged backendtests.
Готовый новыйAPK назвать verified/gym-beam-reconnect-fix.apk, сохранить oldcode2.
ОбновитьPHONE_SETUP/checkpoint/rootссылки, честный finalRussian: причинарешена,
новыйAPKповерхбезудаления/подключениесохраняется, consent+enable, testproofmock/noAPIspend.
