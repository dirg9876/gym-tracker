# Gym-Beam: Прогнозы Массы И Следующих Занятий, 1.1.14 В Работе

## Цель И Статус

Обновление23октября06:39UTC: nativeQA малого экрана завершён. Скриншоты
release-1.1.14-small-restart-stats.png, small-keyboard-afterboot.png,
small-keyboard-scrolled.png, small-exercise-top.png, small-exercise-sets.png
в ignored artifacts/apk/verified. При клавиатуре форма прокручивается, после
scroll доступны оба поля и сохранение. Настройки размера/плотности/font/IME
сброшены. Собственная исходная копия импортирована; свежий экспорт
after-qa-restored-1.1.14-visualqa.json (v11): state/plans deepEqual свежему
before-release-1.1.14-visualqa.json PASS. Синтетические данные полностью убраны.
Далее sourcecommit/push/CI/GHRelease/OTA. Все нижние промежуточные указания о
fixture, reboot и незавершённой QA теперь неактуальны.

Актуализация 2026-10-23 перед публикацией (имеет приоритет над промежуточными
статусами ниже): реализация завершена, финальные 354 mobile +21 API +13 Worker
+22 design =410 тестов PASS, workspace typecheck PASS, journey624тренировки/
8970подходов/findings[]/elite80 PASS. Добавлены проверки временных данных,
удаления старого взвешивания без подмены профильного веса и zoom-графика.
Общий planningContext:31упражнение/1200тренировок/7200подходов около59мс наПК.
Финальный APK build-release.ps1 пересоздал manifest и JS, версия1.1.14/code20,
runtime1.1.0, файл artifacts/apk/verified/gym-beam-1.1.14.apk, SHA256
AD223492A21E5439CCC8E0A6E7E8B84FC00641B9604700C8E38709BBD6A273D0.
Установлен -r в gymbeam_visualqa/5556, не5554. Перед установкой свежий baseline
before-release-1.1.14-visualqa.json; после APK state/plans deepEqual PASS.
Baseline содержит2завершённых тренировки/2подхода/32упражнения/0active/0plans,
backupv10; ничего реального не прерывалось. Потом импортирована собственная
синтетическая fixture:22взвешивания/6подходов/месячный план. Проверены native
создание/исправление/удаление даты (осталась21запись), история подходов сохранена.
Проверены release notes, прогноз70→72.5кг и все подходы по4датам, клавиатура
на1080x2400. Финальный zoom-график читаем на1080x2400 и360x640/font1.3.
Смена wmразрешения без перезапуска оставляла старый SVG/IMEbuffer; после restart
приложения SVG корректен. Для реальной клавиатуры малого экрана сейчас reboot
QAAVD, конфигурация720x1280/density320/font1.3. Не считать скриншоты с Gboard
permission диалогом проверкой клавиатуры. Нет running execsessions.
Свежий Expoexport готов: dist/entry-6e32a26820e48a50953b4475d0c45915.hbc;
точный secret audit25stagedfiles/1448APKentries/204OTAfiles PASS.
Код staged, но ещё НЕ commit/push, НЕ GHRelease/OTA. Worker не менялся.
Важное следующее действие: завершить QAмалого экрана, вернуть wm/font/IME,
импортировать собственную gym-beam-original-1.1.14.json (копия свежего baseline)
через ignored import-qa-1.1.14.ps1 и экспортом подтвердить exactstate/plans.
Сейчас fixture ещё в эмуляторе! Затем sourcecommit/pushmaster/CI, APKGHRelease,
OTAproductionruntime1.1.0, реальная проверка OTA/offline/сохранения, финальный
checkpoint. Повторно версию не повышать; это тот же незавершённый1.1.14.

Пользователь после опубликованной1.1.13 попросил: прогноз изменения массы тела
в статистике, прогноз прибавки каждого упражнения и при открытии упражнения
план следующих тренировок с числом подходов, повторами каждого и предполагаемыми
датами. Работа в C:\gymbeam, mobile artifacts/gym-tracker-mobile, PowerShell.
Последний опубликованный релиз1.1.13, source814b16c, master docs8af96d4.
Новые изменения НЕ закоммичены и НЕ опубликованы. release:patch УЖЕ выполнен
ровно один раз: подготовлена1.1.14/code20, release:checkPASS. Повторно не bump.
Native runtime остаётся1.1.0 (только JS), нативных зависимостей не добавлено.

