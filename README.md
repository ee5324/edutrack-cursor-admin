# 教學組事務管理系統

## 在 Cursor 中查看程式運作（方便知道哪邊要調整）

1. **啟動開發伺服器**：在 Cursor 終端機執行  
   ```bash
   npm run dev
   ```
2. **用本機瀏覽器開啟**（最穩定）：
   - 本專案網址為 **http://localhost:5173**
   - 直接用 **Chrome、Safari 或 Edge** 開啟：`http://localhost:5173`
   - 或執行 **`npm run dev:open`**，會自動用預設瀏覽器開啟
3. 若 Cursor 的 Simple Browser 無法開網址，請一律改用上述本機瀏覽器開啟。

目前預設為 **Sandbox 模式**（`.env` 的 `VITE_SANDBOX=true`），不需 Firebase/GAS 就能完整操作。

---

## 程式對照（畫面 / 功能 → 要改的檔案）

| 畫面／功能 | 前端元件 | 資料／API 層 |
|------------|----------|--------------|
| 左側選單、整體版面 | `components/Layout.tsx` | — |
| 行政行事曆、待辦 | `components/TodoCalendar.tsx` | `services/api.ts`：getTodos, saveTodo, deleteTodo, uploadAttachment… |
| 本土語點名單製作 | `AttendanceGenerator.tsx` | api：getHistory, getCourseStudents, saveCourseConfig, importFromSpreadsheet |
| 頒獎通知 | `AwardGenerator.tsx` | api：getAwardHistory, saveAwardRecord, getAllKnownStudents, createAwardDocs… |
| 廠商管理 | `VendorManager.tsx` | api：getVendors, saveVendor, deleteVendor |
| 事項列檔 | `ArchiveManager.tsx` | api：getArchiveTasks, saveArchiveTask, deleteArchiveTask |
| 系統設定 | `App.tsx`（SettingsTab） | api：setupSystem |

- **統一 API**：`services/api.ts`（Firebase / GAS 呼叫都在這裡，Sandbox 時改走 `services/sandboxStore.ts`）
- **型別**：`types.ts`

---

## 後端架構

- **文字資料**：Firebase Firestore（課程、學生、頒獎、廠商、事項列檔、待辦）
- **附檔與產出檔**：仍使用 Google Drive，經由 Google Apps Script (GAS) Web App 上傳／產生（點名單試算表、頒獎通知 Doc、附件等）

## 與其他系統共用 Firebase（外掛模式）

本系統設計成可與其他系統共用**同一個 Firebase 專案**，不另開新專案、也不影響其他系統：

- 所有 Firestore 集合都帶**前綴**（預設 `edutrack_`），例如：`edutrack_courses`、`edutrack_students`、`edutrack_awards`、`edutrack_vendors`、`edutrack_archive`、`edutrack_todos`
- 只會讀寫以上六個集合，不會碰到其他系統的 collections
- 前綴可在 `.env` 用 `VITE_FIREBASE_COLLECTION_PREFIX` 自訂（須與規則一致）

**Firestore 規則**：不需要提供你現有的規則也可以。專案裡有 **`firestore-rules-snippet.rules`**，裡面是「只針對本系統六個集合」的規則片段，你只要把該片段**複製、貼進**現有 `firestore.rules` 的 `match /databases/{database}/documents { ... }` 大括號內即可。若你自訂了集合前綴，把片段裡的 `edutrack_` 改成相同前綴。  
若你願意提供現有規則全文，我可以幫你整份合併好。

## 環境設定

1. 複製 `.env.example` 為 `.env`
2. 填入你**現有** Firebase 專案的 Web 應用程式設定（與其他系統共用同一專案即可）：
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. （選填）`VITE_FIREBASE_COLLECTION_PREFIX` 預設 `edutrack_`；若改前綴，Firestore 規則裡的集合名要一致
4. （選填）若 GAS Web App URL 不同，可設定 `VITE_GAS_API_URL`

## Sandbox 模式（建議先使用以了解程式）

不需設定 Firebase 或 GAS，即可在本地跑完整流程：

1. 複製 `.env.example` 為 `.env`（或建立 `.env` 並設 `VITE_SANDBOX=true`）
2. `npm install` → `npm run dev`
3. 開啟瀏覽器即可操作：課程、頒獎、廠商、事項列檔、行事曆待辦等，資料存於記憶體，附檔／點名單／頒獎 Doc 為模擬連結
4. 重新整理頁面會還原為預設範例資料

正式環境請將 `VITE_SANDBOX` 設為 `false` 或移除，並設定 Firebase 與 GAS。

## 執行（正式環境）

1. `npm install`
2. 設定 Firebase 與（選填）GAS 於 `.env`，並關閉 Sandbox（`VITE_SANDBOX=false` 或刪除該行）
3. `npm run dev`
