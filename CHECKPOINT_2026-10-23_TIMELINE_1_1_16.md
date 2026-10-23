# Gym-Beam 1.1.16: История И Прогноз На Одном Графике

## Итог: Опубликовано

Выпуск ЗАВЕРШЁН. Source master `d2c68397dff88dd98b18c45533511f6da2da6076`.
CI PASS: https://github.com/dirg9876/gym-tracker/actions/runs/40002783197
APK: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.16/gym-beam-1.1.16.apk
152475067 байт; GitHub asset digest совпадает с локальным SHA256
`9DE193A113D182D1DE78AC935198F0A3A72F185D5229ED92F9202E0AA84EED61`.
Production Android OTA/runtime1.1.0: `01a16a02-5eb3-707c-866a-57747fd9b978`,
group `cac2f93f-6707-4d0c-8385-4d4bf80da3d5`, создан2026-10-23T18:25:02.643Z,
gitCommitHash совпадает с source. Версия1.1.16/code22; следующий app release1.1.17.

Реальные check/download/apply и cold offline launch OTA PASS. Скриншоты
`release-1.1.16-ota-applied/offline.*` ignored. Экспорт после OTA успел завершиться
несмотря на прерывание tool-turn пользователем. В следующем turn проверено:
`after-ota-1.1.16-visualqa.json` exact state/plans == свежий baseline PASS.
Сеть включена обратно, QA AVD5556 остановлен; Gradle остановлен, процессов проверок
не осталось. История, backup, ключ подписи, основной AVD не затронуты.

Новый запрос: убрать веб-приложение из репозитория, оставить Android и нужные шлюзы.
См. `CHECKPOINT_2026-10-23_ANDROID_ONLY.md`. Нижние промежуточные статусы и TODO
оставлены как архив, не повторять публикацию/увеличение версии1.1.16.

## Цель И Текущий Статус

Workspace `C:\gymbeam`, PowerShell, mobile `artifacts/gym-tracker-mobile`.
Пользователь прислал скриншот: график начинается 29 октября и показывает плоские
60 кг, хотя нужна вся история с прогнозом. Очистка папки НЕ запрошена, НЕ выполнена,
аудит сохранён в `CHECKPOINT_2026-10-23_STORAGE_AUDIT.md` (кандидаты около 12 GiB).
Предыдущий опубликованный 1.1.15 завершён: `CHECKPOINT_2026-10-23_RELEASE_1_1_15.md`.

## Диагноз И Решения

В 1.1.15 прогноз и история всё ещё имели отдельные графики. Верхний рисовал только
4 будущих занятия, нижний ограничивался 24 измерениями. Воспроизведение read-only
на личной копии 2026-10-23 показало: 60x10, 60x11, 60x12, 60x12. Вес не повышается
до двух полных сопоставимых занятий на верхней границе с RIR>=2 / хорошей техникой.
Это не застывший алгоритм: UI скрывал прогрессию повторений и первую прибавку.

Реализовано: один график всей сопоставимой истории + до6 будущих занятий,
сплошной факт / пунктирный сценарий, общая ось дат, вес вместе с повторами,
нажатие на факт открывает тренировку. Прошлые рекорды не подменяются рабочими целями.
Все подходы и несовместимые категории остаются в журнале. Сценарий 60x10 теперь
показывает и последующие 62.5x8 / 62.5x9 при выполнении условий. Компактный список
сразу показывает все будущие даты/веса/подходы/повторы; детали подходов раскрываются.
Есть условие и дата следующего шага веса. Масштаб не растягивает плоские60кг
до59.9-60.1, нулевой прирост не подсвечивается как достижение.

Правило прогрессии НЕ ослаблено, формулы/EMA/история/backup/шлюз НЕ изменены.
Калибровка не становится численным прогнозом. Секунды, собственный вес и противовес
остаются в своих единицах; шаг>2.5кг не становится автоматическим повышением.
Новые прогнозные цели/даты являются только условным сценарием, не наблюдениями.

## Параметры И Файлы

