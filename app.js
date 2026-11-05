/* app.js — 1画面の共通部分（借金の表示・ひつじ・セリフ・朝夜・デモ）

全体の流れ
1. ひつじのドット絵（4つの表情）
2. セリフ（1文字ずつ出す・押すと次へ）
3. 借金の表示（いちばん上のパネル）
4. 朝・夜の見た目
5. 画面全体を描き直す render()
6. デモ用ボタン
7. ページを開いたときに動かす

計算・保存は全部 bank.js に任せる。この画面は bank.js の関数を呼んで表示するだけ。
夜の処理は night.js、朝の処理は morning.js に分けてある。
*/


// 何度も書く document.getElementById を短くする
function el(id) {
    return document.getElementById(id);
}

// bank.js にその関数があるか（まだマージされていない PR の関数を安全に使うため）
function hasBankFunction(name) {
    return typeof window[name] === "function";
}


// ===== 1. ひつじのドット絵 =====

// 色の名前（1文字）と色
const SHEEP_COLORS = {
    K: "#1b1530", // ふちどり・目
    W: "#ffffff", // 毛
    G: "#c9c4e6", // 毛のかげ
    S: "#fde3c8", // 顔
    P: "#f58fa8", // ほっぺ・耳の中
    B: "#4c63d8", // ぼうし
    L: "#8ea6ff", // ぼうしのふち
    Y: "#ffd23f", // ほし
    D: "#3b3352", // 足
    T: "#7ec8ff", // なみだ
    M: "#d9475f", // 口の中
};

// 表情ごとの目・口など。[x, y, 色] の点を顔の上に打つ
const SHEEP_FACES = {
    // ふつう：点の目、小さい口
    normal: [
        [13, 19, "K"], [13, 20, "K"], [19, 19, "K"], [19, 20, "K"],
        [15, 22, "K"], [16, 22, "K"],
        [11, 21, "P"], [21, 21, "P"],
    ],
    // よろこぶ：^ ^ の目、大きく開いた口、ほっぺ多め
    happy: [
        [12, 20, "K"], [13, 19, "K"], [14, 20, "K"],
        [18, 20, "K"], [19, 19, "K"], [20, 20, "K"],
        [14, 22, "K"], [15, 23, "K"], [16, 23, "K"], [17, 22, "K"], [15, 22, "M"], [16, 22, "M"],
        [11, 21, "P"], [12, 21, "P"], [20, 21, "P"], [21, 21, "P"],
    ],
    // しょんぼり：下がった目、への字の口、なみだ
    sad: [
        [12, 19, "K"], [13, 20, "K"], [14, 20, "K"],
        [18, 20, "K"], [19, 20, "K"], [20, 19, "K"],
        [14, 23, "K"], [15, 22, "K"], [16, 22, "K"], [17, 23, "K"],
        [13, 21, "T"], [13, 22, "T"],
    ],
    // ねてる：とじた目、小さい口
    sleep: [
        [12, 20, "K"], [13, 20, "K"], [14, 20, "K"],
        [18, 20, "K"], [19, 20, "K"], [20, 20, "K"],
        [16, 22, "K"],
        [11, 21, "P"], [21, 21, "P"],
    ],
};

// 32×32 のマス目に図形をぬって、ひつじを作る。返すのは「色の文字」の2次元配列
// 表情（mood）で変わるのは顔だけ。体・ぼうしはどの表情でも同じ
function buildSheep(mood) {
    const size = 32;
    const grid = Array.from({ length: size }, () => Array(size).fill("."));

    // 条件に合うマスを色 c でぬる（マスの真ん中の点で判定する）
    function paint(test, c) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (test(x + 0.5, y + 0.5)) grid[y][x] = c;
            }
        }
    }
    const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

    // 足
    paint((x, y) => y >= 26 && y < 30 && ((x >= 11 && x < 13) || (x >= 19 && x < 21)), "D");

    // もこもこの毛：まんなかの楕円 ＋ まわりに小さい円を10こ
    const bumps = [];
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        bumps.push(ellipse(16 + 8.5 * Math.cos(angle), 18 + 8 * Math.sin(angle), 3.6, 3.6));
    }
    paint((x, y) => ellipse(16, 18, 9, 8.5)(x, y) || bumps.some(b => b(x, y)), "W");
    // 右下にかげ
    paint((x, y) => grid[Math.floor(y)][Math.floor(x)] === "W" && (x - 16) * 0.7 + (y - 18) > 8, "G");

    // 耳
    paint(ellipse(4.5, 18.5, 2.6, 1.6), "S");
    paint(ellipse(27.5, 18.5, 2.6, 1.6), "S");
    grid[18][4] = "P";
    grid[18][27] = "P";

    // 顔
    paint(ellipse(16, 19.5, 6, 5.2), "S");

    // ナイトキャップ（三角形）
    const tipX = 20;
    paint((x, y) => {
        if (y < 3 || y > 13) return false;
        const t = (y - 3) / 10;              // 0（先っぽ）〜 1（ふち）
        const left = tipX + (8.5 - tipX) * t;
        const right = tipX + (23.5 - tipX) * t;
        return x >= left && x <= right;
    }, "B");
    paint((x, y) => y >= 11.5 && y < 13.5 && x >= 8 && x < 24.5, "L"); // ふち
    // 先っぽのほし
    const starY = 2;
    [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        grid[starY + dy + 1][tipX + dx] = "Y";
    });

    // 外側のふちどり：何もないマスのとなりに色があれば黒にする
    const filled = (x, y) => x >= 0 && y >= 0 && x < size && y < size && grid[y][x] !== "." && grid[y][x] !== "o";
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === "." && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) {
                grid[y][x] = "o"; // あとで黒にする（ここで黒にすると、ふちどりのふちどりができてしまう）
            }
        }
    }
    // 顔のまわりのふちどり（毛と顔のさかいめ）
    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            const isWool = grid[y][x] === "W" || grid[y][x] === "G";
            const touchesFace = [grid[y][x - 1], grid[y][x + 1], grid[y - 1][x], grid[y + 1][x]].includes("S");
            if (isWool && touchesFace) grid[y][x] = "K";
        }
    }
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === "o") grid[y][x] = "K";
        }
    }

    // 表情
    (SHEEP_FACES[mood] || SHEEP_FACES.normal).forEach(([x, y, c]) => {
        grid[y][x] = c;
    });
    return grid;
}

