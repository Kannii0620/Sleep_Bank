const INTEREST_RATE = 1.1;    // 1日あたりの利息（10%）
const COINS_PER_HOUR = 100;   // 睡眠1時間＝100コイン

//日付の文字列をn日ずらす　（"2026-10-28", -1 → "2026-10-27"）
function addDays(dateStr, n) {
    const date = new Date(dateStr + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
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
            const woke = new Date(record.wokeAt);
            const slept = new Date(record.sleptAt);
            const diffMs = woke - slept;
            const sleepMinutes = diffMs / (1000 * 60); //単位を分にする
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
// Node.jsでテストするための1行（ブラウザでは無視される）
if (typeof module !== "undefined") {
    module.exports = { calcDebt };
}