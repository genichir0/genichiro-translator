// ربط عناصر الواجهة بمتغيرات جافاسكريبت
const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');
const spellCheck = document.getElementById('spellCheck');

/**
 * وظيفة لتحديث الحالة البصرية للإضافة
 * @param {string} msg - الرسالة النصية للحالة
 * @param {string} state - نوع الحالة (loading, success, ready)
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
 * الوظيفة الأساسية لترجمة النص وجلب البيانات الإضافية
 * @param {string} text - النص المراد ترجمته
 */
async function translateText(text) {
    // التحقق من وجود نص
    if (!text || text.trim() === "") {
        output.innerText = "...";
        details.innerHTML = "المفردات ستظهر هنا";
        spellCheck.style.display = "none";
        updateStatus("Ready", "ready");
        return;
    }

    updateStatus("Translating", "loading");

    // تحديد اتجاه الترجمة بناءً على لغة الإدخال
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    // بناء رابط الـ API مع طلب الترجمة (t)، القاموس (md)، والكلمات القريبة (rw/bd)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Connection failed");
        
        const data = await response.json();

        // 1. معالجة الترجمة الأساسية
        if (data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
        }

        // 2. معالجة ميزة "هل تقصد" (Spelling Correction)
        // جوجل يضع التصحيح عادة في مصفوفة فرعية (غالباً index 7)
        if (data[7] && data[7][1]) {
            const suggestion = data[7][1].replace(/<b>|<\/b>/g, ""); // تنظيف الوسوم إن وجدت
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

        // 3. معالجة المرادفات (Dictionary Data)
        let dictionaryData = null;
        // البحث عن مصفوفة القاموس داخل رد جوجل
        for (let i = 1; i < data.length; i++) {
            if (Array.isArray(data[i]) && data[i][0] && typeof data[i][0][0] === 'string') {
                dictionaryData = data[i];
                break;
            }
        }

        if (dictionaryData) {
            let synonymsHTML = "";
            dictionaryData.forEach(section => {
                const type = section[0]; // Noun, Verb, etc.
                if (section[1] && Array.isArray(section[1])) {
                    const synonyms = section[1].slice(0, 3).join(', ');
                    synonymsHTML += `
                        <div style="margin-top: 10px; border-left: 2px solid #333; padding-left: 8px;">
                            <div style="color: #666; font-size: 10px; text-transform: uppercase;">${type}</div>
                            <div style="color: #eee; font-size: 14px;">${synonyms}</div>
                        </div>`;
                }
            });
            details.innerHTML = synonymsHTML;
        } else {
            details.innerHTML = "لا توجد مرادفات لهذه الكلمة";
        }

        // العملية نجحت حتى لو لم توجد مرادفات
        updateStatus("Ready", "success");

    } catch (err) {
        console.error("Translation Error:", err);
        // حالة الخطأ الحقيقي (مثل انقطاع الإنترنت)
        updateStatus("Network Error", "loading");
    }
}

// --- أحداث الأزرار والمدخلات ---

// زر اللصق
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        chatInput.value = text;
        translateText(text.trim());
    } catch (err) {
        console.error("Clipboard access denied");
    }
});

// زر النسخ
copyBtn.addEventListener('click', () => {
    const textToCopy = output.innerText;
    if (textToCopy && textToCopy !== "...") {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "COPIED!";
        setTimeout(() => copyBtn.innerText = originalText, 2000);
    }
});

// مؤقت لتأخير الطلب أثناء الكتابة (Debounce)
let typingTimer;
chatInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    updateStatus("Typing", "loading");
    typingTimer = setTimeout(() => {
        translateText(chatInput.value.trim());
    }, 800); 
});
