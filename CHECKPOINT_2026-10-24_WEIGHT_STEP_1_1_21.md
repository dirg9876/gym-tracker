# Gym-Beam 1.1.21: Шаг Веса И Сценарий Роста

Дата: 24 октября 2026, Europe/Moscow. Workspace: C:\gymbeam, ветка master.
Работа завершена и опубликована. Следующий логический выпуск приложения: 1.1.22.

## Цель И Решения

Пользователь попросил менять шаг веса в упражнении с пересчётом тренировок и
прогнозов. Во время проверки показал плоский график55кг с октября до декабря.
Исправления объединены в ещё не опубликованный на тот момент выпуск1.1.21:
Android versionCode27, runtime1.1.0, backupv11. Новых native API/зависимостей нет.
Существующий ключ подписи сохранён. Android-only/offline-first/AI optional.

Раньше будущий сценарий добавлял только1повтор и требовал двух верхних занятий,
хотя live-прогрессия уже умела реагировать быстрее на большой запас. Теперь
будущие цели используют reserveRepGain/nextWorkingLoad из trainingCoach, с
явной гипотезой RIR4+ и хорошей техники во всех подходах. Проверенный пример:
55x8 →55x10 →55x12 →60x8 →60x10 →60x12 при шаге5кг. Первое назначение по
реальной истории не меняется. Это целевой сценарий, не обещание роста силы.
Условные строки локальны, не записываются в историю и не обучают EMA.
Шаг>10%, плохая техника/малый запас, калибровка, длинный перерыв и разные единицы
по-прежнему защищены. В UI условия указаны рядом с графиком и следующим шагом.

## Изменённые Файлы

- components/ExerciseWeightStep.tsx: новый контрол на Stepper, диапазон0,25–20кг,
  пресеты0,25/0,5/1/1,25/2,5/5/10, явные save/cancel, блокировка double-save,
  ошибки без потери draft, инвалидация связанных query. Без TextInput веса.
- app/exercises/[id].tsx: контрол над прогнозом; скрыт для секунд, старый
  прогноз скрывается во время сохранения.
- lib/equipmentSettings.ts и components/EquipmentSettingsFields.tsx: общие пресеты.
- lib/offlineApi.ts/updateExercise: смена шага атомарно пересчитывает оставшиеся
  цели active daily-плана и untouched automatic draft, повышает draftRevision.
  Выполненные подходы, completed targets, manual draft и ручные шаблоны неизменны.
  У active manual-плана обновляется только metadata шага.
- components/SavedWorkoutPlan.tsx: новые упражнения используют шаг каталога,
  Android KeyboardAvoidingView не дублирует native adjustResize.
- lib/exerciseOutlook.ts, components/ExerciseOutlook.tsx: целевой сценарий роста,
  общий live progression guard, RIR условия и ориентировочная дата следующего веса.
- scripts/exercise-step.test.mjs:12 новых регрессий UI/API/active/month/AI/backup/
  invalid/stale revision/atomic rollback. exercise-timeline.test.mjs: ещё4
  регрессии55→60, совпадения целей с реальным дневником, read-only/EMA и перерыва.
  progress-outlook.test.mjs: уточнено название существующей проверки.
- app.json/release.json:1.1.21/code27,4русские заметки; AGENTS.md/CHECKPOINT.md.

## Проверки

499tests PASS:15repo +428mobile +21local gateway +13Worker +22gallery.
Workspace typecheck, release:check, штатный build-release.ps1, Android export PASS.
CI source commit: https://github.com/dirg9876/gym-tracker/actions/runs/40099011938
PASS: types/tests/release/gallery/optional gateways dry builds/Android export.
Private audit16staged source files/APK entries/204OTA files PASS. Секреты не
печатались и не добавлялись. Платных AI вызовов/перехода на платный тариф не было.

