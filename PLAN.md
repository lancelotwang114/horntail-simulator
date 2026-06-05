# Horntail Simulator — 重構 + 多人版 實作計畫（編輯器中心版）

> 方法論：system-design（需求→高階設計→深入→規模/可靠度→取捨）＋ 分階段可測試漸進。
> 建立：2026-06-04｜**v2 已對齊 james 親述流程（編輯為核心）**。接手者：先讀本檔，再讀 `HANDOFF.md`。

---

## 0. 一頁總覽

**真正的流程（james 2026-06-04 澄清）**：
> 房主開 App → 進**編輯模式**自己編各階段流程／站位／排版／文字 → 按「分享連結」給別人看 → 房主**隨時可改**、觀眾**即時**看到 → 觀眾**看不到編輯模式、不能改**，**只有房主能編輯**。

關鍵推論：**要同步的是「房主編輯的內容本身」**（各階段的站位 `pos`、圈叉 `marks`、下煙 `zones`、文字 `notes`）＋目前階段 `cur`，**不只是 cur**。所以本計畫有兩根支柱：
1. **房主編輯器**（拖站位、改圈叉/下煙、編文字、增刪階段）。
2. **即時同步**：房主每次編輯 → 廣播給觀眾；觀眾端是乾淨唯讀檢視。

分階段（每階段都能獨立跑、附成功標準與驗證）：

| 階段 | 目標 | 風險 |
|---|---|---|
| P0 | 資料修正：接 3 新職業（字典）、UI 小修 | 低 |
| P1 | 重構為 `state ↔ render(state)`（行為不變，STAGES 納入狀態） | 中 |
| P2 | 狀態/事件層：`dispatch(action)` + reducer（含**編輯類** action） | 中 |
| P3 | **房主編輯器 UI** + localStorage 自動存稿 | 高 |
| P4 | 接 Trystero：開房、分享連結、新人補完整快照 | 高 |
| P5 | 模式分離 + 唯讀跟隨 + 編輯即時廣播（拖曳節流/差異） | 中 |
| P6 | GitHub Pages 部署 | 低 |

**攻略鐵則（資料正確性,編輯器要防呆）**：尾巴一定最先斷；其他部位先斷=失敗；肚子最後。擊破順序 尾→左頭→中頭→右頭,肚子最後。

---

## 1. 需求

### 1.1 功能需求
- **檢視**（已具備）：地圖上呈現多階段的站位、〇目標、✕已斷、危險/安全/下煙區；上一/下一/自動播放/點圓點跳階段。
- **房主編輯器**（核心，待做）：
  - 拖曳調整職業站位（`pos`）。
  - 新增/移動/縮放/刪除 〇 與 ✕（`marks`）。
  - 編輯每階段下煙區（`zones`）。
  - 編輯每階段文字 `notes`（含類型：一般/warn/safe）與標題、顏色。
  - 增加/刪除/重排階段。
  - 接入完整職業（含主教、火毒、聖騎士），可在任一階段放上/移除。
- **分享 + 即時同步**：房主按「分享連結」產生 `?room=` → 觀眾貼連結進來 → 房主之後的每次編輯/切階段,觀眾**即時**看到。
- **權限**：只有房主能編輯;觀眾唯讀、看不到任何編輯 UI、不能自由翻看（強制跟隨房主當前階段）。
- **存稿**：房主編輯內容自動存 localStorage,重開不丟失。

### 1.2 非功能需求
- **託管**：純靜態,GitHub Pages 直跑（無後端）。
- **連線**：Trystero（免自架 signaling;不穩可換 strategy 或退 PeerJS）。**房主在線時房間才存在**（純 P2P,關閉即結束,符合不做釘板的決策）。
- **延遲**：編輯動作 → 觀眾看到 < 500ms;拖曳同步順手不卡。
- **規模**：單房 ~6–12 人。
- **相容**：手機 + 桌機;維持單一 HTML 檔可傳閱。

### 1.3 限制
- 單人開發、單一 HTML、不引入打包工具（Trystero 走 CDN）。
- 維持相對路徑載圖（單檔版用 base64）。
- 繁中介面;Windows 開發。

### 1.4 本次已確認的決策
- 新職業（主教/火毒/聖騎士）→ **選項 A**：先只補進 ROLES 字典,站位之後在編輯器逐階段擺。
- UI 改善 → **這次先做**（鍵盤切換、吸頂標題、播放進度、頭尾提示等,P0 起逐步納入）。
- 「交棒控制權」→ **淡化/未來**（你強調只有房主能編輯;暫不做多人交棒）。

