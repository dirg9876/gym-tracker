import { db, exercisesTable, userExercisePrefsTable, workoutSetsTable, workoutsTable, appMetaTable } from "@workspace/db";
import { eq, and, isNotNull, isNull, asc, inArray, or, sql } from "drizzle-orm";
import {
  getProfile,
  getConfirmedLevel,
  setConfirmedLevel,
  FALLBACK_BODY_WEIGHT_KG,
  FALLBACK_SEX,
} from "./profile";
import {
  getMcKgForExercise,
  getWeightClassKg,
  rankForLevel,
  rankForMcPercent,
  type McSource,
  type SportRank,
} from "./sport-norms";

export type LevelDef = {
  level: number;
  name: string;
  description: string;
  tier: number;
  benchmarkKg: number;
  tonnage7dKgRequired: number;
  mainExercisesRequired: number;
  rank: SportRank;
};

const TIER_SIZE = 9;
const MAIN_EXERCISES_REQUIRED = 3;

// Weekly tonnage assumptions. The required tonnage per week is:
//   workouts/week × exercises/workout × sets × reps × workingWeight
// where workingWeight = bodyWeight × levelFactor(level).
// 9 reps is the midpoint of the 8–10 working-set range.
const WORKOUTS_PER_WEEK_ASSUMED = 3;
const EXERCISES_PER_WORKOUT = 5;
const SETS_PER_EXERCISE = 5;
const REPS_PER_SET = 9;

// Anchor: at level 80 (МСМК — Мастер спорта международного класса) the level
// factor is 1.0, meaning the per-exercise МСМК target equals the full МСМК kg
// norm for the user's weight class. All lower levels scale linearly:
// required_kg = mc_kg × level/80.
export const LEVEL_FACTOR_ANCHOR = 80;

// Standard Olympic bar weight. Barbell exercises whose required kg falls below
// this floor are auto-passed (treated as cleared) — you can't load a real
// barbell with less than the empty bar, so it would be silly to "block" the
// next level on, say, a 10 kg bench press requirement.
export const BAR_WEIGHT_KG = 20;

// Multi-level jump penalty: each level skipped beyond +1 from the confirmed
// level adds 10% to both tonnage and per-exercise weight requirements. So a
// jump of +1 has no penalty (×1.0), +2 has ×1.10, +3 has ×1.20, etc.
const JUMP_PENALTY_PER_LEVEL = 0.10;

