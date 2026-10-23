# Gym-Beam: Только Android, 2026-10-23

## Цель И Контекст

Пользователь явно просит удалить из репозитория всё, связанное с веб-приложением:
нужно только Android-приложение. Workspace C:\gymbeam, PowerShell, branch master.
Предыдущий выпуск1.1.16 опубликован полностью (APK/OTA/CI/nativeQA), см.
`CHECKPOINT_2026-10-23_TIMELINE_1_1_16.md`. После прерывания проверены точные state/plans
после OTA, сеть AVD5556 включена, AVD остановлен. Никаких live QA процессов нет.

## Решения

Удалить web UI `artifacts/gym-tracker`, web mockup `artifacts/mockup-sandbox`,
мёртвый PostgreSQL/Clerk backend (legacy routes/middleware/lib и lib/db), Replit
web deployment и web-hosting scripts/template внутри mobile. Сохранить Android,
offline/backup, общий клиент API и типы, level-data, ai-coach, Cloudflare Worker
и локальный optional coach gateway `artifacts/api-server/src/coach` (Worker использует
его core/provider). Реальный платный шлюз не трогать, ключи/токены не публиковать.
Не переписывать Git history и не force-push: старый web останется в исторических
коммитах, но исчезнет из текущей ветки. Старые checkpoints сохраняют историю.

Перед удалением обязательны переносы: главная Android импортирует hero logo PNG
из `gym-tracker/src/assets/gymbeam-logo.png`; перенести точную копию в mobile assets.
Галерея Android уже содержит все PNG, но female-baseline/sync/level-gallery tests
ссылаются на web. Сделать mobile единственным canonical source, сохранить все хеши.
Три art-audit скрипта получают pngjs через web package; перенести pngjs в scripts.

В `mockup-sandbox/src/.generated/mockup-components.ts` есть чужой dirty: до удаления
скопировать byte-identical в ignored `artifacts/apk/verified/retired-web-2026-10-23/`.
Остальные чужие dirty `.agents/agent_assets_metadata.toml`, untracked attached_assets
и checkpoints17/18 октября не трогать. Не удалять SDK/AVD/APK/backup/credentials.
Backup макета создан до удаления; текущие результаты реализации приведены ниже.

## Состояние После Реализации

Этот раздел заменяет начальные статусы выше: web source УЖЕ удалён. Обычный
`git rm -r` без force удалил400 tracked файлов, затем ещё .replitignore и старый
tracked web screenshot. Изменённый mockup сохранён byte-identical в ignored
`artifacts/apk/verified/retired-web-2026-10-23/mockup-components.ts`, затем удалён
через apply_patch. Не восстанавливать web из Git ради старых тестов.

Перенесён точный hero logo в `mobile/assets/images/gymbeam-logo.png`, SHA256
`E362B2BE0A56ACD52AF87E94EBF7D437BFB07AD2B6CE9154DA38819BF0820D9B`.
Главная/repack используют local asset. Female baseline/sync/male gallery tests
используют только mobile; pngjs7 перенесён в scripts для старых art-audit tools.
Обе галереи и PNG byte-identical, female90 hashes PASS.

Mobile app.json platforms=[android], убраны web/ios config и Replit origin; package
build теперь `expo export --platform android`, удалены browser hosting/server/template,
react-dom/react-native-web/@types-react-dom direct deps. Expo может сохранять свои
внутренние browser peer deps: это SDK, не возвращать из-за warning отдельный web app.
Нативные/direct retained dependency versions проверены YAML parser: изменений НЕТ.
pnpm lock importers13->10, package records1340->952. Frozen offline install PASS,
реально +17/-409 установленных пакетов. minimumReleaseAge1440 сохранён.

Local api-server теперь только `src/coach`, сборка51.3KB, Express/OpenAI/Zod;
worker и shared модели не менялись. Старые DB/Clerk/routes/middleware/types удалены.
README/CI/tsconfig/workspace обновлены. CI вызывает pnpm test, local gateway build,
Worker --dry-run и Android export. Новые scripts/android-workspace.test.mjs7 проверок;
preinstall теперь cross-platform Node guard, без удаления пользовательских lockfiles.

