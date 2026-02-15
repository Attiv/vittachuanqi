export type Profession = "战士" | "法师" | "道士";

export type SkillKind = "attack" | "shield" | "poison" | "heal" | "summon";

export type EquipmentSlot =
  | "helmet"
  | "necklace"
  | "leftBracelet"
  | "rightBracelet"
  | "leftRing"
  | "rightRing"
  | "belt"
  | "boots"
  | "weapon"
  | "armor";

export type ItemName = "金创药" | "魔法药" | "修炼卷轴" | "强化石" | "幸运油";

export type Rarity = "普通" | "精良" | "稀有" | "史诗";

export interface SkillTemplate {
  id: string;
  name: string;
  bookName: string;
  profession: Profession;
  unlockLevel: number;
  kind: SkillKind;
  manaCost: number;
  cooldown: number;
  description: string;
  basePower: number;
  scaling: number;
  duration: number;
}

export interface SkillState {
  templateId: string;
  level: number;
  training: number;
  autoUse: boolean;
  cooldownLeft: number;
}

export interface Equipment {
  id: string;
  name: string;
  slot: EquipmentSlot;
  levelReq: number;
  rarity: Rarity;
  setId?: string;
  setName?: string;
  setColor?: "crimson" | "azure" | "jade" | "amber";
  attack: number;
  magic: number;
  tao: number;
  attackSpeed: number;
  defense: number;
  hp: number;
  mp: number;
  luck: number;
  strengthen: number;
  isElite: boolean;
  eliteBonus: Partial<
    Record<"attack" | "magic" | "tao" | "attackSpeed" | "defense" | "hp" | "mp" | "luck", number>
  >;
  special?: "paralyze";
}

export interface MonsterTemplate {
  id: string;
  name: string;
  isBoss?: boolean;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  gold: number;
  skillText: string;
}

export interface MapArea {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  dropTier: number;
  monsters: MonsterTemplate[];
  bosses?: MonsterTemplate[];
}

export interface ShopItem {
  name: ItemName;
  price: number;
  description: string;
}

export interface Player {
  name: string;
  profession: Profession;
  level: number;
  exp: number;
  gold: number;
  baseLuck: number;
  hp: number;
  mp: number;
  inventory: Record<ItemName, number>;
  skillBooks: Record<string, number>;
  equipments: Record<EquipmentSlot, Equipment | null>;
  bag: Equipment[];
  skills: Record<string, SkillState>;
  potionConfig: {
    autoHpEnabled: boolean;
    autoHpThreshold: number;
    autoMpEnabled: boolean;
    autoMpThreshold: number;
  };
}

export interface DerivedStats {
  attack: number;
  magic: number;
  tao: number;
  attackSpeed: number;
  critRate: number;
  lifesteal: number;
  paralyzeChance: number;
  defense: number;
  maxHp: number;
  maxMp: number;
  luck: number;
}

export interface CombatResult {
  win: boolean;
  logs: string[];
  exp: number;
  gold: number;
  drops: string[];
}

export interface AfkResult {
  wins: number;
  fails: number;
  exp: number;
  gold: number;
  drops: string[];
  logs: string[];
  processedMinutes: number;
  totalMinutes: number;
  offlineMinutes: number;
}

export interface AfkSession {
  running: boolean;
  mapId: string;
  totalMinutes: number;
  doneMinutes: number;
  startedAt: number;
  lastTickAt: number;
}

export interface GameSaveData {
  player: Player | null;
  afkSession: AfkSession | null;
  afkResult: AfkResult | null;
}
