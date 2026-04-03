require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const GEN_DIR = path.join(__dirname, 'public', 'generated');
if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });

const AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;

// Отключаем проверку SSL (GigaChat использует свои сертификаты)
const agent = new https.Agent({ rejectUnauthorized: false });

// ============================================
// GIGACHAT AUTH — получаем Access Token
// ============================================
let accessToken = null;
let tokenExpires = 0;

async function getAccessToken() {
    // Если токен ещё живой — возвращаем его
    if (accessToken && Date.now() < tokenExpires - 60000) {
        return accessToken;
    }

    console.log('[GigaChat] Получаем новый Access Token...');

    const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': generateUID(),
            'Authorization': 'Basic ' + AUTH_KEY
        },
        body: 'scope=GIGACHAT_API_PERS',
        agent: agent
    });

    const data = await res.json();

    if (data.access_token) {
        accessToken = data.access_token;
        tokenExpires = data.expires_at || (Date.now() + 1800000); // 30 минут
        console.log('[GigaChat] ✅ Токен получен!');
        return accessToken;
    }

    console.error('[GigaChat] ❌ Ошибка токена:', data);
    throw new Error('Не удалось получить токен: ' + JSON.stringify(data));
}

function generateUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ============================================
// ГЕНЕРАЦИЯ КАРТИНКИ ЧЕРЕЗ GIGACHAT
// ============================================
async function generateImage(prompt) {
    if (!AUTH_KEY) {
        return { success: false, error: 'Ключ не настроен. Добавьте GIGACHAT_AUTH_KEY в .env' };
    }

    try {
        const token = await getAccessToken();

        console.log('[GigaChat] Генерация: ' + prompt.substring(0, 60) + '...');

        // Отправляем запрос на генерацию картинки
        const res = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                model: 'GigaChat',
                messages: [
                    {
                        role: 'user',
                        content: 'Нарисуй: ' + prompt
                    }
                ],
                function_call: 'auto'
            }),
            agent: agent
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('[GigaChat] Ошибка:', data);
            return { success: false, error: data.message || 'Ошибка ' + res.status };
        }

        // Ищем картинку в ответе
        const content = data.choices?.[0]?.message?.content || '';
        console.log('[GigaChat] Ответ получен, ищем картинку...');

        // GigaChat возвращает картинку как <img src="..."> в тексте
        const imgMatch = content.match(/<img\s+src="([^"]+)"/);

        if (imgMatch && imgMatch[1]) {
            const fileId = imgMatch[1];
            console.log('[GigaChat] Найден файл: ' + fileId);

            // Скачиваем картинку
            const imgRes = await fetch('https://gigachat.devices.sberbank.ru/api/v1/files/' + fileId + '/content', {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/jpg'
                },
                agent: agent
            });

            if (!imgRes.ok) {
                return { success: false, error: 'Не удалось скачать картинку: ' + imgRes.status };
            }

            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const filename = 'gc_' + Date.now() + '_' + Math.random().toString(36).substring(7) + '.jpg';
            fs.writeFileSync(path.join(GEN_DIR, filename), buffer);

            console.log('[GigaChat] ✅ Сохранено: ' + filename + ' (' + Math.round(buffer.length / 1024) + ' KB)');
            return { success: true, imageUrl: '/generated/' + filename };
        }

        // Если картинки нет в ответе
        console.log('[GigaChat] Картинка не найдена в ответе. Контент:', content.substring(0, 200));
        return { success: false, error: 'GigaChat не вернул картинку. Попробуйте ещё раз.' };

    } catch (err) {
        console.error('[GigaChat] Ошибка:', err.message);
        return { success: false, error: err.message };
    }
}

