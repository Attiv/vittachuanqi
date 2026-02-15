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

interface FighterState {
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  statuses: Record<string, number>;
  values: Record<string, number>;
}

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

function getBaseByProfession(profession: Profession): {
  attack: number;
  defense: number;
  hp: number;
  mp: number;
} {
  if (profession === "战士") {
    return { attack: 22, defense: 10, hp: 260, mp: 90 };
  }
  if (profession === "法师") {
    return { attack: 14, defense: 7, hp: 180, mp: 220 };
  }
  return { attack: 17, defense: 8, hp: 215, mp: 170 };
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

function ensureUnlockedSkills(player: Player): string[] {
  const logs: string[] = [];
  const templates = getProfessionTemplates(player.profession);
  for (const template of templates) {
    const learned = Boolean(player.skills[template.id]);
    if (player.level >= template.unlockLevel && !learned) {
      player.skills[template.id] = createDefaultSkillState(template.id);
      logs.push(`你领悟了新技能【${template.name}】，需求等级 Lv.${template.unlockLevel}。`);
    }
    if (player.level < template.unlockLevel && learned) {
      delete player.skills[template.id];
    }
  }
  return logs;
}

function resetSkillCooldown(player: Player): void {
  Object.values(player.skills).forEach((state) => {
    state.cooldownLeft = 0;
  });
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

export function getEquipmentStat(
  equipment: Equipment,
  key: "attack" | "defense" | "hp" | "mp" | "luck",
): number {
  const base = equipment[key];
  const elite = equipment.eliteBonus[key] ?? 0;
  if (key === "attack" || key === "defense" || key === "hp" || key === "mp") {
    return base + elite + Math.floor(base * 0.12 * equipment.strengthen);
  }
  return base + elite;
}

function sumEquipStats(
  player: Player,
  key: "attack" | "defense" | "hp" | "mp" | "luck",
): number {
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
  const attackGrowth = (player.level - 1) * (player.profession === "战士" ? 5 : 4);
  const defenseGrowth = (player.level - 1) * (player.profession === "战士" ? 4 : 3);
  const hpGrowth = (player.level - 1) * (player.profession === "战士" ? 34 : 28);
  const mpGrowth = (player.level - 1) * (player.profession === "战士" ? 14 : 22);

  return {
    attack: base.attack + attackGrowth + sumEquipStats(player, "attack"),
    defense: base.defense + defenseGrowth + sumEquipStats(player, "defense"),
    maxHp: base.hp + hpGrowth + sumEquipStats(player, "hp"),
    maxMp: base.mp + mpGrowth + sumEquipStats(player, "mp"),
    luck: player.baseLuck + sumEquipStats(player, "luck"),
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
    const gain = randInt(3, 7);
    const name = SKILL_MAP.get(target.templateId)?.name ?? target.templateId;
    logs.push(`实战领悟：${name} 熟练度 +${gain}。`);
    logs.push(...addSkillTraining(target, gain));
  }
  return logs;
}

export function formatEquipment(item: Equipment): string {
  const eliteText = item.isElite ? "·极品" : "";
  return `${item.name}${eliteText} [${item.rarity}] +${item.strengthen} (攻${getEquipmentStat(item, "attack")} 防${getEquipmentStat(item, "defense")} 生${getEquipmentStat(item, "hp")} 魔${getEquipmentStat(item, "mp")} 运${getEquipmentStat(item, "luck")})`;
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
    equipments,
    bag: [],
    skills: {},
    potionConfig: { ...DEFAULT_POTION_CONFIG },
  };
  ensureUnlockedSkills(player);
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
  return {
    id: typeof obj.id === "string" ? obj.id : randomId("eq"),
    name: obj.name,
    slot: normalized,
    levelReq: safeNumber(obj.levelReq, 1),
    rarity: obj.rarity as Equipment["rarity"],
    attack: safeNumber(obj.attack, 0),
    defense: safeNumber(obj.defense, 0),
    hp: safeNumber(obj.hp, 0),
    mp: safeNumber(obj.mp, 0),
    luck: safeNumber(obj.luck, 0),
    strengthen: safeNumber(obj.strengthen, 0),
    isElite: Boolean(obj.isElite),
    eliteBonus: {
      attack: safeNumber(obj.eliteBonus?.attack, 0),
      defense: safeNumber(obj.eliteBonus?.defense, 0),
      hp: safeNumber(obj.eliteBonus?.hp, 0),
      mp: safeNumber(obj.eliteBonus?.mp, 0),
      luck: safeNumber(obj.eliteBonus?.luck, 0),
    },
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

  if (source.equipments && typeof source.equipments === "object") {
    for (const slot of SLOT_ORDER) {
      const data = (source.equipments as Record<string, unknown>)[slot];
      const eq = hydrateEquipment(data);
      player.equipments[slot] = eq;
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

  ensureUnlockedSkills(player);

  if (source.skills && typeof source.skills === "object") {
    for (const skillId of Object.keys(player.skills)) {
      const rawState = (source.skills as Record<string, Partial<SkillState> | undefined>)[skillId];
      if (!rawState) {
        continue;
      }
      player.skills[skillId] = {
        templateId: skillId,
        level: Math.max(1, Math.floor(safeNumber(rawState.level, 1))),
        training: Math.max(0, Math.floor(safeNumber(rawState.training, 0))),
        autoUse: Boolean(rawState.autoUse),
        cooldownLeft: 0,
      };
    }
  }

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

function criticalHit(luck: number): boolean {
  const rate = clamp(0.08 + luck * 0.015, 0.08, 0.42);
  return Math.random() < rate;
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

function pickSkillPriority(
  player: Player,
  actor: FighterState,
  target: FighterState,
): SkillState[] {
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
    const av = (at?.basePower ?? 0) + a.level * 6 - (at?.manaCost ?? 0) * 0.05;
    const bv = (bt?.basePower ?? 0) + b.level * 6 - (bt?.manaCost ?? 0) * 0.05;
    return bv - av;
  });
}

function performSkill(
  player: Player,
  actor: FighterState,
  target: FighterState,
  state: SkillState,
): { text: string; extraLogs: string[] } {
  const template = SKILL_MAP.get(state.templateId);
  if (!template) {
    return { text: "技能释放失败。", extraLogs: [] };
  }
  actor.mp -= template.manaCost;
  state.cooldownLeft = template.cooldown;
  const extraLogs: string[] = [];
  const attackPower = actor.attack;

  if (template.kind === "attack") {
    let damage = Math.floor(template.basePower + state.level * 11 + attackPower * template.scaling - target.defense * 0.46);
    damage = Math.max(1, damage);

    if (template.id === "warrior_fire_sword" && criticalHit(calcDerivedStats(player).luck)) {
      damage = Math.floor(damage * 1.45);
      target.hp -= damage;
      extraLogs.push(`【${template.name}】烈焰顺着剑脊爆燃，你踏步前压一剑贯胸，触发烈火暴击，造成 ${damage} 点爆裂伤害！`);
    } else if (template.id === "mage_thunder") {
      target.hp -= damage;
      if (Math.random() < 0.25) {
        target.statuses.shockBreak = 1;
        extraLogs.push("雷电麻痹了目标动作，下次普通攻击更容易打出重击。");
      }
      extraLogs.push(`【${template.name}】乌云压顶，雷柱直落命中目标，造成 ${damage} 点雷系伤害。`);
    } else if (template.id === "mage_blizzard") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】冰风怒卷，锋利冰锥持续切割目标，造成 ${damage} 点寒霜伤害。`);
    } else if (template.id === "warrior_half_moon") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】你横刀回旋，半月弧光炸开，斩出 ${damage} 点连段伤害。`);
    } else if (template.id === "warrior_charge") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】你沉肩突进把对手撞得踉跄，随即补上一击，共造成 ${damage} 点冲撞伤害。`);
    } else if (template.id === "warrior_attack_slash") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】你短暂蓄势后斜斩而下，剑气挟风压线推进，造成 ${damage} 点伤害。`);
    } else if (template.id === "mage_fireball") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】炽热火球拖出红光轨迹，精准砸中目标，造成 ${damage} 点火焰伤害。`);
    } else if (template.id === "taoist_talisman") {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】符纸化作幽光箭矢破空而去，在目标胸前炸裂，造成 ${damage} 点法术伤害。`);
    } else {
      target.hp -= damage;
      extraLogs.push(`【${template.name}】命中目标，造成 ${damage} 点伤害。`);
    }
  } else if (template.kind === "shield") {
    const rounds = template.duration + Math.floor(state.level / 3);
    actor.statuses.shieldRounds = rounds;
    actor.values.shieldPower = template.basePower + state.level * 7;
    extraLogs.push(`【${template.name}】你抬手结印，半透明护盾笼罩全身，将在 ${rounds} 回合内显著减伤。`);
  } else if (template.kind === "poison") {
    const rounds = template.duration + Math.floor(state.level / 3);
    const poisonDamage = template.basePower + Math.floor(attackPower * 0.26) + state.level * 4;
    target.statuses.poisonRounds = rounds;
    target.values.poisonDamage = poisonDamage;
    extraLogs.push(`【${template.name}】毒符没入敌体，黑雾沿血脉扩散，接下来 ${rounds} 回合每回合受到 ${poisonDamage} 点毒伤。`);
  } else if (template.kind === "heal") {
    const healAmount = template.basePower + Math.floor(attackPower * 0.55) + state.level * 10;
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmount);
    extraLogs.push(`【${template.name}】温润白光层层缠绕，你的伤势快速收拢，恢复 ${healAmount} 点生命。`);
  } else if (template.kind === "summon") {
    const rounds = template.duration + Math.floor(state.level / 2);
    actor.statuses.summonRounds = rounds;
    actor.values.summonDamage = template.basePower + Math.floor(attackPower * 0.24) + state.level * 5;
    extraLogs.push(`【${template.name}】法阵震鸣，神兽踏火降临，将在 ${rounds} 回合内持续撕咬敌人。`);
  } else {
    extraLogs.push(`【${template.name}】施放成功。`);
  }

  extraLogs.push(...addSkillTraining(state, randInt(8, 14)));
  return { text: extraLogs[0], extraLogs: extraLogs.slice(1) };
}

