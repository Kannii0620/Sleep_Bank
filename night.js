/* night.js — おやすみ画面の処理

全体の流れ
1. 保存場所の名前と、決まりごとの数字を決める
2. 保存・読み込みの道具
3. 日付と時刻の道具
4. 見込みの計算（bank.js の calcDebt をそのまま使う）
5. 画面の表示
6. ボタンを押したとき
7. ページを開いたときに動かす

bank.js を先に読み込んでおく必要がある（calcDebt と addDays を使うため）。
*/


// ===== 1. 保存場所の名前と、決まりごとの数字 =====

// localStorage に保存するときの名前。朝担当・銀行担当と同じ名前を使う
const KEY_SETTINGS = "sleepBank.settings"; // { targetHours: 7, wakeTime: "07:00" }
const KEY_PENDING = "sleepBank.pending";   // { sleptAt: "2026-10-29T14:00:00.000Z", targetHours: 7 }
const KEY_HISTORY = "sleepBank.history";   // [{ date, sleptAt, wokeAt, targetHours }, ...]

const DEFAULT_SETTINGS = { targetHours: 7, wakeTime: "07:00" };
const FORGOT_HOURS = 16; // おやすみからこれ以上たっていたら「おはようの押し忘れ」とみなす


// ===== 2. 保存・読み込みの道具 =====

// key の中身を読み込む。何もない・壊れているときは fallback を返す
function load(key, fallback) {
    try {
        const text = localStorage.getItem(key);
        if (text === null) {
            return fallback;
        }
        return JSON.parse(text); // 文字列 → オブジェクトに戻す
    } catch (e) {
        return fallback;
    }
}

// value を文字列にして key に保存する
function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value)); // オブジェクト → 文字列にする
}

// 設定を読み込む。保存されていない項目は初期値で埋める
function loadSettings() {
    // ...は「中身を広げる」書き方。後ろに書いたほうが優先される
    return { ...DEFAULT_SETTINGS, ...load(KEY_SETTINGS, {}) };
}


// ===== 3. 日付と時刻の道具 =====

// 何度も書く document.getElementById を短くする
function el(id) {
    return document.getElementById(id);
}

// Date → "2026-10-29"。パソコンの時刻（日本時間）で日付を作る
// ※ toISOString() は世界標準時になるので、日本の朝9時前は前日の日付になってしまう
function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0"); // 月は0から数えるので+1
    const d = String(date.getDate()).padStart(2, "0");      // 1桁なら前に0を付ける
    return `${y}-${m}-${d}`;
}

// 次に起きる予定の日時を返す（例：今が23時・起床7:00 → 明日の7:00）
function nextWakeTime(now, wakeTime) {
    const [h, m] = wakeTime.split(":").map(Number); // "07:00" → [7, 0]
    const wake = new Date(now);
    wake.setHours(h, m, 0, 0);       // 今日の7:00にする
    if (wake <= now) {
        wake.setDate(wake.getDate() + 1); // もう過ぎていたら明日の7:00にする
    }
    return wake;
}