## Решения

- Датированных взвешиваний раньше не было, только текущий profile.bodyWeightKg.
  Добавлен optional state.bodyWeightLog [{date:local YYYY-MM-DD,kg:20..500}].
  Не выдумывать дату старого профильного веса и не считать тренировочные
  bodyWeightKg snapshots отдельными взвешиваниями. Одна запись на дату,
  максимум5000, исправление/удаление. Изменение веса через старый профиль тоже
  пишет сегодняшнюю запись; sex/height-only правки не создают измерений.
- PUT /api/body-weight {date,kg}, DELETE /api/body-weight/YYYY-MM-DD.
  Нельзя невозможную/будущую дату. Старое взвешивание не меняет текущую массу,
  если есть более новая запись. Исторические подходы/bodyweight snapshots не меняются.
- Body forecast: последние56дней, недельные медианы по7-дневным бакетам;
  медиана парных наклонов Theil–Sen. Нужно6дат, охват14дней и3недельных бакета.
  Последнее измерение старше14дней -> stale. |weeklyChange|>2%массы -> unstable,
  без числа. Горизонты7/14/28дней. Полоса MAD*1.4826, минимум0.2кг, расширяется
  до×2на28дней. Это сценарный разброс, НЕ доверительный интервал/валидация.
  Метод/пороги продуктовые, не обещание прироста мышц.
- Научная проверка: открыта официальная NIDDK страница
  https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner .
  Питание/активность влияют на массу; прирост мышц по журналу упражнений неизвестен.
  Мы НЕ реализуем и НЕ выдаём Theil–Sen за метаболическую модель NIH.
- Exercise outlook: ближайшее число по существующей Epley/RIR/goal policy
  8–12основные/10–15изоляция, затем4предполагаемых занятия. Будущие успехи
  только условный сценарий «все цели выполнены с RIR2/good», НЕ добавляются в
  state/EMA/рекорды. На потолке после2полных сопоставимых занятий шаг<=2.5,
  сброс к минимуму. Большой шаг и собственный вес автоматически не отягощаются.
- Сохранённый месяц: оставшиеся slots в фактической последовательности,
  исключены completed и текущий active coachCycle slot. Межзанятийный интервал
  7/daysPerWeek, даты от последнего регулярного занятия/сегодня. Вне месяца:
  текущий состав3дневного сплита, через buildAdaptiveSplit с фильтром направления.
  Упражнения вне текущего состава помечены «условное повторение».
  Дни недели НЕ закреплены: явно предполагаемые даты, не назначенный календарь.
- Новому упражнению только1probe (bodyweight3, остальные<=8); последующие числа
  до калибровки не считаются подтверждёнными. Планка в секундах, противовес отдельно.
  История берётся завершённая/не будущая, сортировка по finishedAt.

## Файлы И Схема

Новые mobile/lib/bodyWeight.ts, exerciseOutlook.ts; components/BodyWeightStats.tsx,
ExerciseOutlook.tsx; scripts/progress-outlook.test.mjs.
Изменены offlineApi.ts (state/routes/profile/normalizeState), progressBackup.ts,
scripts/testHarness.mjs (разрешение новыхTSимпортов), app/(tabs)/stats.tsx,
app/exercises/[id].tsx и7тестов с ожиданием версии backup.
Backup экспорт повышен10->11, импорт1..11; bodyWeightLog строго валидируется,
уникальные даты, старыеv10безлога остаются без него. APK runtime не меняется.

UI: Stats получает GET /api/stats/outlook {body,exercises}; отдельные данные
GET /api/exercises/:id/outlook. Статистика содержит журнал/тренд/датированные
сценарии и выбор упражнения. Открытое упражнение показывает4будущих занятия,
все подходы/повторы/веса, условия и даты. Формы веса inline, numeric kg и текстовая
дата, edit/delete последних5дат, native delete confirmation. СсылкиNIDDK.
Все записи сохраняются offline/backup; ИИ/provider/Worker не менялись.

## Текущие Проверки