// ============================================
// БАЗА ПРОМПТОВ (РУССКИЙ — GigaChat отлично понимает!)
// ============================================
const pecsTemplates = {
    'хочу пить': { prompt: 'Стакан чистой питьевой воды на белом фоне, простая минималистичная иллюстрация, без текста', emoji: '💧' },
    'хочу есть': { prompt: 'Тарелка с едой вилка и нож на белом фоне, простая минималистичная иллюстрация, без текста', emoji: '🍽️' },
    'туалет': { prompt: 'Символ туалета на белом фоне, простая минималистичная иконка, без текста', emoji: '🚽' },
    'играть': { prompt: 'Разноцветные детские кубики на белом фоне, простая иллюстрация, без текста', emoji: '🧩' },
    'гулять': { prompt: 'Человек гуляет среди деревьев на свежем воздухе, простая иллюстрация, белый фон, без текста', emoji: '🚶' },
    'спать': { prompt: 'Человек мирно спит в кровати, простая иллюстрация, белый фон, без текста', emoji: '😴' },
    'помощь': { prompt: 'Поднятая рука просит о помощи, простая иллюстрация, белый фон, без текста', emoji: '🙋' },
    'да': { prompt: 'Большая зелёная галочка знак согласия, простая иллюстрация, белый фон, без текста', emoji: '✅' },
    'нет': { prompt: 'Большой красный крестик знак отказа, простая иллюстрация, белый фон, без текста', emoji: '❌' },
    'больно': { prompt: 'Грустный человек показывает что ему больно, простая иллюстрация, белый фон, без текста', emoji: '🤕' },
    'мама': { prompt: 'Добрая улыбающаяся мама, простая иллюстрация, белый фон, без текста', emoji: '👩' },
    'папа': { prompt: 'Добрый улыбающийся папа, простая иллюстрация, белый фон, без текста', emoji: '👨' },
    'музыка': { prompt: 'Наушники и музыкальные ноты, простая иллюстрация, белый фон, без текста', emoji: '🎵' },
    'обнять': { prompt: 'Два человека обнимаются, простая тёплая иллюстрация, белый фон, без текста', emoji: '🤗' },
    'устал': { prompt: 'Уставший зевающий человек, простая иллюстрация, белый фон, без текста', emoji: '😫' },
    'стоп': { prompt: 'Жест стоп открытая ладонь, простая иллюстрация, белый фон, без текста', emoji: '✋' },
    'школа': { prompt: 'Здание школы, простая иллюстрация, белый фон, без текста', emoji: '🏫' },
    'дом': { prompt: 'Уютный домик с крышей и окнами, простая иллюстрация, белый фон, без текста', emoji: '🏠' },
    'читать': { prompt: 'Открытая книга, простая иллюстрация, белый фон, без текста', emoji: '📖' },
    'рисовать': { prompt: 'Цветные карандаши и бумага, простая иллюстрация, белый фон, без текста', emoji: '🖍️' },
    'мыть руки': { prompt: 'Руки под краном с мылом и водой, простая иллюстрация, белый фон, без текста', emoji: '🧼' },
    'чистить зубы': { prompt: 'Зубная щётка с пастой, простая иллюстрация, белый фон, без текста', emoji: '🪥' },
    'одеваться': { prompt: 'Рубашка и штаны одежда, простая иллюстрация, белый фон, без текста', emoji: '👕' },
    'друг': { prompt: 'Двое детей играют вместе улыбаются, простая иллюстрация, белый фон, без текста', emoji: '👫' },
    'врач': { prompt: 'Добрый врач со стетоскопом, простая иллюстрация, белый фон, без текста', emoji: '👨‍⚕️' },
    'купаться': { prompt: 'Ванна с пузырьками, простая иллюстрация, белый фон, без текста', emoji: '🛁' },
    'ждать': { prompt: 'Часы и человек терпеливо ждёт, простая иллюстрация, белый фон, без текста', emoji: '⏰' },
    'тихо': { prompt: 'Палец у губ жест тишины, простая иллюстрация, белый фон, без текста', emoji: '🤫' },
    'слушать': { prompt: 'Ухо внимательно слушает, простая иллюстрация, белый фон, без текста', emoji: '👂' },
    'смотреть': { prompt: 'Глаза внимательно смотрят, простая иллюстрация, белый фон, без текста', emoji: '👀' }
};

const styles = {
    minimalist: { name: 'Минималистичный', suffix: ', минималистичная иллюстрация, простые формы, белый фон, без лишних деталей' },
    cartoon: { name: 'Мультяшный', suffix: ', мультяшный стиль, яркие цвета, для детей, милый, дружелюбный' },
    realistic: { name: 'Реалистичный', suffix: ', реалистичное изображение, хорошее освещение, чистый фон' },
    schematic: { name: 'Схематичный', suffix: ', простая пиктограмма, чёрный контур на белом фоне, иконка' },
    pastel: { name: 'Пастельный', suffix: ', пастельные мягкие цвета, акварельный стиль, нежный, спокойный' }
};

