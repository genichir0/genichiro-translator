const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');

function updateStatus(msg, state) {
    statusText.innerText = msg;
    statusArea.classList.remove('loading', 'success');
    if (state === 'loading') statusArea.classList.add('loading');
    if (state === 'success') statusArea.classList.add('success');
}

async function translateText(text) {
    if (!text || text.trim() === "") {
        output.innerText = "...";
        details.innerHTML = "المفردات ستظهر هنا";
        updateStatus("Ready", "ready");
        return;
    }

    updateStatus("Translating", "loading");

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    // الرابط يتضمن جميع المعايير اللازمة لجلب البيانات التفصيلية
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 1. عرض الترجمة الأساسية
        if (data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
        }

        // 2. البحث عن المرادفات (القاموس) في كامل المصفوفة
        let dictionarySection = null;
        
        // نبحث في المصفوفة عن الجزء الذي يحتوي على تصنيفات الكلام (اسم، فعل..)
        for (let i = 1; i < data.length; i++) {
            if (Array.isArray(data[i]) && data[i][0] && typeof data[i][0][0] === 'string') {
                dictionarySection = data[i];
                break;
            }
        }

        if (dictionarySection) {
            let synonymsHTML = "";
            dictionarySection.forEach(section => {
                const partOfSpeech = section[0]; // Noun, Verb...
                if (section[1] && Array.isArray(section[1])) {
                    // استخراج الكلمات المترجمة البديلة
                    const words = section[1].slice(0, 3).join(', ');
                    synonymsHTML += `
                        <div style="margin-top: 10px; border-left: 2px solid #333; padding-left: 8px;">
                            <div style="color: #666; font-size: 10px; text-transform: uppercase;">${partOfSpeech}</div>
                            <div style="color: #eee; font-size: 14px;">${words}</div>
                        </div>`;
                }
            });
            details.innerHTML = synonymsHTML;
        } else {
            details.innerHTML = "لا توجد مرادفات متوفرة";
        }

        updateStatus("Ready", "success");
    } catch (err) {
        console.error("Error:", err);
        details.innerHTML = "خطأ في جلب البيانات";
    }
}

// أزرار التحكم ومراقب الكتابة
pasteBtn.addEventListener('click', async () => {
    const text = await navigator.clipboard.readText();
    chatInput.value = text;
    translateText(text);
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(output.innerText);
    copyBtn.innerText = "COPIED";
    setTimeout(() => copyBtn.innerText = "COPY", 2000);
});

let timer;
chatInput.addEventListener('input', () => {
    clearTimeout(timer);
    updateStatus("Typing", "loading");
    timer = setTimeout(() => translateText(chatInput.value), 800);
});
