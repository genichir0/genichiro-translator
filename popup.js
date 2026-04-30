
const api = typeof browser !== "undefined" ? browser : chrome;


api.storage.local.get(['translateText']).then((result) => {
    if (result.translateText) {
        chatInput.value = result.translateText;
        translateText(result.translateText);
        api.storage.local.remove('translateText');
    }
});

const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');
const spellCheck = document.getElementById('spellCheck');

/**
 * 
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
 * 
 */
async function translateText(text) {
    if (!text || text.trim() === "") {
        output.innerText = "...";
        details.innerHTML = "المفردات ستظهر هنا";
        spellCheck.style.display = "none";
        updateStatus("Ready", "ready");
        return;
    }





     if (text.trim() === "67") {
        output.innerText = "انقلع";
        spellCheck.style.display = "none";
        updateStatus("Ready", "success");
        return; 
     }


    updateStatus("Translating", "loading");

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 
        if (data && data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
            
            updateStatus("Ready", "success");
        }

        
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

// كود آمن ومتوافق مع سياسات فايرفوكس
if (synonymsHTML) {
    details.innerHTML = synonymsHTML; // إذا كانت تحتوي على وسم HTML قمت أنت ببنائه يدوياً
} else {
    details.textContent = "لا توجد مرادفات لهذه الكلمة"; // استخدام textContent للنصوص العادية
}

        
    } catch (err) {
        console.error("Critical Error:", err);
        
        updateStatus("Ready", "success"); 
    }
}


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


// متغيرات للتحكم في الأداء
let typingTimer;
let lastTranslatedValue = ""; // لحفظ آخر نص تم معالجته بنجاح
const doneTypingInterval = 850; // زيادة التأخير قليلاً لراحة متصفح فايرفوكس

chatInput.addEventListener('input', () => {
    const currentValue = chatInput.value.trim();

    // 1. منع المعالجة إذا كان النص هو نفسه (تجنب العمليات الزائدة)
    if (currentValue === lastTranslatedValue) return;

    // 2. تحديث الحالة فوراً بنص خفيف (بدون عمليات CSS ثقيلة)
    statusText.innerText = "Typing...";
    
    clearTimeout(typingTimer);

    // 3. استخدام Debounce لانتظار توقف المستخدم عن الكتابة
    typingTimer = setTimeout(() => {
        if (currentValue) {
            lastTranslatedValue = currentValue;

            /**
             * استخدام requestIdleCallback (خاص بفايرفوكس والكروم الحديث)
             * يضمن تنفيذ الترجمة فقط عندما يكون المتصفح غير مشغول برسم الواجهة أو معالجة المدخلات
             */
            const scheduleTask = window.requestIdleCallback || window.requestAnimationFrame;
            
            scheduleTask(() => {
                translateText(currentValue);
            });
        } else {
            // تنظيف الواجهة إذا مسح المستخدم النص
            output.innerText = "...";
            details.innerHTML = "المفردات ستظهر هنا";
            updateStatus("Ready", "ready");
        }
    }, doneTypingInterval);
});
