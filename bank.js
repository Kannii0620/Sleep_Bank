const INTEREST_RATE = 1.1;    // 1日あたりの利息（10%）
const COINS_PER_HOUR = 100;   // 睡眠1時間＝100コイン

//日付の文字列をn日ずらす　（"2026-10-28", -1 → "2026-10-27"）
function addDays(dateStr, n) {
    const date = new Date(dateStr + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
}

// 寝た時刻と起きた時刻（文字）から、睡眠時間（分）を返す
function sleepMinutesBetween(sleptAt, wokeAt) {
    const woke = new Date(wokeAt);
    const slept = new Date(sleptAt);
    const diffMs = woke - slept;
    const sleepMinutes = diffMs / (1000 * 60); //単位を分にする
    return sleepMinutes;
}

/* 全体の流れ

1. 借金を0、連続を0から始める
2. 始まりの日付 ＝ 履歴の中の一番古い date
3. 終わりの日付 ＝ today の1日前
4. 始まりから終わりまで、1日ずつ繰り返す：
   4-1. 利息を足す（借金 × 1.1、小数は切り捨て）
   4-2. その日の夜の睡眠記録を、履歴から探す
   4-3. 記録があったら：
         ・睡眠時間 ＝ 起きた日時 − 寝た日時
         ・差 ＝ 目標 − 睡眠時間
         ・差がプラス（足りない）→ 差 × 100 を借金に足す（切り捨て）
         ・差がマイナスかゼロ（足りてる）→ 差の分を返済。借金は0より下にしない
         ・目標以上寝た → 連続 +1、届かなかった → 連続 0
   4-4. 記録がなかったら：
         ・昨日の夜なら → 連続はそのまま
         ・それより前なら → 連続 0
5. 借金と連続を返す
*/

function calcDebt(history, today) {
    // 1. 借金を0、連続を0から始める
    let debt = 0;
    let streak = 0;
    // 2. 始まりの日付 ＝ 履歴の中の一番古い date
    if (history.length === 0) {
        return { debt: 0, streak: 0 }
    }
    const firstDay = history.map(r => r.date).sort()[0];
    // 3. 終わりの日付 ＝ today の1日前
    const lastDay = addDays(today, -1);
    // 4. 繰り返し
    let day = firstDay;
    while (day <= lastDay) {
        //4-1.利息の追加
        debt = Math.floor(debt * INTEREST_RATE);
        //4-2. その日の夜の睡眠記録を履歴から探す
        const record = history.find(r => r.date === day); //=>はアロー関数 rを受け取って、条件を返す関数
        if (record) { //record Noneならundefined
            // 4-3
            const sleepMinutes = sleepMinutesBetween(record.sleptAt, record.wokeAt);
            const diffMinutes = (record.targetHours * 60) - sleepMinutes;
            if (diffMinutes <= 0) {
                debt = (debt - Math.floor((Math.abs(diffMinutes) * COINS_PER_HOUR / 60)));
                if (debt <= 0) {
                    debt = 0;
                }
                streak++
            } else {
                debt = (debt + Math.floor((Math.abs(diffMinutes) * COINS_PER_HOUR / 60)));
                streak = 0;
            }


        } else {
            //4-4
            if (day !== lastDay) {
                streak = 0;
            }
        }
        day = addDays(day, 1);
    }
    // 5. 借金と連続を返す
    return { debt, streak };
}

// データの保存
function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

//名前で読む、まだ何もなければdefaultVlalueを返す
function load(key, defaultValue) {
    const text = localStorage.getItem(key);
    if (text === null) {
        return defaultValue;
    }
    return JSON.parse(text);
}

//早送り込みの[今]を、日時オブジェクトで返す
function now() {
    const timeOffset = load("timeOffset", 0);
    const offsetMs = timeOffset * 1000 * 60;
    return new Date(Date.now() + offsetMs);
}

// 日時オブジェクトを "2026-10-30T03:23" の形の文字にする
function formatDateTime(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
        + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

// 早送り込みの「今」を "2026-10-30T03:23" の形で返す
function nowString() {
    return formatDateTime(now());
}

// 早送り込みの「今日」を "2026-10-30" の形で返す
function todayString() {
    return nowString().slice(0, 10);
}

/* おやすみの流れ

1. 設定がない → 失敗（NO_SETTINGS）
2. もう寝ている → 失敗（ALREADY_SLEEPING）
3. 今の時刻と、今の目標を仮置きする
4. 成功を返す { ok, sleptAt }
*/
function goodnight() {
    // 1. 設定がない → 失敗
    const settings = load("settings", null);
    if (!settings) {
        return { ok: false, code: "NO_SETTINGS", reason: "先に目標睡眠時間を設定してね" }
    }
    // 2. もう寝ている → 失敗
    if (load("sleptAt", null)) {
        return { ok: false, code: "ALREADY_SLEEPING", reason: "もう寝ています" }
    }
    // 3. 今の時刻と、今の目標を仮置きする
    const nowTime = nowString(); //現在時刻
    save("sleptAt", nowTime);
    //4. sleptTargetHours に settings の目標を保存
    save("sleptTargetHours", settings.targetHours);
    //5. 成功を返す { ok, sleptAt }
    return { ok: true, sleptAt: nowTime };
}

/* おはようの流れ

1. 寝ていない（sleptAt がない） → 失敗（NOT_SLEEPING）
2. 準備
   ・起きた時刻 ＝ 今（now() を呼ぶのはここの1回だけ）
   ・今日 ＝ 起きた時刻から日付だけ切り出す
   ・その夜 ＝ 今日の1日前（0時過ぎに寝ても前日扱い）
   ・睡眠時間（分）、履歴
3. 16時間以上たっている → 失敗（FORGOT_MORNING）。手入力に回す
4. その夜の記録がもうある → 失敗（ALREADY_RECORDED）
5. 足す前の借金 ＝ calcDebt(今の履歴, その夜) … 一昨日の夜まで
6. 履歴に1行足して保存、sleptAt を空にする（おはようボタン経由なので manual は false）
7. 足した後の借金 ＝ calcDebt(新しい履歴, 今日) … 昨日の夜まで
8. 成功を返す
   ・change：後 − 前（利息込みの増減。マイナスなら返済）
   ・achieved：目標ちょうども達成（calcDebt と同じ基準）
*/
function goodmorning() {
    // 1. 寝ていない（sleptAt がない） → 失敗
    const sleptAt = load("sleptAt", null);
    if (!sleptAt) {
        return { ok: false, code: "NOT_SLEEPING", reason: "まだおやすみしていません" }
    }
    // 2. 準備
    const wokeAt = nowString();
    const today = wokeAt.slice(0, 10);
    const lastNight = addDays(today, -1);
    const sleepMinutes = sleepMinutesBetween(sleptAt, wokeAt);
    const history = load("history", []);

    // 3. 16時間以上 → 押し忘れ
    if (sleepMinutes >= 960) {
        return { ok: false, code: "FORGOT_MORNING", reason: "おはようの押し忘れかも。起きた時刻を入力してね" }
    }
    // 4. その夜の記録がもうある → 失敗
    if (history.find(r => r.date === lastNight)) {
        return { ok: false, code: "ALREADY_RECORDED", reason: "もう夜の記録があるよ" }
    }
    // 5. 足す前の借金
    const debtBefore = calcDebt(history, lastNight).debt;

    // 6. 履歴に一行足して保存、sleptAt　を空に
    const record = {
        date: lastNight,
        sleptAt: sleptAt,
        wokeAt: wokeAt,
        targetHours: load("sleptTargetHours", load("settings", null).targetHours),
        manual: false
    };
    history.push(record);
    save("history", history);
    save("sleptAt", null);
    localStorage.removeItem("sleptTargetHours");

    // 7. 足した後の借金
    const debtAfter = calcDebt(history, today).debt;

    //8. 成功を返す
    return {
        ok: true,
        change: debtAfter - debtBefore,
        debt: debtAfter,
        sleepMinutes,
        achieved: sleepMinutes >= record.targetHours * 60
    };
}

//ユーザーから受け取る起床予定時間と、目標睡眠時間をsettingsに保存する
function saveSettings(targetHours, wakeTime) {
    if (targetHours < 4 || targetHours > 12 || wakeTime === "") {
        return { ok: false, code: "INVALID_TIME", reason: "睡眠時間は4~12時間、起きる予定の時刻も入れてね" };
    }
    const settings = {
        targetHours: targetHours,
        wakeTime: wakeTime
    };
    save("settings", settings);
    return { ok: true, targetHours: targetHours, wakeTime: wakeTime };
}

/* 今の状態を返す（どの画面も、開いた瞬間に呼ぶ）

1. sleptAt と履歴を読む
2. 寝ているか ＝ sleptAt があるか
3. 今の借金と連続日数 ＝ calcDebt(履歴, 今日) … 昨日の夜まで
4. 昨夜の記録を探す
5. キャラの気分 ＝ 昨夜の記録で決める
6. 昨日が未記録か（初日は除く）
7. 信用ランク（連続達成日数で決める）
8. まとめて返す（保存はしない、失敗もしない）

返すもの：
  { ok: true, isSleeping, sleptAt, debt, streak, mood, missedYesterday, rank}
  ・isSleeping：寝ていれば true
  ・sleptAt：寝た時刻（起きているときは null）
  ・mood：昨夜 達成 → "happy"、未達 → "sad"、未記録・初日 → "normal"
  ・missedYesterday：昨夜の記録がなければ true（初日は false）
  ・rank：連続達成 0〜2日 "bronze"、3〜6 "silver"、7〜13 "gold"、14〜20 "platinum"、21〜27 "master"、28〜 "predator"
*/
function getStatus() {
    //1. sleepAtと履歴を読む
    const history = load("history", []);
    const today = todayString();
    const sleptAt = load("sleptAt", null);
    let mood = "normal";

    //2. 寝ているか否か
    const isSleeping = sleptAt !== null;

    //3. 今の借金と連続日数
    const result = calcDebt(history, today);

    //4. 昨夜の記録を探す
    const lastNight = addDays(today, -1);
    const record = history.find(r => r.date === lastNight);

    //5. キャラの気分
    if (record) {
        const sleepMinutes = sleepMinutesBetween(record.sleptAt, record.wokeAt);
        if (sleepMinutes >= record.targetHours * 60) {
            mood = "happy";
        }
        else {
            mood = "sad";
        }

    }

    //6.昨日が未記録か(初日と、寝ている時は除く)
    const missedYesterday = history.length !== 0 && !record && !isSleeping;//初日以外での、未記録

    // 7. 信用ランク（連続達成日数で決める）
    const streak = result.streak;
    let rank = "bronze";
    if (streak >= 0 && streak < 3) {
        rank = "bronze";
    }
    else if (streak >= 3 && streak < 7) {
        rank = "silver";
    }
    else if (streak >= 7 && streak < 14) {
        rank = "gold";
    }
    else if (streak >= 14 && streak < 21) {
        rank = "platinum";
    }
    else if (streak >= 21 && streak < 28) {
        rank = "master";
    }
    else if (streak >= 28) {
        rank = "predator";
    }

    //8. まとめて返す
    return {
        ok: true,
        isSleeping,
        sleptAt,
        debt: result.debt,
        streak: result.streak,
        mood,
        missedYesterday,
        rank
    }
}

/* おやすみの取り消し（間違えておやすみを押したとき用）

1. 寝ていない（sleptAt がない） → 失敗（NOT_SLEEPING）
2. sleptAt を空にする（履歴にはまだ書いてないので、履歴は触らない）
3. 成功を返す { ok: true, sleptAt } … 取り消したおやすみの時刻

使い方（画面側）：
  const result = cancelSleep();
  if (result.ok) {
      // result.sleptAt で「0:15のおやすみを取り消したよ」と表示
  } else {
      // result.reason を表示
  }
*/
function cancelSleep() {
    const sleptAt = load("sleptAt", null);
    if (!sleptAt) {
        return { ok: false, code: "NOT_SLEEPING", reason: "まだおやすみしていません" };
    }
    save("sleptAt", null);
    localStorage.removeItem("sleptTargetHours");
    return { ok: true, sleptAt };

}

/* 早送り（デモ用）

1. 数字に変換して、0以下・数字じゃない → 失敗（INVALID_FORWARD_TIME）
2. 今のずらし幅（timeOffset、分）に足して保存
   ・now() が毎回 timeOffset を読むので、これだけでアプリの中の「今」が進む
3. 成功を返す { ok: true, now } … 進めた後の時刻

使い方（画面側）：
  fastForward(8 * 60);  // 8時間進める
*/

function fastForward(minutes) {
    const forwardMinute = Number(minutes);
    if (!(forwardMinute >= 1 && forwardMinute <= 10080 && Number.isInteger(forwardMinute))) {
        return { ok: false, code: "INVALID_FORWARD_TIME", reason: "早送りは1分～1週間(10080分)の整数にしてね" };
    }
    const timeOffset = load("timeOffset", 0);
    const forwardTime = timeOffset + forwardMinute;
    save("timeOffset", forwardTime);
    return { ok: true, now: nowString() }
}

/* デモ用：全部消して最初の状態に戻す

1. bank.js が保存している5つ（history / settings / timeOffset / sleptAt/ sleptTargetHours）を消す
   ・localStorage.clear() は使わない（同じサイトのほかのページのデータまで消えるため）
2. 成功を返す { ok: true }（失敗はしない）

使い方（画面側）：
  resetDemo();
  // そのあと画面を描き直す（設定画面から始まる）
*/
function resetDemo() {
    localStorage.removeItem("history");
    localStorage.removeItem("settings");
    localStorage.removeItem("timeOffset");
    localStorage.removeItem("sleptAt");
    localStorage.removeItem("sleptTargetHours");

    return { ok: true };
}

// 次に起きる予定の日時を返す（例：今が23時・起床7:00 → 明日の7:00）
// night.js の nextWakeTime を移したもの
function nextWakeTime(from, wakeTime) {
    const [h, m] = wakeTime.split(":").map(Number); // "07:00" → [7, 0]
    const wake = new Date(from);
    wake.setHours(h, m, 0, 0);         // その日の7:00にする
    if (wake <= from) {
        wake.setDate(wake.getDate() + 1); // もう過ぎていたら次の日の7:00
    }
    return wake;
}

/* 今夜の見込み（夜画面の「今寝ると明日の借金いくら」用）

1. もう寝ている → 失敗（ALREADY_SLEEPING）
2. 設定がない → 失敗（NO_SETTINGS）
3. 寝る時刻 ＝ 渡された時刻（なければ今）
4. 起きる時刻 ＝ 寝る時刻の次に来る起床予定（settings.wakeTime）
5. 「もしこの時刻に寝て、起床予定に起きたら」の仮の1行を作る
6. 仮の1行を足した履歴で calcDebt … 保存はしない（見込みだから）
7. 成功を返す
   ・projectedDebt：明日の朝の借金の見込み
   ・change：今の借金からの増減（利息込み）
   ・sleepMinutes：見込みの睡眠時間（分）
   ・wakeAt：起きる予定の時刻
*/

function previewTonight(sleepAt) {
    // 1. もう寝ている → 失敗
    if (load("sleptAt", null)) {
        return { ok: false, code: "ALREADY_SLEEPING", reason: "もう寝ています" }
    }
    // 2. 設定がない → 失敗
    const settings = load("settings", null);
    if (!settings) {
        return { ok: false, code: "NO_SETTINGS", reason: "先に目標睡眠時間を設定してね" }
    }
    // 3. 寝る時刻（なければ今）
    const sleepTime = sleepAt || now();

    // 4. 起きる時刻
    const wakeTime = nextWakeTime(sleepTime, settings.wakeTime);
    const wakeDay = formatDateTime(wakeTime).slice(0, 10);

    // 5. 仮の1行を作る
    const tonight = {
        date: addDays(wakeDay, -1), // その夜 ＝ 起きる日の前日
        sleptAt: formatDateTime(sleepTime),
        wokeAt: formatDateTime(wakeTime),
        targetHours: settings.targetHours,
        manual: false
    };

    // 6. calcDebt を呼ぶ（保存はしない）
    const history = load("history", []);
    const projectedDebt = calcDebt([...history, tonight], wakeDay).debt;
    const currentDebt = calcDebt(history, todayString()).debt;

    // 7.返す
    return {
        ok: true,
        projectedDebt,
        change: projectedDebt - currentDebt,
        sleepMinutes: sleepMinutesBetween(tonight.sleptAt, tonight.wokeAt),
        wakeAt: tonight.wokeAt
    };
}
/* 通帳（毎晩の記録を、銀行の通帳みたいに1行ずつ並べる）

1. 履歴を読む。空なら行なし
2. 一番古い日から昨日まで、1日ずつ繰り返す（calcDebt と同じ順番で計算する）
   2-1. 利息を足す → 0より大きければ「リソク」の行
   2-2. その夜の記録を探す
   2-3. 記録があったら → 睡眠を反映して「スイミン 8:00」の行
        ・borrow：増えた分 / repay：実際に減った分（0で止まった分は書かない）
        ・paidOff：この行で借金が0になったら true（完済マーク用）
   2-4. 記録がなかったら → 「ミキチョウ」の行（昨日の夜は、まだ記帳できるので出さない）
3. 行をまとめて返す { ok: true, rows }
   ・1行：{ date, memo, borrow, repay, balance, paidOff }
   ・最後の行の balance は、calcDebt の借金と同じになる
*/
function getPassbook() {
    //1. 履歴を読む。空なら行なし
    const history = load("history", []);
    const today = todayString();
    const rows = [];          // 通帳の行をためる
    let debt = 0;
    if (history.length === 0) {
        return { ok: true, rows };
    }
    const firstDay = history.map(r => r.date).sort()[0];
    const lastDay = addDays(today, -1);
    let day = firstDay;

    //2. 一番古い日から昨日まで、1日ずつ繰り返す（calcDebt と同じ順番で計算する）
    while (day <= lastDay) {
        // 2-1. 利息
        const beforeDebt = debt;
        debt = Math.floor(debt * INTEREST_RATE);
        const interest = debt - beforeDebt;
        if (interest > 0) {
            rows.push({ date: day, memo: "リソク", borrow: interest, repay: 0, balance: debt, paidOff: false });
        }

        // 2-2. 記録を探す（calcDebt と同じ）
        const record = history.find(r => r.date === day);

        // 2-3. 記録があったら
        if (record) {
            const beforeSleep = debt;

            const sleepMinutes = sleepMinutesBetween(record.sleptAt, record.wokeAt);
            const diffMinutes = (record.targetHours * 60) - sleepMinutes;
            if (diffMinutes <= 0) {
                debt = (debt - Math.floor((Math.abs(diffMinutes) * COINS_PER_HOUR / 60)));
                if (debt <= 0) {
                    debt = 0;
                }
            } else {
                debt = (debt + Math.floor((Math.abs(diffMinutes) * COINS_PER_HOUR / 60)));
            }

            const borrow = Math.max(0, debt - beforeSleep);
            const repay = Math.max(0, beforeSleep - debt);
            rows.push({
                date: day,
                memo: "スイミン " + Math.floor(sleepMinutes / 60) + ":" + String(sleepMinutes % 60).padStart(2, "0"),       // 「8:00」みたいな時間
                borrow,
                repay,
                balance: debt,
                paidOff: beforeSleep > 0 && debt === 0                 // この行で0になったかどうか
            });
        } else if (day !== lastDay) {
            rows.push({
                date: day,
                memo: "ミキチョウ",
                borrow: 0,
                repay: 0,
                balance: debt,
                paidOff: false               // この行で0になったかどうか
            });
        }
        day = addDays(day, 1);
    }
    //3. 行をまとめて返す { ok: true, rows }
    return { ok: true, rows };
}

// Node.jsでテストするための1行（ブラウザでは無視される）
if (typeof module !== "undefined") {
    module.exports = { calcDebt };
}