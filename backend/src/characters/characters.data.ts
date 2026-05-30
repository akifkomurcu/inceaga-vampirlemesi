export type Team = 'good' | 'evil' | 'neutral';

export interface CharacterDefinition {
  id: string;
  name: string;
  description: string;
  team: Team;
  hasNightAction: boolean;
  nightActionDescription?: string;
  icon: string; // emoji
  maxCount?: number; // max per game, undefined = unlimited
}

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'villager',
    name: 'Köylü',
    description: 'Sıradan bir köylü. Vampirleri gündüz oylama ile tespit etmeye çalış.',
    team: 'good',
    hasNightAction: false,
    icon: '🧑‍🌾',
  },
  {
    id: 'vampire',
    name: 'Vampir',
    description: 'Her gece bir köylüyü öldürürsün. Diğer vampirleri bilirsin.',
    team: 'evil',
    hasNightAction: true,
    nightActionDescription: 'Öldürmek istediğin bir oyuncu seç.',
    icon: '🧛',
  },
  {
    id: 'detective',
    name: 'Dedektif',
    description: 'Her gece bir oyuncunun vampir olup olmadığını öğrenirsin.',
    team: 'good',
    hasNightAction: true,
    nightActionDescription: 'Sorgulamak istediğin bir oyuncu seç.',
    icon: '🕵️',
    maxCount: 1,
  },
  {
    id: 'doctor',
    name: 'Doktor',
    description: 'Her gece bir oyuncuyu (veya kendini) vampir saldırısından korursun.',
    team: 'good',
    hasNightAction: true,
    nightActionDescription: 'Bu gece korumak istediğin oyuncuyu seç.',
    icon: '👨‍⚕️',
    maxCount: 1,
  },
  {
    id: 'witch',
    name: 'Cadı',
    description: 'Bir kez öldürme, bir kez koruma iksirin var. İkisini de bu gece kullanabilirsin.',
    team: 'good',
    hasNightAction: true,
    nightActionDescription: 'İksirlerini kullan veya geç.',
    icon: '🧙‍♀️',
    maxCount: 1,
  },
  {
    id: 'hunter',
    name: 'Avcı',
    description: 'Elimine edildiğinde hemen başka bir oyuncuyu vurursun.',
    team: 'good',
    hasNightAction: false,
    icon: '🏹',
    maxCount: 1,
  },
  {
    id: 'jester',
    name: 'Joker',
    description: 'Ne iyisin ne kötü. Amacın oylama ile linç edilmek. Bunu başarırsan kazanırsın.',
    team: 'neutral',
    hasNightAction: false,
    icon: '🃏',
    maxCount: 1,
  },
  {
    id: 'familiar',
    name: 'Hizmetkar',
    description: 'Vampirlerin hizmetkarısın ve vampirleri bilirsin ama sen vampir değilsin. Vampirlerin kazanması için çalış.',
    team: 'evil',
    hasNightAction: false,
    icon: '🐺',
    maxCount: 2,
  },
];

export const getCharacterById = (id: string): CharacterDefinition | undefined =>
  CHARACTERS.find((c) => c.id === id);
