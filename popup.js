const api = typeof browser !== "undefined" ? browser : chrome;

const chatInput  = document.getElementById('chatInput');
const output     = document.getElementById('output');
const details    = document.getElementById('details');
const statusText = document.getElementById('statusText');
const statusArea = document.getElementById('status-area');
const pasteBtn   = document.getElementById('pasteBtn');
const copyBtn    = document.getElementById('copyBtn');
const spellCheck = document.getElementById('spellCheck');

const EMPTY_DETAILS = "المفردات ستظهر هنا";
const DEBOUNCE_MS = 600;

let typingTimer;
let lastTranslatedValue = "";
let requestId = 0; // used to ignore stale responses

function updateStatus(msg, state) {
    statusText.textContent = msg;
    statusArea.classList.remove('loading', 'success');
    if (state === 'loading') statusArea.classList.add('loading');
    else if (state === 'success') statusArea.classList.add('success');
}

function resetUI() {
    output.textContent = "...";
    details.textContent = EMPTY_DETAILS;
    spellCheck.style.display = "none";
    updateStatus("Ready", "ready");
}

function renderSpell(data) {
    spellCheck.style.display = "none";
    if (data && data[7] && data[7][1]) {
        const suggestion = String(data[7][1]).replace(/<\/?b>/g, "");
        spellCheck.textContent = `Did you mean: ${suggestion}?`;
        spellCheck.style.display = "block";
        spellCheck.onclick = () => {
            chatInput.value = suggestion;
            clearTimeout(typingTimer);
            translateText(suggestion);
        };
    }
}

function renderDictionary(data) {
    details.textContent = "";
    let found = false;
    const sections = Array.isArray(data[1]) ? data[1] : [];

    sections.forEach(section => {
        const type = section[0];
        if (typeof type !== "string" || !Array.isArray(section[1])) return;
        found = true;

        const container = document.createElement('div');
        container.style.marginTop = "10px";
        container.style.borderRight = "2px solid #333";
        container.style.paddingRight = "8px";

        const typeDiv = document.createElement('div');
        typeDiv.style.color = "#666";
        typeDiv.style.fontSize = "10px";
        typeDiv.style.textTransform = "uppercase";
        typeDiv.textContent = type;

        const wordsDiv = document.createElement('div');
        wordsDiv.style.color = "#eee";
        wordsDiv.style.fontSize = "14px";
        wordsDiv.textContent = section[1].slice(0, 3).join(', ');

        container.appendChild(typeDiv);
        container.appendChild(wordsDiv);
        details.appendChild(container);
    });

    if (!found) details.textContent = "لا توجد مرادفات لهذه الكلمة";
}

