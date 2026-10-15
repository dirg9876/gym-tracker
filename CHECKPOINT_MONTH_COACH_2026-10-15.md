# Gym-Beam: latest request checkpoint

АРХИВ этапа. Завершён16октября2026; актуально
[CHECKPOINT_2026-10-16_AI_COACH.md](CHECKPOINT_2026-10-16_AI_COACH.md).
Ниже история реализации/промежуточные состояния; не повторять завершённые действия.

2026-10-15. Новый запрос поступил до выдачи предыдущего APK; продолжать, не заканчивать
ответом только про code4. Цель пользователя:

- Уже подключённый шлюз: неактивная кнопка подключения. При правке URL/token подключение
  нового адреса/токена остаётся возможным, токен по-прежнему masked/SecureStore.
- Удалить отдельный переключатель отправки данных. Включение ИИ автоматически включает
  отправку после privacy-confirmation; выключение отзывает отправку/отменяет запросы.
- Удалить выбор исключений и длительности. Исключений по умолчанию нет, тренировка60–90мин
  (принять75мин). Цель/дни/оборудование сохранить. Офисный режим отдельный короткий.
- На экране запуска ровно3 сценария: следующая по плану/истории, короткая офисная с
  турником/брусьями/собственным весом, полноценный сохраняемый месячный план по истории/целям.

## Уже завершено ДО нового запроса

Подробная архитектура и окружение: CHECKPOINT_COACH_DIALOGUE_2026-10-15.md (там часть статуса
ещё устарела). Code4 полная native сборка и QA завершены. Зеленая молния, HomeAIbutton,
app/coach-session.tsx shortmessages, taskadjust_workout, remainingPlan, confirmations,
атомарный POST offline /api/ai-coach/apply-plan, сохранение истории/порядка/защита старой
планки без секунд. Старый reconnect fix входит. Stepper не менялся.

Текущий готовый code4 APK: artifacts/apk/verified/gym-beam-ai-coach.apk,92112438bytes,
SHA256 ECE5BFFE9EA467353097D86221B7F0AD0D4086FCB2F95EF425A8DBB513986449,
packagecom.dirg9876.gymtracker,version1.0.0,versionCode4,arm64/x86_64,debugcert
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a (EAScert другой).
НЕ выдавался пользователю в финальном ответе. Новый этап должен стать code5.

154mobile+14Node+9Worker=177testsPASS,rootpnpmtypecheckPASS. Логи verified/coach-dialogue-*.
Native screenshotsHomegreen/off, keyboard, start, calibration, adjustmentconfirmationPASS.
2 реальных synthetic cloud callsPASS: busy machine заменён при сохранении другихtargets;
смена мышц на ноги с unknownweightsnull. Стоимость$0.0007126, no automatic retries.
Private report api-server/.coach-data/dialogue-smoke-2026-10-15.json. НЕ повторять его.

Production Worker последняя версия32a05b7b-db5f-4317-b947-699e89016ded, URL
https://gym-beam-coach.dirg9876.workers.dev. MODELgpt-6-luna,reasoningnone,storefalse,
maxoutput2400,service_tierdefault(Standard),promptcoach-v3-evidence-dialogue. Curated
ACSM2026 pack lib/ai-coach/src/evidence.ts included. No live websearch perreply.
Statusreadytrue, used$0.0039753, reserved$0.0034804, cap5. Oldunknownreserve НЕ reset.
ImmutableDOowner-v1/seed month2026-10 usedNanoUsd1893100 reservedNanoUsd0 НЕ менять.
Deploy helper worker/scripts/deploy.mjs --publish --free-plan-confirmed, WorkersFree.
Realkeys onlyapi-server/.env.coach + .coach-data/owner-token, connectionJSON private.
No secrets in logs/APK/backup/argv; APKassets+manifest actualsecret scanPASS.

Эмуляторgymbeam_test/emulator5554 запущен, code4latest installed, productionconnection
restored, AI/consentOFF. QAserverPID24228 stopped, ADBreverse8787removed, alltemporary
publicconnectionJSONdeleted. Нет оставшихся exec sessions; session32207 export завершена.
Gradle daemon после последней33203build снова можетработать (стопнуть в конце).
Fresh verified/before-coach-dialogue-v7.json и after-coach-dialogue-v7.json: deepEqual
state+plans кроме nextWorkoutId3->4 из удалённой QAсессии. 2finished/8sets/31ex/0types/noactive.
После окончательного build экспорт after повторён, ещё раз сравнить при новом QA.
Автоматически oldbackup НЕ восстанавливать. Телефон отдельный.

## Следующий шаг / проектные решения (ещё НЕ реализованы)

