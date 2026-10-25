# Gym-Beam 1.1.24: Компактная Тренировка И Правка Подходов

Дата: 25 октября 2026, C:\gymbeam, ветка master. Работа завершена и опубликована.
Пользователь согласовал первые три предложения: компактный экран тренировки,
подтверждение перенесённых оценок RIR/техники и исправление записанных подходов.

## Результат

- На активной тренировке рядом вес/повторы, краткая цель, оценка и компактный таймер. План, прошлые результаты, нормы, подробные расчёты и AI доступны в раскрытии «План и расчёты». Выполненные подходы раскрываются отдельно. Основная запись закреплена снизу.
- RIR/техника сохраняют выбранные позиции между подходами. «Оценка актуальна» подтверждает их одним нажатием. Неподтверждённая перенесённая оценка видна, но записывается как null и не используется как свежая обратная связь математической моделью или ИИ. Старые оценки в истории не переписываются. Калибровка требует явных оценок.
- Карандаш у подхода открывает единый редактор в активной тренировке и истории. Можно изменить вес, повторы, секунды, RIR и технику. Прямой ввод веса не добавлен: сохранены Stepper/presets.
- Итоги, рекорды, прогнозы и оставшиеся автоматические daily targets пересчитываются. Выполненные targets, ручной черновик, пользовательские шаблоны и таймер не переписываются. Правка завершённой тренировки ставит задачу автокопии, если она включена.

## Архитектура

Приложение только Android, offline-first, AI шлюзы опциональны. Версия1.1.24,
Android versionCode30, expo.runtimeVersion1.1.0 без изменения нативной совместимости.
Backup остаётсяv11, строгий WorkoutDraft не расширен. WorkoutRow получил optional
draftAssessment:{rir:boolean,technique:boolean,revision:number}, привязанный к
draftRevision. Отсутствующий/устаревший metadata означает неподтверждённую оценку.
DraftResponse.assessment опционален; явный выбор поля подтверждает только его.

Новые GET/PATCH /api/sets/:id. PATCH:{revision,values:{weightKg,reps,
durationSeconds?,rir,technique}}. Только разрешённые поля, исторические единицы и
bodyweight/equipment/dumbbellCount snapshots. Сохраняются id/createdAt/связи;
optional revision/editedAt добавляются. Конфликт409; одинаковый replay после
потерянного ответа идемпотентен. История/plans/backup jobs сохраняются транзакцией;
активный draftRevision меняется для защиты от старого совета. Query caches
инвалидируются. Android adjustResize, iOS-only KeyboardAvoidingView и gesture roots
в модальном редакторе сохранены. Платных AI-вызовов и нового Worker deploy не было.

## Файлы

Все пути ниже относительно artifacts/gym-tracker-mobile:

- Новые components/SetEditor.tsx, lib/setEditing.ts, scripts/set-corrections.test.mjs.
- UI: app/workout/[id]/index.tsx, app/history/[id].tsx, components/SetCard.tsx, components/TrainingTimer.tsx.
- Данные: lib/offlineApi.ts, lib/workoutDraft.ts, hooks/useWorkoutDraft.ts, lib/progressBackup.ts, lib/workoutMeasurement.ts, lib/aiCoachContext.ts.
- Tests: scripts/testHarness.mjs, scripts/workout-draft.test.mjs. Release: app.json, release.json; в корне AGENTS.md и CHECKPOINT.md.

## Проверки

pnpm test:543 PASS (15root/472mobile/21API/13Worker/22art), новые17/17. Workspace
pnpm typecheck, pnpm release:check, git diff --check PASS. Штатный build-release.ps1:
BUILD SUCCESSFUL; свежие embedded Expo manifest и JavaScript проверены. Android
export успешен: entry-eaf908c86a7f849eba0ba5bd6b51c6ae.hbc. Audit20stagedfiles,
APK entries и204OTAfiles не нашёл приватных значений. CI source release SUCCESS:
https://github.com/dirg9876/gym-tracker/actions/runs/40171905737

Native QA на собственном gymbeam_visualqa/emulator-5556: установка поверх прежней
версии сохраняет данные; основной экран1080×2400 и узкий320dp осмотрены; активная
правка52.5→55кг пересчитала следующую цель, таймер остался пауза1:56; история50×12→13
пересчитала1850кг/37повторов. Native export подтверждает12syntheticsets, null/null
у неподтверждённой оценки и2/good после подтверждения. Автоокно «Что нового» не
мешает активной тренировке, после возврата домой показано; ручной вход проверен.

До QA собственный исходный дневник имел2sets/2finished/0active. Экспорт
before-workout-qa-1.1.24.json совпал с owned original23; после QA восстановлен
gym-beam-original-1.1.24.json. after-restore-1.1.24.json и
after-ota-offline-1.1.24.json точно совпали с baseline по полным state/plans.
OTA применилось, cold start без сети работает, стакан на главной виден.
ReactNativeJS/AndroidRuntime errors отсутствуют. Density/size и airplane mode
восстановлены, проверочный AVD завершён. Screenshots/logs/backups только в ignored
artifacts/apk/verified. Реальные пользовательские экспорты не импортировались.

## Публикация

Source commit af606b106d653ec96112a976c766909ae406ecf9 в master/origin/master.
GitHub Release v1.1.24, APK153145989bytes; uploaded asset digest совпадает:
AEB1CDE59034D7E1DAE87F6B480001652C56CE4A776F443831EFC2A260FAEB9C.
https://github.com/dirg9876/gym-tracker/releases/download/v1.1.24/gym-beam-1.1.24.apk

EAS Android production/runtime1.1.0,25.10.2026 07:13:30UTC:
update01a171e8-45d4-7bd5-8e34-1663751814f3,
group648fb50f-0616-42ca-adeb-79c8764e7c14, gitCommitHash совпадает с source.
В установленном приложении реально показано «Обновление 01a171e8».
Обновление: Главная > облако > Проверить обновления > Применить обновление,
после завершения активной тренировки. APK также ставится поверх с прежней подписью.

## Продолжение

Обязательных изменений по этой задаче нет. Не проверялись физический телефон и
платный end-to-end AI; timed/assisted/парные гантели покрыты API-тестами, нативно
редактировался жим. Прогнозы остаются условными, не гарантией реального прироста.
Следующее изменение согласовать отдельно и выпускать1.1.25 по AGENTS.md.
Сохранить посторонние .agents/agent_assets_metadata.toml и untracked assets/docs;
они не включены в релиз. Финализация checkpoint отдельным documentation commit.

Среда: Node24.14 через C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin,
pnpm10.33.2, JDK17 C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot,
ANDROID_HOME=C:\gymbeam\artifacts\android-sdk, ANDROID_AVD_HOME=C:\gymbeam\artifacts\android-avd.
APK только scripts/build-release.ps1 с прежним закрытым ключом, не генерировать
замену. Версии менять pnpm release:patch --notes-file <JSON-array>, release:check.
Секреты/ключи/owner-token/личные backups/SDK/AVD никогда не добавлять в Git.
