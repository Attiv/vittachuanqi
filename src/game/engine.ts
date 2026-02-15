import { INITIAL_ITEMS, MAPS, PROFESSION_SKILLS, SKILL_TEMPLATES, SHOP_ITEMS } from "./content";
import type {
  CombatResult,
  DerivedStats,
  Equipment,
  EquipmentSlot,
  ItemName,
  MapArea,
  Player,
  Profession,
  SkillState,
  SkillTemplate,
} from "./types";

const SKILL_MAP = new Map<string, SkillTemplate>(SKILL_TEMPLATES.map((item) => [item.id, item]));

const SLOT_ORDER: EquipmentSlot[] = [
  "helmet",
  "necklace",
  "leftBracelet",
  "rightBracelet",
  "leftRing",
  "rightRing",
  "belt",
  "boots",
  "weapon",
  "armor",
];

const SLOT_NAMES: Record<EquipmentSlot, string> = {
  helmet: "头盔",
  necklace: "项链",
  leftBracelet: "左手镯",
  rightBracelet: "右手镯",
  leftRing: "左戒指",
  rightRing: "右戒指",
  belt: "腰带",
  boots: "靴子",
  weapon: "武器",
  armor: "衣服",
};

const DEFAULT_POTION_CONFIG = {
  autoHpEnabled: true,
  autoHpThreshold: 35,
  autoMpEnabled: true,
  autoMpThreshold: 25,
};

type EquipmentStatKey =
  | "attack"
  | "magic"
  | "tao"
  | "attackSpeed"
  | "defense"
  | "hp"
  | "mp"
  | "luck";

interface FighterState {
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  attack: number;
  magic: number;
  tao: number;
  attackSpeed: number;
  defense: number;
  statuses: Record<string, number>;
  values: Record<string, number>;
}

interface SetBonusEffect {
  attack?: number;
  magic?: number;
  tao?: number;
  attackSpeed?: number;
  defense?: number;
  hp?: number;
  mp?: number;
  luck?: number;
  critRate?: number;
  lifesteal?: number;
  paralyzeBonus?: number;
}

interface SetBonusTier {
  pieces: number;
  description: string;
  effects: SetBonusEffect;
}

interface SetTemplate {
  id: string;
  name: string;
  color: NonNullable<Equipment["setColor"]>;
  quality?: "entry" | "advanced";
  professions?: Profession[];
  slots: EquipmentSlot[];
  pieceNames: Partial<Record<EquipmentSlot, string>>;
  tiers: SetBonusTier[];
}

interface SetStatusRow {
  id: string;
  name: string;
  color: NonNullable<Equipment["setColor"]>;
  count: number;
  maxCount: number;
  activeTierCount: number;
  tiers: Array<{
    pieces: number;
    description: string;
    active: boolean;
  }>;
}

