const chatInput = document.getElementById('chatInput');
const output = document.getElementById('output');
const details = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');
const spellCheck = document.getElementById('spellCheck'); // العنصر الجديد

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
        spellCheck.style.display = "none";
        updateStatus("Ready", "ready");
        return;
    }

    updateStatus("Translating", "loading");
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    
    // الرابط يتضمن جميع المعايير اللازمة
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 1. عرض الترجمة الأساسية
        if (data[0] && data[0][0]) {
            output.innerText = data[0][0][0];
        }

        // 2. ميزة "هل تقصد" (Did you mean)
        // جوجل يضع التصحيح غالباً في data[7] أو كقيمة نصية داخل مصفوفة لاحقة
        if (data[7] && data[7][1]) {
            const suggestion = data[7][1];
            spellCheck.innerHTML = `Did you mean: <b style="text-decoration: underline;">${suggestion}</b>?`;
            spellCheck.style.display = "block";
            
            // عند النقر على الاقتراح، قم بتصحيح النص وترجمته
            spellCheck.onclick = () => {
                chatInput.value = suggestion;
                translateText(suggestion);
                spellCheck.style.display = "none";
            };
        } else {
            spellCheck.style.display = "none";
        }

        // 3. عرض المرادفات (كما في الكود السابق)
        let dictionarySection = null;
        for (let i = 1; i < data.length; i++) {
            if (Array.isArray(data[i]) && data[i][0] && typeof data[i][0][0] === 'string') {
                dictionarySection = data[i];
                break;
            }
        }

        if (dictionarySection) {
            let synonymsHTML = "";
            dictionarySection.forEach(section => {
                const partOfSpeech = section[0];
                if (section[1] && Array.isArray(section[1])) {
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
        updateStatus("Error", "loading");
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
