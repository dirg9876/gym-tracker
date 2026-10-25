# Gym-Beam 1.1.25: План И Шаг Веса В Тренировке

Работа в C:\gymbeam, master, 25 октября 2026. Исходный выпуск1.1.24/code30,
runtime1.1.0, backupv11, source af606b1/docs11f3206. Пользователь попросил
продолжить улучшения, менять шаг прямо в тренировке и улучшить разделы.

## Решения

Добавить компактное раскрытие текущего шага под весом/повторами активного
упражнения; использовать существующий ExerciseWeightStep и PATCH exercise,
не новый ввод веса. Шаг0.25–20кг, presets как в настройках. Сохранение должно
обновлять Stepper, prediction, plans и draft; ручные значения/таймер/история
сохраняются по существующим правилам. Сохраняемый шаг блокирует конкурирующие
действия. Не показывать кг для планки. Прямого TextInput веса не добавлять.

Раздел Тренировки: План, Упражнения, Шаблоны. План по умолчанию, readonly
ближайшее предложение математической модели, текущая тренировка при наличии,
доступ к сохранённому месяцу. Не делать скрытый старт, AI запрос или генерацию
месяца при просмотре. Запуск по-прежнему одной кнопкой на Главной. История =
занятия; Статистика = общие итоги/нагрузка/масса; прогресс упражнения остаётся
в карточке упражнения. Сохранить5нижнихвкладок и центральную Главную.

## Промежуточный Результат

Реализованы inline step disclosure и переиспользование ExerciseWeightStep,
external disabled/onSaved props и защита double-save. Новый readonly
components/TrainingPlanOverview.tsx, pure lib/planSummary.ts. Тренировки default
План/Упражнения/Шаблоны с view deep links и lazy template query. План использует
existing GET daily/active/month, catalog для единиц; не делает POST/AI/старт.
При active/unknown status не считает следующий день. Месячный переход ведёт
в start-workout, не mandatoryAI. docs/NAVIGATION_2026-10-25.md фиксирует структуру
и кандидаты следующего выпуска; goal/settings внеAI пока не внедрены.

Новые15тестов в scripts/plan-quick-step.test.mjs: реальные TSX обработчики
сохранения/двойной клик/ошибка/retry/отмена/disabled, UI branches/routing/lazy,
единицы summary/readonlyAPI и сохранение timer/manualdraft/assessment positions.
pnpm test558PASS (15root/487mobile/21API/13Worker/22art), workspace typecheck PASS.
Версия штатно1.1.25/code31/runtime1.1.0, release:check PASS. APK/export идут,
логи в ignored artifacts/apk/verified/*1.1.25*. Запущен own AVD5556.
Исходный baseline25 ещё не экспортирован; последние owned snapshots24 имеют
2sets/2finished/0active и были точно восстановлены после OTA24.
Ничего по25 ещё не закоммичено/не опубликовано.

## Native QA В Процессе

APK BUILD SUCCESSFUL, aapt1.1.25/code31;153155201bytes, SHA256
C453DF74B8D58E18BEF83A51C98E8590264D7C6382251C375280DBF348A58773.
Export dist entry-c4dcc039c9280f7931fe9cd749f00218.hbc. Внешний build PowerShell
ждал conhost после завершения всех build processes; остановлен только этот
ожидающий wrapper. APK guard/manifest/bundle freshness и install прошли.

5556: на запуске AVD во время сборки был SystemUI ANR, кнопка Wait восстановила
систему; ошибок ReactNativeJS/AndroidRuntime нет. before-plan-qa-1.1.25.json
точно совпал state/plans с restored24. Исходный owned2sets/2finished/0active,
сохранён gym-beam-original-1.1.25.json. Установлен новый APK поверх24. Автоnotes
и Plan default осмотрены. Затем импортирован только owned synthetic
gym-beam-qa-step-1.1.25.json (9sets+active4), helper import-qa-1.1.25.ps1
защищает AVD и whitelist имени. Реальные пользовательские backups не трогались.

Quickstep5 обновил untouched draft/target52.5→55. Plus5 дал60 ручного веса;
при смене на1.25 ручной60 сохранился, plus дал61.25, auto target стал51.25.
Таймер сохранён на паузе1:29 (remaining88592ms, UI округляет вверх). Export
after-plan-step-qa-1.1.25.json проверяет exact9historysets, step/manualtarget/
automaticplan/timer. Первый assert ошибочно сравнил округлённый countdown89s
с точными миллисекундами; исправлен QA assert ceil, приложение не менялось.
Current screen default и320dp осмотрены, size/density сброшены. Training Plan
показывает активную4 и возвращает туда, без нового старта. Допроверяются
catalog/templates/progress navigation; далее exact original restore и export.
Sourcecommit/publication25 пока отсутствуют.

## Готово К Публикации

Native catalog→exercise Progress показал forecast51.25 с новым1.25step;
Templates empty state проверен. Original restore фактически завершился, но
helper получил transient ADB/UI dump error на перерисовке; никакая повторная
подмена данных не нужна: after-restore-1.1.25.json точно совпал по state/plans
с before-plan-qa-1.1.25.json. Восстановлены исходные2sets/2finished/0active,
1customtemplate,32catalog. Plan screenshot320dp переснят после layout reload,
подписи и контролы читаемы; size/density reset. Автоnotes/manualnotes проверены.
Файлы во verified ignored, новых app errors нет. Следующий шаг stage audit,
sourcecommit/push, GitHubAPK/EASproduction/CI/реальное OTAapply/offline
preservation и финальный checkpoint. Код после final558tests/types не менялся.

## Далее

Реализовать UI с существующими offline APIs и lazy queries, покрыть новый
маршрут/сохранение шага/таймер/ручные значения тестами; fulltests/types;
release:patch1.1.25 с реальными русскими notes, release:check, штатный APK,
export/native QA5556 только own synthetic и exact baseline restore,
audit/sourcecommit/master/GitHubAPK/productionOTA/CI/application verification,
финальный checkpoint. Нативных изменений/нового runtime не планируется.

Посторонние .agents/agent_assets_metadata.toml и untracked attached_assets,
старые3checkpoint/error.log сохранить, не staging. Секреты/ключи/backups в Git
не добавлять. Последний тестовый AVD остановлен, новая сессия ещё не запускалась.
