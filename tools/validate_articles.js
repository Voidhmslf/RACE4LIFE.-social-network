// Проверка контента: node tools/validate_articles.js
// Ищет пропущенные статьи, дубли заголовков и предложений, слишком короткие тексты.
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'articles.js'));
const src = fs.readFileSync(path.join(__dirname, '..', 'data-generator.js'), 'utf8');
const order = JSON.parse(src.match(/const ORDERED_TOPIC_IDS = (\[.*?\]);/)[1]);
const TOTAL = 465;
const MIN_CHARS = 800;

const used = {};
for (let i = 0; i < TOTAL; i++) {
  const t = order[i % order.length];
  used[t] = (used[t] || 0) + 1;
}

const problems = [];
const titles = new Map();
const sentences = new Map();
let count = 0;

for (const topic in used) {
  for (let v = 0; v < used[topic]; v++) {
    const id = `${topic}#${v}`;
    const a = window.ARTICLES[topic] && window.ARTICLES[topic][v];
    if (!a || !a.t || !a.e || !a.c) { problems.push(`${id}: нет статьи`); continue; }
    count++;
    if (a.c.length < MIN_CHARS) problems.push(`${id}: короткий текст (${a.c.length} симв.)`);
    if (a.c.startsWith(a.e)) problems.push(`${id}: анонс повторяется в начале текста`);
    if (titles.has(a.t)) problems.push(`${id}: заголовок дублирует ${titles.get(a.t)}`);
    titles.set(a.t, id);
    for (const s of a.c.split(/(?<=[.!?])\s+|\n+/)) {
      const t = s.trim();
      if (t.length < 40 || t.startsWith('###')) continue;
      if (sentences.has(t) && sentences.get(t) !== id) problems.push(`${id}: предложение повторяет ${sentences.get(t)}: «${t.slice(0, 60)}…»`);
      else sentences.set(t, id);
    }
  }
}

console.log(`Статей проверено: ${count} из ${TOTAL}`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('Проблем не найдено');
