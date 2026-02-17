<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { showConfirmDialog, showToast } from "vant";
import type { EquipmentSlot, Profession, Rarity } from "./game/types";
import { useWeiLegend } from "./game/useWeiLegend";

const {
  player,
  shopItems,
  stats,
  setRows,
  availableMaps,
  skillRows,
  inventoryRows,
  equippedRows,
  bagGroups,
  battleLogs,
  battleStreaming,
  afkLogs,
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
  afkMinuteMs,
  afkBattleRangeText,
  createCharacter,
  restart,
  challengeOne,
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
} = useWeiLegend();

const activeTab = ref(0);
const createForm = reactive<{ name: string; profession: Profession }>({
  name: "",
  profession: "战士",
});

const shopCount = reactive<Record<string, number>>({});
for (const item of shopItems) {
  shopCount[item.name] = 1;
}

const hpPercent = computed(() => {
  const p = player.value;
  const s = stats.value;
  if (!p || !s) {
    return 0;
  }
  return Math.floor((p.hp / Math.max(1, s.maxHp)) * 100);
});

const mpPercent = computed(() => {
  const p = player.value;
  const s = stats.value;
  if (!p || !s) {
    return 0;
  }
  return Math.floor((p.mp / Math.max(1, s.maxMp)) * 100);
});

const expPercent = computed(() => {
  const p = player.value;
  if (!p) {
    return 0;
  }
  return Math.floor((p.exp / expToNextLevel(p.level)) * 100);
});

const rarityClass = (rarity: Rarity | null | undefined) => {
  if (rarity === "史诗") {
    return "rarity-epic";
  }
  if (rarity === "稀有") {
    return "rarity-rare";
  }
  if (rarity === "精良") {
    return "rarity-magic";
  }
  return "rarity-common";
};

const setToneClass = (color: string | null | undefined) => {
  if (!color) {
    return "";
  }
  return `set-tone-${color}`;
};

const setGlowClass = (active: boolean, color: string | null | undefined) => {
  if (!active || !color) {
    return "";
  }
  return `set-glow-${color}`;
};

const onCreate = () => {
  createCharacter(createForm.name, createForm.profession);
};

const onRestart = async () => {
  try {
    await showConfirmDialog({
      title: "确认重开",
      message: "将清空本地存档并重新创建角色。",
    });
    restart();
    activeTab.value = 0;
  } catch {
    // 用户取消
  }
};

const dollSlotOrder: EquipmentSlot[] = [
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

const paperDollRows = computed(() => {
  const rowMap = new Map(equippedRows.value.map((row) => [row.slot, row]));
  return dollSlotOrder.map((slot) => rowMap.get(slot)).filter((row) => Boolean(row));
});

const secretClickCount = ref(0);
let secretClickTimer: number | null = null;

const cheatEnabled = ref(localStorage.getItem("wei-cheat-enabled") === "1");
const showCheatUnlock = ref(false);
const cheatCode = ref("");

const cheatOpen = ref(false);
const showSetSelector = ref(false);
const cheatPos = reactive({ x: 0, y: 0 });
const dragState = reactive({
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
});

function resetSecretCounter() {
  secretClickCount.value = 0;
  if (secretClickTimer) {
    window.clearTimeout(secretClickTimer);
    secretClickTimer = null;
  }
}

function onSecretTap() {
  secretClickCount.value += 1;
  if (secretClickTimer) {
    window.clearTimeout(secretClickTimer);
  }
  secretClickTimer = window.setTimeout(() => {
    resetSecretCounter();
  }, 2200);

  if (secretClickCount.value >= 5) {
    resetSecretCounter();
    showCheatUnlock.value = true;
  }
}

function confirmCheatUnlock() {
  if (cheatCode.value.trim() === "attiv") {
    cheatEnabled.value = true;
    localStorage.setItem("wei-cheat-enabled", "1");
    showCheatUnlock.value = false;
    cheatCode.value = "";
    showToast("作弊菜单已开启");
    return;
  }
  showToast("口令错误");
}

function cancelCheatUnlock() {
  showCheatUnlock.value = false;
  cheatCode.value = "";
}

function boundCheatPosition(nextX: number, nextY: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minX = 8;
  const minY = 64;
  const maxX = w - 56;
  const maxY = h - 72;
  cheatPos.x = Math.max(minX, Math.min(maxX, nextX));
  cheatPos.y = Math.max(minY, Math.min(maxY, nextY));
}

function onCheatPointerDown(event: PointerEvent) {
  dragState.active = true;
  dragState.moved = false;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.originX = cheatPos.x;
  dragState.originY = cheatPos.y;
}

function onWindowPointerMove(event: PointerEvent) {
  if (!dragState.active) {
    return;
  }
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    dragState.moved = true;
  }
  boundCheatPosition(dragState.originX + dx, dragState.originY + dy);
}

