/* morning.js — 朝の処理（おはよう → 結果をひつじが伝える）

全体の流れ
1. おはようを押したら bank.js の goodmorning() を呼ぶ
2. 失敗なら、理由（reason）をそのままひつじに言わせる
   ・押し忘れ（FORGOT_MORNING）だけは、起きた時刻を入れる欄がまだないので、
     「おやすみを取り消す」で今夜からやり直せるように案内する
3. 成功なら、目標達成 → よろこぶ、未達 → しょんぼり
4. 睡眠時間・借金の増減・今の借金を、セリフで順番に伝える

結果のための別の画面は作らない。同じ画面のまま、上の借金とひつじの表情が変わる。
*/


// 結果のセリフ（押すたびに次へ進む）
function morningLines(result) {
    const lines = [`おはよう！ ${formatMinutes(result.sleepMinutes)} ねむれたね`]; // formatMinutes は night.js

    if (result.change < 0) {
        lines.push(`${-result.change} コイン返済できたよ`);
    } else if (result.change > 0) {
        lines.push(`利息こみで借金が ${result.change} コインふえちゃった…`);
    } else {
        lines.push("借金はそのままだよ");
    }

    if (result.debt === 0) {
        lines.push("借金ゼロ！ 完済おめでとう！");
    } else if (result.achieved) {
        lines.push(`目標達成！ のこりは ${result.debt} コインだよ`);
    } else {
        lines.push(`のこり ${result.debt} コイン。今夜は早めに寝ようね`);
    }
    return lines;
}

function onGoodmorning() {
    const result = goodmorning(); // bank.js
    if (result.code === "FORGOT_MORNING") {
        setMood("sad");
        say([
            "おやすみから16時間以上たってるよ。おはようの押し忘れかも…",
            "この夜は『おやすみを取り消す』で消して、今夜からまた記帳しよう",
        ]);
        el("cancelButton").focus(); // すぐ取り消せるように
        return;
    }
    if (!result.ok) {
        say(result.reason);
        return;
    }
    render();
    setMood(result.achieved ? "happy" : "sad");
    say(morningLines(result));
    el("dialogButton").focus(); // 押したボタンが押せなくなるので、セリフに移る（Enter で続きへ）
}

// ボタンと関数を結びつける（app.js がページを開いたときに呼ぶ）
function setupMorning() {
    el("goodmorningButton").addEventListener("click", onGoodmorning);
}
