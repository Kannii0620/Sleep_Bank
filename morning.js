// テスト
localStorage.clear();
const saveset = saveSettings(8, "07:00");
console.log(saveset);
const sleepResult = goodnight();
console.log(sleepResult);

// getstatus
const ifstatus = getStatus();
console.log(ifstatus);

if (ifstatus.isSleeping) {
    showScreen('wake-up');
}else {
    showScreen('home-screen');
}

// 指定した画面だけを表示します。
function showScreen(screenId) {
    const screens = document.querySelectorAll('main > div, main > section');

    screens.forEach((screen) => {
        screen.hidden = screen.id !== screenId;
    });

    // 切り替え先の見出しに移動し、キーボードでも操作しやすくします。
    document.querySelector(`#${screenId} h2`).focus();
}

// 睡眠中 → おはよう → 結果 → 通常
// ここでは画面だけを切り替えます。睡眠の記録・計算・保存は未接続です。
document.getElementById('wake-up').addEventListener('click', () => {
    // bank.jsのgoodmorning関数を呼び出す
    const result = goodmorning();
    console.log(result);

    const sleepMinutes = result.sleepMinutes;
    const debt = result.debt;
    const change = result.change;
    document.getElementById('sleep-duration').textContent = `${sleepMinutes}分`;
    document.getElementById('current-debt').textContent = `${debt}コイン`;
    document.getElementById('change-result').textContent = `${change}コイン`;

    showScreen('morning-screen');
});

document.getElementById('show-result').addEventListener('click', () => {
    showScreen('result-screen');
});

document.getElementById('back-home').addEventListener('click', () => {
    showScreen('home-screen');
});