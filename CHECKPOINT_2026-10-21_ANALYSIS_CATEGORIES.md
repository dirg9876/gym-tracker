# Gym-Beam: анализ и категории упражнений

Дата: 2026-10-21 (Europe/Moscow). Репозиторий C:\gymbeam, branch master.
Выпуск **1.1.8 ЗАВЕРШЁН** (Android14, native runtime1.1.0). Source
25eeb4099361a6c0c0a27116f957cedadb0f32f6 pushed master; CI39644478186 SUCCESS:
https://github.com/dirg9876/gym-tracker/actions/runs/39644478186.
Production OTA и GitHub APK опубликованы и проверены. Не повторять build/upload/
publish и не увеличивать версию для documentation-only completion. Следующий
логический выпуск1.1.9. Никаких необходимых exec sessions не осталось.

APK https://github.com/dirg9876/gym-tracker/releases/download/v1.1.8/gym-beam-1.1.8.apk.
GH asset663280993,stateuploaded,152340147bytes, server digestSHA256 совпал с локальным
DBD85E4D447106F43EFADD6F16041FCEBE604D45CC9563DE733B596B6AFEB655.
Releasev1.1.8 public/isDraft=false/latest, target полный source25eeb4099361a6c0c0a27116f957cedadb0f32f6.
Первая попытка create с коротким SHA получила422 и ничего не создала; повтор с
полным SHA успешен, upload завершился0. Второй релиз/asset не создавался.

## Цель

Прочитать анализ https://chatgpt.com/share/6ad8ef8d-506c-83eb-b8b4-b707f6c2df23,
запланировать содержательный анализ и улучшения по рекомендациям; разрешить
смену категории упражнения, даже если оно уже использовано в тренировках.

## Решения

Публичная страница web tool показала пустой текст. HTML удалось получить обычным
HTTP GET без авторизации; inert JSON ReactRouter разобран stdlib HTMLParser.
Прочитаны ответы 21, 36, 79, 80: разбор истории и проект адаптивного контроллера.
Пользователю больше не нужно присылать текст по прежнему async вопросу.
Личная исходная переписка НЕ коммитится. docs/TRAINING_ANALYSIS_PLAN.md содержит
план, критерии и проверенные первоисточники, без личных тренировочных данных.
Подробный новый анализ ещё не внедрён: отдельно запланированы локальные метрики,
структурированный AI review, прогрессия, готовность и долгосрочная персонализация.
Не возвращать отменённое разделение разминка/рабочие; не использовать e1RM в уровнях.

Категорию можно менять у встроенных и custom упражнений; имена встроенных защищены.
В выполненных подходах equipment snapshot. Старые подходы снапшотятся до первой
смены категории. История/числа/оценки/тоннаж сохраняются; текущие нормативы,
working-load, last-sets, exercise progress и AI используют сопоставимую категорию.
Статистика исключает чужие категории из графика с явным счётчиком, но оставляет
их в общей истории/объёме. Противовес и обычный вес отображаются разными сериями.
Старую тренировку нельзя сохранить как шаблон с несовместимыми текущими категориями.
Будущие targets/custom/current/monthly и активный draft пересчитываются к начальной
калибровочной нагрузке атомарно через journal; stale draft отклоняется.
Использованный timed/reps переход и переключение loadMode без смены категории
по-прежнему защищены 409. Масса тела legacy остаётся оценочной, не выдумывается.
Backup v10, импорт v1-v9 поддержан. Runtime остаётся 1.1.0 (native API не менялись).

## Файлы

Mobile: components/ExerciseEditor.tsx, SaveWorkoutTemplate.tsx; lib/offlineApi.ts,
workoutMeasurement.ts, workoutDraft.ts, progressBackup.ts, aiCoachContext.ts,
trainingInsights.ts; app/(tabs)/stats.tsx; scripts/exercise-category.test.mjs,
обновлены связанные regression tests/backup version assertions.
docs/TRAINING_ANALYSIS_PLAN.md; этот checkpoint; CHECKPOINT.md указывает сюда.

## Проверки на текущий момент

305 тестов PASS: mobile256, design22, API17, Worker10. Включены 6 новых category tests (матрица25 переходов,
legacy snapshots, official ranks/AI/charts filtering, journal rollback, assisted/
two-dumbbell history, v9 import/v10 validation, monthly targets/stale proposals).
Полный workspace typecheck и scoped diff --check PASS.
Финальный journey:624 тренировок/8970 подходов/4617835кг,181с,findings=[],
eliteFinalLevel80. Первый прогон157с также без findings; его оболочка PowerShell
вернула1 из-за native stderr warning, финальный прямой node завершился0.
Сборка scripts/build-release.ps1 PASS,2м12с,835tasks; обе freshness guards PASS.
APK artifacts/apk/verified/gym-beam-1.1.8.apk;
SHA256 DBD85E4D447106F43EFADD6F16041FCEBE604D45CC9563DE733B596B6AFEB655.
Прежняя signing certificate SHA256 dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.

