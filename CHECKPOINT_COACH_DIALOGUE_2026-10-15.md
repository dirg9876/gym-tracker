# Gym-Beam: AI dialogue checkpoint

АРХИВ. Этап включён в code5; актуально CHECKPOINT_2026-10-16_AI_COACH.md.
Ниже история промежуточной реализации, не текущее состояние процессов/APK.

2026-10-15, Europe/Moscow. В РАБОТЕ, продолжать из C:\gymbeam (PowerShell).

## Цель

Пользователь разобрался с подключением ИИ. Нужны зелёная молния при ON, запуск
«Начать тренировку с ИИ» с Главной, подсказки действий, короткие сообщения во время
занятия (занят тренажёр, сменить мышцы, усталость), описание возможностей и выбор
моделей в личном API-бюджете $5/мес. Предыдущий reconnect fix не терять.

## Решения и код

- Home читает useAiConnection; ON = зелёная молния и отдельная AI-кнопка. При активной
  тренировке открывает её диалог, не создаёт вторую. OFF обычное ведение дневника.
- Новый app/coach-session.tsx: KeyboardAvoidingView, короткое сообщение до300 символов,
  быстрые команды (без платного запроса до отправки), история последних6 сообщений
  только в памяти экрана. При OFF история очищается. Сервер принимает максимум7
  сообщений, role=user/assistant, последние должны быть user, assistant до2000 знаков.
- Shared lib/ai-coach/src/index.ts: новая task adjust_workout, optional messages и
  remainingPlan, только оставшиеся подходы. Старые JSON-контексты сохраняют fingerprint.
  Проверки единиц, барbell>=20, неизвестный новый вес=null, без повышения >2.5кг,
  исключения/equipment/RIR/техника остаются. performedSetCount учитывает весь объём.
- lib/aiCoachContext.ts строит контекст: последние12 завершённых + текущая тренировка,
  максимум160 подходов,120 упражнений,3 шаблона; текущий черновик не выполненный подход.
  Для adjust загружается сохранённый план, вычитается число выполненных подходов.
- Новый POST offline /api/ai-coach/apply-plan: под progress lock проверяет актуальный
  fingerprint, валидирует ручные правки и атомарно сохраняет state+plan. Новую сессию
  создаёт только после подтверждения. Коррекция сохраняет реальные записи и добавляет
  выполненные targets к оставшимся, чтобы completedTargets не засчитывал новое как старое.
  Профиль/цели постоянной программы не изменяет. Ничего не записывает как выполненное.
- aiCoachPlan хранит optional session proposal с envelope/context; coach-plan и
  SavedWorkoutPlan используют существующий редактор для калибровки/подходов и отдельный
  confirm start/apply. Обычное сохранение шаблонов остаётся доступным прежним путём.
- ActiveWorkout: «Написать тренеру» доступно без выбранного упражнения; план перечитывается
  при фокусе. useAiCoach проверяет свежесть с теми же messages и отбрасывает поздние ответы.
- lib/ai-coach/src/evidence.ts: curated ACSM2026 pack, источник
  https://pubmed.ncbi.nlm.nih.gov/41843416/ (DOI10.1249/MSS.0000000000003897).
  Прогрессия/объём/отказ/оборудование, здоровые взрослые, не реабилитация. Модель не
  выполняет live literature search и не должна выдумывать статьи. Ссылка в диалоге.
- provider.ts PROMPT_VERSION=coach-v3-evidence-dialogue, MODEL=gpt-6-luna, reasoningnone,
  max_output_tokens2400, storefalse, retries0, timeout45с, без web tools. Цены проверены:
  Luna $0.10/$0.50 за1M input/output; GPT6.1Sol $2/$10, reasoningnone не поддерживает.
  Дорогую модель не включали. Предложить Sol для периодического анализа после eval.
- app.json versionCode4, version1.0.0. Stepper не менялся. Credentials только SecureStore.

## Проверки и параметры

- Mobile151/151 PASS (новый scripts/coach-dialogue.test.mjs12tests), Node14/14,
  Worker9/9, root pnpm typecheckPASS перед последним performedSetCount patch.
- Code4 полная native сборка уже прошла; после последнего маленького patch повторяется
  в exec session19525. Лог artifacts/apk/verified/coach-dialogue-build.log.
- Production Worker обновлён helper scripts/deploy.mjs --publish --free-plan-confirmed,
  version3db46d72-47b0-4f69-bb04-134f92ebc6cd. После performedSetCount patch redeploy needed.
- Production https://gym-beam-coach.dirg9876.workers.dev, WorkersFree. SingletonDO owner-v1.
  Immutable seed .cloud-deploy/seed.json month2026-10 usedNanoUsd1893100 reservedNanoUsd0
  НЕ менять: live ledger отдельно и не сбрасывается. До deploy live used$0.0032627,
  reserved$0.0034804, limit5. Расход вырос от пользователя; текущих paidcalls0.
- Secrets: api-server/.env.coach, .coach-data/owner-token, connectionJSON там же;
  не печатать, не в APK/backup/argv. Cloudcutover marker запрещает local paidgateway.
- QA-only mock server PID24228 на8787, не читает реальные keys, upstreamcalls0. ADBreverse8787
  установлен; dummy connection /sdcard/Download/gym-beam-dialogue-qa.json. Старый
  /sdcard/Download/gym-beam-reconnect-qa.json тоже нужно убрать. Logsprivate native-qa.
- Эмулятор gymbeam_test/emulator5554 (SDK artifacts/android-sdk, AVDhome artifacts/android-avd),
  Android36,1080x2400,density420. До нового APK code3, AI ON на старом dummy localhost.
- Fresh progress backup before-coach-dialogue-v7.json в artifacts/apk/verified. Не
  восстанавливать автоматически! Сначала сравнить after с before. На эмуляторе2 finished
  sessions/8sets/31exercises/0templates/noactive, телефон имеет отдельные данные.
- Старый выданный gym-beam-autoconnect.apk =code2; code3 не выдавался. Local debugcert
  dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a отличается от EAS:
  обновлять -r только matchingcert, не советовать удалять без внешнего backup.

## Следующий шаг

Дождаться19525, установить -r, импортировать dummy connection, nativeQA Homegreen,
AIbutton/chat/keyboard/preview/calibration/start/adjust, удалить только созданную QA
тренировку. Затем восстановить production connection из privateJSON, выключить AI и
consent, удалить public dummyJSON/reverse, остановить PID24228. Exportafter, сравнить
пользовательские workouts/sets/catalog/profile/templates/plans, nextids могут только
монотонно вырасти от QA. Финальные тесты, redeploy, APKcopy/hash/signature, docs и
checkpoint завершить, дать пользователю ссылку и короткую инструкцию/модельный план.

## Среда

Node/pnpm PATH C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;
JAVA_HOME C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot, ANDROID_HOME C:\gymbeam\artifacts\android-sdk.
expo prebuild --platform android --no-install; android/gradlew.bat assembleRelease
-PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=2 --console=plain. Ninja1.12.1 и
plugins/withWindowsNativePaths сохраняют CMake staging .cache/native-cxx и абсолютный
Metro entry. Не clean/native downgrade. Manual edits apply_patch, Russian UTF8 reads.
Рабочее дерево сильно dirty из предыдущей разработки; чужое не откатывать.