---

## 2. 現況與差距

### 2.1 現況（`闇黑龍王_互動攻略.html`,純檢視）
- 三組資料：`ROLES`、`GLOBAL_ZONES`、`STAGES[]`(7 階段)。
- 已有雛形 render 分離：`render(i)` 讀 `STAGES[i]` 改 DOM。
- 狀態只是游離變數 `cur/playing/timer`;事件直接綁 DOM。
- **目前沒有編輯器檔案**（交接提到曾有可匯出 JSON 的編輯器,但專案內找不到 → 視為**需新建**）。

### 2.2 差距（對齊新流程）
1. 沒有單一狀態物件,且 **STAGES 內容也要成為可同步、可編輯的狀態**。
2. `render` 要以「狀態」為輸入(`render(state)`),狀態含 STAGES + cur。
3. 沒有 action/reducer 層;編輯與遠端訊息都要走同一條 `dispatch`。
4. **沒有編輯器 UI**（拖曳、改圈叉/文字、增刪階段）。
5. 沒有連線層、模式分離（房主編輯 vs 觀眾唯讀）、localStorage 存稿。
6. ROLES 缺 主教/火毒/聖騎士。

---

## 3. 高階設計

### 3.1 單向資料流（單機與多人共用）
```
  房主編輯/切階段  ────┐
  觀眾收到遠端 action ─┤
                       ▼
                 dispatch(action, fromRemote?)
                       │
                       ▼
              reducer(state, action) → 新 state   （純函式,可單元測試）
                       │
        ┌──────────────┼─────────────────────────┐
        ▼              ▼                           ▼
   render(state)   autosave(state→localStorage)   net.broadcast(action)
   （冪等重繪）     （僅房主）                      （僅房主;fromRemote 不回傳）
```
本地編輯與遠端訊息都進同一個 `dispatch` → 單機/多人共用邏輯,是重構的核心價值。

### 3.2 狀態物件（含可編輯內容,可序列化）
```js
const state = {
  version: 1,
  cur: 0,
  playing: false,
  board: {                 // ← 房主可編輯、需同步的內容
    stages: [ /* STAGES 同結構：name,color,notes,pos,marks,zones */ ],
    globalZones: [ /* GLOBAL_ZONES */ ],
  },
  // 本地用,不進同步快照：
  selfId: null, hostId: null, peers: {}, mode: 'host' | 'viewer',
};
```
- **靜態的**：`ROLES`（職業字典＋圖路徑）隨 App 發佈,各端一致,不必同步。
- **同步的**：`board`(房主編的) + `cur` + `playing`。新人加入補一份完整 `{version,cur,playing,board}` 快照即可。
- `board` 體積小（目前 JSON 數 KB）,整包同步無壓力;拖曳期間改傳差異(見 5)。

### 3.3 Action 種類
| type | 載荷 | 誰能發 | 效果 |
|---|---|---|---|
| `GOTO` | `{cur}` | 房主 | 切階段 |
| `PLAY`/`PAUSE` | — | 房主 | 播放/暫停 |
| `MOVE_ROLE` | `{stage,roleKey,x,y}` | 房主 | 拖站位(高頻,需節流) |
| `SET_ROLE` | `{stage,roleKey,on}` | 房主 | 在階段放上/移除某職業 |
| `EDIT_MARK` | `{stage,index,patch}` / `ADD`/`DEL` | 房主 | 改/增/刪 〇✕ |
| `EDIT_ZONE` | `{stage,index,patch}` / `ADD`/`DEL` | 房主 | 改/增/刪 下煙區 |
| `EDIT_NOTE` | `{stage,index,kind,text}` / `ADD`/`DEL` | 房主 | 改階段文字 |
| `EDIT_STAGE_META` | `{stage,name?,color?}` | 房主 | 改標題/顏色 |
| `ADD_STAGE`/`DEL_STAGE`/`MOVE_STAGE` | … | 房主 | 增刪/重排階段 |
| `SNAPSHOT` | `{snapshot}` | 房主 | 新人補完整狀態 |

