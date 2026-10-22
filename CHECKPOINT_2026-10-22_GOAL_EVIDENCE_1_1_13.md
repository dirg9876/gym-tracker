# Gym-Beam 1.1.13: Цель, Диапазоны И Научная Опора

## Цель И Текущий Статус

22 октября 2026, C:\gymbeam, PowerShell. Пользователь: цель «Мышцы» должна
влиять на алгоритм; назначения надо обосновывать расчётами и реальными источниками.
Пользователь явно выбрал8–12 для основных упражнений и10–15 для изоляции,
а не жёсткое12 для всех. Не утверждать, что >12 исключает гипертрофию.
Задача ЗАВЕРШЕНА: версия1.1.13 в master, APK/GitHubRelease/productionOTA
опубликованы, Worker обновлён, nativeQA и сохранность прогресса проверены.
Source814b16c9ef0efbf32beb1e00e71b0d9ccbb74ccd; до изменений master был
83fb781f840b588f2731890de90972b9fecdb333. Финальное уточнение checkpoint
сохранено отдельным docs-коммитом после публикации; код приложения не менялся.

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
  API/context schema не расширялась. Worker задеплоен; модель gpt-6-luna,
  ключи/DO/лимит$5/WorkersFree сохранены, новых paidcalls0.
- Локальная loadTargets.calibration имеет приоритет над усечёнными12занятиями
  AI-контекста: знакомое упражнение из полной истории не становится снова новым
  probe8 вместо рабочего15 только из-за сокращения передаваемых данных.

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

## Результаты Проверок

- Новые6тестов сначала дали5FAIL: потолок контроллера, калибровка13,
  старый шаблон, месяц25, потерянный isolation ceiling. После исправления PASS.
- Всего12новых регрессий: дополнительно классификация, источники/допущения,
  короткий isolation probe, точные числа обоснования, диапазон применённого
  AI-плана и приоритет полной локальной истории над усечённым AI-контекстом.
- Финально388PASS: mobile332, API21, Worker13, design22. TypecheckPASS;
  CI814b16cSUCCESS: https://github.com/dirg9876/gym-tracker/actions/runs/39828572591 .
  Release:check1.1.13/code19/runtime1.1.0PASS.
- Worker mock сначала ожидал старую research.version; исправлен, все13PASS.
- Симуляция624тренировок/8970подходов findings[]; уровень13 при обычных весах,
  отдельная elite-boundary проверка до80PASS. Не обещает МСМК обычному новичку.
- build-release.ps1 финально1м13с/835задач/36выполнено, BOTH свежие встроенные
  manifest и JS bundle. APK заново собран после последнего исправления;
  промежуточные хеши не публиковались. Старая подпись подтверждена.
- Секрет-аудит29source-файлов/1448распакованныхAPK/204freshOTA PASS.
- Native только gymbeam_visualqa/5556. Свежий baseline12533байта:
  artifacts/apk/verified/before-release-1.1.13-visualqa.json,
  2завершённых/2подхода/32упражнения/1свойвид/0активных/0планов.
  Установка поверх1.1.12 сохраняет state И plans точно.
- Собственная QA-копия с месяцем по25повторов: native предлагает bench70×8,
  isolation10×15, plank45с; диапазоны[8,12]/[10,15]/[45,45]. Старт сохраняет
  эти цели и черновик, не создавая выполненные подходы. Числа проверены экспортом
  native-goal-plan-1.1.13.json; исходные6синтетических подходов не изменились.
- Native отображает цель/RIR2/оценку1ПМ93,33кг/расчёт70кг/шаг2,5 и ограничения.
  Источники доступны прокруткой. Обычный1080×2400 и малый360×640/font1,3:
  текст переносится, источники/кнопки не пересекаются, старт остаётся доступен.
  Заголовок на малом экране штатно сокращается многоточием.
- После QA восстановлена ТОЧНАЯ свежая исходная копия:
  after-qa-restored-1.1.13.json state/plans deepEqualPASS.