const LEGEND_SETS: SetTemplate[] = [
  {
    id: "set_shengzhan",
    name: "圣战",
    color: "crimson",
    professions: ["战士"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "圣战战盔",
      necklace: "圣战项链",
      leftBracelet: "圣战左镯",
      rightBracelet: "圣战右镯",
      leftRing: "圣战左戒",
      rightRing: "圣战右戒",
      weapon: "圣战裁决",
      armor: "圣战战甲",
    },
    tiers: [
      { pieces: 2, description: "攻击+14、防御+8、幸运+1", effects: { attack: 14, defense: 8, luck: 1 } },
      { pieces: 4, description: "攻速+0.05、暴击+8%", effects: { attackSpeed: 0.05, critRate: 0.08 } },
      { pieces: 6, description: "攻击+28、吸血+6%", effects: { attack: 28, lifesteal: 0.06 } },
      { pieces: 8, description: "暴击+8%、麻痹几率+2%", effects: { critRate: 0.08, paralyzeBonus: 0.02 } },
    ],
  },
  {
    id: "set_fashen",
    name: "法神",
    color: "azure",
    professions: ["法师"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "法神冠",
      necklace: "法神链",
      leftBracelet: "法神左腕",
      rightBracelet: "法神右腕",
      leftRing: "法神左戒",
      rightRing: "法神右戒",
      weapon: "法神权杖",
      armor: "法神法袍",
    },
    tiers: [
      { pieces: 2, description: "魔法+16、魔法上限+90、幸运+1", effects: { magic: 16, mp: 90, luck: 1 } },
      { pieces: 4, description: "攻速+0.04、暴击+10%", effects: { attackSpeed: 0.04, critRate: 0.1 } },
      { pieces: 6, description: "魔法+30、吸血+4%", effects: { magic: 30, lifesteal: 0.04 } },
      { pieces: 8, description: "暴击+10%、攻速+0.05", effects: { critRate: 0.1, attackSpeed: 0.05 } },
    ],
  },
  {
    id: "set_tianzun",
    name: "天尊",
    color: "jade",
    professions: ["道士"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "天尊冠",
      necklace: "天尊链",
      leftBracelet: "天尊左镯",
      rightBracelet: "天尊右镯",
      leftRing: "天尊左戒",
      rightRing: "天尊右戒",
      weapon: "天尊宝刃",
      armor: "天尊道袍",
    },
    tiers: [
      { pieces: 2, description: "道术+16、生命+90、幸运+1", effects: { tao: 16, hp: 90, luck: 1 } },
      { pieces: 4, description: "攻速+0.04、吸血+5%", effects: { attackSpeed: 0.04, lifesteal: 0.05 } },
      { pieces: 6, description: "道术+28、暴击+8%", effects: { tao: 28, critRate: 0.08 } },
      { pieces: 8, description: "吸血+5%、攻速+0.05", effects: { lifesteal: 0.05, attackSpeed: 0.05 } },
    ],
  },
  {
    id: "set_leiting",
    name: "雷霆",
    color: "amber",
    slots: ["necklace", "leftRing", "rightRing", "belt", "boots", "weapon"],
    pieceNames: {
      necklace: "雷霆链",
      leftRing: "雷霆左戒",
      rightRing: "雷霆右戒",
      belt: "雷霆腰带",
      boots: "雷霆战靴",
      weapon: "雷霆之刃",
    },
    tiers: [
      { pieces: 2, description: "攻速+0.03、幸运+1", effects: { attackSpeed: 0.03, luck: 1 } },
      { pieces: 4, description: "暴击+6%、吸血+3%", effects: { critRate: 0.06, lifesteal: 0.03 } },
      { pieces: 6, description: "攻/魔/道各+12、攻速+0.05", effects: { attack: 12, magic: 12, tao: 12, attackSpeed: 0.05 } },
    ],
  },
  {
    id: "set_zhanshen",
    name: "战神",
    color: "crimson",
    professions: ["战士"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "战神战盔",
      necklace: "战神项链",
      leftBracelet: "战神左镯",
      rightBracelet: "战神右镯",
      leftRing: "战神左戒",
      rightRing: "战神右戒",
      weapon: "战神屠刀",
      armor: "战神宝甲",
    },
    tiers: [
      { pieces: 2, description: "攻击+18、生命+80", effects: { attack: 18, hp: 80 } },
      { pieces: 4, description: "防御+14、暴击+6%", effects: { defense: 14, critRate: 0.06 } },
      { pieces: 6, description: "攻击+32、攻速+0.04、吸血+5%", effects: { attack: 32, attackSpeed: 0.04, lifesteal: 0.05 } },
      { pieces: 8, description: "暴击+8%、麻痹几率+2%、幸运+2", effects: { critRate: 0.08, paralyzeBonus: 0.02, luck: 2 } },
    ],
  },
  {
    id: "set_kuanglei",
    name: "狂雷",
    color: "crimson",
    professions: ["战士"],
    slots: ["helmet", "weapon", "armor", "leftRing", "rightRing", "belt", "boots"],
    pieceNames: {
      helmet: "狂雷战盔",
      weapon: "狂雷战刃",
      armor: "狂雷重甲",
      leftRing: "狂雷左戒",
      rightRing: "狂雷右戒",
      belt: "狂雷腰带",
      boots: "狂雷战靴",
    },
    tiers: [
      { pieces: 2, description: "攻击+14、攻速+0.03", effects: { attack: 14, attackSpeed: 0.03 } },
      { pieces: 4, description: "防御+12、吸血+4%", effects: { defense: 12, lifesteal: 0.04 } },
      { pieces: 6, description: "攻击+28、暴击+8%、幸运+1", effects: { attack: 28, critRate: 0.08, luck: 1 } },
    ],
  },
  {
    id: "set_lieyan",
    name: "烈焰",
    color: "azure",
    professions: ["法师"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "烈焰法冠",
      necklace: "烈焰法链",
      leftBracelet: "烈焰左腕",
      rightBracelet: "烈焰右腕",
      leftRing: "烈焰左戒",
      rightRing: "烈焰右戒",
      weapon: "烈焰法杖",
      armor: "烈焰法袍",
    },
    tiers: [
      { pieces: 2, description: "魔法+18、魔法上限+120、幸运+1", effects: { magic: 18, mp: 120, luck: 1 } },
      { pieces: 4, description: "攻速+0.05、暴击+8%", effects: { attackSpeed: 0.05, critRate: 0.08 } },
      { pieces: 6, description: "魔法+34、吸血+4%", effects: { magic: 34, lifesteal: 0.04 } },
      { pieces: 8, description: "暴击+10%、攻速+0.05", effects: { critRate: 0.1, attackSpeed: 0.05 } },
    ],
  },
  {
    id: "set_hanshuang",
    name: "寒霜",
    color: "azure",
    professions: ["法师"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "armor"],
    pieceNames: {
      helmet: "寒霜法冠",
      necklace: "寒霜吊坠",
      leftBracelet: "寒霜左腕",
      rightBracelet: "寒霜右腕",
      leftRing: "寒霜左戒",
      rightRing: "寒霜右戒",
      armor: "寒霜长袍",
    },
    tiers: [
      { pieces: 2, description: "魔法+12、防御+8", effects: { magic: 12, defense: 8 } },
      { pieces: 4, description: "魔法上限+160、暴击+7%", effects: { mp: 160, critRate: 0.07 } },
      { pieces: 6, description: "魔法+26、攻速+0.04、吸血+3%", effects: { magic: 26, attackSpeed: 0.04, lifesteal: 0.03 } },
    ],
  },
  {
    id: "set_wuji",
    name: "无极",
    color: "jade",
    professions: ["道士"],
    slots: ["helmet", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "weapon", "armor"],
    pieceNames: {
      helmet: "无极道冠",
      necklace: "无极道链",
      leftBracelet: "无极左镯",
      rightBracelet: "无极右镯",
      leftRing: "无极左戒",
      rightRing: "无极右戒",
      weapon: "无极神刃",
      armor: "无极道袍",
    },
    tiers: [
      { pieces: 2, description: "道术+18、生命+100、幸运+1", effects: { tao: 18, hp: 100, luck: 1 } },
      { pieces: 4, description: "攻速+0.04、吸血+5%", effects: { attackSpeed: 0.04, lifesteal: 0.05 } },
      { pieces: 6, description: "道术+32、暴击+8%", effects: { tao: 32, critRate: 0.08 } },
      { pieces: 8, description: "吸血+6%、麻痹几率+1.5%", effects: { lifesteal: 0.06, paralyzeBonus: 0.015 } },
    ],
  },
  {
    id: "set_xuanming",
    name: "玄冥",
    color: "jade",
    professions: ["道士"],
    slots: ["weapon", "helmet", "necklace", "leftRing", "rightRing", "belt", "boots"],
    pieceNames: {
      weapon: "玄冥魂刃",
      helmet: "玄冥冠",
      necklace: "玄冥项链",
      leftRing: "玄冥左戒",
      rightRing: "玄冥右戒",
      belt: "玄冥腰带",
      boots: "玄冥战靴",
    },
    tiers: [
      { pieces: 2, description: "道术+14、魔法上限+90", effects: { tao: 14, mp: 90 } },
      { pieces: 4, description: "防御+12、吸血+4%", effects: { defense: 12, lifesteal: 0.04 } },
      { pieces: 6, description: "道术+24、攻速+0.05、暴击+6%", effects: { tao: 24, attackSpeed: 0.05, critRate: 0.06 } },
    ],
  },
  {
    id: "set_guangmang",
    name: "光芒",
    color: "amber",
    slots: ["helmet", "armor", "belt", "boots"],
    pieceNames: {
      helmet: "光芒头盔",
      armor: "光芒战衣",
      belt: "光芒腰带",
      boots: "光芒战靴",
    },
    tiers: [
      { pieces: 2, description: "防御+12、生命+120", effects: { defense: 12, hp: 120 } },
      { pieces: 4, description: "攻/魔/道各+8、幸运+1", effects: { attack: 8, magic: 8, tao: 8, luck: 1 } },
    ],
  },
  {
    id: "set_xingwang",
    name: "星王",
    color: "amber",
    slots: ["weapon", "necklace", "leftBracelet", "rightBracelet", "leftRing", "rightRing", "belt", "boots"],
    pieceNames: {
      weapon: "星王圣刃",
      necklace: "星王吊坠",
      leftBracelet: "星王左镯",
      rightBracelet: "星王右镯",
      leftRing: "星王左戒",
      rightRing: "星王右戒",
      belt: "星王腰带",
      boots: "星王战靴",
    },
    tiers: [
      { pieces: 2, description: "攻速+0.03、幸运+1", effects: { attackSpeed: 0.03, luck: 1 } },
      { pieces: 4, description: "攻/魔/道各+10", effects: { attack: 10, magic: 10, tao: 10 } },
      { pieces: 6, description: "暴击+8%、吸血+4%", effects: { critRate: 0.08, lifesteal: 0.04 } },
      { pieces: 8, description: "攻速+0.06、暴击+6%、麻痹几率+1%", effects: { attackSpeed: 0.06, critRate: 0.06, paralyzeBonus: 0.01 } },
    ],
  },
  {
    id: "set_wangzhe",
    name: "王者",
    color: "amber",
    slots: ["helmet", "armor", "weapon", "necklace", "leftRing", "rightRing"],
    pieceNames: {
      helmet: "王者战盔",
      armor: "王者战甲",
      weapon: "王者神兵",
      necklace: "王者项链",
      leftRing: "王者左戒",
      rightRing: "王者右戒",
    },
    tiers: [
      { pieces: 2, description: "生命+100、魔法上限+100", effects: { hp: 100, mp: 100 } },
      { pieces: 4, description: "攻/魔/道各+14", effects: { attack: 14, magic: 14, tao: 14 } },
      { pieces: 6, description: "暴击+7%、吸血+5%、攻速+0.03", effects: { critRate: 0.07, lifesteal: 0.05, attackSpeed: 0.03 } },
    ],
  },
  {
    id: "set_zuma_zhanjiang",
    name: "祖玛战将",
    color: "crimson",
    quality: "entry",
    professions: ["战士"],
    slots: ["helmet", "weapon", "armor", "leftRing", "rightRing", "belt"],
    pieceNames: {
      helmet: "祖玛战盔",
      weapon: "祖玛战刃",
      armor: "祖玛战甲",
      leftRing: "祖玛左戒",
      rightRing: "祖玛右戒",
      belt: "祖玛战带",
    },
    tiers: [
      { pieces: 2, description: "攻击+8、生命+50", effects: { attack: 8, hp: 50 } },
      { pieces: 4, description: "防御+8、攻速+0.02", effects: { defense: 8, attackSpeed: 0.02 } },
      { pieces: 6, description: "攻击+14、暴击+4%、吸血+2%", effects: { attack: 14, critRate: 0.04, lifesteal: 0.02 } },
    ],
  },
  {
    id: "set_zuma_mifa",
    name: "祖玛秘法",
    color: "azure",
    quality: "entry",
    professions: ["法师"],
    slots: ["helmet", "weapon", "armor", "necklace", "leftRing", "rightRing"],
    pieceNames: {
      helmet: "祖玛法冠",
      weapon: "祖玛法杖",
      armor: "祖玛法袍",
      necklace: "祖玛法链",
      leftRing: "祖玛法左戒",
      rightRing: "祖玛法右戒",
    },
    tiers: [
      { pieces: 2, description: "魔法+8、魔法上限+70", effects: { magic: 8, mp: 70 } },
      { pieces: 4, description: "攻速+0.02、幸运+1", effects: { attackSpeed: 0.02, luck: 1 } },
      { pieces: 6, description: "魔法+14、暴击+5%、吸血+2%", effects: { magic: 14, critRate: 0.05, lifesteal: 0.02 } },
    ],
  },
  {
    id: "set_zuma_daowen",
    name: "祖玛道纹",
    color: "jade",
    quality: "entry",
    professions: ["道士"],
    slots: ["helmet", "weapon", "armor", "necklace", "leftBracelet", "rightBracelet"],
    pieceNames: {
      helmet: "祖玛道冠",
      weapon: "祖玛道刃",
      armor: "祖玛道袍",
      necklace: "祖玛道链",
      leftBracelet: "祖玛道左镯",
      rightBracelet: "祖玛道右镯",
    },
    tiers: [
      { pieces: 2, description: "道术+8、生命+60", effects: { tao: 8, hp: 60 } },
      { pieces: 4, description: "攻速+0.02、吸血+2%", effects: { attackSpeed: 0.02, lifesteal: 0.02 } },
      { pieces: 6, description: "道术+14、暴击+4%、幸运+1", effects: { tao: 14, critRate: 0.04, luck: 1 } },
    ],
  },
  {
    id: "set_zuma_shoubei",
    name: "祖玛守备",
    color: "amber",
    quality: "entry",
    slots: ["necklace", "leftBracelet", "rightBracelet", "belt", "boots"],
    pieceNames: {
      necklace: "祖玛护符",
      leftBracelet: "祖玛护腕左",
      rightBracelet: "祖玛护腕右",
      belt: "祖玛腰甲",
      boots: "祖玛护靴",
    },
    tiers: [
      { pieces: 2, description: "防御+7、生命+70", effects: { defense: 7, hp: 70 } },
      { pieces: 4, description: "攻/魔/道各+4、幸运+1", effects: { attack: 4, magic: 4, tao: 4, luck: 1 } },
      { pieces: 5, description: "攻速+0.03、暴击+3%", effects: { attackSpeed: 0.03, critRate: 0.03 } },
    ],
  },
  {
    id: "set_zuma_moyin",
    name: "祖玛魔印",
    color: "amber",
    quality: "entry",
    slots: ["helmet", "necklace", "leftRing", "rightRing", "belt"],
    pieceNames: {
      helmet: "祖玛印冠",
      necklace: "祖玛印链",
      leftRing: "祖玛印左戒",
      rightRing: "祖玛印右戒",
      belt: "祖玛印腰带",
    },
    tiers: [
      { pieces: 2, description: "幸运+1、攻速+0.02", effects: { luck: 1, attackSpeed: 0.02 } },
      { pieces: 4, description: "攻/魔/道各+6、暴击+3%", effects: { attack: 6, magic: 6, tao: 6, critRate: 0.03 } },
      { pieces: 5, description: "吸血+3%、麻痹几率+0.8%", effects: { lifesteal: 0.03, paralyzeBonus: 0.008 } },
    ],
  },
];

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBaseByProfession(profession: Profession): {
  attack: number;
  magic: number;
  tao: number;
  defense: number;
  hp: number;
  mp: number;
  attackSpeed: number;
} {
  if (profession === "战士") {
    return { attack: 31, magic: 7, tao: 8, defense: 11, hp: 280, mp: 95, attackSpeed: 1.02 };
  }
  if (profession === "法师") {
    return { attack: 12, magic: 32, tao: 10, defense: 7, hp: 188, mp: 255, attackSpeed: 0.94 };
  }
  return { attack: 18, magic: 14, tao: 30, defense: 9, hp: 228, mp: 195, attackSpeed: 0.98 };
}