// 今の表情（"normal" / "happy" / "sad" / "sleep"）
let currentMood = "normal";

// ひつじの表情を変える
function setMood(mood) {
    if (!SHEEP_FACES[mood]) mood = "normal";
    currentMood = mood;
    const canvas = el("chara");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    buildSheep(mood).forEach((row, y) => {
        row.forEach((c, x) => {
            if (c === ".") return;
            ctx.fillStyle = SHEEP_COLORS[c];
            ctx.fillRect(x, y, 1, 1);
        });
    });
}


// ===== 2. セリフ =====

let lineQueue = [];   // まだ出していないセリフ
let typingTimer = null;
let typingFull = "";  // 今出しているセリフの全文

// セリフを出す。配列で渡すと、押すたびに次のセリフへ進む
function say(lines) {
    lineQueue = Array.isArray(lines) ? [...lines] : [lines];
    showNextLine();
}

function showNextLine() {
    const text = lineQueue.shift();
    if (text === undefined) return;
    clearInterval(typingTimer);
    typingFull = text;
    el("lineFull").textContent = text; // 読み上げ用
    let shown = 0;
    el("line").textContent = "";
    typingTimer = setInterval(() => {
        shown++;
        el("line").textContent = text.slice(0, shown);
        if (shown >= text.length) finishTyping();
    }, 40);
    el("next").hidden = true;
}

function finishTyping() {
    clearInterval(typingTimer);
    typingTimer = null;
    el("line").textContent = typingFull;
    el("next").hidden = lineQueue.length === 0;
}

// セリフの枠（ボタン）を押したとき：とちゅうなら全部出す、出しきっていたら次へ
function onDialogClick() {
    if (typingTimer) {
        finishTyping();
    } else {
        showNextLine();
    }
}


// ===== 3. 借金の表示 =====

// 今の借金が始まってから一番多かった額（完済バーの「全体」に使う）
// 借金が0になった日でリセットする。bank.js の calcDebt を日ごとに呼んで調べる
function peakDebt(history, today) {
    if (history.length === 0) return 0;
    let day = addDays(history.map(r => r.date).sort()[0], 1);
    let peak = 0;
    while (day <= today) {
        const debt = calcDebt(history, day).debt;
        peak = debt === 0 ? 0 : Math.max(peak, debt);
        day = addDays(day, 1);
    }
    return peak;
}

function renderHud(status) {
    el("debt").textContent = status.debt;
    el("streak").textContent = `🔥${status.streak}日`;

    // ランクは bank.js の getStatus が返すようになったら表示する
    el("rank").hidden = !status.rank;
    if (status.rank) el("rank").textContent = `ランク${status.rank}`;

    const peak = Math.max(peakDebt(load("history", []), todayString()), status.debt);
    if (status.debt === 0) {
        el("progressLabel").textContent = "借金なし";
        el("remaining").textContent = "完済！";
        el("bar").style.width = "100%";
    } else {
        el("progressLabel").textContent = "完済まで";
        el("remaining").textContent = `あと ${status.debt}`;
        el("bar").style.width = `${Math.round(((peak - status.debt) / peak) * 100)}%`;
    }
}


// ===== 4. 朝・夜の見た目 =====

let forcedTheme = null; // デモで朝/夜を切りかえたとき。null なら時刻で決める

