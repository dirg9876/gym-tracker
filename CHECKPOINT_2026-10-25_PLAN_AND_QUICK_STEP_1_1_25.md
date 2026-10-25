# Gym-Beam 1.1.25: План И Шаг Веса В Тренировке

Дата: 25 октября 2026. Workspace C:\gymbeam, master. Работа завершена и опубликована.
Пользователь попросил продолжить улучшения, менять шаг веса прямо в упражнении
во время тренировки и улучшить организацию разделов.

## Реализовано

- Под весом/повторами активного упражнения строка «Шаг: N кг». Раскрывает существующий ExerciseWeightStep с presets и Stepper0.25–20кг; после сохранения закрывается. Прямого ввода веса нет. У планки настройка килограммов не показывается.
- Существующий PATCH exercise пересчитывает кнопки веса, прогнозы, оставшиеся automatic daily targets и untouched draft. Ручной вес, записанные подходы, шаблоны и таймер сохраняются. Сохранение шага блокирует конкурирующие действия, защищено синхронным lock; ошибка позволяет повторить, отмена не пишет данные.
- Тренировки теперь План/Упражнения/Шаблоны; default План. Ближайший расчёт математической модели виден без старта, без обязательного ИИ и без платного запроса. При активной тренировке вместо нового предложения показана она с переходом обратно.
- Месячный план доступен из Плана. Его ближайшее занятие открывается через start-workout и математический алгоритм вместо обязательного AI session. Просмотр сохранённого месяца остаётся офлайн.
- Из упражнения ближайшего плана переход сразу в объединённую историю/прогноз. Сводка сохраняет порядок разных весов и различает противовес, свой/добавленный вес, кг на гантель, секунды; дополнительные после калибровки подходы помечены условными.
- Сохранены5нижнихвкладок, увеличенная центральная Главная и одна основная кнопка старта на ней. История = факт занятий, Статистика = общие тенденции, карточка упражнения = его история/прогноз. Шаблоны, каталог и план загружаются по необходимости.

## Технические Решения

Версия1.1.25, Android versionCode31, expo.runtimeVersion1.1.0. Native dependencies,
разрешения, подпись и shared API contracts не менялись; backup остаётсяv11.
Офлайн-модель/RIR/прогрессия из1.1.24 сохранены. Новых backend endpoints нет.
TrainingPlanOverview использует existing GET active/daily/month/catalog; query
daily выключен при active/неизвестном active status и вне фокуса. Выбор вкладки
поддерживает view=plan/exercises/templates deep links. Нет автоматического POST,
AI.ask или создания тренировки при просмотре. Неизвестные параметры упражнения
не превращаются молча в обычные кг, есть загрузка/повтор.

ExerciseWeightStep расширен optional disabled/onSaved; старый экран настроек
продолжает работать. Активная форма включает stepSaving в formBusy. Успешное
сохранение инвалидирует cache, затем разблокирует форму и сворачивает редактор.
Произвольный пользовательский вес не округляется задним числом под новый шаг.

## Файлы

В artifacts/gym-tracker-mobile новые components/TrainingPlanOverview.tsx,
lib/planSummary.ts, scripts/plan-quick-step.test.mjs. Изменены
app/(tabs)/programs.tsx, app/workout/[id]/index.tsx, app/coach-month.tsx,
components/ExerciseWeightStep.tsx, components/ExerciseLibrary.tsx,
scripts/testHarness.mjs, scripts/training-navigation.test.mjs, app.json/release.json.
В корне AGENTS.md/CHECKPOINT.md и этот checkpoint. Организация и кандидаты
следующего этапа: docs/NAVIGATION_2026-10-25.md.

## Проверки

pnpm test:558PASS (15root/487mobile/21API/13Worker/22art), новые15тестов включают
реальные TSX save/doubleclick/error/retry/cancel/disabled handlers с native hooks
stubbed, overview branches/routes/lazy, summary units, readonly API, сохранение
timer/manualdraft/позиций оценки. Workspace pnpm typecheck, release:check,
git diff --check PASS. build-release.ps1 BUILD SUCCESSFUL, embedded manifest и
JS свежие; Android export entry-c4dcc039c9280f7931fe9cd749f00218.hbc.
Private audit16stagedfiles/APK entries/204OTAfiles PASS, секреты не печатались.
CI source SUCCESS: https://github.com/dirg9876/gym-tracker/actions/runs/40175399961