441 тест PASS =7 repo +378mobile +21API +13Worker +22design. Workspace typecheck,
release:check, gallery preservation, art inspection, local gateway build+node --check,
Worker dry-run build, Android Expo export PASS. Обновлён branding-test: web favicon
больше не требуется, Android icon/splash/поля идентичности всё ещё проверяются.
Логи ignored `artifacts/apk/verified/android-only-*.log`.
Bundle `entry-4b91c4d9f03acd30c990b056762395e2.hbc`, но OTA cleanup НЕ публиковать.

Local native APK build через build-release.ps1 PASS (3m16s), обе embedded launch
artifacts свежие. Лог `android-only-apk-build.log`. Не перезаписывать опубликованный verified
gym-beam-1.1.16.apk: тестовая сборка находится только в android/app/build/outputs.
Версия1.1.16/code22/runtime1.1.0 намеренно сохранена для repo-only maintenance.
Сертификат тот же dfdcf05447cf713727f87f653a702649e4bf0ba8ff9598b294d0ac26a264814a.
Логотип найден через AAPT resources table `drawable/assets_images_gymbeamlogo`,
в compiled PNG1254x1254 все видимые RGBA pixels идентичны исходному. PNG bytes
перекомпрессированы AAPT, поэтому сравнивать содержимое декодированных пикселей,
не искать исходное имя или SHA256 PNG в APK. Старый опубликованный verified APK
1.1.16 сохраняет прежний SHA2569DE193A...; новая smoke-сборка не опубликована.
После удаления web новые экранные e2e не повторялись: покрыты тесты, bundling,
нативная сборка, asset pixels и подпись. Предыдущие nativeQA1.1.16 опубликованного
выпуска были успешны. Gradle остановлен, live exec/AVD процессов нет.
Generated web dist/node_modules и lib/db cache ещё есть на диске, но НЕ в Git;
попытка bulk forced очистки blocked by execution policy, не обходить ограничения.
Из текущей ветки исходники удалены, историюGit/SDK/AVD/backup никто не чистил.

Далее: финальный diff/secret audit (пропускать staged deletions и разрешить только
пустой public .env.example), точный stage без чужих dirty, commit/push master/CI,
финализировать checkpoint. Ещё нет cleanup commit/push. Нужные direct версии
зависимостей не обновлялись. SDK/EAS/native runtime не мигрировали.

Это очистка репозитория без изменения поведения установленного Android, а не новый
логический app release: не повышать/публиковать версию только ради maintenance.
Если потребуется реальный новый app release, следующий1.1.17, runtime по совместимости.

## План И Проверки

1. Перенести logo/asset tooling, удалить исходники и конфиги web по точному перечню.
   Для bulk удаления Windows проверить resolved absolute paths внутри workspace,
   сохранить dirty файл и не переходить по node_modules reparse points.
2. Упростить local API package до AI gateway, убрать DB/Clerk зависимости; исправить
   tsconfig references, workspace catalogs/lockfile, CI и README для Android-only.
   Сохранить minimumReleaseAge1440 и текущие pin версий нужных Android зависимостей.
3. Regression tests структуры репозитория, полный mobile/API/Worker/design набор,
   workspace typecheck, fresh Android export и local APK build через build-release.ps1.
   Проверить byte-identical logo/женскую галерею и остальные портреты. Не запускать
   gateway с реальными API credentials и не вызывать платного ИИ.
4. Secret audit, точный stage без unrelated dirty/личных файлов, commit/push master,
   CI без web build, итоговый checkpoint. Не выкладывать APK ради repo-only cleanup.

До изменений: git status HEAD==origin/master d2c6839. Около130MB картинок web
дублируют mobile; удаление web из текущей ветки не гарантирует уменьшение .git.
Предыдущий storage audit12GiB временных APK/кэшей не выполнялся и не авторизует
удаление всего verified. Новый запрос даёт право удалить только web-related области.
