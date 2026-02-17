import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  AfkResult,
  AfkSession,
  Equipment,
  EquipmentSlot,
  GameSaveData,
  ItemName,
  Player,
  Profession,
  SecretRealmRecord,
} from "./types";
import {
  buyShopItem,
  calcDerivedStats,
  challengeSecretRealm,
  cheatAddGold,
  cheatAddItems,
  cheatGenerateEquipment,
  cheatGenerateSetEquipment,
  cheatHeal,
  cheatLevelUp,
  cheatUnlockAllSkills,
  createPlayer,
  equipFromBag,
  expToNextLevel,
  formatEquipment,
  getAllSets,
  getAvailableMaps,
  getAvailableSecretRealms,
  getEquipmentStat,
  getMaps,
  getProfessionSkillBook,
  getSecretRealmCooldown,
  getSetStatuses,
  getShopItems,
  getTrainingNeed,
  getSlotName,
  learnSkillByBook,
  pickRandomMonster,
  restorePlayer,
  runAutoBattle,
  sellAllEquipment,
  sellNonRecommendedEquipment,
  toggleSkillAuto,
  trainSkillByScroll,
  tryStrengthen,
  updatePotionConfig,
  useLuckyOil,
  usePotion,
} from "./engine";
import { loadEncryptedJSON, removeEncryptedJSON, saveEncryptedJSON } from "./secureStorage";

const STORAGE_KEY = "wei-legend-save-v2";
const LEGACY_STORAGE_KEY = "wei-legend-save-v1";
const AFK_MINUTE_MS = 8000;
const AFK_MINUTE_SECONDS = 60;
const AFK_BATTLE_SECONDS_MIN = 12;
const AFK_BATTLE_SECONDS_MAX = 24;
const AFK_BATTLE_COUNT_MIN = Math.floor(AFK_MINUTE_SECONDS / AFK_BATTLE_SECONDS_MAX);
const AFK_BATTLE_COUNT_MAX = Math.ceil(AFK_MINUTE_SECONDS / AFK_BATTLE_SECONDS_MIN);
const BATTLE_LINE_MS = 1000;
const AFK_LINE_MS = 360;
const MAX_LOG_LINES = 1800;

function trimLogs(list: string[]): string[] {
  if (list.length <= MAX_LOG_LINES) {
    return list;
  }
  return list.slice(list.length - MAX_LOG_LINES);
}

