/* night.js — 夜の処理（おやすみ・見込み・取り消し・設定）

全体の流れ
1. 時刻の道具
2. 見込みの計算（bank.js の calcDebt をそのまま使う）
3. 夜のひつじのセリフ
4. 見込み・おやすみ中のパネルを描く
5. ボタンを押したとき
6. ボタンと関数を結びつける

保存・計算は bank.js の関数（goodnight / saveSettings / getStatus / cancelSleep）に任せる。
今の時刻は new Date() ではなく bank.js の now() を使う（早送りを効かせるため）。
*/


// ===== 1. 時刻の道具 =====

// 次に起きる予定の日時を返す（例：今が23時・起床7:00 → 明日の7:00）
function nextWakeTime(nowDate, wakeTime) {
    const [h, m] = wakeTime.split(":").map(Number); // "07:00" → [7, 0]
    const wake = new Date(nowDate);
    wake.setHours(h, m, 0, 0);
    if (wake <= nowDate) {
        wake.setDate(wake.getDate() + 1); // もう過ぎていたら明日にする
    }
    return wake;
}

// 分 → "6時間30分"
function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}時間${m}分`;
}

// Date → "7:00"
function formatClock(date) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// +30 / -50 / ±0 の形にする
function formatDelta(n) {
    if (n > 0) return `+${n}`;
    if (n < 0) return `${n}`;
    return "±0";
}


// ===== 2. 見込みの計算 =====

// 「sleepAt に寝て wake に起きたら」明日の朝の借金はいくら？
// 今夜の仮の記録を履歴に足して、bank.js の calcDebt に計算してもらう（本番と同じ計算なのでずれない）
// ※ bank.js に previewTonight ができたら、そちらに置きかえる
function previewDebt(history, targetHours, sleepAt, wake) {
    const morningDate = formatDateTime(wake).slice(0, 10);
    const tonight = {
        date: addDays(morningDate, -1), // 起きる日の前の夜（0時過ぎに寝ても前の夜）
        sleptAt: formatDateTime(sleepAt),
        wokeAt: formatDateTime(wake),
        targetHours: targetHours,
    };
    return calcDebt([...history, tonight], morningDate).debt;
}


// ===== 3. 夜のひつじのセリフ =====

function nightLines(status) {
    if (status.debt === 0) {
        return ["いらっしゃいませ〜 借金ゼロ！", "今夜もこの調子で記帳していってね"];
    }
    if (status.debt < 300) {
        return ["いらっしゃいませ〜 今夜も記帳していってね", "少し借金があるよ。早めに寝て返していこう"];
    }
    return ["そろそろ返してほしいな…", "今夜こそ早く寝よう？ 利息がふえちゃうよ"];
}


// ===== 4. パネルを描く =====

// 見込み・おやすみ中・設定のうち、areaId だけ表示する
function showInfo(areaId) {
    ["previewArea", "sleepingArea", "settingsArea"].forEach(id => {
        el(id).hidden = id !== areaId;
    });
}

let settingsOpen = false;

function renderNightPanel(status, settings) {
    // 設定を開いているとき・まだ設定がないときは設定を出す
    if (settingsOpen || !settings) {
        showInfo("settingsArea");
        return;
    }

    const nowDate = now();

    // A. おやすみ中：寝た時刻と、ここまでの睡眠時間
    if (status.isSleeping) {
        showInfo("sleepingArea");
        const slept = new Date(status.sleptAt);
        el("sleptClock").textContent = formatClock(slept);
        el("sleptFor").textContent = formatMinutes(Math.max(0, (nowDate - slept) / 60000));
        el("cancelButton").hidden = !hasBankFunction("cancelSleep");
        return;
    }

    // B. 起きている：今寝たら / 1時間後に寝たら、借金がいくら増えるか
    showInfo("previewArea");
    const history = load("history", []);
    const wake = nextWakeTime(nowDate, settings.wakeTime);

    // 起きる日の前の夜が、もう記帳ずみ（おはようを押した直後など）→ 見込みは出さない
    const nightDate = addDays(formatDateTime(wake).slice(0, 10), -1);
    if (history.some(r => r.date === nightDate)) {
        el("deltaNow").textContent = "記帳ずみ";
        el("deltaLater").textContent = "また今夜";
        return;
    }

    const debtNow = previewDebt(history, settings.targetHours, nowDate, wake);
    el("deltaNow").textContent = formatDelta(debtNow - status.debt);

    const later = new Date(nowDate.getTime() + 60 * 60 * 1000);
    if (later >= wake) {
        el("deltaLater").textContent = "起床時刻すぎ";
    } else {
        const debtLater = previewDebt(history, settings.targetHours, later, wake);
        el("deltaLater").textContent = formatDelta(debtLater - status.debt);
    }
}


// ===== 5. ボタンを押したとき =====

function onGoodnight() {
    const result = goodnight(); // bank.js
    if (!result.ok) {
        say(result.reason);
        if (result.code === "NO_SETTINGS") openSettings();
        return;
    }
    render();
    setMood("sleep");
    say([`${formatClock(new Date(result.sleptAt))} に記帳したよ。おやすみなさい…`, "起きたら『おはよう』を押してね"]);
}

function onCancel() {
    const result = cancelSleep(); // bank.js（#13）
    if (!result.ok) {
        say(result.reason);
        return;
    }
    const status = render();
    setMood(moodFor(status));
    say(`${formatClock(new Date(result.sleptAt))} のおやすみを取り消したよ`);
}

// 設定を開く（今の設定を入力欄に入れておく）
function openSettings() {
    const settings = load("settings", null) || { targetHours: 7, wakeTime: "07:00" };
    el("targetInput").value = settings.targetHours;
    el("wakeInput").value = settings.wakeTime;
    settingsOpen = true;
    showInfo("settingsArea");
}

function onSaveSettings(event) {
    event.preventDefault(); // フォームの送信でページが読み直されないようにする
    const result = saveSettings(Number(el("targetInput").value), el("wakeInput").value); // bank.js
    if (!result.ok) {
        say(result.reason);
        return;
    }
    settingsOpen = false;
    render();
    say(`目標 ${result.targetHours}時間、${result.wakeTime} に起きる予定で受けつけたよ`);
}

function onSettingsButton() {
    if (settingsOpen && load("settings", null)) {
        settingsOpen = false; // もう一度押したら閉じる
        render();
    } else {
        openSettings();
    }
}


// ===== 6. ボタンと関数を結びつける（app.js がページを開いたときに呼ぶ） =====

function setupNight() {
    el("goodnightButton").addEventListener("click", onGoodnight);
    el("cancelButton").addEventListener("click", onCancel);
    el("settingsArea").addEventListener("submit", onSaveSettings);
    el("settingsButton").addEventListener("click", onSettingsButton);
}
