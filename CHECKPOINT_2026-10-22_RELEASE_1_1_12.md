# Gym-Beam 1.1.12: Проверка И Публикация

## Цель И Исходное Состояние

Пользователь попросил найти ветку с1.1.12, проверить и опубликовать. Найден PR#6:
fix/one-set-calibration-and-familiar-leg-alternatives, исходный head710d9298d80c99216d2cee9345128127ccac476e.
Его база origin/master6422fbf уже содержит неопубликованные изменения1.1.11a,
адаптивный план по полной истории, автоматический Push/Pull/Legs и один
проверочный подход перед расширением. Последний известный APK Release1.1.10.
Рабочая локальная ветка release-review-1.1.12, создана от PR#6. Master локально
пока8dc6703; fetch выполнен, но merge/публикация1.1.12 ещё НЕ выполнены.

## Решения И Изменения

Используется подготовленная версия1.1.12/code18/date2026-10-22/runtime1.1.0.
Повторный bump не нужен: это проверка одного уже подготовленного выпуска.
Нативных зависимостей/контрактов нет; допустимы APK и совместимая OTA.
Новый автоматический сплит берёт всю завершённую историю; месячный план имеет
приоритет; свои виды остаются для ручного выбора. Рабочие веса — прежняя локальная
модель, не спортивный разряд. Знакомые сгибания ног предпочитаются незнакомой
румынской тяге. Незнакомое движение сначала имеет1подход и postCalibrationSets;
после RIR/техники добавляются только цели, не выполненные записи. При отказе или
нарушении техники автоматическое продолжение не назначается. Backupv10,
postCalibrationSets — необязательное дополнение схемы; исходная подпись сохранится.

Проверка нашла воспроизводимые ошибки нового кода: исходная оценка первого подхода
возвращала более тяжёлый вес после последующего снижения/нарушения техники;
снижение противовеса ошибочно считалось облегчением. Добавлены падавшие тесты,
затем исправлено: последнее наблюдение приоритетно, вес не повышается этим правилом,
противовес/секунды исключены. Дополнительно короткий предписанный bodyweight-probe
3повтора разрешает безопасное расширение после оценки; проверяется именно
назначенный probe, а не ещё не выполненный диапазон6повторов. Уменьшение после
калибровки учитывает targetRir упражнения, не фиксированное2. Подпись об остановке
ограничена автоматическим сплитом, чтобы не обещать отмену старых месячных целей.

Локально изменены trainingPrediction.ts, workoutTemplates.ts, release.json,
scripts/training-model.test.mjs, daily-workout.test.mjs. Этот checkpoint и
CHECKPOINT.md обновляются для продолжения. Пока изменения НЕ закоммичены.

## Проверки

Исходная ветка:315mobilePASS и workspace typecheckPASS; CI PR710d929 SUCCESS.
Два новых регрессионных теста воспроизвели проблемы (67.5вместо<=50,
противовес27.5вместо30). После исправлений320mobilePASS; mobiletypecheckPASS;
release:check1.1.12/18/runtime1.1.0PASS. Логи ignored artifacts/apk/verified/*1.1.12*.
Остались финальные workspace/API/Worker/design/journey, APK/native/OTA/CI.
Worker/provider/schema контекстов не изменены; отдельная публикация шлюза
не требуется, но его тесты прогнать. Не делать платные проверки и не сбрасывать бюджет.

## Данные И Инструменты

Сохранять посторонние dirty .agents/agent_assets_metadata.toml,
mockup generated component,17/18Octcheckpoints и attached_assets. Не коммитить их.
Все SDK/AVD/APK/ключи/секреты/личные backup ignored. Основной emulator5554 не трогать.
Запущен ONLY gymbeam_visualqa/emulator5556, PID2012, headless, boot может ещё идти.
Последний вызов90277 пытается открыть backup, в момент вызова boot не был готов,
ошибка Noactivities не означает отсутствие приложения. Не сбрасывать AVD!
До любого install-r/fixtures СВЕЖИЙ export baseline1.1.12, не использовать копию1.1.10.
Если обнаружена активная реальная тренировка — не прерывать/не заменять её.
В конце восстановить свежие state+plans точно, сетьON/font1/density420/physicalsize,
остановить5556ONLY/Gradle. Прежний ключ artifacts/apk/debug.keystore неизменен.

Node C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;
pnpm C:\Users\Dirg9\AppData\Local\pnpm; JDK C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot;
SDKartifacts/android-sdk, AVDartifacts/android-avd; gh C:\Program Files\GitHub CLI\gh.exe.
UIhelpersmobile/scripts/android-ui-helpers.ps1 с ANDROID_SERIAL=emulator-5556.
Всегда инспектировать filepicker; после coldstart дождаться Home и повторить route.

## Следующий Шаг

Закоммитить проверки/исправления в PRветку, push безforce, дождаться CI и merge#6
в master. Перейти в master и ff послеfetch, не трогая dirty. Сборка ТОЛЬКО
mobile/scripts/build-release.ps1 с JAVA_HOME/ANDROID_HOME, свежие manifest+bundle.
Полные тесты, nativeQA двух сценариев калибровки/противовеса/знакомой замены,
сохранность после install-r; свежий Expoexport, секрет-аудит, GitHub Release APKasset,
productionOTA через EAS16.32.0, реальное check/download/apply/offlinecoldstart,
точное сравнение state/plans. Финальный self-contained checkpoint и pointer,
AGENTScurrent1.1.12, docscompletioncommit/push; следующий выпуск1.1.13.
Commit identitydirg9876 /273524213+dirg9876@users.noreply.github.com.
Push с PATHgh и git -c credential.helper= -c 'credential.helper=!gh auth git-credential'.