const NAMES_AND_DESCRIPTIONS: Array<[string, string]> = [
  // Tier 0 — L0–8
  ["Стартовый Дрыщ",        "Ты не держал ничего тяжелее компьютерной мышки. Пока."],
  ["Пакетный Атлет",        "Пакеты из магазина пока считаются функциональным тренингом."],
  ["Грифовый Нуб",          "Пустой гриф смотрит на тебя как финальный босс."],
  ["Тонкий Провод",         "Сигнал силы есть, мощности пока маловато."],
  ["Колобок на массе",      "От бабушки ушёл. От штанги — пока нет."],
  ["Пугливый Блин",         "Блин 5 кг уже вызывает уважительное молчание."],
  ["Разминщик",             "Разминка длится дольше тренировки, зато научно."],
  ["Вешалка с амбициями",   "Футболка висит, но планы уже плотные."],
  ["Цыплёнок на предтрене", "Кудахчешь над пустым грифом, но глаза уже горят."],
  // Tier 1 — L9–17
  ["Левша с грифом",        "Подковал бы блоху, но пока ищешь замки на штангу."],
  ["Зелёный Луч",           "В зале ты как новый NPC: стоишь, мигаешь, учишься."],
  ["Любитель железа",       "Уже знаешь, что блины бывают не только к чаю."],
  ["Турист качалки",        "Заходишь в зал как на экскурсию, но билет уже куплен."],
  ["Иван с печи",           "С печи слез — к штанге пошёл. История началась."],
  ["Школьник железа",       "Делаешь подходы по 5 раз с пустым грифом и важным лицом."],
  ["Кардио-бард",           "Рассказываешь, что дорожка заменит силовые. Штанга смеётся."],
  ["Ученик грифа",          "Уже не падаешь под штангой. Прогресс официально засчитан."],
  ["Подстрахованный",       "Тренер рядом, ангел-хранитель тоже не ушёл."],
  // Tier 2 — L18–26
  ["Самовытаскиватель",     "Сам себя за волосы вытащил. Теперь попробуй становую."],
  ["Стажёр силы",           "Жим и тяга больше не звучат как отделы бухгалтерии."],
  ["Регуляр",               "Ходишь в зал чаще, чем обновляешь планы на жизнь."],
  ["YouTube-рыцарь",        "Техника из роликов медленно становится техникой в реальности."],
  ["Геракл-лайт",           "Двенадцать подвигов впереди. Пока — двенадцать повторов."],
  ["Кандидат в кач",        "Гриф уже не пугает, он просто оценивает."],
  ["День-ног-выживший",     "Ноги потрясывает, но честь сохранена."],
  ["Свой на ресепшене",     "Тебя узнают. Значит, отступать стало неловко."],
  ["Активист зала",         "Берёшь кардио после силовой. Иногда. В теории."],
  // Tier 3 — L27–35
  ["Гладиатор без арены",   "Арены нет, зато есть стойка для приседа."],
  ["Юниор",                 "Можешь подсказать новичку, как не перепутать гантели."],
  ["Форма намечается",      "В зеркале уже не просто человек, а черновик атлета."],
  ["Железный парень",       "Шейкер с собой, лицо серьёзное, веса растут."],
  ["Лабиринтный герой",     "Лабиринт тренажёров пройден. Минотавр — это день ног."],
  ["Завсегдатай",           "Знаешь, где лежат блины 20 кг. Пока смотришь на них уважительно."],
  ["Суперсетник",           "Можешь объяснить суперсет и устать ещё до него."],
  ["Уверенный",             "Поднимаешь без страха травмы и без лишней драмы."],
  ["Опытный",               "Ты уже не ищешь тренажёр. Ты ищешь свободный тренажёр."],
  // Tier 4 — L36–44
  ["Святогор на минималках","Сила земли в ладонях, но абонемент ещё месячный."],
  ["Прогрессирующий",       "Веса растут, отговорки сохнут."],
  ["Тренированный",         "Видно, что ходишь в зал, а не просто мимо."],
  ["Бывалый",               "Пояс, магнезия и взгляд человека, который видел присед."],
  ["Самсон без парикмахера","Волосы целы, сила растёт, парикмахер в пролёте."],
  ["Атлет",                 "На входе кивают как своему. Уже приятно."],
  ["Силач",                 "Жмёшь свой вес — это уважают даже блины."],
  ["Белковый бухгалтер",    "Считаешь белки так, будто сдаёшь квартальный отчёт."],
  ["Мощный",                "Футболка начала просить отпуск."],
  // Tier 5 — L45–53
  ["Добрыня с абонементом", "Богатырский вайб, современный график тренировок."],
  ["Жилистый",              "Сила ощущается в каждом движении."],
  ["Крепкий",               "Шкаф двигаешь один. Но сначала разминаешься."],
  ["Подтянутый",            "В зеркало смотришь как инвестор в собственные плечи."],
  ["Ахилл с бинтами",       "Пятка прикрыта, жим открыт."],
  ["Сложенный",             "Форма стала такой, что рубашка задумалась."],
  ["Прокачанный",           "Новички спрашивают совет, а ты делаешь вид, что так и было."],
  ["Сильный",               "Жмёшь в полтора своих веса и не строишь из этого драму."],
  ["Боец зала",             "В зале как дома, только дома нет стойки для приседа."],
  // Tier 6 — L54–62
  ["Алёша с шейкером",      "Хитрость подкреплена силой и углеводным окном."],
  ["Жимовой маг",           "Каждый повтор выглядит как заклинание грудных мышц."],
  ["Король тяги",           "Становая — не упражнение, а сцена твоего возвращения."],
  ["Силовой атлет",         "Соревнования уже не пугают, они кивают."],
  ["Громовержец с молотом", "Молот при себе. Гриф тоже не жалуется."],
  ["Мускулистый",           "Спина закрывает половину зеркала."],
  ["Богатырь на старте",    "Потенциал уже виден. Осталось докинуть блинов."],
  ["Жим-машина",            "Повторы идут как конвейер, только громче."],
  ["Стальной атлет",        "Веса, что пугали раньше, теперь разминка."],
  // Tier 7 — L63–71
  ["Муромец после сна",     "33 года ждал. Теперь компенсируешь объёмом."],
  ["Грозный",               "На тебя оборачиваются, когда ты просто берёшь гриф."],
  ["Богатырь",              "Ты уже не примеряешь силу. Ты её носишь."],
  ["Гора формы",            "Двери становятся узкими, самооценка — широкой."],
  ["Громила",               "Стулья скрипят уважительно."],
  ["Танк в кроссовках",     "Просто проходишь сквозь толпу и расписание тренировок."],
  ["Зверь",                 "Рычишь под штангой так, что музыка становится тише."],
  ["Колосс",                "Размеры и сила впечатляют даже опытных."],
  ["Глыба характера",       "Тебе уступают дорогу — и стойку для приседа."],
  // Tier 8 — L72–80
  ["Избранный в плаще",     "Очки на месте, гравитация спорит, штанга проигрывает."],
  ["Мастер",                "Техника чистая, как будто её отполировали."],
  ["Профи",                 "Молодёжь смотрит как на легенду, тренеры — как на коллегу."],
  ["Сильнейший",            "В твоём зале равных нет. Есть только свидетели."],
  ["Чемпион зала",          "Все рекорды на доске начинают нервничать."],
  ["Тяжёлая артиллерия",   "Цифры на штанге впечатляют даже калькулятор."],
  ["Агент в чёрном",        "Пришёл стереть память тем, кто сомневался в твоей силе."],
  ["Несгибаемый",           "Каждая тренировка — битва с собой. Ты обычно побеждаешь."],
  ["Легенда Gym-Beam",      "Твоё имя будут помнить, а штангу — проверять дважды."],
];
console.assert(NAMES_AND_DESCRIPTIONS.length === 81, `Male array has ${NAMES_AND_DESCRIPTIONS.length} entries, expected 81`);