### 3.4 元件圖
```
┌───────────────────────────── index.html ──────────────────────────────┐
│ data 區塊    ROLES（靜態,含主教/火毒/聖騎士） + 預設 board(7 階段)        │
│ state 區塊   state + reducer(state,action)（純函式,所有編輯都走這）        │
│ render 區塊  render(state)：roles/marks/zones/panel/steps                │
│ editor 區塊  房主工具：拖曳、圈叉/下煙/文字編輯、增刪階段（僅 host 顯示）   │
│ store 區塊   localStorage 自動存稿 / 載稿（僅 host）                       │
│ net 區塊     Trystero：joinRoom / send(action) / onAction / snapshot      │
└─────────────────────────────────────────────────────────────────────────┘
            │ actions（房主→觀眾單向）
            ▼  Trystero（公共 tracker,免自架）
```

---

## 4. 深入設計

### 4.1 reducer（純函式,先寫測試）
- 不可變更新(回傳新物件),所有編輯操作集中於此 → 可在 sandbox 用 Node 跑單元測試,不需瀏覽器。
- 邊界防呆：`GOTO` clamp;刪到 0 階段要擋;**攻略鐵則檢查**(尾未斷不可標其他部位已斷,可做成編輯器警告而非硬擋)。

### 4.2 模式分離（房主 vs 觀眾）
- 進入方式決定模式：直接開（或帶 `#edit`）→ `mode='host'`;帶 `?room=xxx` 進來 → `mode='viewer'`。
- `render()` 依 `mode` 決定是否掛編輯工具;**觀眾完全不建立編輯 DOM**（看不到也點不到）。
- 觀眾的上一/下一被停用 → 強制跟隨房主 `cur`。

### 4.3 連線層（Trystero）
```js
import {joinRoom} from 'https://cdn.../trystero-torrent.min.js';
const room = joinRoom({appId:'horntail-sim'}, roomId);
const [send, onAct] = room.makeAction('act');
onAct((a) => dispatch(a, /*fromRemote=*/true));        // 觀眾套用,不回傳
room.onPeerJoin(id => { if(mode==='host') send(snapshotAction(), id); }); // 只補新人
room.onPeerLeave(id => { if(id===hostId) showRoomEnded(); });
```
- `dispatch(action, fromRemote)`：`fromRemote=true` 不再廣播,避免回音。
- 房主編輯 → `dispatch` → 同時 `render` + `autosave` + `send(action)`。
- 分享：房主按鈕產生短碼 roomId → 更新網址 `?room=` → 複製連結。

### 4.4 拖曳節流 / 差異（核心,因為要邊編邊給人看）
- `MOVE_ROLE` 在拖曳中高頻 → 用 `requestAnimationFrame` 或 ~25–30/s throttle 合併,只送「該職業最新座標」(差異,非整包 board)。
- 放開滑鼠送一次最終值 + 標記 commit（確保收斂一致）。
- 大型結構變更(增刪階段)低頻,直接送該 action 即可。

### 4.5 存稿（localStorage,僅房主）
- 每次房主 `dispatch` 後 debounce 存 `board` 到 localStorage（key 含版本）。
- 開啟時若有存稿 → 載入;否則用內建預設 7 階段。
- 這不是「釘房間」,只是房主本機草稿;符合「純 P2P、關房即消失」（觀眾端不留存）。
- **未來選項**：把 `board` 壓進分享連結（`#data=base64`）→ 可離線/非即時分享(房主不在也能看),需另評估連結長度。

---

## 5. 修正項（併入計畫）

### 5.1 新職業（P0,選項 A）
`ROLES` 補三 key（兩個 HTML 都要;單檔版改 base64）：
```js
bishop:{f:'職業/主教.jpg', n:'主教'},
fp:    {f:'職業/火毒.jpg', n:'火毒'},
pala:  {f:'職業/聖騎士.jpg', n:'聖騎士'},
```
站位之後在編輯器逐階段擺（補字典不影響現有畫面,因 render 只畫各階段 `pos` 內有的）。

### 5.2 UI／操作體驗（這次先做,P0 起）
- 鍵盤：←/→ 切階段、空白鍵 播放/暫停。
- 目前階段標題吸頂;手機版按鈕加大。
- 自動播放進度條/倒數。
- 上一/下一到頭尾的提示（目前循環易混淆）。
- 多人需要的徽章：在線人數、房主/觀眾標示、唯讀提示。

---

## 6. 分階段實作計畫（成功標準＋驗證）

