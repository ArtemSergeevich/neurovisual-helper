const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================
// БАЗА ДАННЫХ ПРОМПТОВ ДЛЯ PECS-КАРТОЧЕК
// ============================================
const pecsTemplates = {
  'хочу пить': {
    prompt: 'A clear glass of drinking water, minimalist illustration, white background, simple clean vector style, no text, centered',
    emoji: '💧'
  },
  'хочу есть': {
    prompt: 'A plate with simple food and fork, minimalist illustration, white background, simple clean vector style, no text, centered',
    emoji: '🍽️'
  },
  'туалет': {
    prompt: 'A clean toilet symbol, simple bathroom icon, minimalist illustration, white background, no text, centered',
    emoji: '🚽'
  },
  'играть': {
    prompt: 'Colorful building blocks toys, minimalist illustration, white background, simple clean style, no text, centered',
    emoji: '🧩'
  },
  'гулять': {
    prompt: 'A person walking outside in sunshine with trees, minimalist illustration, white background, simple clean style, no text',
    emoji: '🚶'
  },
  'спать': {
    prompt: 'A person sleeping peacefully in bed with pillow, minimalist illustration, white background, simple style, no text',
    emoji: '😴'
  },
  'помощь': {
    prompt: 'A raised hand asking for help, help gesture, minimalist illustration, white background, simple clean style, no text',
    emoji: '🙋'
  },
  'да': {
    prompt: 'Green checkmark and thumbs up, approval symbol, minimalist illustration, white background, simple clean style, no text',
    emoji: '✅'
  },
  'нет': {
    prompt: 'Red X mark, gentle refusal symbol, minimalist illustration, white background, simple clean style, no text',
    emoji: '❌'
  },
  'больно': {
    prompt: 'A person pointing to pain location with sad face, medical help needed, minimalist illustration, white background, no text',
    emoji: '🤕'
  },
  'мама': {
    prompt: 'A caring mother figure smiling warmly, minimalist illustration, white background, simple clean style, no text',
    emoji: '👩'
  },
  'папа': {
    prompt: 'A caring father figure smiling warmly, minimalist illustration, white background, simple clean style, no text',
    emoji: '👨'
  },
  'музыка': {
    prompt: 'Headphones with musical notes floating around, minimalist illustration, white background, simple clean style, no text',
    emoji: '🎵'
  },
  'обнять': {
    prompt: 'Two people hugging warmly with love, minimalist illustration, white background, simple clean style, no text',
    emoji: '🤗'
  },
  'устал': {
    prompt: 'A tired person yawning, sleepy face, minimalist illustration, white background, simple clean style, no text',
    emoji: '😫'
  },
  'стоп': {
    prompt: 'Stop hand gesture, clear red stop sign, minimalist illustration, white background, simple clean style, no text',
    emoji: '✋'
  },
  'школа': {
    prompt: 'A simple school building with windows and door, minimalist illustration, white background, clean style, no text',
    emoji: '🏫'
  },
  'дом': {
    prompt: 'A cozy house with roof and door, home symbol, minimalist illustration, white background, clean style, no text',
    emoji: '🏠'
  },
  'читать': {
    prompt: 'An open book with pages, reading activity, minimalist illustration, white background, clean style, no text',
    emoji: '📖'
  },
  'рисовать': {
    prompt: 'Crayons and paper with simple drawing, art activity, minimalist illustration, white background, clean style, no text',
    emoji: '🖍️'
  },
  'мыть руки': {
    prompt: 'Hands being washed with soap and water under faucet, hygiene, minimalist illustration, white background, no text',
    emoji: '🧼'
  },
  'чистить зубы': {
    prompt: 'Toothbrush with toothpaste, dental hygiene, minimalist illustration, white background, clean style, no text',
    emoji: '🪥'
  },
  'одеваться': {
    prompt: 'Shirt and pants clothing, getting dressed, minimalist illustration, white background, clean style, no text',
    emoji: '👕'
  },
  'друг': {
    prompt: 'Two children playing together happily, friendship, minimalist illustration, white background, clean style, no text',
    emoji: '👫'
  },
  'врач': {
    prompt: 'Friendly doctor with stethoscope smiling, minimalist illustration, white background, clean style, no text',
    emoji: '👨‍⚕️'
  },
  'купаться': {
    prompt: 'A bathtub with warm water and bubbles, bath time, minimalist illustration, white background, clean style, no text',
    emoji: '🛁'
  },
  'ждать': {
    prompt: 'A clock and a patient person sitting calmly, waiting, minimalist illustration, white background, clean style, no text',
    emoji: '⏰'
  },
  'тихо': {
    prompt: 'A finger on lips, quiet gesture, silence symbol, minimalist illustration, white background, clean style, no text',
    emoji: '🤫'
  },
  'слушать': {
    prompt: 'An ear listening carefully, paying attention, minimalist illustration, white background, clean style, no text',
    emoji: '👂'
  },
  'смотреть': {
    prompt: 'Eyes looking and watching carefully, paying attention, minimalist illustration, white background, clean style, no text',
    emoji: '👀'
  }
};

