# GanttPro — 專案甘特圖管理工具

以互動式甘特圖規劃專案與追蹤進度的瀏覽器應用程式。

**[English](README.md)**

![GanttPro 主介面](docs/images/gantt-main.png)

## 關於

GanttPro 協助專案團隊整理工作、安排任務並追蹤進度。這是使用原生 JavaScript 模組、Vite 與 Firebase 建置的單頁應用程式，介面支援繁體中文與英文。

## 快速開始

需求：Node.js `^20.19.0` 或 `>=22.12.0`（鎖定的 Vite 套件所宣告的版本範圍），以及 npm。

```bash
npm ci
cp .env.example .env
```

請在 `.env` 填入 Firebase 網頁應用程式設定，並在 Firebase 專案啟用 Google 登入與 Cloud
Firestore。若需要管理員面板或要產生 Firestore 規則，請設定 `VITE_ADMIN_EMAIL`。接著啟動開發伺服器：

```bash
npm run dev
```

Vite 會在 <http://localhost:5173>
提供應用程式。建置、測試、格式化與 Firestore 規則指令請見[開發文件](docs/development.md)（英文）。

## 功能

### 規劃與排程

- 將任務整理成群組與里程碑，並調整任務階層。
- 使用 FS、SS、FF 或 SF 相依關係與滯後天數連結任務。排程器會依相依關係計算日期，要徑分析會標示沒有排程浮時的任務。
- 使用台灣工作日曆、自訂工作日與假日，並追蹤負責人、進度、完成狀態、審批狀態及佐證連結。

### 檢視與追蹤

- 切換甘特圖、里程碑與工作量視圖；依日、週或月縮放。
- 將目前日期與基準線比較、儲存及還原專案版本，並檢視專案稽核紀錄。
- 使用明亮或深色模式，以及 WBS 編號等任務表格功能。

### 分享與匯出

- 使用 Google 登入以使用雲端功能，或以訪客模式在本機工作。
- 邀請協作者並設定讀取或編輯權限，也可建立唯讀分享連結。兩種分享連結的隱私與撤銷方式不同，詳見
  [Firebase 與安全性](docs/firebase-security.md)（英文）。
- 將圖表匯出為 PNG、列印或另存為 PDF，並將任務資料匯出為 CSV 或 iCalendar。

## 畫面截圖

### 深色模式

![深色模式](docs/images/gantt-dark.png)

### 工作量視圖

![工作量視圖](docs/images/gantt-workload.png)

## 文件

- [文件索引](docs/index.md)（英文）
- [開發設定與指令](docs/development.md)（英文）
- [架構與原始碼配置](docs/architecture.md)（英文）
- [Firebase 設定與安全界線](docs/firebase-security.md)（英文）

## 專案狀態

這是私人專案（`package.json` 設定 `private: true`）。目前儲存庫未包含授權條款檔案。