function renderTheme() {
    const hour = now().getHours(); // bank.js の now()（早送り込み）
    const autoTheme = hour >= 5 && hour < 17 ? "morning" : "night";
    const theme = forcedTheme || autoTheme;
    document.body.classList.toggle("is-morning", theme === "morning");
    document.body.classList.toggle("is-night", theme === "night");
}


// ===== 5. 画面全体を描き直す =====

// 保存されている内容から、画面全体を描き直す。セリフはここでは変えない
function render() {
    const status = getStatus();
    const settings = load("settings", null);

    renderHud(status);
    renderTheme();

    // 押せるボタンはどちらか片方だけ
    el("goodnightButton").disabled = status.isSleeping;
    el("goodmorningButton").disabled = !status.isSleeping;

    renderNightPanel(status, settings); // night.js
    return status;
}

// 状態に合った表情（寝ている → ねてる、それ以外は昨夜の結果）
function moodFor(status) {
    if (status.isSleeping) return "sleep";
    return status.mood || "normal"; // mood は bank.js の getStatus が返すようになったら使われる
}

// 画面を開いたときのあいさつ
function greetingLines(status, settings) {
    if (!settings) {
        return ["いらっしゃいませ〜 睡眠銀行 ひつじ支店へようこそ", "まずは目標の睡眠時間と、起きる時刻を教えてね"];
    }
    if (status.isSleeping) {
        return ["……zzz", "起きたら『おはよう』を押してね"];
    }
    const lines = [];
    if (status.missedYesterday) lines.push("昨日の分、まだ記帳されてないよ…");
    lines.push(...nightLines(status)); // night.js
    return lines;
}


// ===== 6. デモ用ボタン =====

function setupDemo() {
    // 4つの表情：顔を変えて、その表情のセリフを1つ言う
    document.querySelectorAll("[data-mood]").forEach(button => {
        button.addEventListener("click", () => {
            setMood(button.dataset.mood);
            say(pickLine(MOOD_LINES[button.dataset.mood]));
        });
    });

    // 朝/夜
    el("themeButton").addEventListener("click", () => {
        const isMorning = document.body.classList.contains("is-morning");
        forcedTheme = isMorning ? "night" : "morning";
        renderTheme();
    });

    // 早送り・リセット（bank.js にあるときだけ）
    if (hasBankFunction("fastForward")) {
        el("forwardButton").hidden = false;
        el("forwardButton").addEventListener("click", () => {
            fastForward(8 * 60);
            forcedTheme = null;
            const status = render();
            say(`8時間すすめたよ（今 ${formatClock(now())}）`);
            setMood(moodFor(status));
        });
    }
    if (hasBankFunction("resetDemo")) {
        el("resetButton").hidden = false;
        el("resetButton").addEventListener("click", () => {
            resetDemo();
            forcedTheme = null;
            start();
        });
    }
}

// 表情ごとのセリフ。押すたびにこの中から1つ選ぶ
const MOOD_LINES = {
    normal: [
        "いらっしゃいませ〜 今夜も記帳していってね",
        "睡眠銀行 ひつじ支店へようこそ",
        "今日はどんな一日だった？",
        "通帳の記帳はおやすみボタンからどうぞ",
        "ひつじが1匹、ひつじが2匹…あ、ぼくか",
    ],
    happy: [
        "目標達成！ 借金がへったよ、えらい！",
        "よく眠れたね！ 毛並みもつやつやだよ",
        "この調子なら完済も近いね！",
        "返済ありがとう〜 ひつじ支店も大よろこび！",
        "ぐっすり記帳、ばっちりだね！",
    ],
    sad: [
        "そろそろ返してほしいな…",
        "利息がふえちゃうよ…今夜こそ早く寝よう？",
        "昨日はちょっと寝不足だったね…",
        "借金、じわじわふえてるよ…",
        "ひつじ、ちょっと心配だな…",
    ],
    sleep: [
        "……zzz",
        "……むにゃ…もう食べられない…",
        "……zzz 利息は…あしたで…",
        "……すぴー",
        "……ひつじが…1000匹…zzz",
    ],
};

let lastPickedLine = "";

// セリフの候補から1つ選ぶ（同じセリフが続けて出ないようにする）
function pickLine(lines) {
    const choices = lines.length > 1 ? lines.filter(line => line !== lastPickedLine) : lines;
    lastPickedLine = choices[Math.floor(Math.random() * choices.length)];
    return lastPickedLine;
}


// ===== 7. ページを開いたときに動かす =====

// 画面を最初の状態にする（開いたとき・リセットしたとき）
function start() {
    const status = render();
    const settings = load("settings", null);
    setMood(moodFor(status));
    say(greetingLines(status, settings));
    if (!settings) openSettings(); // night.js
}

window.addEventListener("DOMContentLoaded", () => {
    el("dialogButton").addEventListener("click", onDialogClick);
    setupNight();   // night.js
    setupMorning(); // morning.js
    setupDemo();
    start();
    setInterval(render, 60 * 1000); // 1分ごとに見込みと時刻を更新する
});