- ProductionOTA реально проверена/скачана/применена в приложении. Экран показывает
  1.1.13/update01a164cd, включая холодный офлайн-запуск. Итоговый экспорт
  after-production-ota-1.1.13.json снова state/plans deepEqual с baselinePASS.
  Окно новых версий и ручной вход «Что нового» сохранены.
- Шлюз до/после deploy ready=true, лимит$5, used0.0318788USD,
  reserved0.0138336USD точно неизменны. Это прежние расходы/резервации;
  новый платный запрос/сброс журнала не выполнялся. DO binding/migration прежние.

## Публикация

APK: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.13/gym-beam-1.1.13.apk
GitHubRelease421043778, asset666662386, latest, target814b16c9ef0efbf32beb1e00e71b0d9ccbb74ccd.
Размер152433167байт. SHA256EB3A9EE17714DAE7260001B799693272C85676C8E2C11DA629CAA0D3C578EDE2.
Release asset digest совпал с локальным файлом.
Сертификатdfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.

ProductionOTA Android/runtime1.1.0:
update01a164cd-c20a-7420-a378-c4514c584ad3,
groupc95b704e-a299-412c-a14c-2c32270a711a,
bundleentry-b3d00a3c1efc0cee3f66d0b770c8d860.hbc,
source814b16c9ef0efbf32beb1e00e71b0d9ccbb74ccd.
Fresh expo export --platform android --clear, EAS16.32.0,
productionbranch/environment, skip-bundler. OTA реально применена и offlinePASS.

Worker https://gym-beam-coach.dirg9876.workers.dev,
versioncb20c850-30e0-4d80-a8e1-c2eeb38d4975, promptcoach-v10-goal-evidence,
evidenceacsm-2026-iusca-2021-v2. Публикация deploy.mjs --publish
--free-plan-confirmed, без secret bulk и без новых миграций/DO/тарифа.

Телефон: завершить активную тренировку > Обновления > Проверить обновления >
Применить обновление. Либо APK поверх прежнего приложения, не удаляя его.
Цель «Мышцы» сохраняется в настройках тренера и влияет на локальный расчёт,
даже когда ИИ отключён. Повторная публикация1.1.13 не нужна.

## Ограничения И Продолжение

Не делали новый платный тест реального ответа LLM: provider payload, нормализация,
кэш/лимит и Worker проверены автоматическими тестами; deploy/status реальны.
Источники — проверенная статическая сводка, не живой поиск на каждый подход.
Формула/RIR/название движения/полнота журнала приблизительны, не клинический совет.
Неопределённые названия пользовательских упражнений могут требовать уточнения
названия/группы или явно выбранного ручного диапазона. Планка остаётся в секундах.

AVD первый раз завершился во время сборки; повторный старт с1536MB и остановка
своего GradleDaemon устранили нехватку ресурсов. На маленьком экране import-modal
нужно прокрутить до кнопки: простой старый helper Tap-Text может попасть вне
видимой области. Все окончательные restore выполнены при исходном размере,
проверены последующим экспортом. Случайно начатая пустая тренировка была ТОЛЬКО
в собственной QA-копии и удалена точным restore, не в пользовательских данных.

Локальные helpers/fixtures/screens/logs/APK ignored artifacts/apk/verified.
Перед новыми изменениями на эмуляторе делать НОВЫЙ экспорт, не восстанавливать
baseline1.1.13 вслепую. Не трогать5554. Все необходимые exec sessions завершены;
QA-настройки размера/шрифта/сети восстановлены, собственные sharedQAJSON удалены,
AVD5556 и свой GradleDaemon остановлены.

Следующий завершённый логический выпуск1.1.14, не менять runtime при JS-only.
Следующий полезный шаг — разбор нового реального примера назначения, если
пользователь обнаружит расхождение с целью; дополнительной публикации сейчас нет.

Сохранить чужие dirty .agents/agent_assets_metadata.toml и generatedmockup,
старые untracked checkpoints/attached_assets. Не stage их, не откатывать.
Оригинальный signingkey не менять; APK/секреты/backup/SDK/AVD вGit запрещены.
Нативный runtime1.1.0 стабильный. Windows JDK17/SDK и команды публикации
описаны в предыдущем CHECKPOINT_2026-10-22_RELEASE_1_1_12.md.