function normalAttack(actor: FighterState, target: FighterState, luck: number): string {
  let damage = Math.max(1, Math.floor(actor.attack + randInt(0, 8) - target.defense * 0.52));
  if (target.statuses.shockBreak) {
    damage = Math.floor(damage * 1.2);
    target.statuses.shockBreak = 0;
  }
  if (criticalHit(luck)) {
    damage = Math.floor(damage * 1.7);
    target.hp -= damage;
    return `你抓住破绽劈出暴击，刀锋带起火花，造成 ${damage} 点伤害。`;
  }
  target.hp -= damage;
  return `你打出一记平砍，造成 ${damage} 点伤害。`;
}

function monsterAttack(actor: FighterState, target: FighterState, text: string): string {
  let damage = Math.max(1, Math.floor(actor.attack + randInt(-4, 10) - target.defense * 0.48));
  if (target.statuses.shieldRounds && target.statuses.shieldRounds > 0) {
    const reduceRate = clamp(0.22 + (target.values.shieldPower ?? 0) / 230, 0.22, 0.65);
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
    logs.push(...ensureUnlockedSkills(player));
  }
  return logs;
}

const RARITY_LIST: Array<{ name: Equipment["rarity"]; weight: number }> = [
  { name: "普通", weight: 0.82 },
  { name: "精良", weight: 0.14 },
  { name: "稀有", weight: 0.035 },
  { name: "史诗", weight: 0.005 },
];