// ─── Female level names ───────────────────────────────────────────────────────
const NAMES_AND_DESCRIPTIONS_FEMALE: Array<[string, string]> = [
  // Tier 0 — L0–8
  ["Стартовая Искра",        "Пока маленькая, но уже светишься перед первой тренировкой."],
  ["Пакетница",              "Пакеты из магазина пока тяжелее твоих рабочих весов."],
  ["Гантельная Мышка",       "Гантели маленькие, амбиции подозрительно большие."],
  ["Тонкий Луч",             "Силы немного, зато направление уже выбрано."],
  ["Золушка на предтрене",   "Туфельку оставила дома. В зал пришла за штангой."],
  ["Пугливая Гиря",          "Зал кажется босс-файтом первого уровня."],
  ["Разминка с характером",  "Разогреваешься дольше, чем тренируешься, но уже с лицом профи."],
  ["Мини-Блинница",          "Пока берёшь маленькие блины. Но берёшь с видом чемпиона."],
  ["Цыпа на массе",          "Кудахтит над пустым грифом, но уже не сдаётся."],
  // Tier 1 — L9–17
  ["Снегурка с грифом",      "В зале не тает — просто работает с лёгкими весами."],
  ["Зелёный Луч",            "Ещё путаешь тренажёры, но уже сияешь увереннее."],
  ["Любопытная Атлетка",     "Уже знаешь, где раздевалка, вода и самые лёгкие блины."],
  ["Гостья качалки",         "Зашла на экскурсию, но задержалась на подход."],
  ["Маша без медведя",       "Медведя не боишься. Штангу пока уважаешь издалека."],
  ["Школьница железа",       "Учишь азбуку подходов, повторов и нормальной техники."],
  ["Кардио-ведьмочка",       "Дорожка зовёт, но штанга уже шепчет громче."],
  ["Ученица грифа",          "Уже не падаешь под штангой. Это серьёзная победа."],
  ["Под присмотром",         "Тренер всё ещё рядом, но уже не держит валидол."],
  // Tier 2 — L18–26
  ["Охотница на вампиров",   "Ночью спасает мир, днём спорит с пустым грифом."],
  ["Стажёрка силы",          "Жим и тяга больше не звучат как заклинания."],
  ["Регулярочка",            "Ходишь в зал чаще, чем за сладким. Почти."],
  ["YouTube-воительница",    "Техника из роликов медленно превращается в технику в зале."],
  ["Геба с шейкером",        "Кубок богов подняла. Теперь очередь за блином 10 кг."],
  ["Кандидатка в кач",       "Гриф уже не пугает, он просто ждёт."],
  ["День-ног-героиня",       "Не пропускаешь ноги. Ну… почти не пропускаешь."],
  ["Своя на ресепшене",      "Тебя уже узнают. Значит, пути назад почти нет."],
  ["Активистка зала",        "Кардио после силовой — иногда, но звучит красиво."],
  // Tier 3 — L27–35
  ["Королева Нила",          "Командуешь залом так, будто это личная империя."],
  ["Юниорка",                "Можешь подсказать новенькой, где лежат гантели поменьше."],
  ["Форма намечается",       "В зеркале уже видно: сюжет развивается правильно."],
  ["Железная леди",          "Шейкер с собой, взгляд серьёзный, настрой боевой."],
  ["Кошка из девяностых",    "Грация есть. Осталось, чтобы блины начали бояться."],
  ["Завсегдатая",            "Знаешь, где лежат блины 20 кг. Пока просто знаешь."],
  ["Суперсетница",           "Можешь объяснить суперсет и сделать вид, что так и планировала."],
  ["Уверенная",              "Поднимаешь без паники и уже не споришь с зеркалом."],
  ["Опытная",                "Ты уже не ищешь тренажёр. Ты ищешь свободный тренажёр."],
  // Tier 4 — L36–44
  ["Принцесса-воительница",  "В кадре плащ, в руке гриф, в глазах — план на ноги."],
  ["Прогрессирующая",        "Веса растут, а отговорки уменьшаются."],
  ["Тренированная",          "По плечам видно: ты здесь не фотографироваться пришла."],
  ["Бывалая",                "Пояс, магнезия и серьёзный взгляд — всё на месте."],
  ["Воронья королева",       "На подходе такая атмосфера, что блины сами ровняются."],
  ["Атлетка",                "На входе кивают как своей. Заслуженно."],
  ["Силачка",                "Жмёшь свой вес — и это уже не шутка."],
  ["Фитнес-королева",        "Белки посчитаны, подходы записаны, трон занят."],
  ["Мощная",                 "Топ держится, но уже начинает вести переговоры."],
  // Tier 5 — L45–53
  ["Орлеанская лидерка",     "Ведёшь себя в бой: ты, гриф и святой предтрен."],
  ["Жилистая",               "В каждом движении видно: сила стала привычкой."],
  ["Крепкая",                "Теперь пакеты из магазина — просто разминка."],
  ["Подтянутая",             "В зеркало смотришь как главный редактор прогресса."],
  ["Царица степей",          "Коня остановит, штангу поднимет, треню закроет."],
  ["Сложенная",              "Форма стала такой, что одежда начала уважать плечи."],
  ["Прокачанная",            "Новички спрашивают совет, а ты делаешь вид, что всегда так было."],
  ["Сильная",                "Жмёшь в полтора своих веса и спокойно пьёшь воду."],
  ["Воительница",            "В зале как дома, только дома меньше блинов."],
  // Tier 6 — L54–62
  ["Богатырка",              "Русская сила без музейной пыли: слово держит, штангу тоже."],
  ["Жимовая фея",            "Фея, которая вместо пыльцы разбрасывает магнезию."],
  ["Королева тяги",          "Становая — не упражнение, а сцена твоего триумфа."],
  ["Силовая атлетка",        "Соревнования уже не пугают, они подмигивают."],
  ["Марья без Кощея",        "Кощея отпустила. Теперь в плену только рабочие веса."],
  ["Мускулистая",            "Спина закрывает половину зеркала, и это проблема зеркала."],
  ["Богатырка на старте",    "Потенциал уже виден. Осталось докинуть блинов."],
  ["Жим-машина",             "Повторы идут как конвейер, только красивее."],
  ["Стальная атлетка",       "Веса, что пугали раньше, теперь зовутся разминкой."],
  // Tier 7 — L63–71
  ["Девушка в чёрном плаще", "Очки на месте, гравитация спорит, штанга проигрывает."],
  ["Грозная",                "На тебя оборачиваются, когда ты просто берёшь гриф."],
  ["Богатырша",              "Ты уже не примеряешь силу. Ты её носишь."],
  ["Гора формы",             "Двери становятся узкими, самооценка — широкой."],
  ["Громовая леди",          "Стулья скрипят уважительно, когда ты садишься отдыхать."],
  ["Танк на шпильках",       "Просто проходишь сквозь толпу и расписание тренировок."],
  ["Звериная форма",         "Рычишь под штангой так, что музыка становится тише."],
  ["Колоссальная",           "Размеры и сила впечатляют даже опытных."],
  ["Глыба характера",        "Тебе уступают дорогу — и стойку для приседа."],
  // Tier 8 — L72–80
  ["Гайя",                   "Земля носит всех, но ты ещё и поднимаешь."],
  ["Мастерица",              "Техника чистая, как будто её отполировали."],
  ["Профи",                  "Молодёжь смотрит как на легенду, тренеры — как на коллегу."],
  ["Сильнейшая",             "В твоём зале равных нет. Есть только свидетели."],
  ["Чемпионка зала",         "Все рекорды на доске начинают нервничать."],
  ["Тяжёлая артиллерия",    "Цифры на штанге впечатляют даже калькулятор."],
  ["Агентка в чёрном",       "Пришла стереть память тем, кто сомневался в твоей силе."],
  ["Несгибаемая",            "Каждая тренировка — битва с собой. Ты обычно побеждаешь."],
  ["Легенда Gym-Beam",       "Твоё имя будут помнить, а штангу — проверять дважды."],
];
console.assert(NAMES_AND_DESCRIPTIONS_FEMALE.length === 81, `Female array has ${NAMES_AND_DESCRIPTIONS_FEMALE.length} entries, expected 81`);

