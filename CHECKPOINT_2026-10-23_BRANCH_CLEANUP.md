# Gym-Beam: Единственная Ветка Master

Дата: 23 октября 2026, Europe/Moscow. Workspace: `C:\gymbeam`.

## Цель И Решения

Последний запрос пользователя: «убери все ветки кроме актуальной». Актуальная
ветка `master` проверена: до операции локальный HEAD и origin/master совпадали,
`1b17ef30053563734af82dbd654878c2000152d5`. Других worktree нет.

Удалены все остальные local и remote ветки, без слияния старых разработок.
Чтобы удалить прежнюю default branch `main`, GitHub default переключён на
`master` в рамках нового запроса пользователя. Это заменяет прежнее решение
не менять default branch; теперь основная и публикационная ветка `master`.

Нельзя терять уникальные коммиты: перед удалением создан и проверен локальный
инкрементальный Git bundle. Он не добавлялся в Git и не загружался на GitHub.
Новых архивных веток или тегов не создавалось. История master, существующие
теги, GitHub Releases, APK assets и progress/signing/AI credentials не менялись.

## Резервная Копия

Файл: `C:\gymbeam\artifacts\apk\verified\branches-before-cleanup-2026-10-23.bundle`.
Размер: 165833646 байт. SHA256:
`7B9033C8458E0BD0562C5742D0F1FCBF6BC63BFE77D48CBAFC21C85304C2E10F`.

`git bundle verify` PASS. Внутри 8 refs с уникальными коммитами; полностью
вошедшие в master main/offline ветки восстанавливаются из обычной истории.
Bundle содержит только коммиты/объекты вне master, а не дубликат всей истории.
Для восстановления нужен этот репозиторий или полный clone истории master
с необходимыми prerequisites:

```text
496db9d76972b85f923b8af24189bf59532a3a3d
6422fbf26e2e6d0babff07fc3e03d9254d0123f8
1521b6da7a6844019d84eca61c4320d562259918
36de29825871843a05cea79f0e71c64ebc268d94
a8f51bd8c87f5c316e2983e084edfa747e26dd23
8dc6703cad7d4a35e646806ed46ce1f8c8d7baca
```

Пример восстановления только по отдельному новому запросу пользователя:

```powershell
git fetch C:/gymbeam/artifacts/apk/verified/branches-before-cleanup-2026-10-23.bundle refs/remotes/origin/work:refs/heads/recovered-work
```

Bundle намеренно локальный и ignored. Не публиковать его целиком и не удалять
при общей очистке старых APK без решения, нужны ли сохранённые коммиты.

## Удалённые Ветки

Remote ветки `origin/*`, проверенные непосредственно перед атомарным удалением:

| Ветка | Последний Commit | Коммитов Вне Master |
| --- | --- | --- |
| `main` | `496db9d76972b85f923b8af24189bf59532a3a3d` | 0 |
| `codex/android-v10-moderation` | `e2b51e77da9d195f9b1dc63d8cdaea480f989369` | 8 |
| `feat/all-history-adaptive-daily-workout` | `c17631e11dc1f472d34e73dcebbda1b1fb0a2c7c` | 6 |
| `feat/automatic-history-driven-split` | `bc10e4931c8111b0b9820e98ae009a87a4c1fa50` | 10 |
| `fix/hypertrophy-single-rep-prescriptions-1.1.11` | `b0b341b9706d016c4370901aaf13698c63caae3b` | 12 |
| `fix/one-set-calibration-and-familiar-leg-alternatives` | `7067b4b05f5cacd3773b4a37b6ee7a07d58cf31f` | 8 |
| `fix/split-calibration-one-set-then-expand` | `c857f220db58079b81bf970857cfc702e72e803c` | 9 |
| `work` | `cfff12fcb3b8ea596ed9b6b6ce026d0133da4012` | 103 |

Локально удалены `main` и `offline-apk-corrections` на `496db9d...`, а также
`release-review-1.1.12` на `7067b4b...`. Проверено, что они не открыты в worktree.
`origin/HEAD` теперь symbolic ref на `origin/master`, это не отдельная ветка.

Старый [PR #1](https://github.com/dirg9876/gym-tracker/pull/1),
`codex/android-v10-moderation` -> `main`, закрыт без слияния с поясняющим комментарием.
Открытых PR после очистки нет. Не сливать этот старый PR ради восстановления ветки.

## Файлы И Проверки

- `README.md`: убрано предупреждение о старой default main, указана единственная master.
- `AGENTS.md`: зафиксирована текущая публикационная/default ветка master.
- `CHECKPOINT.md`: указывает на этот самодостаточный checkpoint.
- `git fetch origin --prune` и проверка live refs до удаления: PASS; remote master
  и локальная master совпадали. Fetch также получил существующий тег v1.1.16.
- Восемь remote refs удалены одной `git push --atomic --delete`, без force-push.
- `git branch -avv`: только master, origin/master и symbolic origin/HEAD.
- GitHub branches API: ровно одна master. Repo API: defaultBranchRef=master.
- Bundle verify, hash и проверка ignored пути: PASS.
- `pnpm test`: 448/448 PASS (14 repo, 378 mobile, 21 Node gateway, 13 Worker,
  22 gallery), включая бренд и локальные ссылки актуальных документов.
- `pnpm typecheck`: все workspace-пакеты PASS. Платных API-вызовов не было.
- `git diff --check`: PASS. App/release metadata и pnpm-lock не изменились.
- Документация оформляется в master с сообщением коммита
  `docs: record master-only branch cleanup`; нет слияния или принудительной
  перезаписи исходников приложения.

## Сохранность И Следующий Шаг

Никакого app release: версия 1.1.16 / Android 22 / runtime 1.1.0 не менялась,
следующий логический выпуск 1.1.17. APK/OTA и Worker не публиковались. Нет GC,
перезаписи истории, force-push, очистки SDK/AVD или удаления пользовательских файлов.

Чужой dirty `.agents/agent_assets_metadata.toml` и untracked старые checkpoints/
attached_assets сохранены. Не добавлять их общим `git add .`. Из архивных
checkpoint не применять прежнее утверждение о default main: оно устарело.

Задача очистки завершена. Нерешённых проблем с ветками нет. Далее продолжать
только новую задачу пользователя после чтения AGENTS.md и git status.
Не восстанавливать удалённые ветки автоматически. Перед будущей общей очисткой
диска учитывать Git bundle. При следующем app release использовать 1.1.17.