Native QA: только собственный AVD gymbeam_visualqa/emulator-5556.
Baseline2подхода экспортирован до теста. Собственный synthetic backup9подходов
и active daily workout4: UI2,5→5 меняет52,5→55 в forecast и active draft.
Сохранение/отмена и компакт320dp проверены, текст помещается; wm size/density reset.
Новый график:31октября55кг,21ноября60кг,5декабря60x12 при обозначенных условиях.
Экспорт после изменения подтвердил все9реальных тестовых подходов без изменений.
Original2подхода восстановлен, полный state+plans точно совпал с baseline до теста.
После OTA снова экспорт/deep compare полных state+plans PASS. На Updates виден
01a16e23. Холодный offline запуск после force-stop com.dirg9876.gymtracker PASS:
стакан на Главной виден, кэшированная OTA работает. Сеть AVD восстановлена.
Окно первого выпуска проверено, ручное «Что нового» показало все4итоговые заметки.
AVD остановлен; adb devices пуст. Телефонные данные пользователя не трогались.

Ignored QA artifacts: artifacts/apk/verified/*1.1.21*.
Логи tests/typecheck/build/export-1.1.21-final; screenshots growth-final-top,
final-notes, step-compact-edit, ota-applied, offline-cold-home.
before-step-qa-1.1.21-visualqa.json, after-step-qa-1.1.21-visualqa.json,
after-restore-1.1.21-visualqa.json, after-ota-1.1.21-visualqa.json.
Предварительный APK с плоским графиком заменён финальной сборкой, не публиковался.

## Публикация

Source commit:93526ada1eed2b04d5071662c9067b367c106fde, master/origin/master.
APK: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.21/gym-beam-1.1.21.apk
Release: https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.21
Asset153069085bytes, uploaded; GitHub digest совпал с локальным SHA256:
0B3A4B69DA1D9C084324D62BB6A4DBCC468A433B81C16A54F1312968CE1F6503.
Signing certificate SHA256:
dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.

EAS project @dirg9508/gym-tracker-mobile,
id dabd3128-415f-4a2f-8c73-3b0a52585149, Android production/runtime1.1.0.
OTA update:01a16e23-87fe-7fc5-a516-cb6ae93476b9.
Group:219576cd-5d6b-4a48-8437-77d51d4d8687, createdAt2026-10-24T13:39:44.766Z.
Source commit в EAS совпал. Export entry-51a0f568973fd821a844ed06791ae096.hbc.
Публикация и фактическое применение проверены, не только git push.
На телефоне: Главная →значок загрузки →Проверить обновления →Применить обновление,
вне активной тренировки. Удаление приложения не требуется.

Worker не менялся:189a8063-5928-453c-aed1-8476ebf4e170/evidencev4,
https://gym-beam-coach.dirg9876.workers.dev, Free/$5 ledger сохранён.
Адреса/owner token/API key/connection files нельзя публиковать как credentials.

## Ограничения И Следующий Шаг

Незавершённой работы по запросам шага веса и плоского сценария нет.
Прогноз условный: не доказательство реального индивидуального прироста, не
клиническое исследование. Проверки на AVD и synthetic diaries, не телефоне.
Если очередной реальный подход тяжёлый, приложение должно снижать/держать цель,
даже если прежняя условная линия показывала рост. При слишком крупном шаге
предложить меньший шаг, не увеличивать вес только ради восходящего графика.

Перед новой задачей прочитать AGENTS.md, этот checkpoint, git status.
Новый логический app release1.1.22 через release:patch; runtime1.1.0 оставлять
для native-compatible изменений. APK собирать только scripts/build-release.ps1,
выпускать с прежним локальным ключом, assets в GitHub Release, никогда в Git blobs.
Не трогать .agents/agent_assets_metadata.toml, старые untracked checkpoints,
attached_assets и error.log: это посторонние исходные изменения. Секреты,
личные backups, SDK/AVD и ignored QA не stage-ить. Не force-push master.