// Historical default list — used only on first-run seeding so existing users
// keep level behavior. After seeding, the source of truth is the `is_main`
// column on the exercises table, which the user can edit on the Exercises page.
export const DEFAULT_MAIN_EXERCISE_NAMES = [
  "Жим штанги лёжа",
  "Жим гантелей лёжа",
  "Жим штанги на наклонной скамье",
  "Приседания со штангой",
  "Румынская тяга",
  "Становая тяга",
  "Тяга штанги в наклоне",
  "Тяга гантели одной рукой",
  "Жим штанги стоя",
  "Жим гантелей сидя",
  "Подъём штанги на бицепс",
];

// Per-exercise bodyweight multipliers. For dumbbell movements, the multiplier
// reflects the weight of ONE dumbbell relative to bodyweight (so 0.4 = 40% of
// bodyweight per dumbbell, e.g. an 80 kg trainee aims for ~32 kg dumbbells at
// the anchor level).
export const DEFAULT_MAIN_EXERCISE_MULTIPLIERS: Record<string, number> = {
  "Жим штанги лёжа": 1.0,
  "Жим штанги на наклонной скамье": 0.85,
  "Приседания со штангой": 1.5,
  "Румынская тяга": 1.5,
  "Становая тяга": 2.0,
  "Тяга штанги в наклоне": 1.0,
  "Жим штанги стоя": 0.65,
  "Подъём штанги на бицепс": 0.65,
  "Жим гантелей лёжа": 0.4,
  "Тяга гантели одной рукой": 0.5,
  "Жим гантелей сидя": 0.4,
};

const MAIN_EXERCISES_SEED_KEY = "main_exercises_seeded_v1";
const DEFAULT_MULTIPLIERS_SEED_KEY = "default_multipliers_seeded_v1";
const DEFAULT_EQUIPMENT_SEED_KEY = "default_equipment_seeded_v1";

// Default equipment for the historical exercise catalog. Anything not listed
// here defaults to "other" via the column default, and the user can edit it
// on the /exercises page.
export const DEFAULT_EXERCISE_EQUIPMENT: Record<
  string,
  "barbell" | "dumbbell" | "bodyweight" | "machine" | "other"
> = {
  // Barbell
  "Жим штанги лёжа": "barbell",
  "Жим штанги на наклонной скамье": "barbell",
  "Приседания со штангой": "barbell",
  "Румынская тяга": "barbell",
  "Становая тяга": "barbell",
  "Тяга штанги в наклоне": "barbell",
  "Жим штанги стоя": "barbell",
  "Подъём штанги на бицепс": "barbell",
  "Французский жим": "barbell",
  // Dumbbell
  "Жим гантелей лёжа": "dumbbell",
  "Жим гантелей сидя": "dumbbell",
  "Тяга гантели одной рукой": "dumbbell",
  "Разводка гантелей": "dumbbell",
  "Махи гантелями в стороны": "dumbbell",
  "Махи в наклоне": "dumbbell",
  "Сгибания с гантелями": "dumbbell",
  "Молотки с гантелями": "dumbbell",
  "Выпады с гантелями": "dumbbell",
  // Bodyweight
  "Подтягивания": "bodyweight",
  "Отжимания на брусьях": "bodyweight",
  "Отжимания узким хватом": "bodyweight",
  "Скручивания": "bodyweight",
  "Планка": "bodyweight",
  "Подъём ног в висе": "bodyweight",
  // Machine / cable
  "Жим ногами": "machine",
  "Сгибания ног лёжа": "machine",
  "Разгибания ног сидя": "machine",
  "Тяга верхнего блока": "machine",
  "Тяга горизонтального блока": "machine",
  "Подъёмы на носки": "machine",
  "Разгибания на блоке": "machine",
};

