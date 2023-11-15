document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const selectedText = params.get('selectedText');
    const textContainer = document.getElementById('selected-text');
    textContainer.innerText = selectedText;
});

// 关闭窗口
window.addEventListener('blur', closePopup);

function closePopup() {
    window.close();
}
