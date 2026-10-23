# Gym-Beam 1.1.15: Промежуточный Архив

Выпуск завершён и опубликован. Актуальные параметры, результаты и следующий шаг:
[CHECKPOINT_2026-10-23_RELEASE_1_1_15.md](CHECKPOINT_2026-10-23_RELEASE_1_1_15.md).
Нижние статусы сохранены как история, не повторять bump или публикацию.

## Цель

ФИНАЛЬНАЯ QA:after-qa-restored-1.1.15-visualqa.json получен; state/plans
deepEqual freshbefore-release-1.1.15-visualqa.json PASS. Оригинал возвращён точно,
active0, синтетики нет. Последняя sourceпроверка release:check/diffcheck PASS.

ПОСЛЕДНИЙ СТАТУС перед публикацией:1.1.15/code21/runtime1.1.0 уже подготовлены,
367mobile +21API +13Worker +22design =423PASS, finalworkspace typecheckPASS.
Дополнительный13-йтест исключает пустой completed workout со splitDay, чтобы
не скрыть реально не выполненный сплит. Подпись выбранной альтернативы уточнена.
FinalAPKbuild1m19s, обе embedded launchartifacts свежие; SHA256
DB6E0AEB1D9B2E3BA0C7ADCDEC81599902CAE77D455380636ADAD10E40960ABE.
Свежий finalExpoexport entry-08db74f401feb31e857ebbc28b9843f5.hbc.
Secret audit19stagedfiles/1448APKentries/204OTAfilesPASS. Stage19путей,
ещёНЕcommit/push/release/OTA. Journey624/8970/findings[]PASS,118секунд.
Nativegymbeam_visualqa5556:свежийbefore-release-1.1.15-visualqa.json доinstall;
after-installstate/plansdeepEqualPASS. Затем собственная синтетика4sessions/
10sets,не личная копия пользователя. Проверены3×50кг,другаякатегория,общийблок,
двевариантабезпоследнегопула,выборpush/старт/nativeexportmetadataи50×10,
взвешивание82.3→профиль82.3. Синтетическийпустойзапуск5удалёнчерезUI.
ФинальныйAPKустановлен -r; small360×640/font1.3скриншотывыбораиисторииPASS.
Сброшеныwm/density/font/IME, оригиналgym-beam-original-1.1.15.jsonимпортирован.
Сейчасидётэкспортafter-qa-restored-1.1.15-visualqa.json(sessionизtooloutput);
проверитьexactstate/plansпротивсвежегоbaseline. AVDживой,сетьпокаoff.
Остальные3красныхчастныхauditтеста(пуловер/подписи/контекстныйбюджет)остаются
известнымиограничениямивнескопановогозапроса,новыхпроблемданныхнет.
Далееcommit/pushmaster/CI,GHDraftAPK→publish,EASproduction/runtime1.1.0,
реальныйOTAapply/offline/exactdata,итоговыйcheckpointиcleanup. Версиюнеbump.

АКТУАЛИЗАЦИЯ: release:patch УЖЕ выполнен один раз1.1.15/code21/runtime1.1.0;
не bump повторно. Все366mobile +21API +13Worker +22design =422PASS;
workspace typecheck PASS, journey624/8970/findings[] PASS. APKbuild-release.ps1
завершён1m44s, свежие manifest/JS проверены. APK artifacts/apk/verified/
gym-beam-1.1.15.apk. Gradle остановлен; запускается AVDgymbeam_visualqa/5556,
пока НЕТ свежего baseline1.1.15 и НЕТ fixtures/nativeQA. Сначала экспортировать
before-release-1.1.15-visualqa.json, убедиться0active. Код ещёнеcommit/push/OTA.
Только3чужихdirty(включая rootCHECKPOINT после частногоаудита, теперь ours).
Личные данные не импортировались в AVD. Частный audit27нановомкоде24PASS/3FAIL:
calendarисправлен;оставшиеся3(пуловер/подписи/AIcontextbudget)не относятся к
новому запросу и не исправлялись. Старые статусы ниже читать с этой поправкой.

Новый запрос: объединить прогноз и полный журнал одного упражнения, вернуть
видимость старого жима3×50кг, синхронизировать взвешивания с данными спортсмена,
предлагать2сплита при старте тренировки без последнего выполненного сплита.
Workspace C:\gymbeam, mobile artifacts/gym-tracker-mobile, PowerShell.
Текущий опубликованный выпуск1.1.14/code20/runtime1.1.0, master c9c617f.
Следующий выпуск1.1.15: bump ЕЩЁ НЕ ВЫПОЛНЕН, не повышать несколько раз.

## Решения И Изменения

stats.tsx: один exerciseId/ExercisePicker для прогноза и полной истории. Отдельная
query insights?days=all для истории, основной переключатель периода сохраняет
смысл для общих графиков. Новый InsightExercise.history содержит все занятия и
все подходы, включая другие категории; измеренные графики не смешиваются с
будущими целями. История5занятий/страница, стрелки дают доступ ко всем. Жим3×50
не был потерян из данных: раньше показывался только лучший подход и выбор
упражнения в двух блоках был независимым. Другие категории видны с предупреждением,
но не подмешиваются в расчёт рабочих весов. Данные пользователя не исправлялись.