async function translateText(text) {
    text = (text || "").trim();
    const id = ++requestId;
    lastTranslatedValue = text;

    if (!text) { resetUI(); return; }

    spellCheck.style.display = "none";

    if (text === "67") {
        output.textContent = "انقلع";
        details.textContent = "";
        updateStatus("Ready", "success");
        return;
    }

    updateStatus("Translating", "loading");

    const isArabic = /[\u0600-\u06FF]/.test(text);
    const targetLang = isArabic ? 'en' : 'ar';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=md&dt=rw&dt=bd&q=${encodeURIComponent(text)}`;

    try {
        const response = text.length > 1200
            ? await fetch(url.split('&q=')[0], {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'q=' + encodeURIComponent(text)
              })
            : await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();

        if (id !== requestId) return; // a newer request replaced this one

        // join ALL sentence segments, not just the first
        const translated = (data[0] || []).map(seg => (seg && seg[0]) || "").join("");
        output.textContent = translated || "...";

        renderSpell(data);
        renderDictionary(data);
        updateStatus("Ready", "success");
    } catch (err) {
        if (id !== requestId) return;
        console.error("Translation error:", err);
        output.textContent = "...";
        details.textContent = EMPTY_DETAILS;
        updateStatus("Error - check connection", "ready");
        lastTranslatedValue = ""; // allow retry with same text
    }
}

pasteBtn.addEventListener('click', async () => {
    chatInput.focus();

    // 1) image in clipboard?
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const imgType = item.types.find(t => t.startsWith('image/'));
            if (imgType) {
                handleImage(await item.getType(imgType));
                return;
            }
        }
    } catch (err) {
        console.warn("clipboard.read failed, trying text:", err);
    }

    // 2) text in clipboard
    try {
        const text = await navigator.clipboard.readText();
        chatInput.value = text;
        clearTimeout(typingTimer);
        translateText(text);
    } catch (err) {
        console.error("Clipboard readText failed:", err);
        // Fallback: native paste (fires the 'paste' event below)
        let ok = false;
        try { ok = document.execCommand('paste'); } catch (e) {}
        if (!ok) updateStatus("Paste failed - press Ctrl+V", "ready");
    }
});

copyBtn.addEventListener('click', async () => {
    const text = output.textContent;
    if (!text || text === "...") return;
    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "COPIED";
    } catch (err) {
        console.error("Clipboard write failed:", err);
        copyBtn.textContent = "FAILED";
    }
    setTimeout(() => copyBtn.textContent = "COPY", 2000);
});


// ---------------------------------------------------------------
// Image (screenshot) reading - OCR with Tesseract.js, fully offline
// ---------------------------------------------------------------
let ocrWorkerPromise = null;
let ocrRun = 0;

function getOcrWorker() {
    if (!ocrWorkerPromise) {
        if (typeof Tesseract === "undefined") {
            return Promise.reject(new Error("lib/tesseract.min.js is missing - run setup-ocr.sh"));
        }
        ocrWorkerPromise = Tesseract.createWorker('eng+ara', 1, {
            workerPath: api.runtime.getURL('lib/worker.min.js'),
            corePath: api.runtime.getURL('lib'),
            langPath: api.runtime.getURL('lib/lang'),
            workerBlobURL: false,   // blob workers are blocked by extension CSP
            cacheMethod: 'none',
            logger: m => {
                if (m.status === 'recognizing text') {
                    updateStatus(`Reading image ${Math.round(m.progress * 100)}%`, 'loading');
                }
            }
        }).catch(err => { ocrWorkerPromise = null; throw err; });
    }
    return ocrWorkerPromise;
}

// Upscale small screenshots and flip dark-mode (light-on-dark) images
async function prepareImage(blob) {
    const bmp = await createImageBitmap(blob);
    const maxSide = Math.max(bmp.width, bmp.height);
    const scale = maxSide < 1200 ? Math.min(3, Math.ceil(1200 / maxSide)) : 1;

    const canvas = document.createElement('canvas');
    canvas.width = bmp.width * scale;
    canvas.height = bmp.height * scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = img.data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
        sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    if (sum / (px.length / 4) < 128) {
        for (let i = 0; i < px.length; i += 4) {
            px[i] = 255 - px[i];
            px[i + 1] = 255 - px[i + 1];
            px[i + 2] = 255 - px[i + 2];
        }
        ctx.putImageData(img, 0, 0);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function handleImage(blob) {
    const run = ++ocrRun;
    ++requestId;                 // cancel any pending translation
    clearTimeout(typingTimer);
    output.textContent = "...";
    details.textContent = EMPTY_DETAILS;
    spellCheck.style.display = "none";
    updateStatus("Reading image...", "loading");

    try {
        const worker = await getOcrWorker();
        const prepared = await prepareImage(blob);
        const { data } = await worker.recognize(prepared);
        if (run !== ocrRun) return;

        const text = data.text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (!text) {
            updateStatus("No text found in image", "ready");
            return;
        }
        chatInput.value = text;
        translateText(text);
    } catch (err) {
        if (run !== ocrRun) return;
        console.error("OCR error:", err);
        updateStatus("Image reading failed", "ready");
    }
}

// Ctrl+V anywhere in the popup: image -> OCR, text -> normal paste
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            handleImage(item.getAsFile());
            return;
        }
    }
});

window.addEventListener('unload', () => {
    if (ocrWorkerPromise) ocrWorkerPromise.then(w => w.terminate()).catch(() => {});
});

chatInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    ocrRun++;
    const value = chatInput.value.trim();

    if (!value) {
        requestId++;           // cancel any in-flight request
        lastTranslatedValue = "";
        resetUI();
        return;
    }

    if (value === lastTranslatedValue) {
        if (!statusArea.classList.contains('loading')) updateStatus("Ready", "success");
        return;
    }

    updateStatus("Typing...", "ready");
    typingTimer = setTimeout(() => translateText(chatInput.value), DEBOUNCE_MS);
});

// Text sent from elsewhere (context menu etc.) via storage
(async () => {
    try {
        const result = await api.storage.local.get(['translateText']);
        if (result && result.translateText) {
            chatInput.value = result.translateText;
            translateText(result.translateText);
            api.storage.local.remove('translateText');
        }
    } catch (e) {
        console.error("Storage error:", e);
    }
})();

chatInput.focus();
