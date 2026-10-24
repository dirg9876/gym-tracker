# Gym-Beam 1.1.23: Разгрузка Статистики

Дата24октября2026, C:\gymbeam, master. Последний опубликованный1.1.22/code28,
runtime1.1.0/backupv11, sourcec95d4d4,519tests/types/native/CI PASS. Полная информация
в CHECKPOINT_2026-10-24_ANATOMY_UX_1_1_22.md. Новый отдельный логический выпуск23.

## Запрос И Решение

Статистика перегружена, Виды тренировок недогружены. Переименовать в Тренировки.
Органично перенести историю/прогноз каждого упражнения в его экран Прогресс,
доступный из каталога внутри Тренировки. Там же сохранённые шаблоны (без новых
автоматических программ). Схема: Тренировки →Упражнения/Шаблоны; Статистика →
Обзор/Нагрузка/Вес тела. Кнопка Начать остаётся единственной на Главной.
Сохранить всю историю, объединённый график факт+прогноз, подходы/датированные цели,
анатомию, настройки шага и категории, deep links и редактор/замену/удаление.
Избежать вложенных ScrollView и тяжёлого расчёта всех прогнозов ради веса тела.

## Состояние И Следующий Шаг

Реализация ещё не начата. Подготовить reusable ExerciseLibrary из app/exercises,
ExerciseJournal из stats, новый detailProgress с общим графиком и полнойисторией.
Stats оставить общими тремя компактными вкладками, lazyqueries. Добавить узкие
offline endpoints для bodyforecast/per-exercisehistory без миграции backup.
Регрессии routing/search/history/units/read-only и fulltests/types/native QA.
release:patch23/code29/runtime1.1.0; build-release.ps1/export/audit/publishmaster/
APK/OTA/apply+preservation. Чужие .agents/untrackedassets не трогать.
5556 gymbeam_visualqa запущен, baseline2sets точно совпал послеOTA22. Личные
экспорты пользователя не импортировать, использовать только ownQA и exactrestore.

## Реализация Перед Финальными Проверками

В app/(tabs)/_layout title Тренировки, programs.tsx две вкладки: Упражнения
по умолчанию и Шаблоны. ExerciseLibrary.tsx вынесен из старого route, embedding
без второгоheader/вложенногоScrollView. Старый/exercises route оставленwrapper.
Вход из каталога/WeeklyTraining открывает detail?view=progress, из activeguide
по-прежнему открываются мышцы. В detail прежние разрозненные графики заменены
единым ExerciseProgressChart +полной ExerciseJournal5sessions/page+compactfuture.
Нормативы/рекорды скрытыподраскрытие; мышцы/settings сохранены. Outlook/journal
загружаютсятолькопривкладкеProgress, focusrefetchподдерживаетактуальность.
OfflineAPI новые readonly /api/stats/body-weight и /api/exercises/id/insights.
Stats workerNash01a16eb2-168f-7a41-9cda-0e699575aae0 переписал толькоstats.tsx:
Обзор(period/totals/calendar/weeks),Нагрузка(WeeklyTraining),Вес тела(BodyWeightStats).
Lazyqueries/focus/pullrefreshтолькоактивнойвкладки, ошибки/retryнепрячутся.
Новыхсхемbackup/native/sharedAI/Workerнет, реальные данные не мигрируют.

Initial519tests/types PASS.6новыхnavigation/APItests+6search/deleteUItests PASS,
добавленаещёоднаstaticregressionstatslazy. release:patch23/code29/runtime1.1.0
выполнен,4русскиезаметки. Следующийшаг: полный526tests/types/build/export,
NativeQAкаталог→прогресс/анатомия/шаблоны/Stats3views/планка/read-onlypreservation,
audit/commit/push/GitHubAPK/OTA/verify/restore+stopownAVD/finalcheckpoint.

## Финальные Проверки Перед Публикацией

526tests PASS:15repo/455mobile/21gateway/13Worker/22gallery. Workspace types,
release check, build-release.ps1, Android export PASS. APK code29/runtime1.1.0:
SHA794FDE0E1611DD5CDE61BDDE7582CEE22F62A0F8A60C9AB75C5CDDA5434985E1.
Export entry-ad5953aa02860de08c7c32a69a4e56d0.hbc. Full tests/type/build/export
logs ignoredartifacts/apk/verified/*1.1.23*.

5556visualqa install-r: state/plans baseline2sets preserved exactly vsOTA22.
OwnQA9sets+active4: Training→catalogrowopensProgress directly, graph contains
allobservedhistoryandconditionalfuture; completejournal2sessions/6benchsets visible,
templatesempty(default), stats3views/period/calendar/load/body all checked.
Compact320dp rendering inspected, wm size/density reset. firstbody screenshot
caught transientframe; stableafter2sidle showsall3tabs, notamissinglabelbug.
after-navigation-qa-1.1.23-visualqa.json EXACT fullstate/plans matchedowninput,
notjustsets. No user-phone data touched. Original2sets restored, after-restore
fullstate/plans exactlymatchesbaseline. Privateaudit18staged/APK/204OTAfiles PASS.
Next sourcecommit/master, GitHubAPK/OTA,
verifyappliedID/state/offline, finalcheckpoint/docscommit/stopownAVD.