Patch УЖЕ выполнен один раз: **1.1.16 / Android22 / native runtime1.1.0**.
Не bump повторно. Notes JSON/Markdown ignored: `artifacts/apk/verified/release-1.1.16-notes.*`.
`app.json`, `release.json` согласованы, `release:check` PASS. APK собран через
build-release.ps1 (1m16s, обе embedded launch artifacts свежие), прежний сертификат.
Локально `artifacts/apk/verified/gym-beam-1.1.16.apk`, 152475067 байт, SHA256
`9DE193A113D182D1DE78AC935198F0A3A72F185D5229ED92F9202E0AA84EED61`.
Expo export: `entry-8040ee9a29af1e5672681cf85dfba037.hbc`. Публикация ещё впереди.

Изменения:
- `lib/exerciseTimeline.ts`: новый pure helper общей серии, единицы и тип факт/прогноз.
- `components/ExerciseProgressChart.tsx`: единый интерактивный график с легендой.
- `components/LineChart.tsx`, `lib/chartGeometry.ts`: необязательная прогнозная часть
  пунктиром, минимум масштаба, значение подхода, без изменения старых режимов графиков.
- `app/(tabs)/stats.tsx`: один график сверху, прогноз без второго графика, журнал ниже.
- `lib/exerciseOutlook.ts`: горизонт до6 занятий, шаг оборудования и условная веха.
- `components/ExerciseOutlook.tsx`: все даты кратко, вес+повторы, условия прибавки.
- `scripts/exercise-timeline.test.mjs`: 11 новых синтетических регрессий.
- `scripts/progress-outlook.test.mjs`: ожидания горизонта4->6.
- `docs/TRAINING_MODEL.md`, `AGENTS.md`, метаданные версии.

## Проверки И Ограничения

434 теста PASS: 378 mobile, 21 API, 13 Worker, 22 design. Workspace typecheck PASS.
Journey624/8970/level13/findings[] PASS (118s). Secret audit18 staged source paths /
1448 APK entries /204 OTA files PASS. Логи ignored:
`tests-1.1.16-mobile.log`, `typecheck-1.1.16.log`. Начальное падение одной новой
fixture исправлено: для timed-set нужны reps0/rirnull, а не обычные оценки усилия.
История>24, прошлые3x50 и тяжёлый сингл, последовательность60->62.5, reps/seconds/
bodyweight/assisted, исключение future/unfinished и сменённых категорий, крупный
шаг и масштаб плоской линии проверены. Не сохранялись выдуманные реальные подходы.
Личный JSON только читался в Node harness, не импортирован в AVD и не публиковался.

NativeQA на gymbeam_visualqa5556: свежий baseline до install, точное state/plans
после APK -r PASS. Собственный fixture31sessions/94sets проверен через backup parser
и импортирован только после baseline. UI: вся ось1сентября-3декабря, сплошной факт /
пунктирный сценарий, тап62.5x9, тапстарого50x10 и открытие тренировки3x50, смена
показателя, все6 кратких целей, раскрытие подходов, one-time release notes PASS.
Small360x640/font1.3: график/легенда/строки будущих целей без наложений PASS.
wm/density/font сброшены. Оригинал импортирован обратно;
`after-qa-restored-1.1.16-visualqa.json` получен: exact state/plans против свежего
`before-release-1.1.16-visualqa.json` PASS, 0active, синтетики нет. Logcat без fatal
Android/JS ошибок. Сеть пока отключена. AVD живой. Exec sessions завершены.

Известные 3 замечания старого частного аудита (пуловер/подпись/AI context budget)
вне объёма текущей задачи, не исправлены. Не трогать чужие dirty
`.agents/agent_assets_metadata.toml`, generated mockup-components, untracked
attached_assets и checkpoints17/18 октября. Наши новые checkpoint/docs ещё не commit.

## Следующий Шаг

1. Наши18 путей staged, посторонние изменения не staged. HEAD и origin/master
   d0aafba, fetch проверен, ещё нет нового source commit/push.
2. Restage checkpoints/AGENTS после финальной сверки, release:check PASS, secret audit.
   Сборку/тесты/увеличение версии не повторять без новых app-правок.
3. Commit/push master/CI, GitHub Release APK1.1.16,
   production OTA runtime1.1.0. Проверить реальное OTA/offline и точное state/plans.
4. Финализировать checkpoint, включить сеть обратно, остановить QA AVD.
   Никаких дополнительных удалений по аудиту диска без отдельного согласования.