UPDATE: перечисленные ниже решения УЖЕ реализованы в исходниках, но nativeQA/code5
ещё не завершены. Backend month_plan/output6000, personal profile default75/noexclusions,
office mode сохранён в WorkoutRow.trainingMode, monthlystatecoachMonth, completionmarker
workout.coachCycle, backupv8/import1..8. Новые файлы mobile/lib/coachMonth.ts,
app/coach-month.tsx, scripts/coach-month.test.mjs. coach-session имеет3сценария,
office сохраняет gymhistory для восстановления, но preferencesbodyweight и validator
не допускают допвес/оборудование/больше9 подходов. Обычные ответы остаются старой4field
структуры; monthly task отдельный schema с monthly. SDK не принимает ZodEffects:
coachMonthShapeSchema используется дляJSONformat, coachMonthSchema.superRefine только
дляruntimeвалидации. Save/DeleteMonth endpoints, месяц сохраняется без performedsets,
scheduled в next_workout, office не продвигает месячныйslot,12сессий journeytest.
Настройки: singleAIswitch, consentdialog только первый раз, consentremembered/offblocks
actualsend; connectbuttondisabledsamecanonicalURL+savedtoken, приправках доступен.
Длительность и exclusions UI удалены; профилиeffectiveclamp60..90,excluded=[]; не надо
принудительно перезаписывать сохранённый профиль при запуске. ИзмененияполучаютсяприSave.
Monthlypage nextsession + preview/Save + delete(onlymonth,historypreserved), existing
month доступен через coachsettings даже приOFF. Rootroute coach-month иversionCode5.

Текущие проверки: mobile166PASS до последнего +1delete test; Node15PASS до последнего
+1usage>2400test; Worker10PASS; roottypecheckPASS. Сейчас build session55172, deploy
session19184. expoMetro59410 остановлен. Новый скрипт worker/scripts/month-office-smoke.mjs
создан, но ЕЩЁ НЕ ЗАПУСКАЛСЯ:2syntheticpaidcalls(reserve<0.02), guardreport private
.coach-data/month-office-smoke-2026-10-15.json запрещаетповтор. Предыдущий dialogue-smoke
НЕ повторять. После deploy можно вызвать --paid-once, проверитьmonthlyquality.
Нужно свежий beforebackup, nativeQA singleSwitch/disabledConnect/3options/office/month
save/persistence/delete/nextplan, cleanupONLYQAmonth/workout, restoreprodconnection+
AIoff, deletepublicJSON/reverse/stopmock, afterbackupcomparison. Code5APKещёневыдан.

Сначала упростить app/coach.tsx. Затем новый месячный workflow должен иметь отдельную
строгую структуру и хранение: несколько повторяемых тренировочных шаблонов + расписание
на4недели, без выдумывания автоматического роста веса. Для monthly отдельный bounded
outputlimit(~6000) и reserve/usageguards; не повышать модель/тариф без решения пользователя.
ДорогойSol пока лишь кандидат для weeklyreview, не включён.
Офисный режим должен ограничивать каталог/доступное оборудование bodyweight, без штанги,
машин и допвеса, малый объём; не просто текстовый запрос с прежними gympreferences.
Следующая по плану должна учитывать сохранённый месячный план, выполненные сессии и историю.
Месячный план нужен в progressbackup/import, старые1..7backups принимать. Сейчас backupv7.
Подумать schema отдельного monthlyreply: НЕ ломать strictreply старых APK для обычныхtasks.
coachReplySchema сейчас oldobject4fields(summary,cautions,nextSet,plan); Provider выбирает
zodTextFormat. Можно новую taskmonth_plan и отдельный monthlyReplySchema толькодлянее,
а envelope.resultunion; обычные taskoutput остаются прежними.
StateSchema progressBackup passthrough, но новые месячные поля валидировать явно;
OfflineState/normalizeState добавить сохранение нового поля, markerworkoutслота для progress.

Важные файлы: lib/ai-coach/src/index.ts,evidence.ts; mobile/lib/{aiCoachContext,offlineApi,
aiCoachConnection,aiCoachPlan,progressBackup,workoutTemplates}.ts; mobile/hooks/useAiCoach.ts;
mobile/app/{coach,coach-session,coach-plan}.tsx; components/SavedWorkoutPlan.tsx;
api-server/src/coach/{provider,core}.ts; worker/src/index.ts.
Docs AI_COACH_GUIDE.md/PHONE_SETUP.md уже описывают code4, обновить по итогам code5.

СредаWindowsPowerShell5fullaccessapprovalnever. NodePATH
C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;
JAVA_HOME C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot,SDK C:\gymbeam\artifacts\android-sdk.
AVDhome C:\gymbeam\artifacts\android-avd. apply_patchmanualedits; UTF8Russianreads.
Build: expo prebuild --platform android --no-install; android/gradlew.bat assembleRelease
-PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --console=plain. KeepNinja1.12.1,
WindowsNativePathsplugin/CMake .cache staging/absoluteentry. No --clean/noSDKdowngrade.
Dirty worktree allbaselinechanges preserve. NewAPK onlyaftertests/nativeQA/signature/backup.
