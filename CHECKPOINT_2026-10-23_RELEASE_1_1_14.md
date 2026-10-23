# Gym-Beam 1.1.14: Прогнозы, Выпуск Завершён

## Цель И Результат

Пользователь запросил прогноз изменения массы тела, прогноз прибавки нагрузки
для каждого упражнения в статистике и при открытии упражнения ближайшие занятия
с предполагаемыми датами, числом подходов, весами и повторами каждого подхода.
Реализовано, проверено, опубликовано в master, GitHub Release и production OTA.
Рабочий каталог C:\gymbeam, Android app artifacts/gym-tracker-mobile, PowerShell.
Это законченный выпуск1.1.14; следующий логический выпуск должен быть1.1.15.

## Публикация

- Source commit/tag v1.1.14: e0027021fa6731c1828c32bc8bd5df94d25e7513.
- Версия1.1.14, Android versionCode20, native runtime1.1.0. Native API/зависимости
  не менялись. Patch уже выполнен ровно один раз, повторно1.1.14 не повышать.
- APK: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.14/gym-beam-1.1.14.apk
- Release: https://github.com/dirg9876/gym-tracker/releases/tag/v1.1.14
- APK152460579байт, SHA256
  AD223492A21E5439CCC8E0A6E7E8B84FC00641B9604700C8E38709BBD6A273D0.
  GitHub asset digest совпадает. Локально artifacts/apk/verified/gym-beam-1.1.14.apk.
- APK собран scripts/build-release.ps1; пересозданы и проверены свежие embedded
  Expo manifest и JS. Исходный signing key сохранён, сертификат SHA256
  dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
- OTA Android/production/runtime1.1.0: 01a1677c-4aaa-79ec-a706-5e60071262dd,
  группа33de57f0-cb7b-465e-a18d-6f99ba259a4a, created2026-10-23T06:39:21.258Z,
  gitCommitHash совпадает с source. Свежий dist entry-6e32a26820e48a50953b4475d0c45915.hbc.
- Для совместимого установленного APK: Обновления > Проверить обновления >
  Применить обновление. Удаление/переустановка не нужны. Активная тренировка
  блокирует применение; release notes не прерывают тренировку.
- CI source: https://github.com/dirg9876/gym-tracker/actions/runs/39912760624 PASS.
- Шлюз/Worker/модель ИИ не менялись, deploy и платные AI вызовы не выполнялись.

## Решения И Параметры

Журнал массы тела хранится локально в OfflineState.bodyWeightLog (optional)
как уникальные {date:YYYY-MM-DD,kg:20..500}, до5000дат. PUT /api/body-weight
добавляет/исправляет дату; DELETE /api/body-weight/YYYY-MM-DD удаляет только её.
Будущие и невозможные даты отклоняются. Явное изменение веса в профиле пишет
сегодняшнее взвешивание; изменение только роста/пола не создаёт запись.
Старый недатированный профиль не превращается в вымышленное взвешивание.
Исторические снимки массы в подходах не меняются. Удаление старой даты не
подменяет профильную массу; при коррекции часов будущие записи не выбираются
как текущая масса. Backup экспорт11, импорт1..11, старыеv10 без журнала
сохраняются без него. Строгая проверка дат/дубликатов/checksum.

Прогноз массы: последние56дней, медианы7-дневных корзин, медиана парных наклонов
Theil-Sen. Минимум6дат на протяжении14дней/3корзин; последняя запись не старше
14дней. При тренде более2%массы/неделю или выходе прогноза за20..500 численного
прогноза нет. Сценарий на7/14/28дней. Полоса=max(0.2кг,1.4826*MADостатков)
с расширением1+horizon/28, НЕ доверительный интервал. Это описательный тренд
взвешиваний при прежнем питании/активности, НЕ обещание набора мышц, НЕ клинически
валидированная модель. Пороги - правила продукта. NIH/NIDDK ссылка для контекста
питания/активности: https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner
Не приписывать NIH нашу формулу. Старые источники ACSM/IUSCA и политика цели
из1.1.13 сохранены (Мышцы:8-12основные,10-15изоляция).

Прогноз упражнения: GET /api/stats/outlook (body+весь каталог) и
GET /api/exercises/:id/outlook. Общий read-only planningContext на весь каталог.
Ближайшие численные targets из buildNextExercisePrediction, те же, что в локальной
тренировке дня; число подходов/порядок из оставшихся слотов месячного плана либо
текущего сплита. Активный и завершённый месячные слоты не дублируются. Интервал
7/daysPerWeek, даты приблизительны, фиксированных дней недели нет. Вне текущего
состава сплита упражнение обозначено условным повторением. Упражнение вне оставшегося
месяца/исключённого оборудования не получает выдуманные даты в плане.
До4занятий; следующие назначения - сценарий успешного выполнения, не измеренные
результаты. Повторы растут внутри целевого диапазона; после2полных сопоставимых
занятий на потолке с хорошей техникой/RIR>=2 один шаг оборудования<=2.5кг и
возврат к минимуму повторов. Другие числа подходов/пауза>28дней сбрасывают
подтверждение; старый успех не заменяет недавний. Большой шаг и собственный вес
не отягощаются автоматически. Неизвестное упражнение:1подборочный подход, без
выдуманной будущей прибавки. Планка в секундах (месячные45с сохранены), противовес
отдельно и не выше массы тела, без массы сначала требуется её указать.
Прогноз НЕ записывает синтетические подходы/EMA/рекорды/уровни в реальные данные.

