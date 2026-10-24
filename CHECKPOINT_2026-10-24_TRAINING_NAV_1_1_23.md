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