const emotions = {
    happy: { name: 'Радость', emoji: '😊', levels: { low: 'лёгкая улыбка', medium: 'радостная улыбка счастливые глаза', high: 'широкая улыбка смех' } },
    sad: { name: 'Грусть', emoji: '😢', levels: { low: 'немного грустный', medium: 'грустное лицо', high: 'очень грустный слёзы' } },
    angry: { name: 'Злость', emoji: '😠', levels: { low: 'немного раздражён', medium: 'сердитое лицо', high: 'очень злой' } },
    scared: { name: 'Страх', emoji: '😨', levels: { low: 'немного тревожный', medium: 'испуганное лицо', high: 'очень испуганный' } },
    surprised: { name: 'Удивление', emoji: '😲', levels: { low: 'немного удивлён', medium: 'удивлённое лицо', high: 'очень удивлён шок' } },
    calm: { name: 'Спокойствие', emoji: '😌', levels: { low: 'расслабленный', medium: 'спокойное умиротворённое лицо', high: 'глубокое спокойствие' } },
    confused: { name: 'Замешательство', emoji: '🤔', levels: { low: 'немного озадачен', medium: 'растерянное лицо', high: 'полное замешательство' } },
    disgusted: { name: 'Отвращение', emoji: '🤢', levels: { low: 'неприятно', medium: 'отвращение на лице', high: 'сильное отвращение' } }
};

const calmingScenes = {
    jellyfish: { name: 'Медузы', emoji: '🪼', prompt: 'Светящиеся медузы плавают в глубоком тёмно-синем океане, мягкий свет, спокойная подводная сцена' },
    rain: { name: 'Дождь', emoji: '🌧️', prompt: 'Капли дождя стекают по оконному стеклу, за окном размытые огни города, уютная атмосфера' },
    aurora: { name: 'Сияние', emoji: '🌌', prompt: 'Северное сияние над спокойным озером, зелёные и фиолетовые переливы, звёздное небо' },
    clouds: { name: 'Облака', emoji: '☁️', prompt: 'Пушистые белые облака на ярко-голубом небе, солнечный мирный день' },
    fireplace: { name: 'Камин', emoji: '🔥', prompt: 'Уютный камин с мягким пламенем, тёплый свет, уютная комната' },
    waves: { name: 'Волны', emoji: '🌊', prompt: 'Спокойные морские волны на песчаном пляже, нежный закат, умиротворение' },
    snowfall: { name: 'Снегопад', emoji: '❄️', prompt: 'Тихий снегопад ночью, мягкие снежинки, тёплый свет фонарей, волшебная зимняя атмосфера' },
    garden: { name: 'Сад', emoji: '🦋', prompt: 'Красивый сад с бабочками, мягкий солнечный свет, цветущие цветы, покой и тишина' }
};

const palettes = {
    muted: ', приглушённые спокойные цвета',
    pastel: ', нежные пастельные цвета',
    warm: ', тёплые мягкие цвета',
    cool: ', холодные успокаивающие цвета'
};

// ============================================
// API
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', aiEnabled: !!AUTH_KEY, provider: 'GigaChat + Kandinsky', version: '6.0' });
});
app.get('/api/templates', (req, res) => {
    res.json(Object.entries(pecsTemplates).map(([t, d]) => ({ text: t, emoji: d.emoji })));
});
app.get('/api/styles', (req, res) => {
    res.json(Object.entries(styles).map(([id, d]) => ({ id, name: d.name })));
});
app.get('/api/emotions', (req, res) => {
    res.json(Object.entries(emotions).map(([id, d]) => ({ id, name: d.name, emoji: d.emoji })));
});
app.get('/api/calming-scenes', (req, res) => {
    res.json(Object.entries(calmingScenes).map(([id, d]) => ({ id, name: d.name, emoji: d.emoji })));
});

// ---- PECS ----
app.post('/api/generate/pecs', async (req, res) => {
    const { items, style: sn, withImages } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Укажите карточки' });

    const sel = styles[sn] || styles.minimalist;
    const cards = [];

    for (let i = 0; i < Math.min(items.length, 10); i++) {
        const item = items[i].trim();
        const tpl = pecsTemplates[item.toLowerCase()];
        const prompt = tpl ? tpl.prompt + sel.suffix : item + sel.suffix + ', понятная карточка для общения, без текста';

        const card = { text: item, emoji: tpl ? tpl.emoji : '🖼️', prompt, imageUrl: null, imageError: null };

        if (withImages) {
            console.log('[PECS] (' + (i + 1) + '/' + Math.min(items.length, 10) + ') ' + item);
            const r = await generateImage(prompt);
            if (r.success) card.imageUrl = r.imageUrl;
            else card.imageError = r.error;
        }
        cards.push(card);
    }

    res.json({ success: true, cards, aiEnabled: !!AUTH_KEY });
});

