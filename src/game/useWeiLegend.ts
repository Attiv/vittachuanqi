import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  AfkResult,
  AfkSession,
  EquipmentSlot,
  GameSaveData,
  ItemName,
  Player,
  Profession,
} from "./types";
import {
  buyShopItem,
  calcDerivedStats,
  cheatAddGold,
  cheatAddItems,
  cheatGenerateEquipment,
  cheatHeal,
  cheatLevelUp,
  cheatUnlockAllSkills,
  createPlayer,
  equipFromBag,
  expToNextLevel,
  formatEquipment,
  getAvailableMaps,
  getMaps,
  getProfessionSkillBook,
  getShopItems,
  getSlotName,
  pickRandomMonster,
  restorePlayer,
  runAutoBattle,
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

export function useWeiLegend() {
  const player = ref<Player | null>(null);
  const battleLogs = ref<string[]>([]);
  const battleStreaming = ref(false);
  const afkLogs = ref<string[]>([]);
  const afkStreaming = ref(false);
  const notice = ref("欢迎来到维传奇，创建角色后即可开始冒险。");
  const afkResult = ref<AfkResult | null>(null);
  const afkSession = ref<AfkSession | null>(null);

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
        learned: Boolean(state),
        level: state?.level ?? 0,
        training: state?.training ?? 0,
        trainingNeed: state ? 70 + state.level * 40 : 0,
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
    return (Object.keys(player.value.equipments) as EquipmentSlot[]).map((slot) => {
      const equipment = player.value?.equipments[slot] ?? null;
      return {
        slot,
        slotName: getSlotName(slot),
        equipment,
        rarity: equipment?.rarity ?? null,
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
      text: formatEquipment(item),
      levelReq: item.levelReq,
      slotName: getSlotName(item.slot),
      rarity: item.rarity,
      name: item.name,
      strengthen: item.strengthen,
      canEquip: (player.value?.level ?? 0) >= item.levelReq,
    }));
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
      battleLogs.value = trimLogs([...battleLogs.value, lines[index]]);
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

    const monster = pickRandomMonster(area);
    const result = runAutoBattle(player.value, area, monster, true);
    const minuteNo = session.doneMinutes + 1;
    const title = mode === "offline" ? `[离线挂机·第${minuteNo}分钟]` : `[挂机·第${minuteNo}分钟]`;
    pushAfkLogs([title, `你在【${area.name}】遭遇【${monster.name}】。`, ...result.logs]);

    if (!afkResult.value) {
      afkResult.value = createEmptyAfkResult(session.totalMinutes);
    }
    afkResult.value.wins += result.win ? 1 : 0;
    afkResult.value.fails += result.win ? 0 : 1;
    afkResult.value.exp += result.exp;
    afkResult.value.gold += result.gold;
    afkResult.value.drops.push(...result.drops);
    afkResult.value.logs = trimLogs([...afkResult.value.logs, title, ...result.logs]);
    afkResult.value.processedMinutes += 1;
    if (mode === "offline") {
      afkResult.value.offlineMinutes += 1;
    }

    session.doneMinutes += 1;
    session.lastTickAt = Date.now();

    if (result.win && player.value) {
      const s = calcDerivedStats(player.value);
      player.value.hp = Math.min(s.maxHp, player.value.hp + Math.floor(s.maxHp * 0.12));
      player.value.mp = Math.min(s.maxMp, player.value.mp + Math.floor(s.maxMp * 0.15));
    }

    if (!result.win || session.doneMinutes >= session.totalMinutes) {
      stopAfk();
      notice.value = result.win
        ? `挂机结束：胜利 ${afkResult.value.wins} 场，经验 ${afkResult.value.exp}，金币 ${afkResult.value.gold}。`
        : "挂机中途失败，已自动停止。";
      return false;
    }

    notice.value = `挂机进行中：${session.doneMinutes}/${session.totalMinutes} 分钟`;
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
    [player, afkSession, afkResult],
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
    streamBattleLines([`你进入【${area.name}】，遭遇了【${monster.name}】！`, ...result.logs]);
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
    notice.value = `挂机已开始，当前换算速度：1分钟挂机=${AFK_MINUTE_MS / 1000}秒现实时间。`;
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

  return {
    player,
    maps,
    shopItems,
    stats,
    availableMaps,
    skillRows,
    inventoryRows,
    equippedRows,
    bagRows,
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
    createCharacter,
    restart,
    challengeOne,
    startAfk,
    stopAfk,
    equipByIndex,
    strengthenBySlot,
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
  };
}
