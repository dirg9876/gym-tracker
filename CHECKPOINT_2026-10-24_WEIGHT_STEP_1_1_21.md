# Gym-Beam 1.1.21: Настраиваемый Шаг Веса

## Итог Проверок Перед Публикацией

Все499tests PASS:15repo/428mobile/21local gateway/13Worker/22gallery.
Workspace typecheck и release:check PASS. Build-release.ps1 обновил встроенные
manifest/bundle; APK code27 подписан прежним ключом, runtime1.1.0/backupv11.
Финальный APK ignored artifacts/apk/verified/gym-beam-1.1.21.apk:
SHA256 0B3A4B69DA1D9C084324D62BB6A4DBCC468A433B81C16A54F1312968CE1F6503.
Финальный Android export dist entry-51a0f568973fd821a844ed06791ae096.hbc.
Полные логи tests/typecheck/build/export-1.1.21-final в ignored verified.

Native5556 visualqa: install-r сохранил собственные QA данные. График55кг
31октября теперь поднимается до60кг21ноября, до5декабря60x12 при условии RIR4+.
Screenshot release-1.1.21-growth-final-top.png визуально проверен, перекрытий нет.
Шаг5 сохранён, active daily workout4 draft55x8. Export after-step-qa-1.1.21-visualqa
подтвердил точное совпадение всех9выполненных подходов с исходным synthetic.
Компакт320dp: chips переносятся, save/cancel помещаются; размер/density сброшены.

Restore original2подходов завершён; after-restore-1.1.21-visualqa.json точно
совпал по полным state+plans с before-step-qa-1.1.21-visualqa.json. Private audit
16staged/APK/204OTAfiles PASS. Следующий шаг: source commit/push master, GitHubReleaseAPK+production
OTA. Затем проверить применённый updateId и сохранность экспорта, CI, финальные
IDs/ссылки/checkpoint commit, остановить только собственный visualqa AVD.
Worker не меняется и не публикуется; $5/Free/подключение остаются прежними.
Прогноз является условной целью, не клинически проверенным обещанием прогресса.
Реальные телефонные данные пользователя НЕ импортировались и не редактировались.
Всё ниже до финальных publication IDs является хронологией этого выпуска.

## Актуализация: Прогноз Роста (Не Опубликовано)

Последний запрос: график55кг с октября до декабря не должен оставаться плоским.
1.1.21 ещё не опубликована, поэтому исправление включено в тот же выпуск/code27.
lib/exerciseOutlook.ts заменяет старый +1повтор/две верхние сессии будущего сценария
на условный сценарий успеха с RIR4+ и хорошей техникой. reserveRepGain и
nextWorkingLoad берутся из live trainingCoach, сохраняют ограничение шага/10%.
Первые реальные цели прежние; затем55x8,55x10,55x12,60x8,60x10,60x12 при шаге5.
Это явно подписанная цель при успешных подходах, не обещание результата и не
оценка будущего1ПМ. Гипотетические строки локальны, не записываются в state и
не обучают EMA. Долгий перерыв возвращает один облегчённый проверочный подход.
components/ExerciseOutlook.tsx показывает условия рядом с графиком/следующим шагом.
release.json теперь4заметки, версия21/runtime1.1.0 неизменны.

Предварительный APK gym-beam-1.1.21.apk (SHA75D6EC...) и dist были собраны ДО
исправления прогноза и НЕ ДОЛЖНЫ публиковаться: нужны полный retest/rebuild/export.
Native QA до этого:5556 visualqa, собственные9исторических подходов+active daily4.
UI step2,5→5 изменил прогноз52,5→55 и active draft55x8, отмена1,25 работает,
компакт320dp проверен, wm size/density reset выполнен. Данные synthetic ещё
НЕ восстановлены! Original gym-beam-original-1.1.21.json сохранён и совпадает с
before-step-qa-1.1.21-visualqa.json по полным state/plans. Для завершения:
rebuild/install без потери QA, новая растущая кривая, экспорт9подходов и сравнение,
restore original2подхода, exact compare, audit/commit/push/release/OTA/verify.
48целевых tests PASS до добавления ещё одного теста разрыва дат; полный новый
прогон/typecheck/build ещё впереди. Checkpoint ниже содержит предшествующую
хронологию и параметры; этот раздел приоритетнее старых отметок состояния.

Дата24октября2026, Europe/Moscow; workspace C:\gymbeam, master.

## Цель