function createDefaultSkillState(skillId: string): SkillState {
  return {
    templateId: skillId,
    level: 1,
    training: 0,
    autoUse: true,
    cooldownLeft: 0,
  };
}

function normalizeSlot(slot: unknown): EquipmentSlot | null {
  if (typeof slot !== "string") {
    return null;
  }
  if (slot === "accessory") {
    return "necklace";
  }
  if (SLOT_ORDER.includes(slot as EquipmentSlot)) {
    return slot as EquipmentSlot;
  }
  return null;
}

function getProfessionTemplates(profession: Profession): SkillTemplate[] {
  return PROFESSION_SKILLS[profession]
    .map((id) => SKILL_MAP.get(id))
    .filter((item): item is SkillTemplate => Boolean(item))
    .sort((a, b) => a.unlockLevel - b.unlockLevel);
}

function ensureSkillStateIntegrity(player: Player): void {
  const allow = new Set(getProfessionTemplates(player.profession).map((item) => item.id));
  for (const key of Object.keys(player.skills)) {
    if (!allow.has(key)) {
      delete player.skills[key];
    }
  }
}

function resetSkillCooldown(player: Player): void {
  Object.values(player.skills).forEach((state) => {
    state.cooldownLeft = 0;
  });
}

function getPrimaryPowerBySkill(template: SkillTemplate, actor: FighterState): number {
  if (template.profession === "战士") {
    return actor.attack;
  }
  if (template.profession === "法师") {
    return actor.magic;
  }
  return actor.tao;
}

function collectLevelSkillHints(player: Player, newLevel: number): string[] {
  const hits = getProfessionTemplates(player.profession).filter((item) => item.unlockLevel === newLevel);
  return hits.map((item) => `你达到 Lv.${newLevel}，现在可以学习【${item.name}】（需要 ${item.bookName}）。`);
}

function ensureStarterSkillBook(player: Player): void {
  const starter = getProfessionTemplates(player.profession).find((item) => item.unlockLevel <= 1);
  if (!starter) {
    return;
  }
  player.skillBooks[starter.id] = Math.max(1, safeNumber(player.skillBooks[starter.id], 0));
}

function mergeSetEffects(base: SetBonusEffect, patch: SetBonusEffect): SetBonusEffect {
  return {
    attack: (base.attack ?? 0) + (patch.attack ?? 0),
    magic: (base.magic ?? 0) + (patch.magic ?? 0),
    tao: (base.tao ?? 0) + (patch.tao ?? 0),
    attackSpeed: round2((base.attackSpeed ?? 0) + (patch.attackSpeed ?? 0)),
    defense: (base.defense ?? 0) + (patch.defense ?? 0),
    hp: (base.hp ?? 0) + (patch.hp ?? 0),
    mp: (base.mp ?? 0) + (patch.mp ?? 0),
    luck: (base.luck ?? 0) + (patch.luck ?? 0),
    critRate: (base.critRate ?? 0) + (patch.critRate ?? 0),
    lifesteal: (base.lifesteal ?? 0) + (patch.lifesteal ?? 0),
    paralyzeBonus: (base.paralyzeBonus ?? 0) + (patch.paralyzeBonus ?? 0),
  };
}

function evaluateSetBonuses(player: Player): { effects: SetBonusEffect; statuses: SetStatusRow[] } {
  const counts: Record<string, number> = {};
  for (const slot of SLOT_ORDER) {
    const eq = player.equipments[slot];
    if (eq?.setId) {
      counts[eq.setId] = (counts[eq.setId] ?? 0) + 1;
    }
  }

  let effects: SetBonusEffect = {};
  const statuses: SetStatusRow[] = [];
  for (const set of LEGEND_SETS) {
    const count = counts[set.id] ?? 0;
    const allowedForProfession = !set.professions || set.professions.includes(player.profession);
    if (!allowedForProfession && count <= 0) {
      continue;
    }
    let activeTierCount = 0;
    const tiers = set.tiers.map((tier) => {
      const active = count >= tier.pieces;
      if (active) {
        activeTierCount += 1;
        effects = mergeSetEffects(effects, tier.effects);
      }
      return {
        pieces: tier.pieces,
        description: tier.description,
        active,
      };
    });
    statuses.push({
      id: set.id,
      name: set.name,
      color: set.color,
      count,
      maxCount: set.slots.length,
      activeTierCount,
      tiers,
    });
  }
  return { effects, statuses };
}

function getSetPieceName(set: SetTemplate, slot: EquipmentSlot): string {
  return set.pieceNames[slot] ?? `${set.name}${SLOT_NAMES[slot]}`;
}

function pickSetTemplate(
  profession: Profession,
  slot: EquipmentSlot,
  rarity: Equipment["rarity"],
  isBoss: boolean,
  mapTier: number,
): SetTemplate | null {
  const pool = LEGEND_SETS.filter(
    (set) => set.slots.includes(slot) && (!set.professions || set.professions.includes(profession)),
  );
  if (pool.length === 0) {
    return null;
  }

  const rarityBonus = rarity === "史诗" ? 0.14 : rarity === "稀有" ? 0.09 : rarity === "精良" ? 0.05 : 0;
  const chance = clamp((isBoss ? 0.3 : 0.14) + rarityBonus, 0.06, 0.56);
  if (Math.random() >= chance) {
    return null;
  }

  const weightOf = (set: SetTemplate): number => {
    let weight = set.professions ? 4 : 2;
    const isEntry = (set.quality ?? "advanced") === "entry";

    if (isEntry) {
      if (mapTier <= 2) {
        weight *= 3.1;
      } else if (mapTier === 3) {
        weight *= 2.2;
      } else {
        weight *= 0.8;
      }
    } else if (mapTier <= 2) {
      weight *= 0.55;
    } else if (mapTier >= 4) {
      weight *= 1.45;
    }

    if (rarity === "普通" && !isEntry) {
      weight *= 0.65;
    }
    if (rarity === "史诗" && isEntry) {
      weight *= 0.72;
    }
    return Math.max(0.1, weight);
  };

  const totalWeight = pool.reduce((sum, set) => sum + weightOf(set), 0);
  let ticket = Math.random() * totalWeight;
  for (const set of pool) {
    ticket -= weightOf(set);
    if (ticket <= 0) {
      return set;
    }
  }
  return pool[pool.length - 1];
}

export function getSetStatuses(player: Player): SetStatusRow[] {
  return evaluateSetBonuses(player).statuses;
}

export function expToNextLevel(level: number): number {
  return 90 + level * level * 25;
}

export function getSkillTemplate(skillId: string): SkillTemplate | undefined {
  return SKILL_MAP.get(skillId);
}

export function getProfessionSkillBook(profession: Profession): SkillTemplate[] {
  return getProfessionTemplates(profession);
}

export function getTrainingNeed(level: number): number {
  return 70 + level * 40;
}

export function getEquipmentStat(equipment: Equipment, key: EquipmentStatKey): number {
  const base = equipment[key];
  const elite = equipment.eliteBonus[key] ?? 0;

  if (key === "attackSpeed") {
    return round2(base + elite + equipment.strengthen * 0.005);
  }

  if (key === "attack" || key === "magic" || key === "tao" || key === "defense" || key === "hp" || key === "mp") {
    return Math.max(0, Math.floor(base + elite + base * 0.12 * equipment.strengthen));
  }
  return Math.max(0, Math.floor(base + elite));
}

function sumEquipStats(player: Player, key: EquipmentStatKey): number {
  return SLOT_ORDER.reduce((sum, slot) => {
    const item = player.equipments[slot];
    if (!item) {
      return sum;
    }
    return sum + getEquipmentStat(item, key);
  }, 0);
}

export function calcDerivedStats(player: Player): DerivedStats {
  const base = getBaseByProfession(player.profession);
  const level = Math.max(1, player.level);
  const setBundle = evaluateSetBonuses(player);
  const setEffect = setBundle.effects;

  const attackGrowth = (level - 1) * (player.profession === "战士" ? 5 : 2);
  const magicGrowth = (level - 1) * (player.profession === "法师" ? 5 : 1);
  const taoGrowth = (level - 1) * (player.profession === "道士" ? 5 : 1);
  const defenseGrowth = (level - 1) * (player.profession === "战士" ? 4 : 3);
  const hpGrowth = (level - 1) * (player.profession === "战士" ? 35 : 28);
  const mpGrowth = (level - 1) * (player.profession === "法师" ? 26 : 18);

  const attackSpeed = clamp(
    round2(base.attackSpeed + (level - 1) * 0.0015 + sumEquipStats(player, "attackSpeed") + (setEffect.attackSpeed ?? 0)),
    0.82,
    1.82,
  );

  return {
    attack: base.attack + attackGrowth + sumEquipStats(player, "attack") + (setEffect.attack ?? 0),
    magic: base.magic + magicGrowth + sumEquipStats(player, "magic") + (setEffect.magic ?? 0),
    tao: base.tao + taoGrowth + sumEquipStats(player, "tao") + (setEffect.tao ?? 0),
    attackSpeed,
    critRate: clamp(setEffect.critRate ?? 0, 0, 0.45),
    lifesteal: clamp(setEffect.lifesteal ?? 0, 0, 0.35),
    paralyzeChance: clamp(setEffect.paralyzeBonus ?? 0, 0, 0.2),
    defense: base.defense + defenseGrowth + sumEquipStats(player, "defense") + (setEffect.defense ?? 0),
    maxHp: base.hp + hpGrowth + sumEquipStats(player, "hp") + (setEffect.hp ?? 0),
    maxMp: base.mp + mpGrowth + sumEquipStats(player, "mp") + (setEffect.mp ?? 0),
    luck: player.baseLuck + sumEquipStats(player, "luck") + (setEffect.luck ?? 0),
  };
}

function keepResourceInRange(player: Player): void {
  const stats = calcDerivedStats(player);
  player.hp = clamp(player.hp, 0, stats.maxHp);
  player.mp = clamp(player.mp, 0, stats.maxMp);
}

