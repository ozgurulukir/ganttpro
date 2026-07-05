# GanttPro — 專案甘特圖管理工具

功能完整的甘特圖專案管理工具，具備任務排程、相依箭頭、要徑分析、里程碑、工作量熱圖、專案分享協作、版本歷史、基準線比對，以及匯出 PNG / CSV / PDF 功能。使用純 ES 模組 SPA 搭配 Vite + Firebase 建置。

**[English](README.md)**

---

## 功能特色

- **甘特圖** — 任務長條、群組摘要、里程碑菱形標記
- **相依類型** — FS（完成到開始）、SS、SS、FF、SF，支援滯後天數
- **CPM 要徑分析** — 反向傳遞浮時計算，標示要徑任務
- **台灣工作日曆** — 內建 2025–2027 年政府辦公日曆
- **正向排程器** — 自動從相依關係推算最早開始／結束日
- **拖曳操作** — 調整長條寬度、移動任務、拖曳里程碑，自動吸附至工作日
- **工作量視圖** — 每人每日負荷熱圖
- **協作分享** — 透過 Email 邀請編輯者（讀／寫權限）
- **分享連結** — 產生唯讀公開網址（無需登入）
- **匯出** — PNG 圖片、CSV 試算表、PDF 列印
- **版本歷程** — 儲存與還原專案快照
- **基準線比對** — 疊加計畫日期與實際日期
- **深色模式**、縮放控制（日／週／月細粒度）

## 技術棧

| 層級     | 技術                                         |
| -------- | -------------------------------------------- |
| 建置工具 | Vite 8                                       |
| 前端     | Vanilla JS（ES 模組，無框架）                |
| 後端     | Firebase（Auth + Firestore，modular v9 SDK） |
| 測試     | Node.js 原生測試執行器（`node --test`）      |
| 格式化   | Prettier                                     |
| 語言     | 繁體中文（zh-TW）                            |

## 快速開始

```bash
# 1. 安裝相依套件
npm install

# 2. 設定 Firebase 與管理員 Email
cp .env.example .env
# 編輯 .env — 填入你的 Firebase 專案 VITE_FIREBASE_* 值，
# 並將 VITE_ADMIN_EMAIL 設為你的 Email

# 3. 產生 Firestore 規則（會自動帶入你的 VITE_ADMIN_EMAIL）
npm run build:rules

# 4. 啟動開發伺服器
npm run dev      # http://localhost:5173
```

### 正式建置

```bash
npm run build    # 輸出至 dist/
npm run preview  # 預覽建置結果
```

### 測試

```bash
npm test                            # 執行全部 105 項測試
TZ=America/Los_Angeles npm test     # 驗證時區獨立性
```

## 架構

```
src/
├── main.js                  App 進入點：狀態、渲染迴圈、事件綁定、同步
│
├── core/                    純邏輯（無 DOM、無全域、可單元測試）
│   ├── date.js              時區安全日期運算（整數日數）
│   ├── calendar.js          台灣工作日曆 + 節日查詢
│   ├── tree.js              扁平任務樹查詢（子層、深度、可見性）
│   ├── deps.js              相依關係解析 + 循環偵測
│   ├── schedule.js          正向排程器（FS/SS/FF/SF + lag）
│   ├── critical-path.js     CPM 反向浮時 → 要徑
│   └── format.js            格式化輔助（dateToX、色彩、XSS 跳脫）
│
├── render/                  DOM 渲染（使用共享 D 物件）
│   ├── deps.js              共享可變 D 物件（狀態橋樑）
│   ├── chart-header.js      時間軸：月標籤 + 日／週／月儲存格
│   ├── chart-body.js        畫布整合：格線 + 長條 + 箭頭 + 今日線
│   ├── grid.js              月／週／日細粒度格線
│   ├── bar.js               任務長條、群組長條、拖曳／縮放互動
│   ├── milestone.js         里程碑時間軸主線 + 菱形標記
│   ├── arrows.js            SVG 相依箭頭（FS/SS/FF/SF）+ 要徑醒目
│   ├── workload.js          每人每日負荷熱圖
│   ├── tooltip.js           懸浮提示 + 列／相依醒目
│   └── task-panel.js        左側任務表格（名稱、日期、相依、操作）
│
├── ui/                      UI 控制器
│   ├── modal.js             任務新增／編輯／刪除對話框、內聯編輯器
│   ├── project.js           專案 CRUD、範本選擇、專案選單
│   └── settings.js          設定、縮放、深色模式、基準線、版本
│
├── data/                    持久層（純 I/O，無應用狀態）
│   ├── firebase.js          Firebase 初始化（app、auth、firestore）
│   ├── remote.js            Firestore CRUD：使用者資料、分享、允許清單
│   ├── local.js             LocalStorage 儲存／讀取（離線 + 訪客模式）
│   └── share.js             分享連結編碼 + Firestore 分享文件 I/O
│
├── auth.js                  Google 登入、訪客模式、註冊、管理員閘門
├── collab.js                分享與協作對話框（新增／移除編輯者）
├── admin.js                 管理員使用者管理面板（延遲載入）
├── export.js                PNG / CSV / PDF 匯出（延遲載入）
└── interactions.js          DOM 設定：捲動同步、欄寬／面板縮放
```