function rarityRoll(luck: number, tier: number): Equipment["rarity"] {
  const bonus = luck * 0.003 + tier * 0.006;
  const r = Math.random() + bonus;
  if (r > 1.08) {
    return "史诗";
  }
  if (r > 0.98) {
    return "稀有";
  }
  if (r > 0.82) {
    return "精良";
  }
  return "普通";
}

function generateEquipment(level: number, tier: number, luck: number): Equipment {
  const slot = SLOT_ORDER[randInt(0, SLOT_ORDER.length - 1)];
  const rarity = rarityRoll(luck, tier);
  const rarityMultiplier = {
    普通: 1,
    精良: 1.22,
    稀有: 1.48,
    史诗: 1.82,
  }[rarity];
  const base = Math.floor((level * 2 + randInt(2, 12)) * rarityMultiplier);

  let attack = 0;
  let defense = 0;
  let hp = 0;
  let mp = 0;
  let eqLuck = 0;
  let name = "无名装备";

  if (slot === "weapon") {
    attack = base + randInt(7, 20);
    mp = randInt(0, 12);
    eqLuck = randInt(0, 2);
    name = ["斩马刀", "井中月", "血饮", "龙纹剑", "骨玉权杖"][randInt(0, 4)];
  } else if (slot === "armor") {
    defense = base + randInt(8, 20);
    hp = randInt(30, 80);
    eqLuck = randInt(0, 1);
    name = ["战神盔甲", "幽灵战衣", "恶魔长袍", "天魔神甲"][randInt(0, 3)];
  } else if (slot === "helmet") {
    defense = Math.floor(base * 0.85) + randInt(5, 15);
    hp = randInt(18, 45);
    name = ["黑铁头盔", "道士头盔", "法神头盔", "圣战头盔"][randInt(0, 3)];
  } else if (slot === "necklace") {
    attack = Math.floor(base * 0.35) + randInt(2, 8);
    mp = randInt(15, 40);
    eqLuck = randInt(1, 3);
    name = ["灯笼项链", "幽灵项链", "绿色项链", "恶魔铃铛"][randInt(0, 3)];
  } else if (slot === "leftBracelet" || slot === "rightBracelet") {
    attack = Math.floor(base * 0.28) + randInt(1, 7);
    defense = Math.floor(base * 0.24) + randInt(1, 5);
    hp = randInt(8, 24);
    name = ["坚固手套", "死神手套", "龙之手镯", "三眼手镯"][randInt(0, 3)];
  } else if (slot === "leftRing" || slot === "rightRing") {
    attack = Math.floor(base * 0.32) + randInt(2, 9);
    mp = randInt(10, 24);
    eqLuck = randInt(0, 2);
    name = ["力量戒指", "紫碧螺", "泰坦戒指", "骑士手镯"][randInt(0, 3)];
  } else if (slot === "belt") {
    defense = Math.floor(base * 0.4) + randInt(2, 8);
    hp = randInt(26, 58);
    name = ["战神腰带", "魔血腰带", "天师腰带", "雷霆腰带"][randInt(0, 3)];
  } else {
    defense = Math.floor(base * 0.4) + randInt(2, 8);
    hp = randInt(20, 48);
    mp = randInt(8, 18);
    name = ["战神靴", "疾风靴", "魔血靴", "圣战靴"][randInt(0, 3)];
  }

  const isElite = Math.random() < clamp(0.03 + luck * 0.006, 0.03, 0.12);
  const eliteBonus: Equipment["eliteBonus"] = {};
  if (isElite) {
    const roll = randInt(0, 4);
    if (roll === 0) {
      eliteBonus.attack = randInt(3, 10);
    } else if (roll === 1) {
      eliteBonus.defense = randInt(3, 10);
    } else if (roll === 2) {
      eliteBonus.hp = randInt(22, 60);
    } else if (roll === 3) {
      eliteBonus.mp = randInt(18, 45);
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
    attack,
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

export function runAutoBattle(
  player: Player,
  area: MapArea,
  monster: MapArea["monsters"][number],
  verbose: boolean,
): CombatResult {
  ensureUnlockedSkills(player);
  resetSkillCooldown(player);

  const stats = calcDerivedStats(player);
  const actor: FighterState = {
    hp: clamp(player.hp, 1, stats.maxHp),
    mp: clamp(player.mp, 0, stats.maxMp),
    maxHp: stats.maxHp,
    maxMp: stats.maxMp,
    attack: stats.attack,
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
    defense: monster.defense,
    statuses: {},
    values: {},
  };
  const logs: string[] = [];
  let round = 1;

  while (actor.hp > 0 && target.hp > 0 && round <= 45) {
    if (verbose) {
      logs.push(`[第${round}回合] 你 HP ${actor.hp}/${actor.maxHp} MP ${actor.mp}/${actor.maxMp} | ${monster.name} HP ${target.hp}/${target.maxHp}`);
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
      const skillResult = performSkill(player, actor, target, chosen);
      logs.push(skillResult.text);
      logs.push(...skillResult.extraLogs);
    } else {
      logs.push(normalAttack(actor, target, stats.luck));
    }

    if (actor.statuses.summonRounds && actor.statuses.summonRounds > 0 && target.hp > 0) {
      let summonDamage = (actor.values.summonDamage ?? 0) + randInt(-4, 8);
      summonDamage = Math.max(1, summonDamage - Math.floor(target.defense * 0.18));
      target.hp -= summonDamage;
      logs.push(`神兽凌空扑击，利爪撕开血痕，再造成 ${summonDamage} 点伤害。`);
      actor.statuses.summonRounds -= 1;
    }

    if (target.hp <= 0) {
      break;
    }

    logs.push(monsterAttack(target, actor, monster.skillText));
    reduceCooldowns(player);
    if (actor.statuses.shieldRounds && actor.statuses.shieldRounds > 0) {
      actor.statuses.shieldRounds -= 1;
    }
    round += 1;
  }

  const win = actor.hp > 0 && target.hp <= 0;
  player.hp = clamp(actor.hp, 0, calcDerivedStats(player).maxHp);
  player.mp = clamp(actor.mp, 0, calcDerivedStats(player).maxMp);

  if (win) {
    const goldGain = Math.floor(monster.gold * randFloat(0.76, 1.03));
    const expGain = Math.floor(monster.exp * randFloat(0.8, 1.06));
    logs.push(...grantReward(player, expGain, goldGain));
    logs.push(...gainBattleTraining(player));

    const drops: string[] = [];
    if (Math.random() < clamp(0.08 + calcDerivedStats(player).luck * 0.007, 0.08, 0.2)) {
      const equipment = generateEquipment(monster.level, area.dropTier, calcDerivedStats(player).luck);
      player.bag.push(equipment);
      drops.push(`掉落装备：${formatEquipment(equipment)}`);
    }
    if (Math.random() < 0.14) {
      const itemPool: ItemName[] = ["金创药", "魔法药", "修炼卷轴", "强化石"];
      const itemName = itemPool[randInt(0, itemPool.length - 1)];
      const count = itemName === "金创药" ? randInt(1, 2) : 1;
      player.inventory[itemName] += count;
      drops.push(`掉落物品：${itemName} x${count}`);
    }
    logs.push(...drops);
    keepResourceInRange(player);
    return { win: true, logs, exp: expGain, gold: goldGain, drops };
  }

  const penalty = Math.floor(player.gold * 0.08);
  player.gold = Math.max(0, player.gold - penalty);
  player.hp = Math.floor(calcDerivedStats(player).maxHp * 0.4);
  player.mp = Math.floor(calcDerivedStats(player).maxMp * 0.35);
  logs.push(`你被击败，遗失金币 ${penalty}，勉强撤离战场。`);
  keepResourceInRange(player);
  return { win: false, logs, exp: 0, gold: -penalty, drops: [] };
}

export function getAvailableMaps(level: number): MapArea[] {
  return MAPS.filter((item) => level >= item.minLevel);
}

export function pickRandomMonster(area: MapArea): MapArea["monsters"][number] {
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

export function updatePotionConfig(
  player: Player,
  patch: Partial<Player["potionConfig"]>,
): string {
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

export function tryStrengthen(
  player: Player,
  slot: EquipmentSlot,
  preferStone: boolean,
): string {
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
  return `作弊生效：所有道具 +${count}。`;
}

export function cheatLevelUp(player: Player, levels = 1): string {
  const step = Math.max(1, Math.floor(levels));
  player.level += step;
  const learnLogs = ensureUnlockedSkills(player);
  const stats = calcDerivedStats(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;
  return `作弊生效：等级提升到 Lv.${player.level}。${learnLogs.join(" ")}`;
}

export function cheatUnlockAllSkills(player: Player): string {
  const templates = getProfessionTemplates(player.profession);
  const needLevel = templates.reduce((max, item) => Math.max(max, item.unlockLevel), player.level);
  player.level = needLevel;
  const learnLogs = ensureUnlockedSkills(player);
  return learnLogs.length > 0
    ? `作弊生效：已解锁全部职业技能。${learnLogs.join(" ")}`
    : "作弊生效：当前已拥有全部职业技能。";
}

export function cheatGenerateEquipment(player: Player, count = 4): string {
  const n = Math.max(1, Math.floor(count));
  const luck = calcDerivedStats(player).luck;
  for (let i = 0; i < n; i += 1) {
    player.bag.push(generateEquipment(player.level + randInt(0, 2), 4, luck + 2));
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