ОБНОВЛЕНИЕ:20новых тестов и все352mobilePASS; typecheckPASS. Вынесен общий
planningContext для всего каталога:31упражнение/1200тренировок/7200подходов
read-only прогноз59мс наПК. Дополнительно исправлены будущая активная дата,
старое недатированное профильное значение, stale подтверждение прогрессии,
противовес выше текущей массы и месячная планка45с вместо generic30.
Stats compact показывает первое занятие + раскрытие остальных; detail все4.
История массы имеет пагинацию5строк и доступ к исправлению/удалению любой даты.
Полные старые7backupassert теперь11, все проходят. Никакой новой научной/AIмодели
на сервере нет; metadataсценария содержитфактическую частотуизмесяца/настроек.

Сейчас запущены: APKbuild-release.ps1 unifiedsession64084, лог
artifacts/apk/verified/build-1.1.14.log (копирует финал gym-beam-1.1.14.apk);
mobile+journey session57499, mobile352PASS, journeyещёработает.
AVD5556 запускается Hidden1536MB, emulatorPID10328, no-snapshot-load/no-audio,
логиemulator-1.1.14.out/err.log. НОВЫЙ baseline ещё не экспортирован!
После загрузкиexport-qa-1.1.12.ps1 -Name before-release-1.1.14-visualqa.json.
Не устанавливать fixtures до свежего baseline/проверки0активных.
Все старые статусы/нерешённые пункты ниже читать с учётом этого обновления.

- Mobile typecheckPASS после UI.
- Исходные332теста:325PASS/7FAIL только из-за ожидаемого backup.version10;
  семь assert обновлены на11, нужно повторить полный прогон.
- Новые15тестов:14PASS/1FAIL воспроизвёл будущую active workout дату как якорь
  расписания. Исправлено фильтром startedAt<=now, надо повторить.
- В тестах: bodygain/loss/stable/outlier/sparse/stale/unstable; upsert/datevalidation;
  не менять oldsetbodyweight; v10/v11 roundtrip и checksummed-invalidrejection;
  детерминизм/read-only, условнаяdoubleprogression, большие шаги, units/probe,
  месячныеslots/active/differentsetcounts, совпадениеfirsttargetсdaily,
  future/unfinishedнепроизводятсилу. Логи ignored artifacts/apk/verified.

## Нерешённое И Следующий Шаг

1. Повторить новые/все тесты и workspace typecheck. Проверить реальные ошибки.
2. Подумать о производительности /stats/outlook: сейчас каждый из31упражнений
   повторно строит3split/расчёт. Есть реальная общая работа: вынести readonly
   planningcontext на один запрос, benchmark на большой истории.
3. UI-прогноз сейчас стоит перед прежними totals и полностью раскрывает4занятия:
   сделать статистику компактнее (totals сохранить сверху, прогноз в раскрытии
   или compact prop), не скрывая ожидаемые данные на detail screen.
4. Проверить assistedбезмассы и temporal/differentsetcount guards дополнительными
   тестами. В core только что исправлены emptyassistance, futureactive,
   sortingfinishedAt, удалены лишние action/reason из SetTarget.
5. Написать docs/notes, bump1.1.14/code20один раз; release:check.
6. Native QA через build-release.ps1, свежий baseline backup на5556 до любых
   fixtures. Проверить ввод веса/даты с клавиатурой, edit/delete/backup, графики,
   detailна360x640/font1.3. Исходные state/plans вернуть точно. Нельзя прервать
   реальную активную тренировку. Старый baseline1.1.13 вслепую не восстанавливать.
7. Полные тесты/API/Worker/design/typecheck/journey, secret audit, sourcecommit/push
   master, APK GitHubRelease1.1.14, freshExpoexport/OTAproduction/runtime1.1.0,
   реальное применение/offline/data preservation, финальный checkpoint.
   Worker не менялся -> deploy не нужен. Не делать платные AIвызовы.

Работать с текущими грязными изменениями: не откатывать их. Чужие dirty защищены:
.agents/agent_assets_metadata.toml, mockup-sandbox/.generated/mockup-components.ts,
старые untracked checkpoints17/18Oct и attached_assets не stage/не трогать.
Новых exec sessions сейчас нет, эмуляторы/Gradle остановлены после1.1.13.
Подробные пути инструментов/публикации/безопасности в предыдущем checkpoint1.1.13;
SDK C:\gymbeam\artifacts\android-sdk, AVD artifacts\android-avd,
толькоgymbeam_visualqa/5556 (Hidden,1536MB), неprimary5554.