### 關鍵設計模式

- **純核心／命令外殼**：`core/` 包含所有領域計算，完整單元測試。`main.js` + `ui/` + `render/` 組成命令外殼。
- **共享 `D` 物件**：`render/deps.js` 匯出可變物件，`main.js` 在每次渲染前透過 `syncRenderDeps()` 重新填入。
- **時區安全日期**：所有日曆計算使用整數日數（`core/date.js`），消除 UTC／本地時間的 Date 混合問題。測試在任何時區結果一致。
- **延遲載入**：`export.js` 與 `admin.js` 使用動態 `import()`。
- **事件委派**：動態內容使用 `data-action` 屬性 + 委派機制。

## Firebase 設定

Firebase 設定透過 `.env` 中的環境變數配置（請參考 `.env.example`）。
Web API 金鑰為 Firebase 客戶端 SDK 公開資訊。

### Firestore 集合

| 集合                   | 用途                                          |
| ---------------------- | --------------------------------------------- |
| `gantt_user_data`      | 每位使用者的專案資料（所有專案為不透明 blob） |
| `gantt_project_shares` | 具名協作授權（擁有者 → 受邀者）               |
| `gantt_allowed_users`  | 註冊允許清單（自行註冊）                      |
| `gantt_shares`         | 公開唯讀分享連結快照                          |

### 安全性規則

`firestore.rules` 定義存取控制：

```bash
# 一次性：透過 Firebase 驗證
npm run firebase login

# 變更 .env 後（或重新產生 firestore.rules 後）：
npm run build:rules
npm run deploy:rules
```

管理員權限透過 `VITE_ADMIN_EMAIL` 在 `.env` 中設定，並由產生的 `firestore.rules` 強制執行。使用者可寫入的 `is_admin` 欄位**不被信任**。
詳細設計決策請參閱 `_pm/Projects/ganttpro-security/done.md`。

## 測試

測試涵蓋 `core/` 純邏輯模組（105 項測試）：

```
tests/
├── date.test.js             日數運算（跨時區驗證）
├── calendar.test.js         工作日曆、節日、補班日
├── tree.test.js             樹查詢、可見性、群組邊界
├── deps.test.js             相依解析、循環偵測
├── schedule.test.js         正向排程器（4 種相依類型 + lag）
├── critical-path.test.js    CPM 反向浮時、要徑集合
└── format.test.js           dateToX、色彩、縮寫、XSS 跳脫
```

## 已知限制

- **Firebase 設定**透過 `VITE_FIREBASE_*` 環境變數（`.env`）；預設指向原始示範專案
- **分享連結無到期日**（Token 永久存在於 Firestore）
- **跨文件協作寫入**較寬鬆（任何已註冊使用者可寫入他人資料 — 詳見 `_pm/` 安全說明）
- **缺少 render、UI、data 及功能模組的測試**（僅 core 有測試）

## 授權

Private project.
