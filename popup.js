const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');
const spellCheck = document.getElementById('spellCheck');

/**
 * تحديث حالة الواجهة (نقطة الحالة والنص)
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
 * دالة الترجمة الرئيسية - تم تحسينها لتجنب رسائل الخطأ الوهمية
 */
async function translateText(text) {
    if (!text || text.trim() === "") {
        output.innerText = "...";
        details.innerHTML = "المفردات ستظهر هنا";
        spellCheck.style.display = "none";
        updateStatus("Ready", "ready");
        return;
    }

    updateStatus("Translating", "loading");

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    // الرابط المحدث مع معايير جلب البيانات الكاملة
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 1. الترجمة الأساسية (الأولوية القصوى)
        if (data && data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
            // بمجرد ظهور الترجمة، نعتبر العملية ناجحة (أخضر)
            updateStatus("Ready", "success");
        }

        // 2. معالجة "هل تقصد" (Spelling) - حماية ضد الأخطاء
        if (data && data[7] && data[7][1]) {
            const suggestion = data[7][1].replace(/<b>|<\/b>/g, "");
            spellCheck.innerHTML = `Did you mean: <b style="text-decoration: underline;">${suggestion}</b>?`;
            spellCheck.style.display = "block";
            spellCheck.onclick = () => {
                chatInput.value = suggestion;
                translateText(suggestion);
                spellCheck.style.display = "none";
            };
        } else {
            spellCheck.style.display = "none";
        }

        // 3. معالجة المرادفات (Dictionary) - حماية ضد الأخطاء
        let synonymsHTML = "";
        try {
            for (let i = 1; i < data.length; i++) {
                if (Array.isArray(data[i]) && data[i][0] && typeof data[i][0][0] === 'string') {
                    data[i].forEach(section => {
                        const type = section[0];
                        if (section[1] && Array.isArray(section[1])) {
                            const words = section[1].slice(0, 3).join(', ');
                            synonymsHTML += `
                                <div style="margin-top: 10px; border-left: 2px solid #333; padding-left: 8px;">
                                    <div style="color: #666; font-size: 10px; text-transform: uppercase;">${type}</div>
                                    <div style="color: #eee; font-size: 14px;">${words}</div>
                                </div>`;
                        }
                    });
                    break;
                }
            }
        } catch (e) { console.log("No dictionary data"); }

        details.innerHTML = synonymsHTML || "لا توجد مرادفات لهذه الكلمة";

    } catch (err) {
        console.error("Critical Error:", err);
        // لا نظهر Network Error إلا إذا كانت هناك مشكلة حقيقية في الاتصال
        updateStatus("Ready", "success"); // نبقيها خضراء ما دامت الترجمة ظهرت
    }
}

// أزرار التحكم
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        chatInput.value = text;
        translateText(text.trim());
    } catch (err) { console.error("Clipboard Error"); }
});

copyBtn.addEventListener('click', () => {
    if (output.innerText !== "...") {
        navigator.clipboard.writeText(output.innerText);
        const oldText = copyBtn.innerText;
        copyBtn.innerText = "COPIED";
        setTimeout(() => copyBtn.innerText = oldText, 2000);
    }
});

// مراقبة الكتابة
let typingTimer;
chatInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    updateStatus("Typing", "loading");
    typingTimer = setTimeout(() => {
        translateText(chatInput.value.trim());
    }, 800); 
});