function addSkillTraining(skill: SkillState, amount: number): string[] {
  const logs: string[] = [];
  skill.training += Math.max(0, amount);
  while (skill.training >= getTrainingNeed(skill.level)) {
    skill.training -= getTrainingNeed(skill.level);
    skill.level += 1;
    logs.push(`技能【${SKILL_MAP.get(skill.templateId)?.name ?? skill.templateId}】提升到 Lv.${skill.level}。`);
  }
  return logs;
}

function gainBattleTraining(player: Player): string[] {
  const logs: string[] = [];
  const list = Object.values(player.skills);
  if (list.length === 0) {
    return logs;
  }

  const count = Math.min(2, list.length);
  for (let i = 0; i < count; i += 1) {
    const target = list[randInt(0, list.length - 1)];
    const gain = randInt(2, 6);
    const name = SKILL_MAP.get(target.templateId)?.name ?? target.templateId;
    logs.push(`实战领悟：${name} 熟练度 +${gain}。`);
    logs.push(...addSkillTraining(target, gain));
  }
  return logs;
}

function formatAttackSpeed(value: number): string {
  return value > 0 ? `攻速+${value.toFixed(2)}` : "";
}

export function formatEquipment(item: Equipment): string {
  const eliteText = item.isElite ? "·极品" : "";
  const specialText = item.special === "paralyze" ? "·麻痹" : "";
  const setText = item.setName ? `·${item.setName}套` : "";

  const stats: string[] = [];
  const speed = formatAttackSpeed(getEquipmentStat(item, "attackSpeed"));
  if (speed) {
    stats.push(speed);
  }
  const attack = getEquipmentStat(item, "attack");
  const magic = getEquipmentStat(item, "magic");
  const tao = getEquipmentStat(item, "tao");
  const defense = getEquipmentStat(item, "defense");
  const hp = getEquipmentStat(item, "hp");
  const luck = getEquipmentStat(item, "luck");

  if (attack > 0) {
    stats.push(`攻击+${attack}`);
  }
  if (magic > 0) {
    stats.push(`魔法+${magic}`);
  }
  if (tao > 0) {
    stats.push(`道术+${tao}`);
  }
  if (defense > 0) {
    stats.push(`防御+${defense}`);
  }
  if (hp > 0) {
    stats.push(`生命+${hp}`);
  }
  if (luck > 0) {
    stats.push(`幸运+${luck}`);
  }

  return `${item.name}${setText}${eliteText}${specialText} [${item.rarity}] +${item.strengthen} (${stats.join(" ")})`;
}

export function createPlayer(name: string, profession: Profession): Player {
  const equipments = SLOT_ORDER.reduce<Record<EquipmentSlot, Equipment | null>>((acc, slot) => {
    acc[slot] = null;
    return acc;
  }, {} as Record<EquipmentSlot, Equipment | null>);

  const player: Player = {
    name: name.trim() || "无名侠客",
    profession,
    level: 1,
    exp: 0,
    gold: 1200,
    baseLuck: 1,
    hp: 0,
    mp: 0,
    inventory: { ...INITIAL_ITEMS },
    skillBooks: {},
    equipments,
    bag: [],
    skills: {},
    potionConfig: { ...DEFAULT_POTION_CONFIG },
  };

  ensureStarterSkillBook(player);
  const stats = calcDerivedStats(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;
  return player;
}

function isProfession(value: unknown): value is Profession {
  return value === "战士" || value === "法师" || value === "道士";
}

function hydrateEquipment(value: unknown): Equipment | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const obj = value as Partial<Equipment>;
  if (typeof obj.name !== "string" || typeof obj.rarity !== "string") {
    return null;
  }
  const normalized = normalizeSlot(obj.slot);
  if (!normalized) {
    return null;
  }

  const eliteBonusRaw = obj.eliteBonus ?? {};
  return {
    id: typeof obj.id === "string" ? obj.id : randomId("eq"),
    name: obj.name,
    slot: normalized,
    levelReq: Math.max(1, Math.floor(safeNumber(obj.levelReq, 1))),
    rarity: obj.rarity as Equipment["rarity"],
    setId: typeof obj.setId === "string" ? obj.setId : undefined,
    setName: typeof obj.setName === "string" ? obj.setName : undefined,
    setColor:
      obj.setColor === "crimson" || obj.setColor === "azure" || obj.setColor === "jade" || obj.setColor === "amber"
        ? obj.setColor
        : undefined,
    attack: safeNumber(obj.attack, 0),
    magic: safeNumber(obj.magic, 0),
    tao: safeNumber(obj.tao, 0),
    attackSpeed: round2(safeNumber(obj.attackSpeed, 0)),
    defense: safeNumber(obj.defense, 0),
    hp: safeNumber(obj.hp, 0),
    mp: safeNumber(obj.mp, 0),
    luck: safeNumber(obj.luck, 0),
    strengthen: Math.max(0, Math.floor(safeNumber(obj.strengthen, 0))),
    isElite: Boolean(obj.isElite),
    eliteBonus: {
      attack: safeNumber(eliteBonusRaw.attack, 0),
      magic: safeNumber(eliteBonusRaw.magic, 0),
      tao: safeNumber(eliteBonusRaw.tao, 0),
      attackSpeed: round2(safeNumber(eliteBonusRaw.attackSpeed, 0)),
      defense: safeNumber(eliteBonusRaw.defense, 0),
      hp: safeNumber(eliteBonusRaw.hp, 0),
      mp: safeNumber(eliteBonusRaw.mp, 0),
      luck: safeNumber(eliteBonusRaw.luck, 0),
    },
    special: obj.special === "paralyze" ? "paralyze" : undefined,
  };
}

export function restorePlayer(raw: unknown): Player | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Partial<Player>;
  if (typeof source.name !== "string" || !isProfession(source.profession)) {
    return null;
  }

  const player = createPlayer(source.name, source.profession);
  player.level = Math.max(1, Math.floor(safeNumber(source.level, 1)));
  player.exp = Math.max(0, Math.floor(safeNumber(source.exp, 0)));
  player.gold = Math.max(0, Math.floor(safeNumber(source.gold, 1200)));
  player.baseLuck = Math.max(0, Math.floor(safeNumber(source.baseLuck, 1)));

  if (source.inventory && typeof source.inventory === "object") {
    for (const key of Object.keys(player.inventory) as ItemName[]) {
      const rawCount = (source.inventory as Record<string, unknown>)[key];
      player.inventory[key] = Math.max(0, Math.floor(safeNumber(rawCount, player.inventory[key])));
    }
  }

  player.skillBooks = {};
  if (source.skillBooks && typeof source.skillBooks === "object") {
    for (const [skillId, value] of Object.entries(source.skillBooks as Record<string, unknown>)) {
      const template = SKILL_MAP.get(skillId);
      if (!template || template.profession !== player.profession) {
        continue;
      }
      player.skillBooks[skillId] = Math.max(0, Math.floor(safeNumber(value, 0)));
    }
  }

  if (source.equipments && typeof source.equipments === "object") {
    for (const slot of SLOT_ORDER) {
      const data = (source.equipments as Record<string, unknown>)[slot];
      player.equipments[slot] = hydrateEquipment(data);
    }
    const oldAccessory = (source.equipments as Record<string, unknown>).accessory;
    if (oldAccessory && !player.equipments.necklace) {
      player.equipments.necklace = hydrateEquipment({ ...(oldAccessory as object), slot: "necklace" });
    }
  }

  if (Array.isArray(source.bag)) {
    player.bag = source.bag
      .map((item) => hydrateEquipment(item))
      .filter((item): item is Equipment => Boolean(item));
  }

  player.skills = {};
  if (source.skills && typeof source.skills === "object") {
    for (const [skillId, rawState] of Object.entries(source.skills as Record<string, Partial<SkillState> | undefined>)) {
      const template = SKILL_MAP.get(skillId);
      if (!template || template.profession !== player.profession || !rawState) {
        continue;
      }
      player.skills[skillId] = {
        templateId: skillId,
        level: Math.max(1, Math.floor(safeNumber(rawState.level, 1))),
        training: Math.max(0, Math.floor(safeNumber(rawState.training, 0))),
        autoUse: typeof rawState.autoUse === "boolean" ? rawState.autoUse : true,
        cooldownLeft: 0,
      };
    }
  }
  ensureSkillStateIntegrity(player);

  const potionRaw = source.potionConfig;
  player.potionConfig = {
    autoHpEnabled:
      typeof potionRaw?.autoHpEnabled === "boolean"
        ? potionRaw.autoHpEnabled
        : DEFAULT_POTION_CONFIG.autoHpEnabled,
    autoHpThreshold: clamp(
      Math.floor(safeNumber(potionRaw?.autoHpThreshold, DEFAULT_POTION_CONFIG.autoHpThreshold)),
      5,
      95,
    ),
    autoMpEnabled:
      typeof potionRaw?.autoMpEnabled === "boolean"
        ? potionRaw.autoMpEnabled
        : DEFAULT_POTION_CONFIG.autoMpEnabled,
    autoMpThreshold: clamp(
      Math.floor(safeNumber(potionRaw?.autoMpThreshold, DEFAULT_POTION_CONFIG.autoMpThreshold)),
      5,
      95,
    ),
  };

  const stats = calcDerivedStats(player);
  player.hp = clamp(Math.floor(safeNumber(source.hp, stats.maxHp)), 1, stats.maxHp);
  player.mp = clamp(Math.floor(safeNumber(source.mp, stats.maxMp)), 0, stats.maxMp);
  resetSkillCooldown(player);
  return player;
}

function criticalHit(luck: number, attackSpeed = 1, extraCritRate = 0): boolean {
  const speedBonus = (attackSpeed - 1) * 0.06;
  const rate = clamp(0.08 + luck * 0.015 + speedBonus + extraCritRate, 0.08, 0.62);
  return Math.random() < rate;
}

function getParalyzeChance(player: Player, luck: number): number {
  const left = player.equipments.leftRing;
  const right = player.equipments.rightRing;
  const hasParalyze = left?.special === "paralyze" || right?.special === "paralyze";
  if (!hasParalyze) {
    return 0;
  }
  return clamp(0.048 + luck * 0.0024, 0.048, 0.14);
}