function onWindowPointerUp() {
  if (!dragState.active) {
    return;
  }
  dragState.active = false;
  window.setTimeout(() => {
    dragState.moved = false;
  }, 80);
}

function onCheatClick() {
  if (dragState.moved) {
    return;
  }
  cheatOpen.value = !cheatOpen.value;
}

function initCheatPosition() {
  if (cheatPos.x !== 0 || cheatPos.y !== 0) {
    return;
  }
  cheatPos.x = Math.max(8, window.innerWidth - 64);
  cheatPos.y = Math.max(64, window.innerHeight * 0.22);
}

function runCheat(action: "gold" | "heal" | "items" | "level" | "skills" | "gear" | "set") {
  if (action === "gold") {
    doCheatAddGold();
  } else if (action === "heal") {
    doCheatHeal();
  } else if (action === "items") {
    doCheatAddItems();
  } else if (action === "level") {
    doCheatLevelUp();
  } else if (action === "skills") {
    doCheatUnlockSkills();
  } else if (action === "set") {
    showSetSelector.value = true;
  } else {
    doCheatSpawnGear();
  }
}

function selectSet(setId: string) {
  doCheatSpawnSet(setId);
  showSetSelector.value = false;
}

onMounted(() => {
  initCheatPosition();
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
});

watch(player, () => {
  if (!player.value) {
    cheatOpen.value = false;
    showSetSelector.value = false;
  }
});
</script>

