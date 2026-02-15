# 维传奇（Vue3 纯前端单机）

一个参考经典传奇玩法的单机前端项目，基于 `Vue3 + Vite + Vant`，兼容手机浏览器。

## 启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## PWA 离线说明

- 已接入 PWA，支持“添加到主屏幕”安装。
- 首次需要联网访问一次，缓存完成后断网可继续打开和游玩。
- 每次发布新版本后，PWA 会自动更新资源缓存。

## 玩法系统

- 地图：比奇野外、沃玛寺庙、祖玛寺庙、赤月峡谷（等级解锁）
- 职业：战士、法师、道士（职业技能差异化）
- 战斗：全自动回合制，技能描述细化，自动喝药（支持阈值设置），技能可切换自动/手动
- 技能：按等级解锁，打怪增加熟练度，可用修炼卷轴加速，道士可召唤神兽参战
- 装备：传奇式多部位（头盔/项链/手镯/戒指/腰带/靴子/武器/衣服），含稀有度、极品词条、强化等级
- 幸运：影响暴击和掉落，可通过幸运油提升武器幸运
- 强化：金币强化，强化石提高成功率，高强化失败可能回退
- 挂机：按时间推进并实时展示战斗日志，支持离线挂机补算
- 商城：金币购买药品、修炼卷轴、强化石、幸运油
- 彩蛋：隐藏触发的可拖动作弊菜单

## 存档

- 纯单机运行，数据保存在浏览器 `localStorage`。
- 存档使用 AES-GCM 加密封装（键：`wei-legend-save-v2`）。

## 部署到 Vercel

项目可以直接部署到 Vercel，已提供 `vercel.json`（适配 Vite + PWA）。

### 方式一：通过 GitHub 导入（推荐）

1. 将仓库推送到 GitHub。
2. 在 Vercel 点击 `Add New Project`，选择该仓库导入。
3. 构建设置确认：
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 点击 Deploy。

### 方式二：Vercel CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

说明：
- 首次部署后，建议在浏览器打开一次，等待 PWA 资源缓存完成。
- `sw.js` 与 `manifest.webmanifest` 已设置为 `no-cache`，避免 PWA 更新不及时。
