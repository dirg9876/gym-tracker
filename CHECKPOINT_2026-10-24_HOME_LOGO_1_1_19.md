# Gym-Beam 1.1.19: Стакан На Главной

Дата: 24 октября 2026, Europe/Moscow; Windows C:\gymbeam; master.

## Цель И Причина

Пользователь прислал скриншот: GYM-BEAM и кнопки есть, стакана нет после OTA.
Выпуск1.1.18 уже опубликован, его алгоритм не переделывать в этой задаче.
Следующее отдельное исправление1.1.19/code25, native runtime1.1.0 сохраняется.

Проверка ZIP assets/app.manifest старых APK1.1.0/4/14/16 и свежего18:
одинаковые pixels/hash6e1cc8f0dc6b58d4bdda9e6931bf8042, но resourcesFilename
поменялся с _gymtracker_src_assets_gymbeamlogo на assets_images_gymbeamlogo
после удаления старого приложения и переноса в canonical mobile assets.
expo-asset Asset.fx.ts при file:///android_res/ возвращает ресурсное имя из
новой Metro metadata вместо старого реально встроенного drawable. Поэтому
на свежем APK18 стакан виден, на прежнем после OTA возможна пустая картинка.

## Решение И Файлы

Home app/(tabs)/index.tsx: useAssets материализует PNG по фактическому hash-map
expo-updates в localUri, Image получает явный file URI. Для старого repack helper
сохранён file:///android_asset/branding/gymbeam-logo.png отдельным путём.
Оригинальный PNG не редактировать, SHA256
e362b2be0a56acd52af87e94ebf7d437bfb07ad2b6ce9154da38819bf0820d9b.
Добавлен direct devDependency expo-asset~12.0.12: именно эта версия уже была
transitive в lock и ExpoAsset в старых APK. Нового native API/версии нет.
pnpm-lock изменился только тремя строками importer, dependency snapshots прежние.
scripts/android-workspace.test.mjs: регрессия на useAssets/localUri вместо
номерного source. app.json/release.json штатно release:patch, одна русская заметка.
AGENTS.md версия19; root CHECKPOINT указывает сюда. Дополнен финал checkpoint18.

## Выполненные Проверки

470tests PASS:15repo/399mobile/21gateway/13Worker/22gallery.
Workspace typecheck PASS. Bump1.1.19/code25, runtime1.1.0. Release APK собран
через scripts/build-release.ps1, JDK17/SDK36, прежний ключ сохранён.
APK SHA256080A9887DC65206425C1E2EDBBEEFEEAB61F1F1C343EBD170A033F0AAD91F644,
certificate dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
На5556 install-r, embedded1.1.19, notes19 и стакан PASS. Android export готов.
AI Worker не менять: задача только локального изображения, платных запросов нет.

## Android QA И Прогресс

5556 gymbeam_visualqa: APK18/code24 и OTA18 update01a16dcf подтверждены.
Baseline2подхода/нет active; after-ota-1.1.18-visualqa.json state/plans точно равны
before-release-1.1.18-visualqa.json. Стакан на этом новом APK виден, screenshot
ignored artifacts/apk/verified/release-1.1.18-home-logo-report.png.
5554 gymbeam_test: ранее установлен APK1.1.7/code13, запущен для проверки
настоящего OTA на старом native drawable. До изменения:2тренировки/8подходов,
нет active. Сохранён before-logo-1.1.19-legacy.json из Documents/GymTracker.
Применено OTA18/update01a16dcf. Баг воспроизведён точно: стакана нет,
logcat ExpoImage сообщает отсутствующий assets... resource. Screenshot
release-1.1.18-legacy-logo-missing.png. Перед OTA19 сохранён отдельный baseline
before-ota-logo-1.1.19-legacy.json: те же8подходов, данные не импортировались.
Не удалять/очищать приложение, SDK/AVD/backup и не импортировать личные данные.

## Нерешённое И Следующий Шаг

Проверить локальное исправление через OTA19 на прежнем APK и offline cold launch,
а также в новом APK19 на5556. Сверить сохранность state/plans до/после.
Audit исходников/секретов/APK/Android export. Commit/push master, GitHub Release
APK19, production OTA19, записать IDs/SHA/результаты в checkpoint. Проверить
отсутствие active workout перед reload. В конце остановить оба запущенных QA AVD.
Не включать .agents/agent_assets_metadata.toml и другие unrelated/untracked assets.

Основные команды/пути: pnpm в C:\Users\Dirg9\AppData\Local\pnpm, Node в
C:\Users\Dirg9\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin.
ADB artifacts/android-sdk/platform-tools/adb.exe, ANDROID_AVD_HOME artifacts/android-avd.
UI helpers scripts/android-ui-helpers.ps1 используют ANDROID_SERIAL. Wrapper
export-qa-1.1.12.ps1 жёстко5556/visualqa; для5554 заменять только serial/AVD в
собственном вызове scriptblock. Папка экспорта5554 Documents/GymTracker,5556 Documents.
После reload явно открыть updates повторно, а не ожидать сохранения маршрута.

## Итог Публикации

Source9a6a85a11360c595a9a96447c0b7f8b985df4170, master/origin/master.
CI PASS: https://github.com/dirg9876/gym-tracker/actions/runs/40094057606
APK153058977байт: https://github.com/dirg9876/gym-tracker/releases/download/v1.1.19/gym-beam-1.1.19.apk
SHA выше, asset digest GitHub совпал. Audit10staged/APK/204OTAfiles PASS.
OTA production/update01a16de2-df89-7cd4-83a3-e8b6f8eef9ba,
group e5ec05ea-0d74-4274-b45b-0aab58474c56, 2026-10-24T12:29:07.337Z.
На прежнем APK1.1.7/code13 подтверждено Updates1.1.19/01a16de2; стакан вернулся
без переустановки, screenshot release-1.1.19-legacy-ota-home.png. Wi-Fi/data off,
force-stop/cold start: стакан виден, release-1.1.19-legacy-offline-home.png.
Связь восстановлена. Экспорт after-ota-logo-1.1.19-legacy.json state/plans точно
равен before-ota-logo-1.1.19-legacy.json. На свежем APK19 state/plans также не
изменились. Оба запущенных QA AVD остановлены; SDK/AVD/data не удалялись.
Логотип исправлен и опубликован; незавершённых проверок этого выпуска нет.

Новый запрос во время завершения19: амбициозные, но обоснованные цели при хорошем
ходе тренировок; большой RIR должен корректировать следующий подход, а не ждать
нескольких занятий. Реализовать отдельным следующим логическим выпуском20 после
доставки logo fix, проверить диапазоны мышц/технику/крупный относительный шаг.