/**
 * One-time seed: marks the historical default 11 names as main so existing
 * users keep the same level behavior. The seed runs only when BOTH:
 *   - no exercise is currently marked is_main = true, AND
 *   - the sentinel row in `app_meta` is absent.
 * The sentinel guarantees that even if the user later unstars every main
 * exercise, a server restart will NOT re-apply the canonical list.
 */
export async function seedMainExercisesIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(and(isNull(appMetaTable.userId), eq(appMetaTable.key, MAIN_EXERCISES_SEED_KEY)))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(exercisesTable)
    .where(eq(exercisesTable.isMain, true));

  let seededCount = 0;
  if (cnt === 0) {
    const updated = await db
      .update(exercisesTable)
      .set({ isMain: true })
      .where(inArray(exercisesTable.name, DEFAULT_MAIN_EXERCISE_NAMES))
      .returning({ id: exercisesTable.id });
    seededCount = updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: MAIN_EXERCISES_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return { seeded: seededCount };
}

/**
 * One-time seed: stamps the default equipment kind for the historical
 * exercise catalog. Gated by a sentinel so user edits are never clobbered.
 * Custom exercises and unknown names keep the column default ("other").
 */
export async function seedDefaultEquipmentIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(and(isNull(appMetaTable.userId), eq(appMetaTable.key, DEFAULT_EQUIPMENT_SEED_KEY)))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  let seededCount = 0;
  for (const [name, equipment] of Object.entries(DEFAULT_EXERCISE_EQUIPMENT)) {
    const updated = await db
      .update(exercisesTable)
      .set({ equipment })
      .where(eq(exercisesTable.name, name))
      .returning({ id: exercisesTable.id });
    seededCount += updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: DEFAULT_EQUIPMENT_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return { seeded: seededCount };
}

/**
 * One-time seed: applies default bodyweight multipliers to the historical 11
 * main exercises. Runs once (gated by sentinel) so a user's later edits are
 * never overwritten on restart. Custom or unknown exercises keep the column
 * default (1.0×).
 */
export async function seedDefaultMultipliersIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, DEFAULT_MULTIPLIERS_SEED_KEY))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  let seededCount = 0;
  for (const [name, mul] of Object.entries(DEFAULT_MAIN_EXERCISE_MULTIPLIERS)) {
    const updated = await db
      .update(exercisesTable)
      .set({ bodyweightMultiplier: mul.toFixed(2) })
      .where(eq(exercisesTable.name, name))
      .returning({ id: exercisesTable.id });
    seededCount += updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: DEFAULT_MULTIPLIERS_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return { seeded: seededCount };
}

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function levelFactor(level: number): number {
  if (level <= 0) return 0;
  return level / LEVEL_FACTOR_ANCHOR;
}

/**
 * Reference weight at this level for a 1.0× exercise = bodyweight × levelFactor.
 * This replaces the old single-number `benchmarkKg` and is what programs.ts
 * uses as a base when no PR is available for an exercise.
 */
export function referenceKg(level: number, bodyWeightKg: number): number {
  if (level <= 0) return 0;
  return roundTo(bodyWeightKg * levelFactor(level), 2.5);
}

// Smallest plate increment we use for required weights and the practical floor
// for any positive multiplier. Without this floor, very low multipliers at low
// levels would round to 0 kg, which both looks wrong in the UI and would
// trivially count as "passed" for any user.
const MIN_REQUIRED_KG = 2.5;

/**
 * Required weight for a specific main exercise at a given level, given the
 * user's bodyweight, the exercise's per-exercise multiplier, and an optional
 * jump penalty multiplier (≥ 1). Floored at MIN_REQUIRED_KG when multiplier > 0
 * so early levels remain meaningful.
 */
export function requiredKgForExercise(
  level: number,
  bodyWeightKg: number,
  multiplier: number,
  penaltyMultiplier: number = 1,
): number {
  if (level <= 0 || multiplier <= 0) return 0;
  const raw = bodyWeightKg * levelFactor(level) * multiplier * penaltyMultiplier;
  return Math.max(MIN_REQUIRED_KG, roundTo(raw, 2.5));
}

/**
 * Required tonnage (kg) per 7-day window to qualify for a given level.
 * Formula: 3 workouts/week × 5 exercises × 5 sets × 9 reps × workingWeight,
 * where workingWeight = bodyWeight × levelFactor(level). Multiplied by an
 * optional jump-penalty multiplier (≥ 1) when computing penalised targets.
 */
export function tonnage7dRequired(
  level: number,
  bodyWeightKg: number,
  penaltyMultiplier: number = 1,
): number {
  if (level <= 0) return 0;
  const workingWeight = bodyWeightKg * levelFactor(level);
  const weekly =
    WORKOUTS_PER_WEEK_ASSUMED *
    EXERCISES_PER_WORKOUT *
    SETS_PER_EXERCISE *
    REPS_PER_SET *
    workingWeight *
    penaltyMultiplier;
  return roundTo(weekly, 500);
}

/**
 * Computes the jump penalty multiplier for a candidate level relative to the
 * confirmed level. +1 jump = ×1.0 (no penalty). Each additional level adds
 * +10%. Always ≥ 1.
 */
export function jumpPenaltyMultiplier(
  candidateLevel: number,
  confirmedLevel: number,
): number {
  const jump = candidateLevel - confirmedLevel;
  if (jump <= 1) return 1;
  return 1 + JUMP_PENALTY_PER_LEVEL * (jump - 1);
}