### P0 — 資料修正（暖身,零風險）
- 改：ROLES 補 3 職業;加鍵盤切換 + 頭尾提示。
- 成功標準：新職業字典可用;既有 7 階段顯示不變;鍵盤可操作。
- 驗證：肉眼比對 + console 無錯。

### P1 — 重構為 `state ↔ render(state)`（行為不變）
- 改：建 `state`(含 `board.stages` 取代直接讀 STAGES、`cur`);`render(i)`→`render(state)`;`go/next/prev/play` 改走 `dispatch`。
- 成功標準：所有操作行為與 P0 逐一相同。
- 驗證：sandbox Node 測 reducer(GOTO 邊界、PLAY/PAUSE);手動回歸清單逐項對照。

### P2 — 狀態/事件層（含編輯類 action 定義）
- 改：完成 `dispatch(action,fromRemote)` + reducer 全部 action(含 MOVE_ROLE/EDIT_* 等,先有邏輯不接 UI)；`snapshotAction()`。
- 成功標準：單機正常;`dispatch` 是唯一改狀態入口(grep 無旁路)。
- 驗證：reducer 單元測試覆蓋每個 action(含不可變、邊界、鐵則警告)。

### P3 — 房主編輯器 UI + 存稿
- 改：拖站位、放上/移除職業、增/改/刪 圈叉與下煙、編文字、增刪/重排階段;localStorage 自動存稿/載稿;可匯出/匯入 JSON。
- 成功標準：房主能完整編出一套攻略並重開不丟失;編輯時 `render` 即時更新。
- 驗證：實際編一份 → 重整頁面確認還在 → 匯出 JSON 結構正確。

### P4 — 接 Trystero
- 改：開房/`?room=`/複製連結/在線人數;新人收 SNAPSHOT(完整 board+cur)。
- 成功標準：兩分頁同房,房主切階段/改站位,觀眾看到;C 中途加入立即同步。
- 驗證：本機 2–3 分頁實測;斷線重連補狀態正確。
- 備案：tracker 不穩 → 換 Trystero strategy 或退 PeerJS(net 層已抽象)。

### P5 — 模式分離 + 唯讀跟隨 + 編輯即時廣播
- 改：viewer 模式不建編輯 DOM、停用導覽(強制跟隨);房主每次編輯廣播;MOVE_ROLE 節流/差異 + commit。
- 成功標準：觀眾完全看不到編輯 UI、不能改、跟隨房主;拖曳同步順、最終一致。
- 驗證：分頁角色扮演核對權限矩陣;拖曳壓力測試看是否收斂、不抖。

### P6 — 部署
- 改：錯誤/重連提示、README、GitHub Pages 上線。
- 成功標準：線上版可開房、分享、跨裝置即時同步。
- 驗證：手機 + 桌機跨網路實測;分享連結第二台加入成功。

---

## 7. 取捨分析

| 決策 | 選擇 | 取捨 |
|---|---|---|
| 同步內容 | board(房主編的)+cur,靜態 ROLES 不同步 | ＋小而快;－各端 ROLES/版本須一致(版本不符要擋) |
| 連線 | Trystero 免自架,房主在線房間才在 | ＋零後端、Pages 直跑;－依賴公共 tracker、房主關閉即結束 |
| 權限 | 單一房主編輯,觀眾唯讀跟隨 | ＋無協作衝突、邏輯單純;－同時只能房主編(本次正是想要的) |
| 存稿 | localStorage 房主本機草稿 | ＋不丟稿、無後端;－只在該瀏覽器、換機不通(未來:連結內嵌 base64) |
| 拖曳同步 | 節流+差異+commit | ＋順手即時;－需處理收斂一致性 |
| 單一 HTML | 維持,CDN 載 Trystero | ＋易傳閱、無建置;－相依 CDN、檔案漸大 |

**長大後要回頭看**：人數 >12 或旁觀多 → P2P 網狀廣播吃力,考慮房主中繼/SFU;要房主離線也能分享 → 連結內嵌狀態或 Supabase;要多人同時編 → 需衝突解決(LWW/CRDT)。

---

## 8. 立即下一步
1. 已確認：新職業選 A、UI 先做、交棒淡化。**若以上理解無誤,我從 P0 動工**,並把 reducer 抽到 sandbox 建第一支單元測試替 P1 鋪路。
2. 每完成一階段跑該階段「驗證步驟」回報,你確認後再進下一階段。
3. 改既有 HTML 前我會先說明動作、等你確認（全域鐵則）。本檔僅計畫,未改程式碼。