// ---- ЭМОЦИИ ----
app.post('/api/generate/emotion', async (req, res) => {
    const { emotion: eid, intensity, style: sn, withImage } = req.body;
    const ed = emotions[eid];
    if (!ed) return res.status(400).json({ error: 'Неизвестная эмоция' });

    const lv = intensity || 'medium';
    const sel = styles[sn] || styles.cartoon;
    const prompt = 'Портрет человека выражающего эмоцию ' + ed.name + ', ' + (ed.levels[lv] || ed.levels.medium) + ', чёткое выражение лица, вид спереди' + sel.suffix;

    const result = { success: true, emotion: ed.name, emoji: ed.emoji, intensity: lv, style: sel.name, prompt, imageUrl: null, imageError: null, aiEnabled: !!AUTH_KEY };

    if (withImage) {
        const r = await generateImage(prompt);
        if (r.success) result.imageUrl = r.imageUrl;
        else result.imageError = r.error;
    }

    res.json(result);
});

// ---- ИСТОРИИ ----
app.post('/api/generate/story', async (req, res) => {
    const { title, steps, style: sn, withImages } = req.body;
    if (!steps || !steps.length) return res.status(400).json({ error: 'Добавьте шаги' });

    const sel = styles[sn] || styles.cartoon;
    const result = [];

    for (let i = 0; i < steps.length; i++) {
        const t = steps[i].trim();
        if (!t) continue;
        const prompt = 'Иллюстрация к истории: ' + t + ', понятная сцена' + sel.suffix;
        const step = { step: i + 1, text: t, prompt, imageUrl: null, imageError: null };

        if (withImages) {
            console.log('[STORY] (' + (i + 1) + '/' + steps.length + ') ' + t);
            const r = await generateImage(prompt);
            if (r.success) step.imageUrl = r.imageUrl;
            else step.imageError = r.error;
        }
        result.push(step);
    }

    res.json({ success: true, title: title || 'История', steps: result, aiEnabled: !!AUTH_KEY });
});

// ---- УСПОКОЕНИЕ ----
app.post('/api/generate/calming', async (req, res) => {
    const { scene, customDescription, colorPalette, withImage } = req.body;
    let prompt, name, emoji;

    if (scene && calmingScenes[scene]) { const s = calmingScenes[scene]; prompt = s.prompt; name = s.name; emoji = s.emoji; }
    else if (customDescription) { prompt = customDescription + ', спокойный, умиротворяющий'; name = 'Своя сцена'; emoji = '🎨'; }
    else return res.status(400).json({ error: 'Выберите сцену' });

    prompt += palettes[colorPalette] || palettes.muted;

    const result = { success: true, scene: name, emoji, prompt, imageUrl: null, imageError: null, aiEnabled: !!AUTH_KEY };

    if (withImage) {
        const r = await generateImage(prompt);
        if (r.success) result.imageUrl = r.imageUrl;
        else result.imageError = r.error;
    }

    res.json(result);
});

// ============================================
// ЭКСПОРТ В PDF
// ============================================
const PDFDocument = require('pdfkit');