// ============================================
// СТИЛИ ГЕНЕРАЦИИ
// ============================================
const styles = {
  minimalist: {
    name: 'Минималистичный',
    suffix: ', minimalist illustration, simple shapes, flat design, clear outlines, white background, vector art style, no clutter',
    negative: 'complex background, many details, realistic textures, shadows, text, watermark'
  },
  cartoon: {
    name: 'Мультяшный',
    suffix: ', friendly cartoon illustration, soft rounded shapes, warm colors, child-friendly, cute, Pixar style simplified, clean background',
    negative: 'scary, dark, complex background, realistic, violent, text, watermark'
  },
  realistic: {
    name: 'Реалистичный',
    suffix: ', clear realistic photograph, well-lit, simple composition, centered, soft lighting, clean background, stock photo quality',
    negative: 'blurry, dark, complex scene, text overlay, watermark, busy background'
  },
  schematic: {
    name: 'Схематичный',
    suffix: ', simple pictogram, icon style, black outline on white background, bold lines, high contrast, universal symbol',
    negative: 'colorful, detailed, realistic, 3d, shadow, gradient, text, complex'
  },
  pastel: {
    name: 'Пастельный',
    suffix: ', soft pastel illustration, gentle colors, watercolor style, calming, muted tones, light background, peaceful',
    negative: 'bright neon colors, harsh contrast, dark, scary, complex, text, watermark'
  }
};

// ============================================
// ЭМОЦИИ
// ============================================
const emotions = {
  happy: {
    name: 'Радость', emoji: '😊',
    prompt: 'a face showing genuine happiness, bright smile, raised cheeks, sparkling eyes',
    levels: {
      low: 'slight smile, content, peaceful happiness',
      medium: 'clear smile, happy eyes, visibly pleased',
      high: 'big bright smile, laughing, very joyful, eyes crinkled with happiness'
    }
  },
  sad: {
    name: 'Грусть', emoji: '😢',
    prompt: 'a face showing sadness, downturned mouth, droopy eyes',
    levels: {
      low: 'slightly downcast, pensive, mild disappointment',
      medium: 'clearly sad, frowning, unhappy eyes',
      high: 'very sad, tears in eyes, deeply upset, crying'
    }
  },
  angry: {
    name: 'Злость', emoji: '😠',
    prompt: 'a face showing anger, furrowed brows, tight lips',
    levels: {
      low: 'slightly annoyed, mild frustration',
      medium: 'clearly angry, furrowed eyebrows, frowning',
      high: 'very angry, red face, clenched teeth, intense'
    }
  },
  scared: {
    name: 'Страх', emoji: '😨',
    prompt: 'a face showing fear, wide eyes, open mouth, raised eyebrows',
    levels: {
      low: 'slightly worried, nervous, uneasy',
      medium: 'clearly frightened, wide eyes, tense',
      high: 'very scared, terrified, gasping, frozen with fear'
    }
  },
  surprised: {
    name: 'Удивление', emoji: '😲',
    prompt: 'a face showing surprise, raised eyebrows, open mouth, wide eyes',
    levels: {
      low: 'slightly surprised, raised eyebrows, curious',
      medium: 'clearly surprised, open mouth, wide eyes',
      high: 'extremely surprised, shocked, jaw dropped'
    }
  },
  calm: {
    name: 'Спокойствие', emoji: '😌',
    prompt: 'a face showing calmness, relaxed expression, gentle eyes, peaceful',
    levels: {
      low: 'neutral relaxed face, at ease',
      medium: 'clearly calm, slight smile, serene',
      high: 'deeply peaceful, meditative calm, pure serenity'
    }
  },
  confused: {
    name: 'Замешательство', emoji: '🤔',
    prompt: 'a face showing confusion, tilted head, furrowed brow, uncertain look',
    levels: {
      low: 'slightly puzzled, thinking',
      medium: 'clearly confused, scratching head',
      high: 'very confused, lost, overwhelmed'
    }
  },
  disgusted: {
    name: 'Отвращение', emoji: '🤢',
    prompt: 'a face showing disgust, wrinkled nose, upper lip raised',
    levels: {
      low: 'mildly displeased, slight nose wrinkle',
      medium: 'clearly disgusted, wrinkled nose, frowning',
      high: 'very disgusted, strong grimace, turned away'
    }
  }
};