function applyParalyze(target: FighterState, chance: number, logs: string[]): void {
  if (chance <= 0 || target.hp <= 0) {
    return;
  }
  if (Math.random() >= chance) {
    return;
  }
  const rounds = randInt(1, 2);
  const current = target.statuses.paralyzeRounds ?? 0;
  target.statuses.paralyzeRounds = Math.max(current, rounds);
  logs.push(`麻痹戒指触发！目标全身僵直，陷入麻痹 ${rounds * 2} 秒。`);
}

function applyLifeSteal(
  actor: FighterState,
  damage: number,
  lifesteal: number,
  logs: string[],
  label = "吸血效果触发",
): void {
  if (lifesteal <= 0 || damage <= 0 || actor.hp <= 0 || actor.hp >= actor.maxHp) {
    return;
  }
  const heal = Math.floor(damage * lifesteal);
  if (heal <= 0) {
    return;
  }
  const before = actor.hp;
  actor.hp = Math.min(actor.maxHp, actor.hp + heal);
  const actual = actor.hp - before;
  if (actual > 0) {
    logs.push(`${label}，回复 ${actual} 点生命。`);
  }
}

function usePotionInBattle(
  player: Player,
  actor: FighterState,
  potion: "金创药" | "魔法药",
): string | null {
  if (player.inventory[potion] <= 0) {
    return null;
  }
  if (potion === "金创药") {
    if (actor.hp >= actor.maxHp) {
      return null;
    }
    player.inventory[potion] -= 1;
    const amount = Math.floor(actor.maxHp * 0.35) + 70;
    actor.hp = Math.min(actor.maxHp, actor.hp + amount);
    return `你迅速拍碎一瓶金创药，暖流涌遍全身，恢复 ${amount} 点生命。`;
  }
  if (actor.mp >= actor.maxMp) {
    return null;
  }
  player.inventory[potion] -= 1;
  const amount = Math.floor(actor.maxMp * 0.35) + 60;
  actor.mp = Math.min(actor.maxMp, actor.mp + amount);
  return `你灌下一口魔法药，精神一振，恢复 ${amount} 点魔法。`;
}

function pickSkillPriority(player: Player, actor: FighterState, target: FighterState): SkillState[] {
  const available = Object.values(player.skills).filter((state) => {
    const template = SKILL_MAP.get(state.templateId);
    return Boolean(template) && state.autoUse && state.cooldownLeft === 0 && actor.mp >= (template?.manaCost ?? 0);
  });
  if (available.length === 0) {
    return [];
  }

  const hpRatio = actor.hp / Math.max(1, actor.maxHp);
  if (player.profession === "法师") {
    const shield = available.find((item) => item.templateId === "mage_shield");
    if (shield && !actor.statuses.shieldRounds && hpRatio < 0.88) {
      return [shield, ...available.filter((item) => item !== shield)];
    }
  }

  if (player.profession === "道士") {
    const heal = available.find((item) => item.templateId === "taoist_heal");
    if (heal && hpRatio < 0.45) {
      return [heal, ...available.filter((item) => item !== heal)];
    }
    const poison = available.find((item) => item.templateId === "taoist_poison");
    if (poison && !target.statuses.poisonRounds) {
      return [poison, ...available.filter((item) => item !== poison)];
    }
    const summon = available.find((item) => item.templateId === "taoist_pet");
    if (summon && !actor.statuses.summonRounds) {
      return [summon, ...available.filter((item) => item !== summon)];
    }
  }

  return available.sort((a, b) => {
    const at = SKILL_MAP.get(a.templateId);
    const bt = SKILL_MAP.get(b.templateId);
    const av = (at?.basePower ?? 0) + a.level * 6 - (at?.manaCost ?? 0) * 0.06;
    const bv = (bt?.basePower ?? 0) + b.level * 6 - (bt?.manaCost ?? 0) * 0.06;
    return bv - av;
  });
}

function performSkill(
  actor: FighterState,
  target: FighterState,
  state: SkillState,
  luck: number,
  critRate: number,
  lifesteal: number,
  paralyzeChance: number,
): { text: string; extraLogs: string[] } {
  const template = SKILL_MAP.get(state.templateId);
  if (!template) {
    return { text: "技能释放失败。", extraLogs: [] };
  }

  actor.mp -= template.manaCost;
  state.cooldownLeft = template.cooldown;

  const extraLogs: string[] = [];
  const primary = getPrimaryPowerBySkill(template, actor);
  let dealtDamage = 0;

  if (template.kind === "attack") {
    let damage = Math.floor(template.basePower + state.level * 10 + primary * template.scaling - target.defense * 0.45);
    damage = Math.max(1, damage);
    const skillCrit = criticalHit(luck, actor.attackSpeed * 0.95, critRate);

    if (template.id === "warrior_fire_sword" && skillCrit) {
      damage = Math.floor(damage * 1.55);
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】烈焰顺着剑脊爆燃，你踏步前压一剑贯胸，造成 ${damage} 点爆裂伤害！`);
    } else if (template.id === "mage_thunder") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.35);
      }
      target.hp -= damage;
      dealtDamage += damage;
      if (Math.random() < 0.24) {
        target.statuses.shockBreak = 1;
        extraLogs.push("雷电击穿目标经络，下一次普通攻击更容易打出重击。");
      }
      extraLogs.push(`【${template.name}】乌云压顶，雷柱直落命中目标，造成 ${damage} 点雷系伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "mage_blizzard") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.35);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】冰风怒卷，锋利冰锥持续切割目标，造成 ${damage} 点寒霜伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "warrior_half_moon") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.4);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】你横刀回旋，半月弧光炸开，斩出 ${damage} 点连段伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "warrior_charge") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.4);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】你沉肩突进把对手撞得踉跄，随即补上一击，共造成 ${damage} 点冲撞伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "warrior_attack_slash") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.4);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】你短暂蓄势后斜斩而下，剑气挟风压线推进，造成 ${damage} 点伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "mage_fireball") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.35);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】炽热火球拖出红光轨迹，精准砸中目标，造成 ${damage} 点火焰伤害${skillCrit ? "（暴击）" : ""}。`);
    } else if (template.id === "taoist_talisman") {
      if (skillCrit) {
        damage = Math.floor(damage * 1.33);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】符纸化作幽光箭矢破空而去，在目标胸前炸裂，造成 ${damage} 点道术伤害${skillCrit ? "（暴击）" : ""}。`);
    } else {
      if (skillCrit) {
        damage = Math.floor(damage * 1.3);
      }
      target.hp -= damage;
      dealtDamage += damage;
      extraLogs.push(`【${template.name}】命中目标，造成 ${damage} 点伤害${skillCrit ? "（暴击）" : ""}。`);
    }
    applyParalyze(target, paralyzeChance, extraLogs);
    applyLifeSteal(actor, dealtDamage, lifesteal, extraLogs, "技能吸血触发");
  } else if (template.kind === "shield") {
    const rounds = template.duration + Math.floor(state.level / 3);
    actor.statuses.shieldRounds = rounds;
    actor.values.shieldPower = template.basePower + state.level * 7 + Math.floor(actor.magic * 0.12);
    extraLogs.push(`【${template.name}】你抬手结印，半透明护盾笼罩全身，将在 ${rounds} 回合内显著减伤。`);
  } else if (template.kind === "poison") {
    const rounds = template.duration + Math.floor(state.level / 3);
    const poisonDamage = template.basePower + Math.floor(actor.tao * 0.32) + state.level * 4;
    target.statuses.poisonRounds = rounds;
    target.values.poisonDamage = poisonDamage;
    extraLogs.push(`【${template.name}】毒符没入敌体，黑雾沿血脉扩散，接下来 ${rounds} 回合每回合受到 ${poisonDamage} 点毒伤。`);
  } else if (template.kind === "heal") {
    const healAmount = template.basePower + Math.floor(actor.tao * 0.62) + state.level * 10;
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmount);
    extraLogs.push(`【${template.name}】温润白光层层缠绕，你的伤势快速收拢，恢复 ${healAmount} 点生命。`);
  } else if (template.kind === "summon") {
    const rounds = template.duration + Math.floor(state.level / 2);
    actor.statuses.summonRounds = rounds;
    actor.values.summonDamage = template.basePower + Math.floor(actor.tao * 0.35) + state.level * 5;
    extraLogs.push(`【${template.name}】法阵震鸣，神兽踏火降临，将在 ${rounds} 回合内持续撕咬敌人。`);
  } else {
    extraLogs.push(`【${template.name}】施放成功。`);
  }

  extraLogs.push(...addSkillTraining(state, randInt(6, 12)));
  return { text: extraLogs[0], extraLogs: extraLogs.slice(1) };
}

function normalAttack(
  player: Player,
  actor: FighterState,
  target: FighterState,
  luck: number,
  critRate: number,
  lifesteal: number,
  paralyzeChance: number,
): { text: string; extraLogs: string[] } {
  const coeff = player.profession === "战士" ? 1 : player.profession === "法师" ? 0.72 : 0.84;
  let damage = Math.max(1, Math.floor(actor.attack * coeff + randInt(0, 7) + actor.attackSpeed * 8 - target.defense * 0.5));

  if (target.statuses.shockBreak) {
    damage = Math.floor(damage * 1.2);
    target.statuses.shockBreak = 0;
  }

  const extraLogs: string[] = [];
  let totalDamage = 0;
  if (criticalHit(luck, actor.attackSpeed, critRate)) {
    damage = Math.floor(damage * 1.7);
    target.hp -= damage;
    totalDamage += damage;
    extraLogs.push(`你抓住破绽劈出暴击，造成 ${damage} 点伤害。`);
  } else {
    target.hp -= damage;
    totalDamage += damage;
    extraLogs.push(`你打出一记平砍，造成 ${damage} 点伤害。`);
  }

  const extraSwingChance = clamp((actor.attackSpeed - 1) * 0.22, 0, 0.2);
  if (target.hp > 0 && extraSwingChance > 0 && Math.random() < extraSwingChance) {
    const extra = Math.max(1, Math.floor(damage * randFloat(0.4, 0.62)));
    target.hp -= extra;
    totalDamage += extra;
    extraLogs.push(`攻速优势触发追击，再补 ${extra} 点伤害。`);
  }

  applyParalyze(target, paralyzeChance, extraLogs);
  applyLifeSteal(actor, totalDamage, lifesteal, extraLogs);
  return { text: extraLogs[0], extraLogs: extraLogs.slice(1) };
}