app.post('/api/export/pdf', async (req, res) => {
    const { cards, title, type } = req.body;

    if (!cards || !cards.length) {
        return res.status(400).json({ error: 'Нет карточек для экспорта' });
    }

    try {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 30,
            info: {
                Title: title || 'PECS Cards',
                Author: 'NeuroVisual Helper'
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="cards_' + Date.now() + '.pdf"');
        doc.pipe(res);

        // Подключаем шрифт с кириллицей
        const fontRegular = path.join(__dirname, 'fonts', 'Roboto-Regular.ttf');
        const fontBold = path.join(__dirname, 'fonts', 'Roboto-Bold.ttf');
        const hasFont = fs.existsSync(fontRegular);

        if (hasFont) {
            doc.registerFont('Regular', fontRegular);
            doc.registerFont('Bold', fs.existsSync(fontBold) ? fontBold : fontRegular);
        } else {
            // Фоллбэк — встроенный шрифт (без кириллицы)
            doc.registerFont('Regular', 'Helvetica');
            doc.registerFont('Bold', 'Helvetica-Bold');
            console.log('[PDF] ⚠️ Шрифт Roboto не найден, кириллица может не работать');
        }

        const pageW = doc.page.width - 60;
        const pageH = doc.page.height - 60;

        // Заголовок
        doc.font('Bold').fontSize(24);
        doc.text(title || 'PECS Cards', 30, 30, { align: 'center', width: pageW });
        doc.moveDown(0.5);
        doc.font('Regular').fontSize(12);
        doc.text('Создано: ' + new Date().toLocaleDateString('ru-RU'), { align: 'center', width: pageW });
        doc.text('NeuroVisual Helper', { align: 'center', width: pageW });
        doc.moveDown(1);

        // Сетка карточек
        const cols = type === 'story' ? 2 : 3;
        const cardW = (pageW - (cols - 1) * 15) / cols;
        const cardH = cardW + 40;
        const gap = 15;

        let x = 30;
        let y = doc.y;
        let col = 0;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            // Новая страница если не помещается
            if (y + cardH > pageH + 30) {
                doc.addPage();
                y = 30;
                col = 0;
                x = 30;
            }

            // Рамка карточки
            doc.roundedRect(x, y, cardW, cardH, 8)
               .lineWidth(2)
               .strokeColor('#667eea')
               .stroke();

            // Картинка
            let hasImage = false;
            if (card.imageUrl && !card.imageUrl.startsWith('http')) {
                const imgPath = path.join(__dirname, 'public', card.imageUrl);
                if (fs.existsSync(imgPath)) {
                    try {
                        const imgSize = cardW - 16;
                        doc.image(imgPath, x + 8, y + 8, {
                            width: imgSize,
                            height: imgSize,
                            fit: [imgSize, imgSize]
                        });
                        hasImage = true;
                    } catch (e) {
                        console.log('[PDF] Ошибка картинки:', e.message);
                    }
                }
            }

            if (!hasImage) {
                // Заглушка — серый квадрат с текстом
                const imgSize = cardW - 16;
                doc.roundedRect(x + 8, y + 8, imgSize, imgSize, 6)
                   .fillColor('#f0f0f0')
                   .fill();
                doc.fillColor('#999999')
                   .font('Regular')
                   .fontSize(14)
                   .text(card.emoji || '?', x + 8, y + 8 + imgSize / 2 - 10, {
                       width: imgSize,
                       align: 'center'
                   });
            }

            // Подпись под картинкой
            const textY = y + cardW - 5;
            doc.roundedRect(x + 2, textY, cardW - 4, 36, 4)
               .fillColor('#667eea')
               .fill();

            const cardText = card.text || card.scene || card.emotion || '';
            doc.fillColor('#ffffff')
               .font('Bold')
               .fontSize(cardW > 150 ? 13 : 10)
               .text(cardText, x + 5, textY + 8, {
                   width: cardW - 10,
                   align: 'center',
                   lineBreak: false
               });

            doc.fillColor('#000000');

            // Номер шага (для историй)
            if (type === 'story' && card.step) {
                doc.circle(x + 18, y + 18, 14).fillColor('#48bb78').fill();
                doc.fillColor('#ffffff').font('Bold').fontSize(12)
                   .text(String(card.step), x + 8, y + 12, { width: 20, align: 'center' });
                doc.fillColor('#000000');
            }

            // Следующая колонка
            col++;
            if (col >= cols) {
                col = 0;
                x = 30;
                y += cardH + gap;
            } else {
                x += cardW + gap;
            }
        }

        // Последняя страница — инструкция
        doc.addPage();
        doc.font('Bold').fontSize(18).fillColor('#000000');
        doc.text('Инструкция', 30, 30, { width: pageW });
        doc.moveDown(0.5);
        doc.font('Regular').fontSize(13);
        doc.text('1. Распечатайте на плотной бумаге (картоне)', { width: pageW });
        doc.moveDown(0.3);
        doc.text('2. Вырежьте карточки по рамкам', { width: pageW });
        doc.moveDown(0.3);
        doc.text('3. Заламинируйте для долговечности', { width: pageW });
        doc.moveDown(0.3);
        doc.text('4. Приклейте липучки Velcro на обратную сторону', { width: pageW });
        doc.moveDown(0.3);
        doc.text('5. Используйте с доской PECS для общения!', { width: pageW });
        doc.moveDown(1.5);

        doc.fontSize(11).fillColor('#718096');
        doc.text('NeuroVisual Helper', { width: pageW, align: 'center' });

        doc.end();
        console.log('[PDF] Экспорт ' + cards.length + ' карточек');

    } catch (err) {
        console.error('[PDF] Ошибка:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Ошибка PDF: ' + err.message });
        }
    }
});

// Экспорт отдельной карточки как PNG
app.get('/api/export/png/:filename', (req, res) => {
    const filepath = path.join(GEN_DIR, req.params.filename);
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'Файл не найден' });
    }
});

// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🧩 NeuroVisual Helper v6.0                     ║');
    console.log('║   🌐 http://localhost:' + PORT + '                      ║');
    if (AUTH_KEY) {
        console.log('║   🎨 GigaChat + Kandinsky: ✅ Подключён!        ║');
    } else {
        console.log('║   🎨 GigaChat: ❌ Нет ключа                    ║');
        console.log('║   Добавьте GIGACHAT_AUTH_KEY в .env             ║');
    }
    console.log('║   Ctrl+C для остановки                           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});