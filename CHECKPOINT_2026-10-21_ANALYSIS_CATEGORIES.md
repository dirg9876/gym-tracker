# Gym-Beam: анализ и категории упражнений

Дата: 2026-10-21 (Europe/Moscow). Репозиторий C:\gymbeam, branch master.
Новый логический выпуск 1.1.8 (Android14, native runtime1.1.0) собран; публикация
ещё не выполнена. Не увеличивать версию повторно в рамках этого выпуска.

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

## Ограничения / следующий шаг

Завершить импорт QA baseline/экспорт и сравнить state+plans точно. Проверить
manual What's New, cold start и appPID errors. Подготовить свежий OTA export,
приватный exact-value scan, source commit/pushmaster, CI, GH asset и production OTA.
Не трогать данные primary gymbeam_test/5554. Перед любой установкой на primary
нужен НОВЫЙ backup, старые backup не восстанавливать поверх актуального прогресса.
Version1.1.8 уже подготовлена pnpm release:patch --notes-file JSON --date 2026-10-21,
release:check PASS; не делать второй bump. APK только scripts/build-release.ps1.
Не публиковать до завершения QA. После публикации проверить actual OTA на5556,
сохранить checkpoint IDs/URLs и вернуть настройки эмулятора.
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