Native QA только own gymbeam_visualqa/emulator-5556: baseline2sets/2finished/
0active/1customtemplate/32catalog. before-plan-qa-1.1.25.json точно совпал с
restored24. Установка поверх предыдущей версии успешна. Импортировался только
owned synthetic gym-beam-qa-step-1.1.25.json (9historicsets+active4).
Step2.5→5 обновил draft/target52.5→55; plus5 дал60; step1.25 сохранил ручной60,
plus дал61.25, automatic target51.25; forecast в Progress также51.25.
Таймер остался на паузе1:29 (remaining88592ms),9historysets exact unchanged.
Это подтверждено after-plan-step-qa-1.1.25.json. Навигация Plan/active/catalog/
Progress/Templates, default1080×2400 и320dp, авто/manual release notes осмотрены.

После QA восстановлен owned gym-beam-original-1.1.25.json. after-restore-1.1.25.json
и after-ota-offline-1.1.25.json точно совпали по полным state/plans с baseline.
OTA реально применено; offline cold start, стакан и ближайший план работают.
Size/density и airplane mode восстановлены, собственный AVD остановлен.
Ошибок ReactNativeJS/AndroidRuntime в PID приложения нет. Были SystemUI ANR
при старте эмулятора во время сборки и transient uiautomator accessibility/dump
errors; повторная проверка после стабилизации успешна. Внешний PowerShell build
wrapper ждал conhost после завершения сборки и остановлен; готовый APK проверен.
Скриншоты, логи, own backups и QA helpers только в ignored artifacts/apk/verified.
Реальные пользовательские экспорты не импортировались, платных AI-вызовов нет.

## Публикация

Source master/origin commit dd73753ec9477a328f870d9f3000b2f910971217.
GitHub Release v1.1.25, APK153155201bytes, uploaded digest совпадает с локальным:
C453DF74B8D58E18BEF83A51C98E8590264D7C6382251C375280DBF348A58773.
https://github.com/dirg9876/gym-tracker/releases/download/v1.1.25/gym-beam-1.1.25.apk

EAS Android production/runtime1.1.0,25.10.2026 08:08:11UTC:
update01a1721a-56f8-7db7-8a4b-6328d128fb84,
group057cbeec-abda-47fe-9ea8-a3ca5a044cc4, gitCommitHash соответствует source.
На устройстве реально показано «Обновление 01a1721a».
Обновление: Главная > облако > Проверить обновления > Применить обновление после
завершения активной тренировки. APK можно установить поверх с прежней подписью.
Финальный checkpoint отправляется отдельным documentation commit, версия та же.

## Продолжение

Обязательных работ по запросу нет. Следующий кандидат: отдельные параметры цели,
графика и оборудования вне настроек подключения ИИ. Они используются и локальным
алгоритмом; это предложение пока не внедрено. Ещё кандидаты в docs/NAVIGATION.
Новая логическая доработка должна получить1.1.26 через release:patch с русским
JSON-array notes и release:check. Сохранить runtime1.1.0 для native-compatibleJS.
Не выдавать прогноз/синтетическую проверку за гарантированный прирост или реальное
исследование атлетов. Физический телефон и платный end-to-end AI не тестировались.

Рабочая среда: Node24.14 C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin,
pnpm10.33.2, JDK17 C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot,
ANDROID_HOME=C:\gymbeam\artifacts\android-sdk, ANDROID_AVD_HOME=C:\gymbeam\artifacts\android-avd.
APK только scripts/build-release.ps1 с прежним закрытым ключом. Не генерировать
замену. Секреты/ключи/owner-token/connection/личные backups/SDK/AVD не добавлять в Git.
Посторонние .agents/agent_assets_metadata.toml и untracked attached_assets/старые
checkpoint/error.log не тронуты и не включены в релиз. Ветка публикации master,
без force-push; APK только в Release assets. Работать дальше по AGENTS.md.
