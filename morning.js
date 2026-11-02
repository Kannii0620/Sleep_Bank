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
    // goodmorning();
    showScreen('morning-screen');
});

document.getElementById('show-result').addEventListener('click', () => {
    showScreen('result-screen');
});

document.getElementById('back-home').addEventListener('click', () => {
    showScreen('home-screen');
});