export function buildLevels(bodyWeightKg: number, sex: "male" | "female" = "male"): LevelDef[] {
  const names = sex === "female" ? NAMES_AND_DESCRIPTIONS_FEMALE : NAMES_AND_DESCRIPTIONS;
  return names.map(([name, description], idx) => ({
    level: idx,
    name,
    description,
    tier: Math.min(8, Math.floor(idx / TIER_SIZE)),
    benchmarkKg: referenceKg(idx, bodyWeightKg),
    tonnage7dKgRequired: tonnage7dRequired(idx, bodyWeightKg),
    mainExercisesRequired: idx === 0 ? 0 : MAIN_EXERCISES_REQUIRED,
    rank: rankForLevel(idx),
  }));
}

// Default ladder built with the fallback bodyweight — exposed for callers
// that don't (yet) need a per-user computation.
export const LEVELS: LevelDef[] = buildLevels(FALLBACK_BODY_WEIGHT_KG);

export const MAX_LEVEL = LEVELS.length - 1;

export type Equipment = "barbell" | "dumbbell" | "bodyweight" | "machine" | "other";
export type AutoPassedReason = "below_bar_weight" | "time_based_exercise";

export type MainExerciseStat = {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: Equipment;
  maxWeightKg: number;
  /** Effective multiplier = mcKg / bodyWeightKg. Used by the level-detail dialog
   *  to compute required kg for any level: bodyWeight × (level/anchor) × multiplier. */
  multiplier: number;
  requiredKgForNextLevel: number | null;
  // ≥ 1. When > 1, the requirement above already includes the jump penalty.
  requiredKgPenaltyMultiplier: number;
  // When non-null, the exercise is treated as passed regardless of maxWeightKg.
  // "below_bar_weight" — barbell exercise whose required kg < empty bar.
  // "time_based_exercise" — e.g. Планка; kg requirement not applicable.
  autoPassedReason: AutoPassedReason | null;
  /** MS-equivalent kg target for this exercise and the user's weight class.
   *  Null for time-based exercises (e.g. Планка). */
  mcKg: number | null;
  /** How the mcKg was derived. */
  mcSource: McSource;
};

export type LevelStats = {
  currentTonnage7dKg: number;
  maxTonnage7dKg: number;
  oldestSetInWindowAt: string | null;
  mainExercises: MainExerciseStat[];
};

export type CurrentLevelInfo = {
  currentLevel: number;
  bestLevelEver: number;
  nextLevel: number | null;
  // The user's last persisted level — anchor for the jump penalty. Equals
  // currentLevel after a successful level-up has been persisted.
  confirmedLevel: number;
  // Penalty multiplier applied to the next level's tonnage and per-exercise
  // requirements. ≥ 1; equals 1 when the next level is just confirmed+1.
  nextLevelPenaltyMultiplier: number;
  // Effective tonnage target the user actually has to hit to qualify for the
  // next level (penalty applied, rounded the same way the server does it
  // internally). Null at max level. Surfaced so all UIs agree with the
  // backend's pass check at the rounding boundary.
  nextLevelTonnage7dKgRequired: number | null;
  bodyWeightKg: number;
  bodyWeightIsFallback: boolean;
  // Constants exposed to the client so the level-detail dialog can compute
  // per-exercise required kg for arbitrary levels without re-implementing
  // the formula in three places.
  barWeightKg: number;
  levelFactorAnchor: number;
  /**
   * Sport rank based on the user's actual max-weight-to-MC ratio averaged
   * across main exercises with recorded data. Falls back to rankForLevel
   * when no exercises have logged sets.
   */
  currentRank: SportRank;
  /** Official competition weight class for the user's bodyweight. */
  weightClassKg: number;
  /** Athlete sex used to select the MS standards table. */
  sex: "male" | "female";
  /**
   * True when confirmed_level > computed currentLevel. Indicates the norms
   * were recalibrated and the user's effective targets increased; UI should
   * show a "check your maxes" hint.
   */
  confirmedLevelMigrationNeeded: boolean;
  levels: LevelDef[];
  stats: LevelStats;
};