PUT /api/body-weight теперь всегда обновляет профиль по последней непрошедшей
в будущее дате журнала после upsert, даже при первом backdated взвешивании вместо
старой недатированной массы. Старые снимки в подходах неизменны. Удаление последней
даты по старой логике возвращает оставшуюся последнюю; все queries инвалидируются.

adaptiveWorkout.ts: workoutSplit/lastWorkoutSplit; новые тренировки сохраняют
optional splitDay=push/pull/legs, старые определяются по преобладающей группе sets.
Office, пустые и будущие записи не мешают определять последний обычный сплит.
buildAdaptiveSplit принимает preferredDay и по умолчанию исключает предыдущий.
dailyWorkout.ts: buildDailyChoices даёт до2доступных вариантов; месячный слот
предлагается только если его сплит разрешён, альтернативный вариант его не
потребляет. Внутренний buildDailyWorkout без preferredDay сохраняет контракт
месячного планирования. Если доступен только предыдущий сплит, choices=[] и
доступен ручной старт, без выдуманного оборудования.
API GET /api/daily-workout?split=push|pull|legs и POSTstart body.splitDay;
fingerprint включает выбранный split, предотвращает запуск другого варианта
по старому ключу. start-workout.tsx:2radioстроки, один готовый план и кнопкастарта,
ручной старт сохранён. optional splitDay валидируется backup schema; формат11
сохранён, так как старыеv11reader passthrough сохраняют это optional поле.
useAiCoach/loadAiContext/currentCoachContext/buildCoachContext передают выбор
только во внутреннийAPI. Внешний contractИИ не меняется, preparedWorkout и
scheduled относятся к выбранному варианту. Не потребуется Workerdeploy.

exerciseOutlook.ts: вместо fixedPPLtimeline моделирует только в отдельной копии
истории предполагаемые занятия через тот же adaptiveplanner. Будущие реальные
записи отфильтрованы ДО сценария, чтобы позже не стали измеренными данными.
18условных занятий,до4появлений упражнения; all-exerciseplanning остаётся общим.
Месячный forecast сохранён. Условные даты и сценарность остаются подписаны.

## Файлы И Проверки

Изменены lib/adaptiveWorkout.ts,dailyWorkout.ts,exerciseOutlook.ts,offlineApi.ts,
progressBackup.ts,trainingInsights.ts,aiCoachContext.ts; hooks/useAiCoach.ts;
app/(tabs)/stats.tsx,app/start-workout.tsx; scripts/daily-workout.test.mjs,
progress-outlook.test.mjs. Новый scripts/statistics-start.test.mjs:12тестов.
Некоторые старые тесты состава упражнения теперь явно выбирают push/legs,
поскольку не должны проверять повтор предыдущего сплита. Тест удаления
месячного занятия проверяет прогресс слотов отдельно от нового выбора2сплитов.

Mobile typecheck PASS до последних правок hooks (нужен новый прогон).
Последний прогон366тестов:365PASS/1FAIL только из-за отсутствующего
durationSeconds:null в месячной fixture нового теста; fixture исправлена,
нужно повторить. Первые12падений после смены политики разобраны: большинство
старые ожидания повторения последнего сплита; один реальный futuretimeline leak
исправлен начальным фильтром; политика массы обновлена по запросу.
Логи ignored artifacts/apk/verified/tests-1.1.15-initial/second/third.log.
В этом этапе ещё нет APKbuild/nativeQA/export/публикации, execsessions нет.

## Следующий Шаг

1. Повторить mobile tests/typecheck и исправить реальные проблемы. Проверить
   выборсплита/ИИ/fingerprint/backup, профиль, allhistory на личной копии только
   в изолированном Node harness. Не публиковать личную копию или auditreports.
2. Прогнать workspace/API/Worker/design/journey; проверить UI. Особенно
   start выбор альтернативы/старыеответыИИ/клавиатура формы массы/пагинация50кг.
3. notesJSON, release:patch ОДИНРАЗ1.1.15/code21, runtime1.1.0 оставить;
   release:check, APK scripts/build-release.ps1. NativeQA только AVD
   gymbeam_visualqa5556, свежий baseline ДОfixtures, не трогать5554 или активную
   реальную тренировку. Вернуть точный originalstate/plans послеQA.
4. Secret audit, sourcecommit/pushmaster/CI, APKGitHubRelease и OTAproduction,
   реальные check/download/apply/offline и сохранность, финальныйcheckpoint.
   На данный момент пользователь просил реализацию; предполагается обычный
   establishedreleaseworkflow. Не deployWorker/не тратитьAI на тесты.

Защищённые чужие dirty:.agents/agent_assets_metadata.toml,
artifacts/mockup-sandbox/src/.generated/mockup-components.ts,старыеuntracked
checkpoints17/18Oct,attached_assets. CHECKPOINT.md указывает сюда вместо частного
аудита; частный auditcheckpoint/отчёты сохранены ignored artifacts/apk/verified.
Не исправлять автоматически категории/прошлые веса/названия упражнений.