function monsterAttack(actor: FighterState, target: FighterState, text: string): string {
  let damage = Math.max(1, Math.floor(actor.attack + randInt(-4, 10) - target.defense * 0.48));
  if (target.statuses.shieldRounds && target.statuses.shieldRounds > 0) {
    const reduceRate = clamp(0.22 + (target.values.shieldPower ?? 0) / 240, 0.22, 0.65);
    const reduced = Math.floor(damage * reduceRate);
    damage -= reduced;
    target.hp -= damage;
    return `${text} 但魔法盾扭曲冲击，吸收 ${reduced} 点伤害，你仍承受 ${damage} 点。`;
  }
  target.hp -= damage;
  return `${text} 你受到 ${damage} 点伤害。`;
}

function grantReward(player: Player, expGain: number, goldGain: number): string[] {
  const logs = [`获得经验 ${expGain}，金币 ${goldGain}。`];
  player.exp += expGain;
  player.gold += goldGain;

  while (player.exp >= expToNextLevel(player.level)) {
    player.exp -= expToNextLevel(player.level);
    player.level += 1;
    const nextStats = calcDerivedStats(player);
    player.hp = nextStats.maxHp;
    player.mp = nextStats.maxMp;
    logs.push(`角色升级至 Lv.${player.level}，生命与魔法完全恢复，战力显著提升。`);
    logs.push(...collectLevelSkillHints(player, player.level));
  }
  return logs;
}

const RARITY_LIST: Array<{ name: Equipment["rarity"]; weight: number }> = [
  { name: "普通", weight: 0.86 },
  { name: "精良", weight: 0.11 },
  { name: "稀有", weight: 0.027 },
  { name: "史诗", weight: 0.003 },
];

function rarityRoll(luck: number, tier: number, isBoss: boolean): Equipment["rarity"] {
  const bonus = luck * 0.0013 + tier * 0.0017 + (isBoss ? 0.02 : 0);
  const roll = Math.random() - bonus;
  if (roll < 0.004) {
    return "史诗";
  }
  if (roll < 0.031) {
    return "稀有";
  }
  if (roll < 0.145) {
    return "精良";
  }
  return "普通";
}

function rollPrimaryType(): "attack" | "magic" | "tao" {
  const r = randInt(0, 2);
  if (r === 0) {
    return "attack";
  }
  if (r === 1) {
    return "magic";
  }
  return "tao";
}

function createParalyzeRing(level: number, luck: number, isBoss: boolean): Equipment {
  const rarity: Equipment["rarity"] = "史诗";
  const strengthFactor = isBoss ? 1.18 : 1;
  const attack = Math.floor((randInt(6, 13) + Math.floor(level * 0.22)) * strengthFactor);
  const magic = Math.floor((randInt(4, 9) + Math.floor(level * 0.16)) * strengthFactor);
  const tao = Math.floor((randInt(4, 9) + Math.floor(level * 0.16)) * strengthFactor);
  const defense = Math.floor((randInt(3, 7) + Math.floor(level * 0.12)) * strengthFactor);

  return {
    id: randomId("eq"),
    name: "麻痹戒指",
    slot: Math.random() < 0.5 ? "leftRing" : "rightRing",
    levelReq: Math.max(18, level - 3),
    rarity,
    attack,
    magic,
    tao,
    attackSpeed: round2(randFloat(0.02, 0.06)),
    defense,
    hp: randInt(18, 46),
    mp: randInt(12, 34),
    luck: randInt(1, 3) + (luck >= 8 ? 1 : 0),
    strengthen: 0,
    isElite: true,
    eliteBonus: {
      attack: randInt(3, 9),
      attackSpeed: round2(randFloat(0.01, 0.04)),
    },
    special: "paralyze",
  };
}

function shouldDropParalyzeRing(tier: number, luck: number, isBoss: boolean): boolean {
  const chance = clamp(0.00016 + tier * 0.00006 + luck * 0.000018 + (isBoss ? 0.00025 : 0), 0.0001, 0.0012);
  return Math.random() < chance;
}

function generateEquipment(
  level: number,
  tier: number,
  luck: number,
  isBoss: boolean,
  profession: Profession,
): Equipment {
  if (shouldDropParalyzeRing(tier, luck, isBoss)) {
    return createParalyzeRing(level, luck, isBoss);
  }

  const slot = SLOT_ORDER[randInt(0, SLOT_ORDER.length - 1)];
  let rarity = rarityRoll(luck, tier, isBoss);
  const setTemplate = pickSetTemplate(profession, slot, rarity, isBoss, tier);
  if (setTemplate && rarity === "普通") {
    rarity = "精良";
  }
  const rarityMultiplier = {
    普通: 1,
    精良: 1.18,
    稀有: 1.42,
    史诗: 1.78,
  }[rarity];

  const base = Math.floor((level * 2 + randInt(2, 12)) * rarityMultiplier * (isBoss ? 1.12 : 1));
  const primary = rollPrimaryType();

  let attack = 0;
  let magic = 0;
  let tao = 0;
  let attackSpeed = 0;
  let defense = 0;
  let hp = 0;
  let mp = 0;
  let eqLuck = 0;
  let name = "无名装备";

  const addPrimary = (value: number) => {
    if (primary === "attack") {
      attack += value;
    } else if (primary === "magic") {
      magic += value;
    } else {
      tao += value;
    }
  };

  if (slot === "weapon") {
    addPrimary(base + randInt(12, 28));
    attackSpeed = round2(randFloat(0.01, 0.06));
    mp = randInt(0, 16);
    eqLuck = randInt(0, 2);

    if (primary === "attack") {
      name = ["炼狱", "井中月", "裁决之杖", "命运之刃"][randInt(0, 3)];
    } else if (primary === "magic") {
      name = ["魔杖", "骨玉权杖", "血饮", "嗜魂法杖"][randInt(0, 3)];
    } else {
      name = ["银蛇", "无极棍", "龙纹剑", "逍遥扇"][randInt(0, 3)];
    }
  } else if (slot === "armor") {
    defense = base + randInt(8, 20);
    hp = randInt(40, 92);
    addPrimary(randInt(3, 10));
    name = primary === "attack"
      ? ["战神盔甲", "圣战宝甲", "天魔神甲"][randInt(0, 2)]
      : primary === "magic"
        ? ["恶魔长袍", "法神披风", "霓裳羽衣"][randInt(0, 2)]
        : ["幽灵战衣", "天尊道袍", "玄天法衣"][randInt(0, 2)];
  } else if (slot === "helmet") {
    defense = Math.floor(base * 0.82) + randInt(5, 14);
    hp = randInt(22, 56);
    addPrimary(randInt(2, 8));
    name = ["黑铁头盔", "圣战头盔", "法神头盔", "天尊头盔"][randInt(0, 3)];
  } else if (slot === "necklace") {
    addPrimary(Math.floor(base * 0.45) + randInt(4, 12));
    attackSpeed = round2(randFloat(0, 0.03));
    eqLuck = randInt(1, 3);
    name = primary === "attack"
      ? ["绿色项链", "记忆项链", "狂风项链"][randInt(0, 2)]
      : primary === "magic"
        ? ["恶魔铃铛", "生命项链", "法神项链"][randInt(0, 2)]
        : ["灵魂项链", "天珠项链", "天尊项链"][randInt(0, 2)];
  } else if (slot === "leftBracelet" || slot === "rightBracelet") {
    addPrimary(Math.floor(base * 0.32) + randInt(2, 8));
    defense = Math.floor(base * 0.18) + randInt(1, 5);
    attackSpeed = round2(randFloat(0.01, 0.04));
    hp = randInt(10, 30);
    name = primary === "attack"
      ? ["死神手套", "骑士手镯", "圣战手镯"][randInt(0, 2)]
      : primary === "magic"
        ? ["思贝儿手镯", "龙之手镯", "法神手镯"][randInt(0, 2)]
        : ["三眼手镯", "心灵手镯", "天尊手镯"][randInt(0, 2)];
  } else if (slot === "leftRing" || slot === "rightRing") {
    addPrimary(Math.floor(base * 0.4) + randInt(3, 10));
    attackSpeed = round2(randFloat(0, 0.03));
    eqLuck = randInt(0, 2);
    defense = randInt(0, 5);
    name = primary === "attack"
      ? ["力量戒指", "骑士戒指", "圣战戒指"][randInt(0, 2)]
      : primary === "magic"
        ? ["紫碧螺", "红宝石戒指", "法神戒指"][randInt(0, 2)]
        : ["泰坦戒指", "铂金戒指", "天尊戒指"][randInt(0, 2)];
  } else if (slot === "belt") {
    defense = Math.floor(base * 0.42) + randInt(2, 8);
    hp = randInt(28, 64);
    addPrimary(randInt(1, 6));
    name = ["战神腰带", "雷霆腰带", "天师腰带", "魔血腰带"][randInt(0, 3)];
  } else {
    defense = Math.floor(base * 0.36) + randInt(2, 8);
    hp = randInt(20, 52);
    mp = randInt(8, 20);
    attackSpeed = round2(randFloat(0.01, 0.03));
    addPrimary(randInt(1, 5));
    name = ["战神靴", "疾风靴", "雷霆靴", "魔血靴"][randInt(0, 3)];
  }

  if (setTemplate) {
    name = getSetPieceName(setTemplate, slot);
    attackSpeed = round2(attackSpeed + randFloat(0.004, 0.018));
    eqLuck += 1;
    if (setTemplate.professions?.includes("战士")) {
      attack += randInt(4, 10);
    } else if (setTemplate.professions?.includes("法师")) {
      magic += randInt(4, 10);
    } else if (setTemplate.professions?.includes("道士")) {
      tao += randInt(4, 10);
    } else {
      addPrimary(randInt(2, 6));
    }
  }

  const isElite = Math.random() < clamp(0.012 + luck * 0.0015 + (isBoss ? 0.01 : 0) + (setTemplate ? 0.02 : 0), 0.012, 0.08);
  const eliteBonus: Equipment["eliteBonus"] = {};
  if (isElite) {
    const roll = randInt(0, 6);
    if (roll === 0) {
      eliteBonus.attack = randInt(3, 10);
    } else if (roll === 1) {
      eliteBonus.magic = randInt(3, 10);
    } else if (roll === 2) {
      eliteBonus.tao = randInt(3, 10);
    } else if (roll === 3) {
      eliteBonus.attackSpeed = round2(randFloat(0.01, 0.04));
    } else if (roll === 4) {
      eliteBonus.defense = randInt(3, 10);
    } else if (roll === 5) {
      eliteBonus.hp = randInt(24, 62);
    } else {
      eliteBonus.luck = randInt(1, 2);
    }
  }

  return {
    id: randomId("eq"),
    name,
    slot,
    levelReq: Math.max(1, level - 2),
    rarity,
    setId: setTemplate?.id,
    setName: setTemplate?.name,
    setColor: setTemplate?.color,
    attack,
    magic,
    tao,
    attackSpeed,
    defense,
    hp,
    mp,
    luck: eqLuck,
    strengthen: 0,
    isElite,
    eliteBonus,
  };
}

