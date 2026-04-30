const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');

/**
 * تحديث حالة الواجهة (Ready, Typing, Translating)
 */
function updateStatus(msg, state) {
    statusText.innerText = msg;
    statusArea.classList.remove('loading', 'success');
    
    if (state === 'loading') {
        statusArea.classList.add('loading');
    } else if (state === 'success') {
        statusArea.classList.add('success');
    }
}

/**
 * دالة الترجمة وجلب المفردات
 */
async function translateText(text) {
    if (!text) {
        output.innerText = "...";
        details.innerHTML = "المفردات ستظهر هنا";
        updateStatus("Ready", "ready");
        return;
    }

    updateStatus("Translating", "loading");

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    // dt=t للترجمة الأساسية، dt=md للمفردات والقاموس
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 1. عرض الترجمة الأساسية
        if (data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
        }

        // 2. معالجة وعرض المفردات (Synonyms)
        // البيانات القاموسية تتواجد في data[1]
        if (data[1] && Array.isArray(data[1])) {
            let synonymsHTML = "";
            
            data[1].forEach(section => {
                const partOfSpeech = section[0]; // نوع الكلمة (Noun, Verb, etc.)
                if (section[2] && Array.isArray(section[2])) {
                    // نأخذ أول 4 مرادفات لكل نوع كلمة
                    const words = section[2].slice(0, 4).map(item => item[0]).join(', ');
                    if (words) {
                        synonymsHTML += `
                            <div style="margin-bottom: 10px; border-bottom: 1px solid #111; padding-bottom: 5px;">
                                <div style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">${partOfSpeech}</div>
                                <div style="color: #aaa; font-size: 14px;">${words}</div>
                            </div>`;
                    }
                }
            });

            details.innerHTML = synonymsHTML || (isArabic ? "No synonyms found" : "لا توجد مرادفات");
        } else {
            details.innerHTML = isArabic ? "No synonyms found" : "لا توجد مرادفات";
        }

        updateStatus("Ready", "success");
    } catch (err) {
        console.error("Translation Error:", err);
        updateStatus("Error", "loading");
    }
}

/**
 * زر اللصق والترجمة الفورية
 */
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        chatInput.value = text;
        translateText(text.trim());
    } catch (err) {
        console.error("Clipboard access denied");
    }
});

/**
 * زر النسخ للترجمة الناتجة
 */
copyBtn.addEventListener('click', () => {
    const textToCopy = output.innerText;
    if (textToCopy && textToCopy !== "...") {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "COPIED!";
        setTimeout(() => copyBtn.innerText = originalText, 2000);
    }
});

/**
 * الاستماع للكتابة مع مؤقت (Debounce) لتقليل طلبات API
 */
let typingTimer;
chatInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    updateStatus("Typing", "loading");
    typingTimer = setTimeout(() => {
        translateText(chatInput.value.trim());
    }, 800); 
});

/**
 * استقبال النص من ميزة "قائمة السياق" (Context Menu) عند الفتح
 */
chrome.storage.local.get(['translateText'], (result) => {
    if (result.translateText) {
        chatInput.value = result.translateText;
        translateText(result.translateText);
        chrome.storage.local.remove('translateText');
    }
});