export async function computeCurrentLevel(userId: string): Promise<CurrentLevelInfo> {
  const profile = await getProfile(userId);
  const bodyWeightKg = profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
  const bodyWeightIsFallback = profile.bodyWeightKg == null;
  const sex = profile.sex ?? FALLBACK_SEX;
  const levels = buildLevels(bodyWeightKg, sex);

  // Fetch exercises that are "main" for this specific user.
  // An exercise is main for a user when:
  //   (a) the user has a pref row with isMain = true, OR
  //   (b) the exercise has global isMain = true AND the user has no pref row at all
  //       (i.e. they haven't explicitly opted in/out yet).
  const mainRows = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      bodyweightMultiplier: exercisesTable.bodyweightMultiplier,
      baseEquipment: exercisesTable.equipment,
      prefEquipment: userExercisePrefsTable.equipment,
    })
    .from(exercisesTable)
    .leftJoin(
      userExercisePrefsTable,
      and(
        eq(userExercisePrefsTable.exerciseId, exercisesTable.id),
        eq(userExercisePrefsTable.userId, userId),
      ),
    )
    .where(
      and(
        or(
          eq(exercisesTable.isCustom, false),
          eq(exercisesTable.userId, userId),
        ),
        or(
          // User explicitly marked as main
          eq(userExercisePrefsTable.isMain, true),
          // Global default: exercise is main and user has no pref yet
          and(
            eq(exercisesTable.isMain, true),
            isNull(userExercisePrefsTable.exerciseId),
          ),
        ),
      ),
    )
    .orderBy(asc(exercisesTable.muscleGroup), asc(exercisesTable.name));

  // Pre-compute MC-based effective multipliers for each main exercise.
  // effectiveMul[id] = mcKg / bodyWeightKg  (→ required = bw × level/80 × mul = mcKg × level/80)
  // For time-based exercises (Планка), mcKg is null and the exercise is auto-passed.
  const mcResultByExercise = new Map<number, { kg: number | null; source: McSource; effectiveMul: number }>();
  for (const r of mainRows) {
    const fallbackMul = Number(r.bodyweightMultiplier);
    const result = getMcKgForExercise(r.name, bodyWeightKg, sex, fallbackMul, r.muscleGroup);
    const effectiveMul = result.kg != null ? result.kg / bodyWeightKg : 0;
    mcResultByExercise.set(r.id, { kg: result.kg, source: result.source, effectiveMul });
  }

  const mainIds = mainRows.map((r) => r.id);
  const maxByExercise = new Map<number, number>();

  if (mainIds.length > 0) {
    const sets = await db
      .select({
        exerciseId: workoutSetsTable.exerciseId,
        weightKg: workoutSetsTable.weightKg,
      })
      .from(workoutSetsTable)
      .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
      .where(
        and(
          isNotNull(workoutsTable.finishedAt),
          eq(workoutsTable.userId, userId),
          inArray(workoutSetsTable.exerciseId, mainIds),
        ),
      );

    for (const s of sets) {
      const w = Number(s.weightKg);
      const prev = maxByExercise.get(s.exerciseId) ?? 0;
      if (w > prev) maxByExercise.set(s.exerciseId, w);
    }
  }

  const allSets = await db
    .select({
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      createdAt: workoutSetsTable.createdAt,
    })
    .from(workoutSetsTable)
    .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
    .where(and(isNotNull(workoutsTable.finishedAt), eq(workoutsTable.userId, userId)))
    .orderBy(asc(workoutSetsTable.createdAt));

  const events = allSets.map((s) => ({
    ts: s.createdAt.getTime(),
    volume: Number(s.weightKg) * s.reps,
  }));

  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  let currentTonnage7dKg = 0;
  let oldestSetInWindowTs: number | null = null;
  for (const e of events) {
    if (e.ts >= windowStart && e.ts <= now) {
      currentTonnage7dKg += e.volume;
      if (oldestSetInWindowTs === null || e.ts < oldestSetInWindowTs) {
        oldestSetInWindowTs = e.ts;
      }
    }
  }

  const maxTonnage7dKg = computeMaxRollingTonnage(events, windowMs);

  // Pass-check helpers. `penaltyMul` allows a candidate level beyond
  // `confirmed + 1` to charge an extra fee on both tonnage and per-exercise
  // weight requirements.
  function levelPasses(
    lvl: LevelDef,
    tonnage: number,
    penaltyMul: number,
  ): boolean {
    if (lvl.level === 0) return true;
    let passedExercises = 0;
    for (const r of mainRows) {
      const mc = mcResultByExercise.get(r.id)!;
      // Time-based exercises (e.g. Планка) have no kg requirement — auto-pass.
      if (mc.kg == null) {
        passedExercises += 1;
        continue;
      }
      const req = requiredKgForExercise(lvl.level, bodyWeightKg, mc.effectiveMul, penaltyMul);
      // Barbell exercises can't physically be loaded below the empty bar, so a
      // sub-bar requirement is auto-passed (counts toward the threshold).
      if (req > 0 && (r.prefEquipment ?? r.baseEquipment) === "barbell" && req < BAR_WEIGHT_KG) {
        passedExercises += 1;
        continue;
      }
      const cur = maxByExercise.get(r.id) ?? 0;
      if (cur >= req && req > 0) passedExercises += 1;
    }
    if (passedExercises < lvl.mainExercisesRequired) return false;
    const tonnageRequired = tonnage7dRequired(
      lvl.level,
      bodyWeightKg,
      penaltyMul,
    );
    return tonnage >= tonnageRequired;
  }

  // bestLevelEver — historical max, computed without the jump penalty.
  let bestLevelEver = 0;
  for (const lvl of levels) {
    if (levelPasses(lvl, maxTonnage7dKg, 1)) {
      bestLevelEver = lvl.level;
    } else {
      break;
    }
  }

  // Bootstrap the confirmed-level sentinel for new installs / pre-existing
  // users. Without this, a user with significant history would suddenly drop
  // to level 0 because the penalty against confirmed=0 makes level 1 unreachable.
  let confirmedLevel = await getConfirmedLevel(userId);
  if (confirmedLevel === null) {
    confirmedLevel = bestLevelEver;
    await setConfirmedLevel(userId, confirmedLevel);
  }

  // Lower the floor when historical data no longer supports it — e.g. the
  // user explicitly deleted workouts or sets. bestLevelEver is computed over
  // ALL historical data (max rolling 7-day window, no jump penalty), so it
  // correctly reflects what the data can actually justify. If confirmedLevel
  // exceeds that, the data that earned it is gone and the floor should drop.
  if (confirmedLevel > bestLevelEver) {
    confirmedLevel = bestLevelEver;
    await setConfirmedLevel(userId, confirmedLevel);
  }

  // currentLevel — bounded above by confirmed + ladder length, with each step
  // beyond confirmed + 1 charged the jump penalty.
  let currentLevel = 0;
  for (const lvl of levels) {
    const penaltyMul = jumpPenaltyMultiplier(lvl.level, confirmedLevel);
    if (levelPasses(lvl, currentTonnage7dKg, penaltyMul)) {
      currentLevel = lvl.level;
    } else {
      break;
    }
  }

  // Persist the new floor when the user has earned a higher level.
  if (currentLevel > confirmedLevel) {
    await setConfirmedLevel(userId, currentLevel);
    confirmedLevel = currentLevel;
  }

  // Guard: if confirmed > computed (e.g. after norm recalibration), use the
  // confirmed level as the floor. All downstream calculations — nextLevel,
  // tonnage requirements, and per-exercise targets — must be anchored to this
  // effective level so the response is internally consistent.
  const confirmedLevelMigrationNeeded = confirmedLevel > currentLevel;
  const effectiveCurrentLevel = confirmedLevelMigrationNeeded
    ? confirmedLevel
    : currentLevel;

  const nextLevelIdx = effectiveCurrentLevel >= MAX_LEVEL ? null : effectiveCurrentLevel + 1;
  const nextLvl = nextLevelIdx !== null ? levels[nextLevelIdx]! : null;
  const nextLevelPenaltyMultiplier =
    nextLvl !== null ? jumpPenaltyMultiplier(nextLvl.level, confirmedLevel) : 1;
  const nextLevelTonnage7dKgRequired = nextLvl
    ? tonnage7dRequired(nextLvl.level, bodyWeightKg, nextLevelPenaltyMultiplier)
    : null;

  const mainExercises: MainExerciseStat[] = mainRows.map((r) => {
    const mc = mcResultByExercise.get(r.id)!;
    // Time-based exercises (e.g. Планка) have no kg requirement at all.
    const isTimeBased = mc.kg == null;
    const required = !isTimeBased && nextLvl
      ? requiredKgForExercise(
          nextLvl.level,
          bodyWeightKg,
          mc.effectiveMul,
          nextLevelPenaltyMultiplier,
        )
      : null;
    let autoPassedReason: AutoPassedReason | null = null;
    if (isTimeBased) {
      autoPassedReason = "time_based_exercise";
    } else if (
      required != null &&
      required > 0 &&
      (r.prefEquipment ?? r.baseEquipment) === "barbell" &&
      required < BAR_WEIGHT_KG
    ) {
      autoPassedReason = "below_bar_weight";
    }
    const equipment = (r.prefEquipment ?? r.baseEquipment) as Equipment;
    return {
      exerciseId: r.id,
      name: r.name,
      muscleGroup: r.muscleGroup,
      equipment,
      maxWeightKg: round(maxByExercise.get(r.id) ?? 0),
      multiplier: round(mc.effectiveMul),
      requiredKgForNextLevel: required,
      requiredKgPenaltyMultiplier: round(nextLevelPenaltyMultiplier),
      autoPassedReason,
      mcKg: mc.kg != null ? round(mc.kg) : null,
      mcSource: mc.source,
    };
  });

  // Compute currentRank from the user's actual big-3 performance (squat,
  // bench, deadlift) as a fraction of their MC target. Only classic lifts are
  // used so that accessory PRs don't inflate the displayed rank.
  // Falls back to level-based rank when no classic lifts have logged sets.
  const CLASSIC_NAMES = new Set([
    "Приседания со штангой",
    "Жим штанги лёжа",
    "Становая тяга",
  ]);
  const classicWithData = mainRows.filter((r) => {
    const mc = mcResultByExercise.get(r.id)!;
    return (
      CLASSIC_NAMES.has(r.name) &&
      mc.kg != null &&
      (maxByExercise.get(r.id) ?? 0) > 0
    );
  });
  let currentRank: SportRank;
  if (classicWithData.length > 0) {
    const totalRatio = classicWithData.reduce((sum, r) => {
      const mc = mcResultByExercise.get(r.id)!;
      const maxW = maxByExercise.get(r.id) ?? 0;
      return sum + maxW / mc.kg!;
    }, 0);
    const avgRatio = totalRatio / classicWithData.length;
    currentRank = rankForMcPercent(round(avgRatio, 4));
  } else {
    // No big-3 data → fall back to level-based rank
    currentRank = rankForLevel(currentLevel);
  }

  return {
    currentLevel: effectiveCurrentLevel,
    bestLevelEver,
    nextLevel: effectiveCurrentLevel >= MAX_LEVEL ? null : effectiveCurrentLevel + 1,
    confirmedLevel,
    nextLevelPenaltyMultiplier: round(nextLevelPenaltyMultiplier),
    nextLevelTonnage7dKgRequired,
    bodyWeightKg,
    bodyWeightIsFallback,
    barWeightKg: BAR_WEIGHT_KG,
    levelFactorAnchor: LEVEL_FACTOR_ANCHOR,
    currentRank,
    weightClassKg: getWeightClassKg(bodyWeightKg, sex),
    sex,
    confirmedLevelMigrationNeeded,
    levels,
    stats: {
      currentTonnage7dKg: round(currentTonnage7dKg),
      maxTonnage7dKg: round(maxTonnage7dKg),
      oldestSetInWindowAt:
        oldestSetInWindowTs !== null
          ? new Date(oldestSetInWindowTs).toISOString()
          : null,
      mainExercises,
    },
  };
}

function computeMaxRollingTonnage(
  events: Array<{ ts: number; volume: number }>,
  windowMs: number,
): number {
  if (events.length === 0) return 0;
  let best = 0;
  let sum = 0;
  let left = 0;
  for (let right = 0; right < events.length; right++) {
    sum += events[right].volume;
    while (left <= right && events[right].ts - events[left].ts > windowMs) {
      sum -= events[left].volume;
      left++;
    }
    if (sum > best) best = sum;
  }
  return best;
}
