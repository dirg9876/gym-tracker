# Gym-Beam 1.1.13: Цель, Диапазоны И Научная Опора

## Цель И Текущий Статус

22 октября 2026, C:\gymbeam, PowerShell. Пользователь: цель «Мышцы» должна
влиять на алгоритм; назначения надо обосновывать расчётами и реальными источниками.
Пользователь явно выбрал8–12 для основных упражнений и10–15 для изоляции,
а не жёсткое12 для всех. Не утверждать, что >12 исключает гипертрофию.
Реализация готова; публикация и nativeQA ЕЩЁ НЕ ЗАВЕРШЕНЫ на момент этой записи.
Последний опубликованный выпуск1.1.12 (sourcefcb33fe); master до новых изменений
83fb781f840b588f2731890de90972b9fecdb333. Сейчас изменения НЕ закоммичены.

Версия повышена ОДИН РАЗ release:patch:1.1.13, Android19, runtime1.1.0,
backupv10. Это JS-совместимый выпуск, нативные зависимости не менялись.
Повторно patch не запускать. AGENTS.md обновлён на1.1.13.

## Решения И Реализация

- shared training-model/goalPrescription.ts: единые диапазоны/целевой RIR2,
  цель силы3–6 для основных, Muscle8–12/10–15. Тип движения по названию/группе,
  не по оборудованию или уровню. Французский/икроножный жим — изоляция.
  Это эвристика каталога и продуктовая схема, не единственный научный оптимум.
- ProgressionController получает repsMax и ограничивает ВСЕ ветки, включая
  отсутствие измерения и калибровку. Бесконечного роста повторов быть не должно.
  Короткий probe допускается ниже рабочего минимума; тяжёлые синглы не рабочая цель.
- Автосплит/месяц/активный прогноз/анализ/AI-план используют одну политику.
  Старые20–25повторов из month targets не задают новый рабочий диапазон.
  При Muscle случайный чужой customProgram не переопределяет цель.
  Явно выбранный ручной planned диапазон разрешён. История не переписывается.
- На потолке HOLD, а не «добавьте повторы». Прибавка лишь после2полных
  сопоставимых сессий с RIR/техникой, один шаг<=2,5кг и возврат к минимуму.
  Эти пороги — осторожные guardrails, а не цитата/протокол ACSM/IUSCA.
- calibrateRemaining сохраняет фактический выполненный20, но будущие цели<=max;
  собственный вес на12 не получает13 при max12. Большие шаги вручную.
- AI proposal/apply сохраняет полноценный рабочий диапазон, не схлопывает
  его к одному числу из первого target и не расширяет по выполненной истории.
- TrainingBasis.tsx: сворачиваемое «Основания расчёта» перед стартом и в разборе,
  формулы/ограничения/две кликабельные ссылки. В daily note цель, диапазон,
  оценка1ПМ, неокруглённый расчёт, фактический шаг, итог. prepared reason обрезан
  до400 символов существующего строгого контракта, сам локальный note полный.
- ModelForecast: raw predictedReps явно «математическая оценка, не цель подхода».
- COACH_EVIDENCE v2, sourcesACSM2026+IUSCA2021, инструкции обоснования
  «история/расчёт → принцип → решение/неопределённость». PROMPT_VERSION
  coach-v10-goal-evidence для сброса устаревшего кэша без сброса бюджета.
  API/context schema не расширялась. Worker НУЖНО задеплоить после тестов;
  модель gpt-6-luna/ключи/DO/лимит$5/WorkersFree не менять, paidcalls не нужны.

## Источники

Проверены браузером, первичные:
https://acsm.org/resistance-training-guidelines-update-2026/
https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf
https://doi.org/10.47206/ijsc.v1i1.81
https://andrewvigotsky.com/studies/Schoenfeld_2021_IJSC_hypertrophy_pos_stand.pdf

ACSM: индивидуализация/регулярность, объём важен для гипертрофии, отказ не обязателен.
IUSCA: широкая область нагрузок для гипертрофии, умеренная нагрузка практична.
Нет доказательства точного персонального веса, RIR2 или границы12.
Epley+RIR/EMA0,2/28дней/поправка утомления/related coefficients явно приближённые
допущения. Платный живой поиск исследований в тренере не включён.
Дополнительно прочитана official OpenAI prompt-engineering documentation;
провайдер/модель/API не мигрировали.

## Файлы

Новые: lib/ai-coach/src/training-model/goalPrescription.ts,
mobile/components/TrainingBasis.tsx, mobile/scripts/goal-prescription.test.mjs.
Изменены shared index/evidence/progressionController; mobile lib adaptiveWorkout,
dailyWorkout, trainingPrediction, trainingAnalysis, trainingCoach, workoutTemplates,
aiCoachPlan, aiCoachContext, offlineApi; app start-workout/coach-session;
components ModelForecast/WorkoutAnalysis; scripts/training-model.test.mjs;
API provider/coach-gateway.test и Worker worker.test; docs/TRAINING_MODEL.md;
app.json/release.json/AGENTS.md/этот checkpoint/rootCHECKPOINT.md.
NotesJSON ignored artifacts/apk/verified/release-notes-1.1.13.json.

## Проверки И Следующий Шаг

- Новые6тестов сначала дали5FAIL: потолок контроллера, калибровка13,
  старый шаблон, месяц25, потерянный isolation ceiling. После исправления PASS.
- Добавлены ещё5: классификация, источники/допущения, короткий isolation probe,
  точные числа обоснования, диапазон применённого AI-плана.
- Mobile331PASS, API21PASS. Workspace typecheckPASS до последних UI/doc-уточнений,
  надо финально повторить. Release:check1.1.13/code19/runtime1.1.0PASS.
- Worker сначала12PASS/1FAIL: mock проверял старую research.version; исправлен,
  ТРЕБУЕТСЯ повторить все13. Это не ошибка работающего gateway.
- journey ещё работает: unified exec session39894, вывод redirected
  artifacts/apk/verified/journey-1.1.13.log. Дождаться write_stdin.
- AVD gymbeam_visualqa стартован Hidden,5556, no-snapshot-load/no-audio:
  emulatorPID10528/qemu6316. sys.boot_completed был пуст, затем adb не увидел
  устройство; процессы ещё есть. Проверить подключение/порт, НЕ трогать primary5554.
- СВЕЖИЙ экспорт QA перед изменением данных/установкой ещё НЕ сделан.
  Экспорт helper artifacts/apk/verified/export-qa-1.1.12.ps1 может сохранять
  новый Name. Старый baseline НЕ восстанавливать вслепую. Если есть activeworkout,
  не перезаписывать. Новые fixtures должны быть только на5556 и после свежего backup.
- Далее: Worker/design/typecheck/journey финально; native backup; APK через
  mobile/scripts/build-release.ps1; UI обычный/малый экран и данные; точный restore;
  git secret audit; commit/pushmaster; Worker deploy с --free-plan-confirmed
  без secrets/budget reset; freshExpoexport/productionOTA и реально применить;
  GHReleaseAPK1.1.13; финальные IDs/hash/checkpoint. Ничего ещё не опубликовано.

Сохранить чужие dirty .agents/agent_assets_metadata.toml и generatedmockup,
старые untracked checkpoints/attached_assets. Не stage их, не откатывать.
Оригинальный signingkey не менять; APK/секреты/backup/SDK/AVD вGit запрещены.
Нативный runtime1.1.0 стабильный. Windows JDK17/SDK и команды публикации
описаны в предыдущем CHECKPOINT_2026-10-22_RELEASE_1_1_12.md.