// 「今夜」の日付。起きる日の前日にする（0時過ぎに寝ても前日の夜として扱う）
function nightDateOf(wake) {
    return addDays(toDateStr(wake), -1); // addDays は bank.js の関数
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


// ===== 4. 見込みの計算 =====

// 「sleepAt に寝て wake に起きたら」明日の朝の借金はいくらになる？
// 今夜の仮の記録を履歴の最後に足して、bank.js の calcDebt に計算してもらう。
// 本番と同じ関数を使うので、見込みと実際の結果がずれない
function previewDebt(history, targetHours, sleepAt, wake) {
    const nightDate = nightDateOf(wake);
    const tonight = {
        date: nightDate,
        sleptAt: sleepAt.toISOString(), // 「時刻」は toISOString で保存してOK（読み戻すと同じ瞬間になる）
        wokeAt: wake.toISOString(),
        targetHours: targetHours,
    };
    const morningDate = addDays(nightDate, 1); // calcDebt は「today の前日の夜」まで計算する
    return calcDebt([...history, tonight], morningDate).debt;
}

// 借金に合わせた窓口キャラのひとこと
function charaLineFor(debt) {
    if (debt === 0) {
        return "借金ゼロ！今夜もこの調子でね";
    }
    if (debt < 300) {
        return "少し借金があるよ。今夜は早めに寝て返していこう";
    }
    return "そろそろ返してほしいな…今夜こそ早く寝よう";
}


// ===== 5. 画面の表示 =====

// 3つのエリアのうち、areaId だけを表示して残りを隠す
function showOnly(areaId) {
    ["previewArea", "sleepingArea", "doneArea"].forEach(id => {
        el(id).classList.toggle("hidden", id !== areaId);
    });
}

// 保存されている内容と今の時刻から、画面全体を描き直す
function render() {
    const now = new Date();
    const settings = loadSettings();
    const history = load(KEY_HISTORY, []);
    const pending = load(KEY_PENDING, null);

    const wake = nextWakeTime(now, settings.wakeTime);
    const nightDate = nightDateOf(wake);

    // 今の借金（昨日の夜まで）とキャラのひとこと
    const debt = calcDebt(history, nightDate).debt;
    el("currentDebt").textContent = debt;
    el("charaLine").textContent = charaLineFor(debt);

    // A. おやすみ中（おやすみを押して、まだおはようを押していない）
    if (pending) {
        showOnly("sleepingArea");
        const slept = new Date(pending.sleptAt);
        const hours = (now - slept) / (1000 * 60 * 60);
        if (hours >= FORGOT_HOURS) {
            el("sleepingMessage").textContent =
                "おはようを押し忘れたかも？おはよう画面で起きた時刻を入力してね";
        } else {
            el("sleepingMessage").textContent =
                `${formatClock(slept)} におやすみしました。起きたらおはようを押してね`;
        }
        return;
    }

    // B. 今夜の記録がもう履歴にある（同じ夜の記録は1つだけ）
    if (history.some(r => r.date === nightDate)) {
        showOnly("doneArea");
        return;
    }

    // C. まだおやすみしていない → 今夜の見込みを出す
    showOnly("previewArea");
    el("wakeTimeLabel").textContent = formatClock(wake);

    // 今すぐ寝た場合
    const minutesNow = (wake - now) / (1000 * 60);
    const debtNow = previewDebt(history, settings.targetHours, now, wake);
    el("sleepNow").textContent = formatMinutes(minutesNow);
    el("debtNow").textContent = debtNow;

    // 1時間後に寝た場合
    const minutesLater = minutesNow - 60;
    if (minutesLater <= 0) {
        // 1時間後だと起きる時刻を過ぎてしまう
        el("sleepLater").textContent = "なし";
        el("debtLater").textContent = "-";
        el("debtDiff").textContent = "起きる時刻を過ぎちゃう";
    } else {
        const later = new Date(now.getTime() + 60 * 60 * 1000);
        const debtLater = previewDebt(history, settings.targetHours, later, wake);
        el("sleepLater").textContent = formatMinutes(minutesLater);
        el("debtLater").textContent = debtLater;
        const diff = debtLater - debtNow;
        el("debtDiff").textContent = diff === 0 ? "変わらない" : `+${diff}`;
    }
}


// ===== 6. ボタンを押したとき =====

// おやすみ：今の時刻と、今夜の目標時間を保存する
// 目標をここで固定しておくと、朝に目標を下げて借金を消すことができない
function onGoodnight() {
    const settings = loadSettings();
    save(KEY_PENDING, {
        sleptAt: new Date().toISOString(),
        targetHours: settings.targetHours,
    });
    render();
}

// 間違えて押したとき用：おやすみを取り消す
function onCancel() {
    localStorage.removeItem(KEY_PENDING);
    render();
}

// 設定を保存する
function onSaveSettings() {
    const targetHours = Number(el("targetInput").value);
    const wakeTime = el("wakeInput").value; // "07:00" の形
    if (!(targetHours >= 4 && targetHours <= 12) || wakeTime === "") {
        el("settingsMessage").textContent = "目標は4〜12時間、起きる予定の時刻も入れてね";
        return;
    }
    save(KEY_SETTINGS, { targetHours, wakeTime });
    el("settingsMessage").textContent = "保存しました";
    render();
}


// ===== 7. ページを開いたときに動かす =====

function init() {
    // 設定欄に、保存されている値を入れておく
    const settings = loadSettings();
    el("targetInput").value = settings.targetHours;
    el("wakeInput").value = settings.wakeTime;

    // ボタンと、押したときに動かす関数を結びつける
    el("goodnightButton").addEventListener("click", onGoodnight);
    el("cancelButton").addEventListener("click", onCancel);
    el("saveSettingsButton").addEventListener("click", onSaveSettings);

    render();
    setInterval(render, 60 * 1000); // 1分ごとに見込みを更新する
}

init();