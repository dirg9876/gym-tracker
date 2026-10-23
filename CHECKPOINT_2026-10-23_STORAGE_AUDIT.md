# Gym-Beam: Аудит Места, 2026-10-23

## Цель И Статус

Пользователь спросил, что можно удалить из `C:\gymbeam` для освобождения места.
Выполнен только read-only аудит. Удаление не запрошено явно и НЕ выполнялось.
После аудита пользователь переключил задачу на график истории/прогноза и повторение
60 кг в прогнозе. Не начинать очистку автоматически. Приложение опубликовано 1.1.15;
см. `CHECKPOINT_2026-10-23_RELEASE_1_1_15.md`. Из-за аудита версию не повышать.

## Метод И Результаты

Ignored scanner: `artifacts/apk/verified/storage-inventory.ps1`. C#/.NET обходит файлы,
пропускает reparse points, считает Length; 230853 файла, 4695 ссылок/нечитаемых элементов
пропущено. Это логические объёмы, не гарантия физического выигрыша: sparse AVD и
hardlinks pnpm могут отличаться. Итого около 46.1 GiB; на C: свободно около 46 GiB.

| Путь | GiB |
| --- | ---: |
| artifacts/android-avd | 16.69 |
| artifacts/apk | 10.14 |
| artifacts/android-sdk | 8.07 |
| .git | 4.19 |
| node_modules | 3.82 |
| artifacts/gym-tracker-mobile | 2.00 |

Внутренние подпапки уже входят в родительские, не складывать их повторно.

## Кандидаты Без Удаления Инструментов И Данных

Суммарно 12.195 GiB логического объёма:

- `artifacts/apk/verified/branding-{32 hex}` и `branding-final`: 22 распаковки APK,
  6011998752 байта / 5.599 GiB. Внутри decoded APK, не исходные изображения приложения.
- 18 старых/промежуточных `*.apk` непосредственно в `artifacts/apk/verified`:
  2334879210 байт / 2.175 GiB. Сохранить 1.1.15 и 1.1.14; проверить наличие нужных
  релизов на GitHub до удаления единственных локальных дистрибутивов.
- 9 старых промежуточных APK непосредственно в `artifacts/apk`: 1468180397 байт /
  1.367 GiB. Не удалять целиком эту папку, там ключ подписи и другие важные материалы.
- `artifacts/gym-tracker-mobile/android/app/build`: 1.622 GiB, пересоздаётся сборкой.
- `.cache/native-cxx`: 0.524 GiB, пересоздаётся; следующая native сборка будет дольше.
- `artifacts/android-downloads`: 0.313 GiB, архив и извлечение cmdline-tools;
  установленная копия есть в `artifacts/android-sdk/cmdline-tools/latest`.
- `artifacts/gym-tracker/dist`, `artifacts/gym-tracker-mobile/dist`,
  `artifacts/gym-tracker-mobile/.expo-export-test`: суммарно 0.362 GiB, exports/builds.
- `artifacts/apk/branding-decoded`, `artifacts/apk/embed-current`: 0.234 GiB,
  промежуточные decoded/export файлы.

Все перечисленные каталоги проверены `git ls-files` / `git check-ignore`: не tracked.
Это кандидаты, не выполненная очистка. Перед очисткой остановить сборки/Gradle,
проверить отсутствие защищённых файлов и разрешение пользователя. Для каждого
recursive Remove-Item проверить resolved absolute path внутри C:\gymbeam, reparse
points и использовать LiteralPath в одной PowerShell-сессии. Никаких blanket wildcard
удалений всей `verified`, никаких ручных удалений `.git/objects`.

## Дополнительно И Защищённые Данные

- Два `snapshots/default_boot/ram.img` по 2684420096 байт, вместе около 5 GiB.
  Удаление снимков после остановки обоих AVD не равно удалению userdata, но потребует
  холодного запуска. Только с отдельным согласием; консервативный набор их не включает.
- `gymbeam_test.avd`: 9.23 GiB; `gymbeam_visualqa.avd`: 7.46 GiB. В userdata могут
  быть тренировки. Полные AVD не удалять без backup и согласования. Сейчас процессы
  emulator/qemu не обнаружены; QA AVD 5556 остановлен после восстановления baseline.
- SDK 8.07 GiB и node_modules 3.82 GiB нужны для разработки; удаление потребует
  повторной установки. В основной предложенный набор не входят.
- `.git`: `git count-objects -vH` показывает 3.04 GiB loose objects, 743.74 MiB packs,
  432.38 MiB garbage `tmp_pack_zvjX1W`. Большой blob b035ff... имеет uncompressed
  size 1875836928; он и ещё два крупных blob не найдены в refs/reflogs/index.
  Это не достаточное основание вручную их удалять: только отдельная проверка
  целостности/ссылок и штатное обслуживание Git после согласования. Git-процессов нет.
- Сохранить исходники/картинки, `artifacts/apk/debug.keystore`, credentials,
  `.env.coach`, `.coach-data`, connection-файлы, личные JSON backup, отчёты аудита,
  checkpoints, APK 1.1.15/1.1.14, SDK и оба AVD. Папку verified целиком НЕ удалять.
- Чужие dirty `.agents/agent_assets_metadata.toml`, generated mockup-components,
  untracked attached_assets и checkpoints 17/18 октября не трогать.

## Следующий Шаг

Текущий приоритет пользователя: исправить график и проверить сценарную прогрессию.
После этого можно согласовать консервативную очистку около 12 GiB, выполнить её по
точному перечню с проверками путей и сравнить фактическое свободное место до/после.
Никаких обещаний, что логический объём равен физическому выигрышу на диске.