function reduceCooldowns(player: Player): void {
  Object.values(player.skills).forEach((state) => {
    if (state.cooldownLeft > 0) {
      state.cooldownLeft -= 1;
    }
  });
}

function maybeDropSkillBook(player: Player, monster: MapArea["monsters"][number], dropRate: number): string | null {
  const list = getProfessionTemplates(player.profession);
  if (list.length === 0) {
    return null;
  }

  const baseChance = monster.isBoss ? 0.18 : 0.028;
  if (Math.random() >= baseChance * dropRate) {
    return null;
  }

  let pool = list.filter((item) => !player.skills[item.id] && player.level >= item.unlockLevel);
  if (pool.length === 0) {
    pool = list.filter((item) => player.level + 3 >= item.unlockLevel);
  }
  if (pool.length === 0) {
    pool = list;
  }

  const picked = pool[randInt(0, pool.length - 1)];
  player.skillBooks[picked.id] = (player.skillBooks[picked.id] ?? 0) + 1;
  return `掉落技能书：${picked.bookName} x1`;
}

export function runAutoBattle(
  player: Player,
  area: MapArea,
  monster: MapArea["monsters"][number],
  verbose: boolean,
  options?: {
    rewardRate?: number;
    dropRate?: number;
  },
): CombatResult {
  const rewardRate = clamp(options?.rewardRate ?? 1, 0, 1);
  const dropRate = clamp(options?.dropRate ?? 1, 0, 1);

  ensureSkillStateIntegrity(player);
  resetSkillCooldown(player);

  const stats = calcDerivedStats(player);
  const actor: FighterState = {
    hp: clamp(player.hp, 1, stats.maxHp),
    mp: clamp(player.mp, 0, stats.maxMp),
    maxHp: stats.maxHp,
    maxMp: stats.maxMp,
    attack: stats.attack,
    magic: stats.magic,
    tao: stats.tao,
    attackSpeed: stats.attackSpeed,
    defense: stats.defense,
    statuses: {},
    values: {},
  };

  const target: FighterState = {
    hp: monster.hp,
    mp: 0,
    maxHp: monster.hp,
    maxMp: 0,
    attack: monster.attack,
    magic: 0,
    tao: 0,
    attackSpeed: 1,
    defense: monster.defense,
    statuses: {},
    values: {},
  };

  const logs: string[] = [];
  const maxRounds = monster.isBoss ? 70 : 45;
  const paralyzeChance = clamp(getParalyzeChance(player, stats.luck) + stats.paralyzeChance, 0, 0.24);
  let round = 1;

  while (actor.hp > 0 && target.hp > 0 && round <= maxRounds) {
    if (verbose) {
      const prefix = monster.isBoss ? "[Boss战]" : "";
      logs.push(
        `${prefix}[第${round}回合] 你 HP ${actor.hp}/${actor.maxHp} MP ${actor.mp}/${actor.maxMp} | ${monster.name} HP ${target.hp}/${target.maxHp}`,
      );
    }

    if (player.potionConfig.autoHpEnabled) {
      const hpRatio = (actor.hp / actor.maxHp) * 100;
      if (hpRatio <= player.potionConfig.autoHpThreshold) {
        const hpLog = usePotionInBattle(player, actor, "金创药");
        if (hpLog) {
          logs.push(hpLog);
        }
      }
    }

    if (player.potionConfig.autoMpEnabled) {
      const mpRatio = (actor.mp / Math.max(1, actor.maxMp)) * 100;
      if (mpRatio <= player.potionConfig.autoMpThreshold) {
        const mpLog = usePotionInBattle(player, actor, "魔法药");
        if (mpLog) {
          logs.push(mpLog);
        }
      }
    }

    if (target.statuses.poisonRounds && target.statuses.poisonRounds > 0) {
      const poisonDamage = target.values.poisonDamage ?? 0;
      target.hp -= poisonDamage;
      logs.push(`毒素发作，${monster.name} 受到 ${poisonDamage} 点持续伤害。`);
      target.statuses.poisonRounds -= 1;
    }

    if (target.hp <= 0) {
      break;
    }

    const priority = pickSkillPriority(player, actor, target);
    if (priority.length > 0) {
      const chosen = priority[0];
      const skillResult = performSkill(actor, target, chosen, stats.luck, stats.critRate, stats.lifesteal, paralyzeChance);
      logs.push(skillResult.text);
      logs.push(...skillResult.extraLogs);
    } else {
      const attackResult = normalAttack(player, actor, target, stats.luck, stats.critRate, stats.lifesteal, paralyzeChance);
      logs.push(attackResult.text);
      logs.push(...attackResult.extraLogs);
    }

    if (actor.statuses.summonRounds && actor.statuses.summonRounds > 0 && target.hp > 0) {
      let summonDamage = (actor.values.summonDamage ?? 0) + randInt(-4, 8);
      summonDamage = Math.max(1, summonDamage - Math.floor(target.defense * 0.18));
      target.hp -= summonDamage;
      logs.push(`神兽凌空扑击，利爪撕开血痕，再造成 ${summonDamage} 点伤害。`);
      applyLifeSteal(actor, summonDamage, stats.lifesteal * 0.65, logs, "神兽吸血触发");
      actor.statuses.summonRounds -= 1;
    }

    if (target.hp <= 0) {
      break;
    }

    if (target.statuses.paralyzeRounds && target.statuses.paralyzeRounds > 0) {
      logs.push(`${monster.name} 全身僵硬，处于麻痹状态，无法行动。`);
      target.statuses.paralyzeRounds -= 1;
    } else {
      logs.push(monsterAttack(target, actor, monster.skillText));
    }

    reduceCooldowns(player);
    if (actor.statuses.shieldRounds && actor.statuses.shieldRounds > 0) {
      actor.statuses.shieldRounds -= 1;
    }
    round += 1;
  }

  const win = actor.hp > 0 && target.hp <= 0;
  const refreshed = calcDerivedStats(player);
  player.hp = clamp(actor.hp, 0, refreshed.maxHp);
  player.mp = clamp(actor.mp, 0, refreshed.maxMp);

  if (win) {
    const goldGain = Math.max(1, Math.floor(monster.gold * randFloat(0.72, 1.04) * rewardRate));
    const expGain = Math.max(1, Math.floor(monster.exp * randFloat(0.78, 1.05) * rewardRate));
    logs.push(...grantReward(player, expGain, goldGain));
    logs.push(...gainBattleTraining(player));

    const drops: string[] = [];
    const bossBonus = monster.isBoss ? 2.2 : 1;
    const equipChance =
      clamp((monster.isBoss ? 0.16 : 0.042) + refreshed.luck * 0.0025, 0.03, monster.isBoss ? 0.33 : 0.12) *
      dropRate;

    if (Math.random() < equipChance) {
      const equipment = generateEquipment(
        monster.level,
        area.dropTier,
        refreshed.luck + (monster.isBoss ? 2 : 0),
        Boolean(monster.isBoss),
        player.profession,
      );
      player.bag.push(equipment);
      drops.push(`掉落装备：${formatEquipment(equipment)}`);
    }

    if (monster.isBoss && Math.random() < 0.08 * dropRate) {
      const extra = generateEquipment(monster.level + 1, area.dropTier + 1, refreshed.luck + 4, true, player.profession);
      player.bag.push(extra);
      drops.push(`Boss额外掉落：${formatEquipment(extra)}`);
    }

    if (Math.random() < (monster.isBoss ? 0.26 : 0.085) * dropRate) {
      const itemPool: ItemName[] = ["金创药", "金创药", "魔法药", "修炼卷轴", "强化石", "幸运油"];
      const itemName = itemPool[randInt(0, itemPool.length - 1)];
      const count = itemName === "金创药" ? randInt(1, 2) : 1;
      player.inventory[itemName] += count;
      drops.push(`掉落物品：${itemName} x${count}`);
    }

    const bookDrop = maybeDropSkillBook(player, monster, dropRate * bossBonus);
    if (bookDrop) {
      drops.push(bookDrop);
    }

    logs.push(...drops);
    keepResourceInRange(player);
    return { win: true, logs, exp: expGain, gold: goldGain, drops };
  }

  const penalty = Math.floor(player.gold * 0.08);
  player.gold = Math.max(0, player.gold - penalty);
  player.hp = Math.floor(refreshed.maxHp * 0.4);
  player.mp = Math.floor(refreshed.maxMp * 0.35);
  logs.push(`你被击败，遗失金币 ${penalty}，勉强撤离战场。`);
  keepResourceInRange(player);
  return { win: false, logs, exp: 0, gold: -penalty, drops: [] };
}