// ============================================
// УСПОКАИВАЮЩИЕ СЦЕНЫ
// ============================================
const calmingScenes = {
  jellyfish: {
    name: 'Медузы в океане', emoji: '🪼',
    prompt: 'ethereal jellyfish floating gently in deep blue ocean, bioluminescent glow, slow graceful movement, serene underwater, soft light rays, peaceful, mesmerizing, calming'
  },
  rain: {
    name: 'Дождь по стеклу', emoji: '🌧️',
    prompt: 'raindrops on window glass, close-up, blurred city lights background, cozy rainy day, water droplets sliding down, warm indoor atmosphere, relaxing'
  },
  aurora: {
    name: 'Северное сияние', emoji: '🌌',
    prompt: 'beautiful aurora borealis over calm lake, green and purple lights, stars visible, mirror reflection in still water, serene Nordic landscape, magical'
  },
  clouds: {
    name: 'Плывущие облака', emoji: '☁️',
    prompt: 'fluffy white clouds drifting across bright blue sky, peaceful sunny day, cotton-like cumulus clouds, infinite sky, serene and calming'
  },
  fireplace: {
    name: 'Камин', emoji: '🔥',
    prompt: 'cozy fireplace with gentle flames, warm orange glow, comfortable living room, soft warm lighting, hygge atmosphere, relaxing evening'
  },
  waves: {
    name: 'Морские волны', emoji: '🌊',
    prompt: 'gentle ocean waves on sandy beach, soft sunset colors, peaceful seashore, foam on sand, rhythmic waves, golden hour light, calming'
  },
  snowfall: {
    name: 'Снегопад', emoji: '❄️',
    prompt: 'gentle snowfall at night, soft snowflakes falling slowly, warm street lights, quiet winter scene, peaceful snowy evening, magical'
  },
  garden: {
    name: 'Сад с бабочками', emoji: '🦋',
    prompt: 'peaceful garden with colorful butterflies, soft sunlight, blooming flowers, gentle breeze, lavender and daisies, calming and beautiful'
  },
  underwater: {
    name: 'Подводный мир', emoji: '🐠',
    prompt: 'calm underwater coral reef, gentle fish swimming slowly, sunlight filtering through water, colorful but muted corals, peaceful ocean, bubbles'
  },
  lava_lamp: {
    name: 'Лава-лампа', emoji: '🫧',
    prompt: 'colorful lava lamp with smooth blobs floating, warm purple and blue colors, hypnotic movement, soft glow, mesmerizing shapes, retro ambient'
  }
};

// ============================================
// API МАРШРУТЫ
// ============================================

// Получить все PECS-шаблоны
app.get('/api/templates', (req, res) => {
  const templates = Object.entries(pecsTemplates).map(([text, data]) => ({
    text: text,
    emoji: data.emoji,
    prompt: data.prompt
  }));
  res.json(templates);
});

// Получить стили
app.get('/api/styles', (req, res) => {
  const styleList = Object.entries(styles).map(([id, data]) => ({
    id: id,
    name: data.name
  }));
  res.json(styleList);
});

// Получить эмоции
app.get('/api/emotions', (req, res) => {
  const emotionList = Object.entries(emotions).map(([id, data]) => ({
    id: id,
    name: data.name,
    emoji: data.emoji
  }));
  res.json(emotionList);
});

// Получить сцены
app.get('/api/calming-scenes', (req, res) => {
  const sceneList = Object.entries(calmingScenes).map(([id, data]) => ({
    id: id,
    name: data.name,
    emoji: data.emoji
  }));
  res.json(sceneList);
});