## Файлы

Новые mobile/lib/bodyWeight.ts, exerciseOutlook.ts;
components/BodyWeightStats.tsx, ExerciseOutlook.tsx;
scripts/progress-outlook.test.mjs (22добавленных теста).
Изменены offlineApi.ts, progressBackup.ts, chartGeometry.ts, LineChart.tsx,
app/(tabs)/stats.tsx, app/exercises/[id].tsx, scripts/testHarness.mjs,
7старых тестов версииbackup, app.json, release.json, docs/TRAINING_MODEL.md,
AGENTS.md, CHECKPOINT.md. Рабочий промежуточный checkpoint
CHECKPOINT_2026-10-22_OUTLOOK_1_1_14.md заменён этим итоговым статусом.
Stats: журнал с редактированием/удалением и пагинацией5строк, график/trend,
даты/диапазоны массы, выбор любого упражнения, компактное первое занятие и
раскрытие остальных. Карточка упражнения показывает все4занятия со всеми подходами.
Для новых графиков zeroBaseline=false: небольшие изменения видны, старые графики
по умолчанию остаются от нуля. Native adjustResize и modal gesture roots сохранены.

## Проверки

- 410тестов PASS:354mobile +21API +13Worker +22design; workspace typecheck PASS.
- release:check PASS1.1.14/code20/runtime1.1.0; git diff --check PASS.
- Journey624тренировки/8970подходов/level13, findings[]; eliteboundary80 PASS.
- Производительность31упражнение/1200тренировок/7200подходов около59мс наПК,
  данные до/после построения прогноза идентичны.
- Exact secret scan25изменённых файлов/1448распакованных APKentries/204OTAfiles PASS.
  Ключи/owner tokens/connection files/backups/SDK/AVD не публиковались.
- Только gymbeam_visualqa/5556, основной эмулятор5554 не трогался. Свежий
  before-release-1.1.14-visualqa.json (v10) сохранён ДО установки/fixtures:
  2finished/2sets/32exercises/1customprogram/0active/0plans.
- После APKinstall-r экспортafter-install-1.1.14-visualqa.json (v11) state/plans
  deepEqual baseline PASS. Затем собственная синтетическая fixture для QA:
  22взвешивания/6подходов/месячный план, не реальные тренировки пользователя.
- Native проверены создание, исправление даты/веса, удаление только выбранной
  записи, сохранность6подходов, прогноз70->72.5кг, даты/все подходы4занятий,
  раскрытие/прокрутка, графики1080x2400 и360x640/font1.3, реальная Gboard.
  На малом экране форму можно прокрутить до полей и сохранения. После смены wm
  потребовался rebootAVD для обновления буферов IME; это не изменение APK.
- Собственная оригинальная копия возвращена; after-qa-restored-1.1.14-visualqa.json
  state/plans deepEqual свежему baseline PASS. Синтетики в эмуляторе нет.
- Реальное OTA скачано и применено из UI, Updates показывает1.1.14/01a1677c.
  После остановки приложения/запуска без сети сохранены та же версия/OTAID,
  прогнозы работают без сети. after-ota-1.1.14-visualqa.json state/plans deepEqual
  baseline PASS (v11). Однократное окно и ручное Что нового работают.
- В текущем процессе Gym-Beam ReactNativeJS/AndroidRuntime ошибок0. В общем
  crashbuffer есть ошибка uiautomator от одновременных UI dump во время QA;
  это процесс инструмента com.android.commands.uiautomator, не сбой приложения.
- Все логи/JSON/screenshotдоказательства в ignored artifacts/apk/verified,
  в том числе release-1.1.14-final-stats, small-restart-stats, small-exercise-top,
  small-exercise-sets, small-keyboard-afterboot/scrolled, ota-applied,
  manual-notes, offline-update, offline-original-stats (.png/.xml).

## Ограничения И Следующий Шаг

Прогнозы условные и пересчитываются после фактических тренировок/изменения плана.
При нехватке взвешиваний честно нет численного прогноза; для старого профиля
нужно начать журнал. Не измеряются жир/мышцы, калории/питание не собираются.
Даты не закреплены по дням недели. iOS/физический телефон не проверены;
нагрузочный тест большой истории выполнен в Node, nativeQA на малой fixture.
Текущая задача выполнена; следующий шаг пользователя - применить обновление,
записывать массу тела и продолжать обычные тренировки.

Следующему агенту: прочитать AGENTS.md/этот checkpoint, текущий git diff;
для новых изменений bump1.1.15 один раз через release:patch --notes-file.
Не менять runtime для совместимого JS и не откатывать исходные данные.
Чужие dirty защищены: .agents/agent_assets_metadata.toml,
artifacts/mockup-sandbox/src/.generated/mockup-components.ts,
untracked checkpoints17/18Oct и attached_assets не stage/не удалять.
Инструменты: Node C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin,
pnpm C:\Users\Dirg9\AppData\Local\pnpm; gh C:\Program Files\GitHub CLI\gh.exe;
SDK artifacts/android-sdk, AVD artifacts/android-avd; JAVA_HOME
C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot. Git identity при commit через
-c user.name=dirg9876 -c user.email=273524213+dirg9876@users.noreply.github.com.
Push master без force через credential.helper=!gh auth git-credential.
Настройки QAразрешения/плотности/font/IME/сети сброшены; собственные два
fixtureJSON удалены из Download, локальные исходные backup оставлены.