Изолированный gymbeam_visualqa/5556 запущен headless; primary/5554 НЕ запускался
и не изменялся. Свежий baseline before-release-1.1.8-visualqa.json,12532bytes,
2finished/2sets/32exercises/1custom/0active. Export helper ошибочно предполагал
Documents/GymTracker: файл фактически в Documents, вручную pulled и проверен.
APK установлен install-r поверх native1.1.6 с cached1.1.7OTA, без очистки данных,
в airplane mode. Окно1.1.8 показало новые notes. Категория встроенного exercise3
с историей изменена dumbbell->barbell, save PASS; history/1 осталась10x12/120кг.
На360dp(1080x1920/density480),font1.3 dropdown и сохранение barbell->dumbbell PASS,
заголовок переносится, кнопка сохранения доступна, наложений нет.
Screenshot release-1.1.8-category-changed/history-preserved/options-small/warning-small.
Размер1080x2400/density420/font1 восстановлен. Native импорт свежего baseline v9
из Documents выполнен, затем v10 export after-release-1.1.8-native-restored.json:
state И plans ТОЧНО совпадают с baseline (Node deepStrictEqual PASS).
Это ТОЛЬКО синтетический QA, НЕ пользовательская база. Cold start не повторил
автоокно notes; manual What's New показало1.1.8. Свежий OTA export dist выполнен,
bundle entry-d8ac620e071e2e89cf6dadee4ad10769.hbc, native runtime1.1.0.

## Публикация OTA

EAS CLI16.32.0, update --branch production --platform android --environment production
--skip-bundler --non-interactive --json, exit0. Group332c1cfc-f4be-4088-9454-18634f1452c0,
update01a15f85-fb96-7835-987f-badb1fcb4017,2026-10-21T17:32:58.646Z,
https://u.expo.dev/update/01a15f85-fb96-7835-987f-badb1fcb4017.
На5556 реально check/download/APPLY: Updates показало1.1.8/Обновление01a15f85;
потом cold start в airplane mode подтвердил тот же ID, без повтора notes.
after-release-1.1.8-production-ota.json: state И plans ТОЧНО совпали с baseline.
В текущем appPID logcat нет ReactNativeJS/AndroidRuntime/FATAL.
Это проверка на native14; отдельный OTA прогон старого native13 в этом выпуске
не выполнялся. Native API/библиотеки/config не менялись, runtime1.1.0 сохранён.
Exact private-value scan PASS:26stagedsource/1448APKentries/204freshOTAfiles.
Секреты читались для сравнения только в памяти, не печатались и не публиковались.

## Ограничения / следующий шаг

Подробный анализ остаётся планом, а не реализованным новым отчётом. Следующая
пользовательская задача: этап1 docs/TRAINING_ANALYSIS_PLAN.md, достоверный подробный
разбор с локальными показателями и структурированным AI review. Не включать всё
автоматически в1.1.8. Web/server CRUD упражнений не менялись: Android использует
offline API. Физический телефон и iOS в этом выпуске не проверялись.
QA восстановлен в точный свежий baseline, cachedproductionOTA1.1.8 сохранено;
airplane0/Wi-Fi+dataon/physical1080x2400/density420/font1/IME0 восстановлены,
AVD5556 остановлен. Primary5554 не запускался. Gradle daemon остановлен.
Финальный docs-only completion commit добавляет этот checkpoint и rootpointer;
новые APK/OTA/версия для него НЕ нужны. Работы по выпуску завершены.
Не трогать данные primary gymbeam_test/5554. Перед любой установкой на primary
нужен НОВЫЙ backup, старые backup не восстанавливать поверх актуального прогресса.
Version1.1.8 подготовлена pnpm release:patch --notes-file JSON --date 2026-10-21,
release:check PASS; не делать второй bump. APK только scripts/build-release.ps1.
При публикации APK в GH Release assets, master без force-push; signing сохранить.
Старая JS1.1.7 не понимает изменённые связи category snapshots: не откатывать её
поверх новых данных; новый backup v10 импортировать в1.1.8+.

Неприкосновенные чужие изменения: .agents/agent_assets_metadata.toml,
artifacts/mockup-sandbox/src/.generated/mockup-components.ts, старые untracked
checkpoints 17/18Oct и attached_assets. Не включать их в коммит задачи.
Ignored artifacts/apk/verified содержит raw shared HTML и read-shared-analysis.py
с личными данными: не публиковать. Tests log tests-1.1.8.log тоже ignored.

Инструменты: Node C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;
pnpm C:\Users\Dirg9\AppData\Local\pnpm; JDK C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot;
SDK C:\gymbeam\artifacts\android-sdk; AVD_HOME C:\gymbeam\artifacts\android-avd.
Предыдущий полный release checkpoint: CHECKPOINT_2026-10-20_EXERCISE_REPLACEMENT.md.
