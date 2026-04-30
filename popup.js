const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');

// وظيفة اللصق السريع
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        chatInput.value = text;
        translateText(text);
    } catch (err) {
        console.error('فشل الوصول للحافظة');
    }
});

// وظيفة النسخ السريع
copyBtn.addEventListener('click', () => {
    const textToCopy = output.innerText;
    if (textToCopy && textToCopy !== "...") {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "COPIED!";
        setTimeout(() => copyBtn.innerText = originalText, 2000);
    }
});

function updateStatus(msg, isLoading) {
    statusText.innerText = msg;
    document.getElementById('status-area').className = isLoading ? 'status-area loading' : 'status-area';
}

async function translateText(text) {
    if (!text) { output.innerText = "..."; details.innerHTML = "المفردات ستظهر هنا"; return; }
    updateStatus("Translating", true);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&q=${encodeURIComponent(text)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data[0]) output.innerText = data[0][0][0];
        if (data[1]) {
            details.innerHTML = data[1].map(i => `• **[${i[0]}]** : ${i[2].slice(0, 3).map(x => x[0]).join(', ')}`).join('<br>');
        } else { details.innerHTML = isArabic ? "No English synonyms" : "لا توجد مرادفات عربية"; }
        updateStatus("Ready", false);
    } catch (err) { updateStatus("Error", false); }
}

let typingTimer;
chatInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    updateStatus("Typing", false);
    typingTimer = setTimeout(() => translateText(chatInput.value.trim()), 800);
});