function createEmptyAfkResult(totalMinutes: number): AfkResult {
  return {
    wins: 0,
    fails: 0,
    exp: 0,
    gold: 0,
    drops: [],
    logs: [],
    processedMinutes: 0,
    totalMinutes,
    offlineMinutes: 0,
  };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

function scoreEquipmentByProfession(item: Equipment, profession: Profession): number {
  const attack = getEquipmentStat(item, "attack");
  const magic = getEquipmentStat(item, "magic");
  const tao = getEquipmentStat(item, "tao");
  const speed = getEquipmentStat(item, "attackSpeed");
  const defense = getEquipmentStat(item, "defense");
  const hp = getEquipmentStat(item, "hp");
  const mp = getEquipmentStat(item, "mp");
  const luck = getEquipmentStat(item, "luck");

  let score = 0;
  if (profession === "战士") {
    score += attack * 1.7 + speed * 220 + defense * 0.75 + hp * 0.16 + luck * 2.2;
  } else if (profession === "法师") {
    score += magic * 1.75 + speed * 190 + mp * 0.2 + defense * 0.58 + luck * 2;
  } else {
    score += tao * 1.75 + speed * 190 + hp * 0.14 + mp * 0.14 + defense * 0.62 + luck * 2;
  }

  if (item.special === "paralyze") {
    score += profession === "战士" ? 70 : 42;
  }
  if (item.setId) {
    score += 10;
  }
  score += item.strengthen * 4;
  return Math.round(score * 10) / 10;
}

export function useWeiLegend() {
  const player = ref<Player | null>(null);
  const battleLogs = ref<string[]>([]);
  const battleStreaming = ref(false);
  const afkLogs = ref<string[]>([]);
  const afkStreaming = ref(false);
  const notice = ref("欢迎来到维传奇，创建角色后即可开始冒险。");
  const afkResult = ref<AfkResult | null>(null);
  const afkSession = ref<AfkSession | null>(null);
  const secretRealmRecords = ref<Record<string, SecretRealmRecord>>({});

  const battleMapId = ref(getMaps()[0].id);
  const afkMapId = ref(getMaps()[0].id);
  const afkMinutes = ref(30);
  const preferStrengthStone = ref(true);

  const maps = getMaps();
  const shopItems = getShopItems();

  const availableMaps = computed(() => {
    if (!player.value) {
      return maps.slice(0, 1);
    }
    return getAvailableMaps(player.value.level);
  });

  const stats = computed(() => {
    if (!player.value) {
      return null;
    }
    return calcDerivedStats(player.value);
  });

  const setRows = computed(() => {
    if (!player.value) {
      return [];
    }
    return getSetStatuses(player.value);
  });
  const activeSetIds = computed(() => {
    const ids = new Set<string>();
    setRows.value.forEach((row) => {
      if (row.activeTierCount > 0) {
        ids.add(row.id);
      }
    });
    return ids;
  });

  const slotRecommendations = computed(() => {
    if (!player.value) {
      return new Map<EquipmentSlot, { source: "equipped" | "bag"; score: number; bagIndex?: number; name: string }>();
    }
    const result = new Map<EquipmentSlot, { source: "equipped" | "bag"; score: number; bagIndex?: number; name: string }>();

    SLOT_ORDER.forEach((slot) => {
      const equipped = player.value?.equipments[slot];
      if (equipped) {
        result.set(slot, {
          source: "equipped",
          score: scoreEquipmentByProfession(equipped, player.value!.profession),
          name: equipped.name,
        });
      }
    });

    player.value.bag.forEach((item, index) => {
      if ((player.value?.level ?? 0) < item.levelReq) {
        return;
      }
      const score = scoreEquipmentByProfession(item, player.value!.profession);
      const current = result.get(item.slot);
      if (!current || score > current.score + 0.1) {
        result.set(item.slot, {
          source: "bag",
          score,
          bagIndex: index,
          name: item.name,
        });
      }
    });
    return result;
  });

  const skillRows = computed(() => {
    if (!player.value) {
      return [];
    }
    const templates = getProfessionSkillBook(player.value.profession);
    return templates.map((template) => {
      const state = player.value?.skills[template.id];
      return {
        id: template.id,
        name: template.name,
        desc: template.description,
        manaCost: template.manaCost,
        cooldown: template.cooldown,
        unlockLevel: template.unlockLevel,
        bookName: template.bookName,
        bookOwned: player.value?.skillBooks[template.id] ?? 0,
        canLearn:
          !state &&
          (player.value?.skillBooks[template.id] ?? 0) > 0 &&
          (player.value?.level ?? 0) >= template.unlockLevel,
        learned: Boolean(state),
        level: state?.level ?? 0,
        training: state?.training ?? 0,
        trainingNeed: state ? getTrainingNeed(state.level) : 0,
        autoUse: state?.autoUse ?? false,
      };
    });
  });

  const inventoryRows = computed(() => {
    if (!player.value) {
      return [];
    }
    return (Object.keys(player.value.inventory) as ItemName[]).map((name) => ({
      name,
      count: player.value?.inventory[name] ?? 0,
    }));
  });

  const equippedRows = computed(() => {
    if (!player.value) {
      return [];
    }
    return SLOT_ORDER.map((slot) => {
      const equipment = player.value?.equipments[slot] ?? null;
      const equipScore = equipment ? scoreEquipmentByProfession(equipment, player.value!.profession) : 0;
      const recommended = slotRecommendations.value.get(slot);
      const recommendFromBag = recommended?.source === "bag" ? recommended : null;
      const recommendDiff = recommendFromBag ? Math.max(0, Math.round((recommendFromBag.score - equipScore) * 10) / 10) : 0;
      return {
        slot,
        slotName: getSlotName(slot),
        equipment,
        rarity: equipment?.rarity ?? null,
        setName: equipment?.setName ?? null,
        setColor: equipment?.setColor ?? null,
        isSetPiece: Boolean(equipment?.setId),
        setActive: Boolean(equipment?.setId && activeSetIds.value.has(equipment.setId)),
        score: equipScore,
        recommendName: recommendDiff > 0 ? recommendFromBag?.name ?? null : null,
        recommendDiff,
        name: equipment?.name ?? "(空)",
        text: equipment ? formatEquipment(equipment) : "(空)",
      };
    });
  });

  const bagRows = computed(() => {
    if (!player.value) {
      return [];
    }
    return player.value.bag.map((item, index) => ({
      index,
      slot: item.slot,
      text: formatEquipment(item),
      levelReq: item.levelReq,
      slotName: getSlotName(item.slot),
      rarity: item.rarity,
      setName: item.setName ?? null,
      setColor: item.setColor ?? null,
      isSetPiece: Boolean(item.setId),
      setActive: Boolean(item.setId && activeSetIds.value.has(item.setId)),
      score: scoreEquipmentByProfession(item, player.value!.profession),
      recommended: slotRecommendations.value.get(item.slot)?.source === "bag" && slotRecommendations.value.get(item.slot)?.bagIndex === index,
      name: item.name,
      strengthen: item.strengthen,
      canEquip: (player.value?.level ?? 0) >= item.levelReq,
    }));
  });

  const bagGroups = computed(() => {
    if (!player.value) {
      return [];
    }
    return SLOT_ORDER.map((slot) => ({
      slot,
      slotName: getSlotName(slot),
      rows: bagRows.value.filter((row) => row.slot === slot),
    })).filter((group) => group.rows.length > 0);
  });

  const recommendedBagIndices = computed(() => {
    const indices = new Set<number>();
    slotRecommendations.value.forEach((rec) => {
      if (rec.source === "bag" && rec.bagIndex !== undefined) {
        indices.add(rec.bagIndex);
      }
    });
    return indices;
  });

  const afkRunning = computed(() => afkSession.value?.running === true);

  const afkProgress = computed(() => {
    const session = afkSession.value;
    if (!session || session.totalMinutes <= 0) {
      return 0;
    }
    return Math.floor((session.doneMinutes / session.totalMinutes) * 100);
  });

  const clearTempPanels = () => {
    stopBattleStream();
    stopAfkStream(true);
    battleLogs.value = [];
    afkLogs.value = [];
    afkResult.value = null;
  };

  const syncMapSelection = () => {
    const currentMaps = availableMaps.value;
    if (!currentMaps.some((item) => item.id === battleMapId.value)) {
      battleMapId.value = currentMaps[0]?.id ?? maps[0].id;
    }
    if (!currentMaps.some((item) => item.id === afkMapId.value)) {
      afkMapId.value = currentMaps[0]?.id ?? maps[0].id;
    }
  };

  let saveTimer: number | null = null;
  let saveInFlight = false;
  let savePending = false;
  let initialized = false;
  let afkTimer: number | null = null;
  let visibilityHandler: (() => void) | null = null;
  let battleStreamTimer: number | null = null;
  let afkStreamTimer: number | null = null;
  const afkLogQueue: string[] = [];

  const buildSaveData = (): GameSaveData => ({
    player: player.value,
    afkSession: afkSession.value,
    afkResult: afkResult.value,
    secretRealmRecords: secretRealmRecords.value,
  });

  const persistNow = async () => {
    if (saveInFlight) {
      savePending = true;
      return;
    }
    saveInFlight = true;
    try {
      if (!player.value) {
        removeEncryptedJSON(STORAGE_KEY);
      } else {
        await saveEncryptedJSON(STORAGE_KEY, buildSaveData());
      }
    } finally {
      saveInFlight = false;
      if (savePending) {
        savePending = false;
        await persistNow();
      }
    }
  };

  const scheduleSave = () => {
    if (!initialized) {
      return;
    }
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      void persistNow();
    }, 260);
  };

  const stopAfkTimer = () => {
    if (afkTimer) {
      window.clearInterval(afkTimer);
      afkTimer = null;
    }
  };

  const stopBattleStream = () => {
    if (battleStreamTimer) {
      window.clearTimeout(battleStreamTimer);
      battleStreamTimer = null;
    }
    battleStreaming.value = false;
  };

  const streamBattleLines = (lines: string[]) => {
    stopBattleStream();
    battleLogs.value = [];
    battleStreaming.value = true;
    let index = 0;

    const tick = () => {
      if (index >= lines.length) {
        stopBattleStream();
        return;
      }
      // 处理套装颜色标记
      let line = lines[index];
      line = line.replace(/<set-entry>(.*?)<\/set-entry>/g, '<span class="combat-set-entry">$1</span>');
      line = line.replace(/<set-advanced>(.*?)<\/set-advanced>/g, '<span class="combat-set-advanced">$1</span>');
      battleLogs.value = trimLogs([...battleLogs.value, line]);
      index += 1;
      battleStreamTimer = window.setTimeout(tick, BATTLE_LINE_MS);
    };

    tick();
  };

  const stopAfkStream = (clearQueue = false) => {
    if (afkStreamTimer) {
      window.clearTimeout(afkStreamTimer);
      afkStreamTimer = null;
    }
    afkStreaming.value = false;
    if (clearQueue) {
      afkLogQueue.length = 0;
    }
  };

  const pushAfkLogs = (logs: string[]) => {
    if (logs.length === 0) {
      return;
    }
    afkLogQueue.push(...logs);
    if (afkStreamTimer) {
      return;
    }

    const tick = () => {
      if (afkLogQueue.length === 0) {
        stopAfkStream();
        return;
      }
      afkStreaming.value = true;
      const line = afkLogQueue.shift();
      if (line) {
        afkLogs.value = trimLogs([...afkLogs.value, line]);
      }
      afkStreamTimer = window.setTimeout(tick, AFK_LINE_MS);
    };

    tick();
  };

  const stopAfk = (manual = false) => {
    if (!afkSession.value) {
      return;
    }
    afkSession.value.running = false;
    stopAfkTimer();
    if (manual) {
      notice.value = "挂机已手动停止。";
    }
  };

  const processOneAfkMinute = (mode: "realtime" | "offline"): boolean => {
    if (!player.value || !afkSession.value || !afkSession.value.running) {
      return false;
    }
    const session = afkSession.value;
    const area = maps.find((item) => item.id === session.mapId);
    if (!area) {
      stopAfk();
      notice.value = "挂机地图不存在，已自动停止。";
      return false;
    }
    if (player.value.level < area.minLevel) {
      stopAfk();
      notice.value = `挂机停止：等级不足，需 Lv.${area.minLevel} 才能进入${area.name}。`;
      return false;
    }

    const offlineRate = mode === "offline" ? 0.75 : 1;
    const minuteNo = session.doneMinutes + 1;
    const minuteTitle =
      mode === "offline"
        ? `[离线挂机·第${minuteNo}分钟·收益75%·按战斗耗时推进]`
        : `[挂机·第${minuteNo}分钟·按战斗耗时推进]`;
    const minuteLogs: string[] = [minuteTitle];

    if (!afkResult.value) {
      afkResult.value = createEmptyAfkResult(session.totalMinutes);
    }

    let failedThisMinute = false;
    let battleIndex = 0;
    let spentSeconds = 0;
    while (spentSeconds < AFK_MINUTE_SECONDS) {
      if (battleIndex > 0 && spentSeconds + AFK_BATTLE_SECONDS_MIN > AFK_MINUTE_SECONDS) {
        break;
      }
      battleIndex += 1;
      const rawBattleSeconds = randInt(AFK_BATTLE_SECONDS_MIN, AFK_BATTLE_SECONDS_MAX);
      const battleSeconds = Math.min(rawBattleSeconds, AFK_MINUTE_SECONDS - spentSeconds);
      spentSeconds += battleSeconds;

      const monster = pickRandomMonster(area);
      const result = runAutoBattle(player.value, area, monster, true, {
        rewardRate: offlineRate,
        dropRate: offlineRate,
      });
      const bossTag = monster.isBoss ? "[Boss]" : "";
      const battleTitle = `第${battleIndex}战（耗时${battleSeconds}秒）：你在【${area.name}】遭遇${bossTag}【${monster.name}】。`;
      minuteLogs.push(battleTitle, ...result.logs);

      afkResult.value.wins += result.win ? 1 : 0;
      afkResult.value.fails += result.win ? 0 : 1;
      afkResult.value.exp += result.exp;
      afkResult.value.gold += result.gold;
      afkResult.value.drops.push(...result.drops);

      if (result.win && player.value) {
        const s = calcDerivedStats(player.value);
        player.value.hp = Math.min(s.maxHp, player.value.hp + Math.floor(s.maxHp * 0.12));
        player.value.mp = Math.min(s.maxMp, player.value.mp + Math.floor(s.maxMp * 0.15));
      } else {
        failedThisMinute = true;
        break;
      }
    }
    minuteLogs.push(`本分钟战斗耗时 60 秒，完成 ${battleIndex} 战。`);

    pushAfkLogs(minuteLogs);
    afkResult.value.logs = trimLogs([...afkResult.value.logs, ...minuteLogs]);
    afkResult.value.processedMinutes += 1;
    if (mode === "offline") {
      afkResult.value.offlineMinutes += 1;
    }

    session.doneMinutes += 1;
    session.lastTickAt = Date.now();

    if (failedThisMinute || session.doneMinutes >= session.totalMinutes) {
      stopAfk();
      notice.value = !failedThisMinute
        ? `挂机结束：胜利 ${afkResult.value.wins} 场，经验 ${afkResult.value.exp}，金币 ${afkResult.value.gold}。`
        : "挂机中途失败，已自动停止。";
      return false;
    }

    notice.value = `挂机进行中：${session.doneMinutes}/${session.totalMinutes} 分钟（按战斗耗时推进）`;
    return true;
  };

  const startAfkTimer = () => {
    stopAfkTimer();
    afkTimer = window.setInterval(() => {
      const keep = processOneAfkMinute("realtime");
      if (!keep) {
        stopAfkTimer();
      }
    }, AFK_MINUTE_MS);
  };

  const catchupOfflineAfk = () => {
    if (!afkSession.value || !afkSession.value.running) {
      return;
    }
    const session = afkSession.value;
    const now = Date.now();
    const elapsed = Math.floor((now - session.lastTickAt) / AFK_MINUTE_MS);
    const left = session.totalMinutes - session.doneMinutes;
    const pending = Math.max(0, Math.min(left, elapsed));

    if (pending > 0) {
      for (let i = 0; i < pending; i += 1) {
        const keep = processOneAfkMinute("offline");
        if (!keep) {
          break;
        }
      }
      if (afkResult.value) {
        notice.value = `已补算离线挂机 ${afkResult.value.offlineMinutes} 分钟。`;
      }
    }

    if (afkSession.value?.running) {
      startAfkTimer();
    }
  };

  const loadSavedGame = async () => {
    const encrypted = await loadEncryptedJSON<GameSaveData>(STORAGE_KEY);
    if (encrypted && encrypted.player) {
      const restored = restorePlayer(encrypted.player);
      if (restored) {
        player.value = restored;
        afkSession.value = encrypted.afkSession ?? null;
        afkResult.value = encrypted.afkResult ?? null;
        secretRealmRecords.value = encrypted.secretRealmRecords ?? {};
        stopAfkStream(true);
        afkLogs.value = encrypted.afkResult?.logs ?? [];
        notice.value = `已读取加密存档：${restored.name}（${restored.profession}）`;
        return;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return;
    }
    try {
      const parsed = JSON.parse(legacyRaw) as unknown;
      const candidate =
        parsed && typeof parsed === "object" && "player" in (parsed as Record<string, unknown>)
          ? (parsed as { player?: unknown }).player
          : parsed;
      const restored = restorePlayer(candidate);
      if (restored) {
        player.value = restored;
        notice.value = `已迁移旧存档：${restored.name}（${restored.profession}）`;
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  };

  void (async () => {
    await loadSavedGame();
    syncMapSelection();
    initialized = true;
    scheduleSave();
    if (afkSession.value?.running) {
      catchupOfflineAfk();
    }
  })();

  watch(
    [player, afkSession, afkResult, secretRealmRecords],
    () => {
      scheduleSave();
    },
    { deep: true },
  );

  watch(
    availableMaps,
    () => {
      syncMapSelection();
    },
    { deep: true },
  );

  onMounted(() => {
    visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        catchupOfflineAfk();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  });

  onBeforeUnmount(() => {
    stopAfkTimer();
    stopBattleStream();
    stopAfkStream(true);
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
  });

  const createCharacter = (name: string, profession: Profession) => {
    stopAfk();
    player.value = createPlayer(name, profession);
    afkSession.value = null;
    clearTempPanels();
    notice.value = `角色创建成功：${player.value.name}（${player.value.profession}）`;
    syncMapSelection();
  };

  const restart = () => {
    stopAfk();
    player.value = null;
    afkSession.value = null;
    clearTempPanels();
    notice.value = "存档已清空，请重新创建角色。";
    removeEncryptedJSON(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  };

  const challengeOne = () => {
    if (!player.value) {
      return;
    }
    const area = maps.find((item) => item.id === battleMapId.value);
    if (!area) {
      notice.value = "地图不存在。";
      return;
    }
    if (player.value.level < area.minLevel) {
      notice.value = `等级不足，需 Lv.${area.minLevel} 才能进入${area.name}。`;
      return;
    }
    const monster = pickRandomMonster(area);
    const result = runAutoBattle(player.value, area, monster, true);
    const bossText = monster.isBoss ? "[Boss]" : "";
    streamBattleLines([`你进入【${area.name}】，遭遇了${bossText}【${monster.name}】！`, ...result.logs]);
    notice.value = result.win
      ? `战斗胜利，获得经验 ${result.exp}，金币 ${result.gold}。`
      : "战斗失败，已自动撤离。";
    syncMapSelection();
  };

  const startAfk = () => {
    if (!player.value) {
      return;
    }
    if (afkSession.value?.running) {
      notice.value = "挂机进行中，请先停止当前挂机。";
      return;
    }

    const area = maps.find((item) => item.id === afkMapId.value);
    if (!area) {
      notice.value = "地图不存在。";
      return;
    }
    if (player.value.level < area.minLevel) {
      notice.value = `等级不足，需 Lv.${area.minLevel} 才能进入${area.name}。`;
      return;
    }

    const minutes = Math.max(1, Math.min(720, Math.floor(afkMinutes.value)));
    afkSession.value = {
      running: true,
      mapId: area.id,
      totalMinutes: minutes,
      doneMinutes: 0,
      startedAt: Date.now(),
      lastTickAt: Date.now(),
    };
    afkResult.value = createEmptyAfkResult(minutes);
    stopAfkStream(true);
    afkLogs.value = [`开始挂机：地图【${area.name}】，计划 ${minutes} 分钟。`];
    notice.value = `挂机已开始：1分钟挂机=${AFK_MINUTE_MS / 1000}秒现实时间，按战斗耗时约${AFK_BATTLE_COUNT_MIN}-${AFK_BATTLE_COUNT_MAX}战。`;
    startAfkTimer();
  };

  const equipByIndex = (index: number) => {
    if (!player.value) {
      return;
    }
    notice.value = equipFromBag(player.value, index);
  };

  const strengthenBySlot = (slot: EquipmentSlot) => {
    if (!player.value) {
      return;
    }
    notice.value = tryStrengthen(player.value, slot, preferStrengthStone.value);
  };

  const toggleAuto = (skillId: string) => {
    if (!player.value) {
      return;
    }
    notice.value = toggleSkillAuto(player.value, skillId);
  };

  const learnSkill = (skillId: string) => {
    if (!player.value) {
      return;
    }
    notice.value = learnSkillByBook(player.value, skillId);
  };

  const trainSkill = (skillId: string) => {
    if (!player.value) {
      return;
    }
    notice.value = trainSkillByScroll(player.value, skillId);
  };

  const buyItem = (itemName: ItemName, count: number) => {
    if (!player.value) {
      return;
    }
    notice.value = buyShopItem(player.value, itemName, count);
  };

  const useHpPotion = () => {
    if (!player.value) {
      return;
    }
    notice.value = usePotion(player.value, "金创药");
  };

  const useMpPotion = () => {
    if (!player.value) {
      return;
    }
    notice.value = usePotion(player.value, "魔法药");
  };

  const oilWeapon = () => {
    if (!player.value) {
      return;
    }
    notice.value = useLuckyOil(player.value);
  };

  const setAutoHpEnabled = (value: boolean) => {
    if (!player.value) {
      return;
    }
    notice.value = updatePotionConfig(player.value, { autoHpEnabled: value });
  };

  const setAutoMpEnabled = (value: boolean) => {
    if (!player.value) {
      return;
    }
    notice.value = updatePotionConfig(player.value, { autoMpEnabled: value });
  };

  const setAutoHpThreshold = (value: number) => {
    if (!player.value) {
      return;
    }
    updatePotionConfig(player.value, { autoHpThreshold: value });
  };

  const setAutoMpThreshold = (value: number) => {
    if (!player.value) {
      return;
    }
    updatePotionConfig(player.value, { autoMpThreshold: value });
  };

  const doCheatAddGold = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatAddGold(player.value, 100000);
  };

  const doCheatHeal = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatHeal(player.value);
  };

  const doCheatAddItems = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatAddItems(player.value, 20);
  };

  const doCheatLevelUp = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatLevelUp(player.value, 1);
  };

  const doCheatUnlockSkills = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatUnlockAllSkills(player.value);
  };

  const doCheatSpawnGear = () => {
    if (!player.value) {
      return;
    }
    notice.value = cheatGenerateEquipment(player.value, 4);
  };

  const doCheatSpawnSet = (setId: string) => {
    if (!player.value) {
      return;
    }
    notice.value = cheatGenerateSetEquipment(player.value, setId);
  };

  const sellAllGear = () => {
    if (!player.value) {
      return;
    }
    notice.value = sellAllEquipment(player.value);
  };

  const sellNonRecommendedGear = () => {
    if (!player.value) {
      return;
    }
    notice.value = sellNonRecommendedEquipment(player.value, recommendedBagIndices.value);
  };

  const availableSets = computed(() => {
    if (!player.value) {
      return [];
    }
    return getAllSets().filter((set) => (set.professions || []).includes(player.value!.profession));
  });

  const availableSecretRealms = computed(() => {
    if (!player.value) {
      return [];
    }
    return getAvailableSecretRealms(player.value.level);
  });

  const secretRealmRows = computed(() => {
    if (!player.value) {
      return [];
    }
    return availableSecretRealms.value.map((realm) => {
      const cooldown = getSecretRealmCooldown(realm.id, secretRealmRecords.value);
      return {
        id: realm.id,
        name: realm.name,
        description: realm.description,
        minLevel: realm.minLevel,
        cooldownMinutes: realm.cooldownMinutes,
        isReady: cooldown.isReady,
        remainingMinutes: cooldown.remainingMinutes,
        totalChallenges: secretRealmRecords.value[realm.id]?.totalChallenges || 0,
      };
    });
  });

  const doChallenge秘境 = (realmId: string) => {
    if (!player.value) {
      return;
    }
    const cooldown = getSecretRealmCooldown(realmId, secretRealmRecords.value);
    if (!cooldown.isReady) {
      notice.value = `秘境冷却中，还需 ${cooldown.remainingMinutes} 分钟。`;
      return;
    }

    const { result, record } = challengeSecretRealm(player.value, realmId, secretRealmRecords.value);
    secretRealmRecords.value[realmId] = record;

    const realm = availableSecretRealms.value.find((r) => r.id === realmId);
    const bossText = realm ? `【${realm.name}】` : "";
    streamBattleLines([`你进入${bossText}，开始挑战秘境Boss！`, ...result.logs]);

    notice.value = result.win
      ? `秘境挑战成功！获得经验 ${result.exp}，金币 ${result.gold}。`
      : "秘境挑战失败，已自动撤离。";
    syncMapSelection();
  };

  return {
    player,
    maps,
    shopItems,
    stats,
    setRows,
    availableMaps,
    skillRows,
    inventoryRows,
    equippedRows,
    bagRows,
    bagGroups,
    battleLogs,
    battleStreaming,
    afkLogs,
    afkStreaming,
    notice,
    afkResult,
    afkSession,
    afkRunning,
    afkProgress,
    battleMapId,
    afkMapId,
    afkMinutes,
    preferStrengthStone,
    expToNextLevel,
    afkMinuteMs: AFK_MINUTE_MS,
    afkBattleRangeText: `${AFK_BATTLE_COUNT_MIN}-${AFK_BATTLE_COUNT_MAX}`,
    secretRealmRows,
    createCharacter,
    restart,
    challengeOne,
    doChallenge秘境,
    startAfk,
    stopAfk,
    equipByIndex,
    strengthenBySlot,
    learnSkill,
    toggleAuto,
    trainSkill,
    buyItem,
    useHpPotion,
    useMpPotion,
    oilWeapon,
    setAutoHpEnabled,
    setAutoMpEnabled,
    setAutoHpThreshold,
    setAutoMpThreshold,
    doCheatAddGold,
    doCheatHeal,
    doCheatAddItems,
    doCheatLevelUp,
    doCheatUnlockSkills,
    doCheatSpawnGear,
    doCheatSpawnSet,
    availableSets,
    sellAllGear,
    sellNonRecommendedGear,
  };
}