export function getAvailableMaps(level: number): MapArea[] {
  return MAPS.filter((item) => level >= item.minLevel);
}

export function pickRandomMonster(area: MapArea): MapArea["monsters"][number] {
  const bossList = area.bosses ?? [];
  const bossChance = clamp(0.05 + area.dropTier * 0.015, 0.05, 0.14);
  if (bossList.length > 0 && Math.random() < bossChance) {
    return bossList[randInt(0, bossList.length - 1)];
  }
  return area.monsters[randInt(0, area.monsters.length - 1)];
}

export function equipFromBag(player: Player, index: number): string {
  if (index < 0 || index >= player.bag.length) {
    return "装备编号无效。";
  }
  const item = player.bag[index];
  if (player.level < item.levelReq) {
    return `等级不足，需 Lv.${item.levelReq} 才能装备。`;
  }
  const old = player.equipments[item.slot];
  player.equipments[item.slot] = item;
  player.bag.splice(index, 1);
  if (old) {
    player.bag.push(old);
  }
  keepResourceInRange(player);
  return `已装备${SLOT_NAMES[item.slot]}：${formatEquipment(item)}`;
}

export function learnSkillByBook(player: Player, skillId: string): string {
  const template = SKILL_MAP.get(skillId);
  if (!template || template.profession !== player.profession) {
    return "该技能不属于当前职业。";
  }
  if (player.skills[skillId]) {
    return `你已经学会【${template.name}】。`;
  }
  if (player.level < template.unlockLevel) {
    return `等级不足，需 Lv.${template.unlockLevel} 才能学习【${template.name}】。`;
  }
  const count = player.skillBooks[skillId] ?? 0;
  if (count <= 0) {
    return `你缺少【${template.bookName}】。`;
  }

  player.skillBooks[skillId] = count - 1;
  player.skills[skillId] = createDefaultSkillState(skillId);
  return `你研读了【${template.bookName}】，成功学会技能【${template.name}】。`;
}

export function toggleSkillAuto(player: Player, skillId: string): string {
  const skill = player.skills[skillId];
  const template = SKILL_MAP.get(skillId);
  if (!skill || !template) {
    return "该技能尚未学习。";
  }
  skill.autoUse = !skill.autoUse;
  return `${template.name} 已切换为${skill.autoUse ? "自动释放" : "手动释放"}。`;
}

export function trainSkillByScroll(player: Player, skillId: string): string {
  if (player.inventory["修炼卷轴"] <= 0) {
    return "你没有修炼卷轴。";
  }
  const skill = player.skills[skillId];
  const template = SKILL_MAP.get(skillId);
  if (!skill || !template) {
    return "该技能尚未学习。";
  }
  player.inventory["修炼卷轴"] -= 1;
  const gain = randInt(45, 70);
  const logs = addSkillTraining(skill, gain);
  if (logs.length > 0) {
    return `${template.name} 获得修炼值 ${gain}。${logs.join(" ")}`;
  }
  return `${template.name} 获得修炼值 ${gain}。`;
}

export function buyShopItem(player: Player, itemName: ItemName, count: number): string {
  const countSafe = Math.max(1, Math.floor(count));
  const item = SHOP_ITEMS.find((entry) => entry.name === itemName);
  if (!item) {
    return "商品不存在。";
  }
  const total = item.price * countSafe;
  if (player.gold < total) {
    return "金币不足。";
  }
  player.gold -= total;
  player.inventory[itemName] += countSafe;
  return `购买成功：${itemName} x${countSafe}，花费 ${total} 金币。`;
}

export function usePotion(player: Player, potion: "金创药" | "魔法药"): string {
  const stats = calcDerivedStats(player);
  if (player.inventory[potion] <= 0) {
    return `${potion} 不足。`;
  }
  if (potion === "金创药") {
    if (player.hp >= stats.maxHp) {
      return "当前生命已满。";
    }
    player.inventory[potion] -= 1;
    const amount = Math.floor(stats.maxHp * 0.35) + 70;
    player.hp = Math.min(stats.maxHp, player.hp + amount);
    return `你使用了金创药，恢复 ${amount} 点生命。`;
  }
  if (player.mp >= stats.maxMp) {
    return "当前魔法已满。";
  }
  player.inventory[potion] -= 1;
  const amount = Math.floor(stats.maxMp * 0.35) + 60;
  player.mp = Math.min(stats.maxMp, player.mp + amount);
  return `你使用了魔法药，恢复 ${amount} 点魔法。`;
}

export function updatePotionConfig(player: Player, patch: Partial<Player["potionConfig"]>): string {
  if (typeof patch.autoHpEnabled === "boolean") {
    player.potionConfig.autoHpEnabled = patch.autoHpEnabled;
  }
  if (typeof patch.autoMpEnabled === "boolean") {
    player.potionConfig.autoMpEnabled = patch.autoMpEnabled;
  }
  if (typeof patch.autoHpThreshold === "number") {
    player.potionConfig.autoHpThreshold = clamp(Math.floor(patch.autoHpThreshold), 5, 95);
  }
  if (typeof patch.autoMpThreshold === "number") {
    player.potionConfig.autoMpThreshold = clamp(Math.floor(patch.autoMpThreshold), 5, 95);
  }
  return "自动药水配置已更新。";
}

export function tryStrengthen(player: Player, slot: EquipmentSlot, preferStone: boolean): string {
  const item = player.equipments[slot];
  if (!item) {
    return "该槽位没有装备。";
  }
  const cost = 180 + player.level * 28 + item.strengthen * 160;
  if (player.gold < cost) {
    return `金币不足，强化需要 ${cost}。`;
  }
  let chance = clamp(0.92 - item.strengthen * 0.09, 0.24, 0.92);
  let usedStone = false;
  if (preferStone && player.inventory["强化石"] > 0) {
    player.inventory["强化石"] -= 1;
    chance = clamp(chance + 0.12, 0.24, 0.96);
    usedStone = true;
  }

  player.gold -= cost;
  if (Math.random() < chance) {
    item.strengthen += 1;
    return `强化成功（成功率 ${Math.floor(chance * 100)}%）！${item.name} 现为 +${item.strengthen}${usedStone ? "，已消耗强化石。" : "。"}`;
  }
  if (item.strengthen >= 7) {
    item.strengthen -= 1;
    return `强化失败（成功率 ${Math.floor(chance * 100)}%），装备回退到 +${item.strengthen}${usedStone ? "，已消耗强化石。" : "。"}`;
  }
  return `强化失败（成功率 ${Math.floor(chance * 100)}%），装备等级未变化${usedStone ? "，已消耗强化石。" : "。"}`;
}

export function useLuckyOil(player: Player): string {
  if (player.inventory["幸运油"] <= 0) {
    return "你没有幸运油。";
  }
  const weapon = player.equipments.weapon;
  if (!weapon) {
    return "请先装备武器。";
  }
  if (getEquipmentStat(weapon, "luck") >= 7) {
    return "武器幸运已达到安全上限。";
  }
  player.inventory["幸运油"] -= 1;
  const chance = clamp(0.62 - getEquipmentStat(weapon, "luck") * 0.07, 0.22, 0.62);
  if (Math.random() < chance) {
    weapon.luck += 1;
    return `幸运油生效！武器幸运 +1，当前幸运 ${getEquipmentStat(weapon, "luck")}。`;
  }
  return "幸运油挥发了，没有产生效果。";
}

export function cheatAddGold(player: Player, amount = 100000): string {
  player.gold += Math.max(1, Math.floor(amount));
  return `作弊生效：金币 +${Math.max(1, Math.floor(amount))}。`;
}

export function cheatHeal(player: Player): string {
  const stats = calcDerivedStats(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;
  return "作弊生效：生命与魔法已补满。";
}

export function cheatAddItems(player: Player, amount = 20): string {
  const count = Math.max(1, Math.floor(amount));
  const keys = Object.keys(player.inventory) as ItemName[];
  keys.forEach((key) => {
    player.inventory[key] += count;
  });
  getProfessionTemplates(player.profession).forEach((template) => {
    player.skillBooks[template.id] = (player.skillBooks[template.id] ?? 0) + Math.max(1, Math.floor(count / 2));
  });
  return `作弊生效：所有道具 +${count}，并补充职业技能书。`;
}

export function cheatLevelUp(player: Player, levels = 1): string {
  const step = Math.max(1, Math.floor(levels));
  player.level += step;
  const stats = calcDerivedStats(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;
  return `作弊生效：等级提升到 Lv.${player.level}。`;
}

export function cheatUnlockAllSkills(player: Player): string {
  const templates = getProfessionTemplates(player.profession);
  const needLevel = templates.reduce((max, item) => Math.max(max, item.unlockLevel), player.level);
  player.level = needLevel;
  for (const template of templates) {
    if (!player.skills[template.id]) {
      player.skills[template.id] = createDefaultSkillState(template.id);
    }
  }
  return "作弊生效：已解锁全部职业技能。";
}

export function cheatGenerateEquipment(player: Player, count = 4): string {
  const n = Math.max(1, Math.floor(count));
  const luck = calcDerivedStats(player).luck;
  for (let i = 0; i < n; i += 1) {
    player.bag.push(generateEquipment(player.level + randInt(0, 2), 4, luck + 2, true, player.profession));
  }
  return `作弊生效：背包新增 ${n} 件高级装备。`;
}

export function getSlotName(slot: EquipmentSlot): string {
  return SLOT_NAMES[slot];
}

export function getAllSlots(): EquipmentSlot[] {
  return [...SLOT_ORDER];
}

export function getShopItems() {
  return SHOP_ITEMS;
}

export function getMaps() {
  return MAPS;
}

export function getRarityList() {
  return RARITY_LIST;
}