Пользователь хочет менять шаг веса в упражнениях, с пересчётом прогнозов и
назначений тренировок. Исходный выпуск1.1.20/code26/runtime1.1.0 опубликован,
483tests/typecheck/CI PASS; подробности CHECKPOINT_2026-10-24_RESPONSIVE_PROGRESSION_1_1_20.md.
Следующий отдельный логический выпуск1.1.21/code27, runtime1.1.0/backupv11 сохранить.

## Контекст И Решения

weightStepKg уже хранится в каталоге, допустим0.25–20кг. В общем ExerciseEditor
есть Stepper, но app/exercises/[id].tsx не позволяет изменить шаг. Математика
prediction/analysis/outlook/daily/AI context уже предпочитает шаг из каталога.
PATCH шага сейчас только увеличивает draftRevision, оставляя сохранённые
будущие цели активного daily-плана со старым шагом. Надо исправить эту связку.

Добавить компактный Stepper на экран упражнения, явное сохранение/отмену,
инвалидацию всех связанных React Query данных. Для секунд не показывать шаг кг.
При сохранении пересчитать только невыполненные цели активного daily-плана и
автоматический draft, если его числовые значения всё ещё совпадают с прежней
целью. Вручную изменённый draft, ручные шаблоны и история не переписываются.
Новый шаг/планы/draft сохранять одной существующей транзакцией. AI optional,
новых контрактов/платных запросов/обязательного сервера не добавлять.

## Следующий Шаг И Проверки

Реализовать UI/API, регрессии на прогнозы/дневной и месячный план/AI/active draft,
защиту истории, ручного ввода, backup, stale revision и interrupted write.
Затем tests/typecheck, patch/release:check, штатный build-release.ps1, native QA
с собственным synthetic backup и точным восстановлением baseline. Source/APK/
Android export audit, commit/push master, APK в GitHub Release, production OTA,
проверить применение и записать итоговые IDs/SHA/ограничения/следующий шаг сюда.
Сейчас оба QA AVD остановлены. Сохранять ключ, историю, .agents metadata и
unrelated untracked assets. CHECKPOINT.md должен указывать на этот checkpoint.

## Реализация И Тесты

Создан components/ExerciseWeightStep.tsx на существующих Stepper/Button/Toast,
без текстового ввода веса, с сохранением/отменой и блокировкой повторного save.
app/exercises/[id].tsx показывает контрол над прогнозом кроме timed-упражнений.
Shared WEIGHT_STEP_PRESETS в equipmentSettings.ts, используется также полным
EquipmentSettingsFields. SavedWorkoutPlan при добавлении берёт шаг каталога,
не произвольный1/2,5кг; Android KeyboardAvoidingView приведён к native resize.
В offlineApi.updateExercise новый stepChanged пересчитывает невыполненные
targets active daily-плана и нетронутый числовой draft; metadata шага обновляется
и в active manual-плане, но его числа остаются прежними. Сохранение атомарное,
старая draftRevision/старый daily fingerprint не могут перезаписать новый расчёт.
Категория/единицы/число выполненных подходов/история не меняются от смены шага.

12новых exercise-step.test.mjs регрессий PASS: live/daily/stats/monthly/AI targets,
microstep/oversized guard, active untouched/manual drafts, completed targets,
literal templates, backup, invalid input и rollback interrupted write.
Итог495tests PASS:15repo/424mobile/21gateway/13Worker/22gallery. Typecheck PASS.
Месячные детерминированные сценарии включены в полный test; новых правил
безопасности прогрессии нет, только применение уже настроенного кванта.
Штатный bump1.1.21/code27/runtime1.1.0,3русские заметки. Build-release.ps1 PASS
(build-1.1.21.log), прежний ключ. Android export выполняется. Worker/ledger/5USD
не меняются: никаких изменений shared AI кода и никаких model-вызовов.

5556 gymbeam_visualqa запущен для native QA, не5554. Созданы ignored own helpers
prepare-qa-1.1.21.mjs/import-qa-1.1.21.ps1. Synthetic backup9исторических подходов,
active daily push workout4, прежний step2,5/цель52,5. Original alias21 — точная
копия after-ota20 baseline2подходов. Данные пока не импортированы; дождаться полного
boot перед adb push, первоначальная попытка push до монтирования sdcard не удалась.
Следующий шаг: native21/notes/backup-before, импорт ownQA, поменять шаг через UI
2,5→5, увидеть55в прогнозе и draft workout4, экспорт/check/restore original,
затем audit/commit/master/GitHubAPK/OTA и контроль сохранности. Другие AVD/data
не трогать, артефакты QA не добавлять в Git.
