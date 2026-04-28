export const CURRENT_VERSION = "0.2.0";

export const CHANGELOG_STORAGE_KEY = "gym-tracker:seen-changelog-version";

export interface ChangelogEntry {
  icon: string;
  title: string;
  description: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    icon: "🏗️",
    title: "Своя программа — свои правила",
    description:
      "Теперь можно создавать собственные программы тренировок. Больше не нужно терпеть чужие «приседай 5×5» — составляй под себя.",
  },
  {
    icon: "✏️",
    title: "Облажался при создании? Не беда",
    description:
      "Свои программы теперь можно редактировать: менять название, описание и весь список упражнений. Удалять и пересоздавать с нуля больше не придётся.",
  },
  {
    icon: "☝️",
    title: "Тягай упражнения, не только железо",
    description:
      "В конструкторе программ работает перетаскивание упражнений — просто зажми иконку и тащи куда надо. Никакой магии, просто удобно.",
  },
];