// Генерация промптов для PECS-карточек
app.post('/api/generate/pecs', (req, res) => {
  const { items, style: styleName } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Укажите хотя бы одну карточку' });
  }

  if (items.length > 20) {
    return res.status(400).json({ error: 'Максимум 20 карточек за раз' });
  }

  const selectedStyle = styles[styleName] || styles.minimalist;
  const safetyNeg = 'nsfw, violent, blood, scary, horror, disturbing, nude, sexual, weapon';

  const cards = items.map(item => {
    const text = item.trim().toLowerCase();
    const template = pecsTemplates[text];

    let prompt;
    if (template) {
      prompt = template.prompt + selectedStyle.suffix;
    } else {
      prompt = `Clear visual representation of "${item}"${selectedStyle.suffix}, single concept, easy to understand, communication card`;
    }

    return {
      text: item.trim(),
      emoji: template ? template.emoji : '🖼️',
      prompt: prompt,
      negative_prompt: selectedStyle.negative + ', ' + safetyNeg,
      style: selectedStyle.name
    };
  });

  res.json({
    success: true,
    count: cards.length,
    style: selectedStyle.name,
    cards: cards
  });
});

// Генерация промпта для эмоции
app.post('/api/generate/emotion', (req, res) => {
  const { emotion: emotionId, intensity, style: styleName } = req.body;

  const emotionData = emotions[emotionId];
  if (!emotionData) {
    return res.status(400).json({ error: 'Неизвестная эмоция' });
  }

  const level = intensity || 'medium';
  const selectedStyle = styles[styleName] || styles.cartoon;
  const levelPrompt = emotionData.levels[level] || emotionData.levels.medium;

  const prompt = `Portrait of a person showing ${emotionData.name} emotion, ${emotionData.prompt}, ${levelPrompt}, clear facial expression, front view${selectedStyle.suffix}`;
  const negative = selectedStyle.negative + ', nsfw, violent, scary, disturbing';

  res.json({
    success: true,
    emotion: emotionData.name,
    emoji: emotionData.emoji,
    intensity: level,
    prompt: prompt,
    negative_prompt: negative,
    style: selectedStyle.name
  });
});

// Генерация промпта для успокаивающей сцены
app.post('/api/generate/calming', (req, res) => {
  const { scene: sceneId, customDescription, colorPalette } = req.body;

  let prompt;
  let name;
  let emoji;

  if (sceneId && calmingScenes[sceneId]) {
    const sceneData = calmingScenes[sceneId];
    prompt = sceneData.prompt;
    name = sceneData.name;
    emoji = sceneData.emoji;
  } else if (customDescription) {
    prompt = `${customDescription}, calming, peaceful, soothing, gentle colors, relaxing atmosphere`;
    name = 'Своя сцена';
    emoji = '🎨';
  } else {
    return res.status(400).json({ error: 'Выберите сцену или опишите свою' });
  }

  const palettes = {
    muted: ', muted desaturated colors, low saturation, calm palette',
    pastel: ', pastel colors, soft pink, light blue, gentle yellow, mint green',
    warm: ', warm gentle colors, soft orange, cream, light brown',
    cool: ', cool calming colors, light blue, soft teal, lavender'
  };

  prompt += palettes[colorPalette] || palettes.muted;

  res.json({
    success: true,
    scene: name,
    emoji: emoji,
    prompt: prompt,
    negative_prompt: 'fast movement, jarring, sudden changes, flashing, strobing, chaotic, scary, violent, nsfw, text, watermark'
  });
});

// Генерация промптов для социальной истории
app.post('/api/generate/story', (req, res) => {
  const { title, steps, style: styleName } = req.body;

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Добавьте хотя бы один шаг истории' });
  }

  const selectedStyle = styles[styleName] || styles.cartoon;
  const safetyNeg = 'nsfw, violent, blood, scary, horror, disturbing, nude, sexual';

  const storySteps = steps.map((step, index) => ({
    step: index + 1,
    text: step.trim(),
    prompt: `Illustration for social story step ${index + 1}: "${step.trim()}", clear scene, easy to understand, showing social situation${selectedStyle.suffix}, sequential illustration, consistent style`,
    negative_prompt: selectedStyle.negative + ', ' + safetyNeg
  }));

  res.json({
    success: true,
    title: title || 'Моя история',
    totalSteps: storySteps.length,
    style: selectedStyle.name,
    steps: storySteps
  });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   🧩 NeuroVisual Helper запущен!     ║');
  console.log('║                                      ║');
  console.log('║   Откройте в браузере:               ║');
  console.log(`║   http://localhost:${PORT}               ║`);
  console.log('║                                      ║');
  console.log('║   Для остановки: Ctrl + C            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});