<template>
  <div class="page">
    <div class="secret-hotspot" @click="onSecretTap" />

    <div class="shell">
      <header class="top">
        <h1>维传奇</h1>
      </header>

      <van-notice-bar left-icon="volume-o" :text="notice" wrapable />

      <section v-if="!player" class="create-section">
        <van-cell-group inset>
          <van-field v-model="createForm.name" label="角色名" placeholder="输入角色名（可为空）" />
          <van-field label="职业">
            <template #input>
              <van-radio-group v-model="createForm.profession" direction="horizontal">
                <van-radio name="战士">战士</van-radio>
                <van-radio name="法师">法师</van-radio>
                <van-radio name="道士">道士</van-radio>
              </van-radio-group>
            </template>
          </van-field>
        </van-cell-group>
        <div class="btn-row">
          <van-button type="primary" block round @click="onCreate">创建角色</van-button>
        </div>
      </section>

      <section v-else class="game-section">
        <div class="status-card">
          <div class="status-title">
            <div>{{ player.name }} · {{ player.profession }} · Lv.{{ player.level }}</div>
            <van-tag plain type="primary">金币 {{ player.gold }}</van-tag>
          </div>
          <div class="status-line">
            攻 {{ stats?.attack }} · 魔 {{ stats?.magic }} · 道 {{ stats?.tao }} · 速
            {{ stats?.attackSpeed?.toFixed(2) }} · 防 {{ stats?.defense }} · 运 {{ stats?.luck }}
          </div>
          <div class="status-line status-line-sub">
            暴击 {{ Math.floor((stats?.critRate ?? 0) * 100) }}% · 吸血 {{ Math.floor((stats?.lifesteal ?? 0) * 100) }}% ·
            套装麻痹+{{ Math.floor((stats?.paralyzeChance ?? 0) * 100) }}%
          </div>
          <div class="status-bar">
            <span>HP {{ player.hp }}/{{ stats?.maxHp }}</span>
            <van-progress :percentage="hpPercent" color="#ee0a24" stroke-width="8" />
          </div>
          <div class="status-bar">
            <span>MP {{ player.mp }}/{{ stats?.maxMp }}</span>
            <van-progress :percentage="mpPercent" color="#1989fa" stroke-width="8" />
          </div>
          <div class="status-bar">
            <span>EXP {{ player.exp }}/{{ expToNextLevel(player.level) }}</span>
            <van-progress :percentage="expPercent" color="#07c160" stroke-width="8" />
          </div>
        </div>

        <van-tabs v-model:active="activeTab" animated sticky>
          <van-tab title="战斗">
            <div class="tab-body">
              <van-cell-group inset>
                <van-field label="自动金创药">
                  <template #input>
                    <van-switch
                      :model-value="player.potionConfig.autoHpEnabled"
                      size="22px"
                      @update:model-value="setAutoHpEnabled"
                    />
                  </template>
                </van-field>
                <van-field label="血量阈值(%)">
                  <template #input>
                    <van-stepper
                      :model-value="player.potionConfig.autoHpThreshold"
                      min="5"
                      max="95"
                      step="5"
                      integer
                      @update:model-value="setAutoHpThreshold"
                    />
                  </template>
                </van-field>
                <van-field label="自动魔法药">
                  <template #input>
                    <van-switch
                      :model-value="player.potionConfig.autoMpEnabled"
                      size="22px"
                      @update:model-value="setAutoMpEnabled"
                    />
                  </template>
                </van-field>
                <van-field label="蓝量阈值(%)">
                  <template #input>
                    <van-stepper
                      :model-value="player.potionConfig.autoMpThreshold"
                      min="5"
                      max="95"
                      step="5"
                      integer
                      @update:model-value="setAutoMpThreshold"
                    />
                  </template>
                </van-field>
              </van-cell-group>

              <van-radio-group v-model="battleMapId">
                <van-cell-group inset>
                  <van-cell
                    v-for="item in availableMaps"
                    :key="item.id"
                    clickable
                    :title="item.name"
                    :label="`推荐 Lv.${item.minLevel}-${item.maxLevel}`"
                    @click="battleMapId = item.id"
                  >
                    <template #right-icon>
                      <van-radio :name="item.id" />
                    </template>
                  </van-cell>
                </van-cell-group>
              </van-radio-group>
              <div class="btn-row">
                <van-button type="danger" block round :loading="battleStreaming" :disabled="battleStreaming" @click="challengeOne">
                  {{ battleStreaming ? "战斗进行中..." : "自动挑战 1 场" }}
                </van-button>
              </div>
              <div class="log-box" v-if="battleLogs.length > 0">
                <div v-for="(line, idx) in battleLogs" :key="`${idx}-${line}`">{{ line }}</div>
              </div>
              <van-empty v-else description="暂无战斗日志，点击上方按钮开打。" />
            </div>
          </van-tab>

          <van-tab title="挂机">
            <div class="tab-body">
              <van-cell-group inset>
                <van-field
                  label="挂机速度"
                  :value="`1分钟挂机=${afkMinuteMs / 1000}秒现实时间，按耗时约${afkBattleRangeText}战`"
                  readonly
                />
                <van-field label="挂机分钟">
                  <template #input>
                    <van-stepper v-model="afkMinutes" min="1" max="720" integer />
                  </template>
                </van-field>
              </van-cell-group>

              <van-radio-group v-model="afkMapId">
                <van-cell-group inset>
                  <van-cell
                    v-for="item in availableMaps"
                    :key="item.id"
                    clickable
                    :title="item.name"
                    :label="`推荐 Lv.${item.minLevel}-${item.maxLevel}`"
                    @click="afkMapId = item.id"
                  >
                    <template #right-icon>
                      <van-radio :name="item.id" />
                    </template>
                  </van-cell>
                </van-cell-group>
              </van-radio-group>

              <div class="btn-row two-actions">
                <van-button type="primary" round block :disabled="afkRunning" @click="startAfk">开始挂机</van-button>
                <van-button type="default" round block :disabled="!afkRunning" @click="stopAfk(true)">停止挂机</van-button>
              </div>

              <div class="afk-progress" v-if="afkSession">
                <div>
                  进度 {{ afkSession.doneMinutes }}/{{ afkSession.totalMinutes }}
                  <span v-if="afkRunning">（进行中）</span>
                  <span v-else>（已停止）</span>
                </div>
                <van-progress :percentage="afkProgress" color="#1989fa" stroke-width="8" />
              </div>

              <div class="afk-box" v-if="afkResult">
                <div>胜利 {{ afkResult.wins }} 场 · 失败 {{ afkResult.fails }} 场</div>
                <div>经验 {{ afkResult.exp }} · 金币 {{ afkResult.gold }}</div>
                <div>离线补算 {{ afkResult.offlineMinutes }} 分钟</div>
                <div v-if="afkResult.drops.length > 0" class="drop-list">
                  <div>掉落（最多展示 8 条）:</div>
                  <van-tag
                    v-for="(drop, index) in afkResult.drops.slice(0, 8)"
                    :key="`${drop}-${index}`"
                    plain
                    type="warning"
                  >
                    {{ drop }}
                  </van-tag>
                </div>
              </div>

              <div class="log-box" v-if="afkLogs.length > 0">
                <div v-for="(line, idx) in afkLogs" :key="`${idx}-${line}`">{{ line }}</div>
              </div>
              <van-empty v-else description="暂无挂机日志。" />
            </div>
          </van-tab>

          <van-tab title="装备">
            <div class="tab-body">
              <van-cell-group inset>
                <van-field label="强化策略">
                  <template #input>
                    <van-switch v-model="preferStrengthStone" size="22px" />
                    <span class="inline-note">强化时优先消耗强化石</span>
                  </template>
                </van-field>
              </van-cell-group>

              <div class="set-board">
                <div
                  v-for="set in setRows"
                  :key="set.id"
                  class="set-card"
                  :class="[setToneClass(set.color), { active: set.activeTierCount > 0 }]"
                >
                  <div class="set-head">
                    <strong>{{ set.name }}套装</strong>
                    <span>{{ set.count }}/{{ set.maxCount }}</span>
                  </div>
                  <div
                    v-for="tier in set.tiers"
                    :key="`${set.id}-${tier.pieces}`"
                    class="set-tier"
                    :class="{ active: tier.active }"
                  >
                    {{ tier.pieces }}件：{{ tier.description }}
                  </div>
                </div>
              </div>

              <div class="paper-doll-wrap">
                <div class="paper-doll">
                  <div class="avatar-core">侠</div>

                  <div
                    v-for="row in paperDollRows"
                    :key="row!.slot"
                    class="doll-slot"
                    :class="[
                      `slot-${row!.slot}`,
                      rarityClass(row!.rarity),
                      row!.isSetPiece ? 'set-piece' : '',
                      setGlowClass(row!.setActive, row!.setColor),
                    ]"
                    @click="row!.equipment && strengthenBySlot(row!.slot)"
                  >
                    <div class="slot-name">{{ row!.slotName }}</div>
                    <div class="slot-value" :class="[rarityClass(row!.rarity), setToneClass(row!.setColor)]">
                      {{ row!.equipment ? row!.equipment.name : "(空)" }}
                    </div>
                    <div class="slot-meta">评分 {{ row!.score }}</div>
                    <div v-if="row!.setName" class="slot-set">{{ row!.setName }}套</div>
                    <div v-if="row!.recommendName" class="slot-recommend">
                      推荐替换：{{ row!.recommendName }} (+{{ row!.recommendDiff }})
                    </div>
                  </div>
                </div>
              </div>

              <div class="bag-wrap">
                <div class="bag-title">背包装备</div>
                <div v-if="bagGroups.length > 0">
                  <div class="btn-grid" style="margin-bottom: 12px;">
                    <van-button type="warning" plain @click="sellNonRecommendedGear">出售非推荐装备</van-button>
                    <van-button type="danger" plain @click="sellAllGear">出售所有装备</van-button>
                  </div>
                  <div class="bag-groups">
                    <div v-for="group in bagGroups" :key="group.slot" class="bag-group">
                      <div class="bag-group-title">
                        <strong>{{ group.slotName }}</strong>
                        <span>{{ group.rows.length }} 件</span>
                      </div>
                      <div class="gear-grid">
                        <div
                          v-for="row in group.rows"
                          :key="`bag-${row.index}`"
                          class="gear-card"
                          :class="[row.isSetPiece ? 'gear-set-piece' : '', setGlowClass(row.setActive, row.setColor)]"
                        >
                          <div class="gear-head">
                            <strong class="gear-name" :class="[rarityClass(row.rarity), setToneClass(row.setColor)]">
                              {{ row.name }} +{{ row.strengthen }}
                            </strong>
                            <span class="gear-slot">{{ row.slotName }}</span>
                          </div>
                          <div class="gear-tags">
                            <van-tag v-if="row.recommended" type="success" plain>职业推荐</van-tag>
                            <van-tag v-if="row.setName" plain type="warning">{{ row.setName }}套</van-tag>
                          </div>
                          <div class="gear-meta">评分 {{ row.score }} · 需求等级 Lv.{{ row.levelReq }}</div>
                          <div class="gear-desc">{{ row.text }}</div>
                          <van-button
                            size="mini"
                            type="success"
                            plain
                            :disabled="!row.canEquip"
                            @click.stop="equipByIndex(row.index)"
                          >
                            装备
                          </van-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <van-empty v-else description="背包暂无装备掉落。" />
              </div>
            </div>
          </van-tab>

          <van-tab title="技能">
            <div class="tab-body">
              <div v-for="skill in skillRows" :key="skill.id" class="skill-card" :class="{ locked: !skill.learned }">
                <div class="skill-top">
                  <strong>
                    {{ skill.name }}
                    <template v-if="skill.learned">Lv.{{ skill.level }}</template>
                    <template v-else>（Lv.{{ skill.unlockLevel }} 解锁）</template>
                  </strong>
                  <van-switch
                    :model-value="skill.autoUse"
                    :disabled="!skill.learned"
                    size="22px"
                    @update:model-value="toggleAuto(skill.id)"
                  />
                </div>
                <div class="skill-desc">{{ skill.desc }}</div>
                <div class="skill-meta">耗蓝 {{ skill.manaCost }} · 冷却 {{ skill.cooldown }} 回合</div>
                <div class="skill-meta" v-if="!skill.learned">
                  技能书：{{ skill.bookName }}（持有 {{ skill.bookOwned }}）
                </div>

                <template v-if="skill.learned">
                  <van-progress
                    :percentage="Math.floor((skill.training / skill.trainingNeed) * 100)"
                    color="#ff976a"
                    stroke-width="8"
                  />
                  <div class="skill-bottom">
                    <span>修炼 {{ skill.training }}/{{ skill.trainingNeed }}</span>
                    <van-button
                      size="small"
                      type="warning"
                      plain
                      :disabled="(player?.inventory['修炼卷轴'] ?? 0) <= 0"
                      @click="trainSkill(skill.id)"
                    >
                      卷轴修炼
                    </van-button>
                  </div>
                </template>
                <template v-else>
                  <div class="skill-bottom">
                    <span>需求等级 Lv.{{ skill.unlockLevel }}</span>
                    <van-button
                      size="small"
                      type="primary"
                      plain
                      :disabled="!skill.canLearn"
                      @click="learnSkill(skill.id)"
                    >
                      学习技能
                    </van-button>
                  </div>
                </template>
              </div>
            </div>
          </van-tab>

          <van-tab title="商城">
            <div class="tab-body">
              <div v-for="item in shopItems" :key="item.name" class="shop-card">
                <div class="shop-row">
                  <strong>{{ item.name }}</strong>
                  <van-tag type="primary">单价 {{ item.price }}</van-tag>
                </div>
                <div class="shop-desc">{{ item.description }}</div>
                <div class="shop-row">
                  <van-stepper v-model="shopCount[item.name]" min="1" max="99" integer />
                  <van-button size="small" type="primary" @click="buyItem(item.name, shopCount[item.name])">
                    购买
                  </van-button>
                </div>
              </div>
            </div>
          </van-tab>

          <van-tab title="背包">
            <div class="tab-body">
              <van-cell-group inset>
                <van-cell v-for="row in inventoryRows" :key="row.name" :title="row.name" :value="`x${row.count}`" />
              </van-cell-group>
              <div class="btn-grid">
                <van-button type="danger" plain @click="useHpPotion">使用金创药</van-button>
                <van-button type="primary" plain @click="useMpPotion">使用魔法药</van-button>
                <van-button type="warning" plain @click="oilWeapon">使用幸运油</van-button>
                <van-button type="default" plain @click="onRestart">清空存档</van-button>
              </div>
            </div>
          </van-tab>
        </van-tabs>
      </section>
    </div>

    <div
      v-if="cheatEnabled"
      class="cheat-float"
      :style="{ left: `${cheatPos.x}px`, top: `${cheatPos.y}px` }"
    >
      <div class="cheat-panel" :class="{ open: cheatOpen }">
        <van-button size="small" type="primary" plain @click="runCheat('gold')">+10万金币</van-button>
        <van-button size="small" type="primary" plain @click="runCheat('heal')">补满血蓝</van-button>
        <van-button size="small" type="primary" plain @click="runCheat('items')">道具+20</van-button>
        <van-button size="small" type="primary" plain @click="runCheat('level')">升1级</van-button>
        <van-button size="small" type="primary" plain @click="runCheat('skills')">解锁全技能</van-button>
        <van-button size="small" type="primary" plain @click="runCheat('gear')">刷4件装备</van-button>
        <van-button size="small" type="success" plain @click="runCheat('set')">获得套装</van-button>
      </div>

      <button
        class="cheat-btn"
        @pointerdown.prevent="onCheatPointerDown"
        @click="onCheatClick"
      >
        秘
      </button>
    </div>

    <van-popup v-model:show="showCheatUnlock" round class="cheat-popup">
      <div class="cheat-popup-inner">
        <h3>输入开启口令</h3>
        <van-field v-model="cheatCode" placeholder="请输入口令" />
        <div class="cheat-popup-actions">
          <van-button size="small" @click="cancelCheatUnlock">取消</van-button>
          <van-button size="small" type="primary" @click="confirmCheatUnlock">确认</van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showSetSelector" round position="bottom" :style="{ height: '60%' }">
      <div class="set-selector">
        <div class="set-selector-header">
          <h3>选择套装</h3>
          <van-button size="small" @click="showSetSelector = false">取消</van-button>
        </div>
        <div class="set-selector-list">
          <div
            v-for="set in availableSets"
            :key="set.id"
            class="set-selector-item"
            @click="selectSet(set.id)"
          >
            <div class="set-selector-name">{{ set.name }}套装</div>
            <div class="set-selector-desc">{{ set.slots.length }}件套</div>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>
