const status = getStatus();

if (status.isSleeping) {
    showScreen('sleeping-screen');
} else {
    renderHome(status);
}

// ホーム画面に最新の借金を表示します。
function renderHome(currentStatus = getStatus()) {
    document.getElementById('coin-count').textContent = currentStatus.debt;
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
document.getElementById('wake-up').addEventListener('click', () => {
    const result = goodmorning();

    if (!result.ok) {
        alert(result.reason);
        return;
    }

    const sleepMinutes = Math.floor(result.sleepMinutes);
    const sleepHours = Math.floor(sleepMinutes / 60);
    const remainingMinutes = sleepMinutes % 60;
    const debt = result.debt;
    const change = result.change;
    const changeSign = change > 0 ? '+' : '';

    document.getElementById('sleep-duration').textContent = `${sleepHours}時間${remainingMinutes}分`;
    document.getElementById('current-debt').textContent = `${debt}コイン`;
    document.getElementById('change-result').textContent = `${changeSign}${change}コイン`;

    showScreen('morning-screen');
});

document.getElementById('show-result').addEventListener('click', () => {
    showScreen('result-screen');
});

document.getElementById('back-home').addEventListener('click', () => {
    renderHome();
});
