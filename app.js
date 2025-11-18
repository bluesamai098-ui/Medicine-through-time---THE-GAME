/* Simple PWA single-file game logic */
const ERAS = [
  { key: "Ancient", title: "Ancient World", mentor: "Hippocrates", intro: "Birth of rational observation and the Four Humours." },
  { key: "Medieval", title: "Middle Ages", mentor: "A Monk Physician", intro: "Church control, Arabic scholarship, and the Black Death." },
  { key: "Renaissance", title: "Renaissance", mentor: "Vesalius", intro: "Dissections, anatomy and the printing press." },
  { key: "Industrial", title: "Industrial Age", mentor: "Edward Jenner", intro: "Cities, cholera, germ-theory beginnings and vaccines." },
  { key: "Modern", title: "Modern Era", mentor: "Florey & Chain", intro: "Antibiotics, NHS, high-tech diagnostics." }
];

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let state = {
  currentScene: "menu",
  currentEra: null,
  player: { level:1, xp:0, maxHP:100, hp:100 },
  boss: { hp:0, maxHP:0 },
  currentQuestion: null
};

// load/save
function saveState(){
  localStorage.setItem('mtt_state', JSON.stringify(state));
}
function loadState(){
  const s = localStorage.getItem('mtt_state');
  if(s) state = JSON.parse(s);
  updateMeta();
}
loadState();

// UI helpers
function showScene(id){
  $$('section.scene').forEach(s => s.classList.remove('active'));
  $(`#scene-${id}`).classList.add('active');
  state.currentScene = id;
  saveState();
}

function updateMeta(){
  $('#level').textContent = `Lvl ${state.player.level}`;
  $('#xp').textContent = `XP ${state.player.xp}`;
}

// Menu actions
$('#btn-start').addEventListener('click', () => {
  // reset progress
  state.player = { level:1, xp:0, maxHP:100, hp:100 };
  state.currentEra = null;
  saveState();
  showMap();
});
$('#btn-continue').addEventListener('click', () => {
  loadState();
  showScene('map');
});

// Map
function showMap(){
  const container = $('#era-list');
  container.innerHTML = '';
  ERAS.forEach((era, idx) => {
    const unlocked = (state.player.level >= (idx+1)); // simple gating: one era per level
    const div = document.createElement('div');
    div.className = 'era-item' + (unlocked ? '' : ' locked');
    div.innerHTML = `<div>
        <strong>${era.title}</strong><div style="font-size:13px;color:var(--muted)">${era.mentor}</div>
      </div>
      <div><button class="btn-ghost era-btn" data-era="${era.key}" ${!unlocked ? 'disabled' : ''}>Play</button></div>`;
    container.appendChild(div);
  });
  showScene('map');
  // bind era buttons
  $$('.era-btn').forEach(b => b.addEventListener('click', e=>{
    const eraKey = e.currentTarget.dataset.era;
    openEra(eraKey);
  }));
}
$('#btn-back-to-menu').addEventListener('click', ()=> showScene('menu'));

function openEra(eraKey){
  const era = ERAS.find(e=>e.key===eraKey);
  if(!era) return;
  state.currentEra = eraKey;
  $('#era-title').textContent = era.title;
  $('#era-intro').textContent = era.intro;
  $('#mentor-panel').textContent = `Mentor: ${era.mentor}`;
  showScene('era');
  saveState();
}

$('#btn-map').addEventListener('click', ()=> showMap());
$('#btn-start-quest').addEventListener('click', () => {
  startBattleForEra(state.currentEra);
});

// Battle system & questions
let QUESTIONS = null;
async function loadQuestions(){
  if(QUESTIONS) return QUESTIONS;
  try{
    const res = await fetch('/questions.json');
    QUESTIONS = await res.json();
  } catch(e){
    console.warn('Could not load questions.json; using embedded fallback.');
    QUESTIONS = { questions: [
      {"id":"anc_1","era":"Ancient","question":"What key idea did Hippocrates introduce?","choices":["Germ theory","The Four Humours","Vaccination"],"answerIndex":1,"explain":"Hippocrates promoted observation and the Four Humours."},
      {"id":"med_1","era":"Medieval","question":"Who preserved and expanded medical knowledge in the Middle Ages?","choices":["Monks only","Islamic scholars","The Vikings"],"answerIndex":1,"explain":"Islamic scholars translated and preserved Greek texts."},
      {"id":"ren_1","era":"Renaissance","question":"What did Vesalius do?","choices":["Dissected and published anatomy","Invented the microscope","Proved germ theory"],"answerIndex":0,"explain":"Vesalius produced detailed anatomical texts."},
      {"id":"ind_1","era":"Industrial","question":"Who is considered the pioneer of vaccination?","choices":["Jenner","Snow","Lister"],"answerIndex":0,"explain":"Edward Jenner developed smallpox vaccination."},
      {"id":"mod_1","era":"Modern","question":"Who developed penicillin for mass use?","choices":["Fleming","Florey & Chain","Pasteur"],"answerIndex":1,"explain":"Florey & Chain turned Fleming's discovery into a drug."}
    ]};
  }
  return QUESTIONS;
}

function getQuestionsForEra(eraKey){
  const q = QUESTIONS.questions.filter(x => x.era.toLowerCase() === eraKey.toLowerCase());
  return q;
}

async function startBattleForEra(eraKey){
  await loadQuestions();
  const eraQs = getQuestionsForEra(eraKey);
  if(eraQs.length===0){
    // fallback to any
    QUESTIONS.questions.forEach(q => {});
  }
  // initialize boss
  state.boss.maxHP = 80 + state.player.level * 10;
  state.boss.hp = state.boss.maxHP;
  state.player.hp = Math.min(state.player.hp, state.player.maxHP);
  updateHPDisplay();
  // store era questions queue
  state._queue = shuffleArray(eraQs.concat()).slice(0,5); // 5 Qs per battle
  showScene('battle');
  renderQuestion();
  saveState();
}

function renderQuestion(){
  const q = state._queue.shift();
  if(!q){
    // battle resolved based on hp
    if(state.boss.hp <= 0){
      onWin();
    } else {
      // out of questions: decide by HP
      if(state.boss.hp < state.player.hp) onWin(); else onLose();
    }
    return;
  }
  state.currentQuestion = q;
  $('#question-text').textContent = q.question;
  const al = $('#answer-list');
  al.innerHTML = '';
  q.choices.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = c;
    btn.addEventListener('click', ()=> onAnswer(i, btn));
    al.appendChild(btn);
  });
  $('#battle-msg').textContent = '';
  $('#btn-next').disabled = true;
  saveState();
}

function onAnswer(index, btn){
  const q = state.currentQuestion;
  const correct = index === q.answerIndex;
  if(correct){
    // damage boss
    const dmg = 25 + Math.floor(state.player.level * 2);
    state.boss.hp = Math.max(0, state.boss.hp - dmg);
    $('#battle-msg').textContent = `Correct! You hit the boss for ${dmg} dmg.`;
    btn.classList.add('correct');
    state.player.xp += 10;
    // small heal on correct
    state.player.hp = Math.min(state.player.maxHP, state.player.hp + 6);
  } else {
    // damage player
    const dmg = 15;
    state.player.hp = Math.max(0, state.player.hp - dmg);
    $('#battle-msg').textContent = `Wrong. You take ${dmg} damage.`;
    btn.classList.add('wrong');
    // show correct choice
    const idx = q.answerIndex;
    const correctBtn = $$('#answer-list .answer-btn')[idx];
    if(correctBtn) correctBtn.classList.add('correct');
  }
  updateHPDisplay();
  $('#btn-next').disabled = false;
  // disable all answer buttons
  $$('#answer-list .answer-btn').forEach(b => b.disabled = true);
  saveState();
}

$('#btn-next').addEventListener('click', ()=>{
  // if boss dead, handle win
  if(state.boss.hp <= 0){ onWin(); return; }
  if(state.player.hp <= 0){ onLose(); return; }
  renderQuestion();
});

$('#btn-surrender').addEventListener('click', ()=>{
  // return to map with no rewards
  showScene('map');
});

function onWin(){
  // reward xp and level up if needed
  state.player.xp += 30;
  // level up logic
  const xpForNext = 50 + (state.player.level - 1) * 50;
  while(state.player.xp >= xpForNext){
    state.player.xp -= xpForNext;
    state.player.level++;
    state.player.maxHP += 10;
    state.player.hp = state.player.maxHP;
  }
  $('#victory-title').textContent = 'Victory!';
  $('#victory-text').textContent = `You defeated the boss and gained XP. Level ${state.player.level}`;
  updateMeta();
  saveState();
  showScene('victory');
}

function onLose(){
  $('#victory-title').textContent = 'Defeat';
  $('#victory-text').textContent = `You were defeated. Recover and try again from the map.`;
  saveState();
  showScene('victory');
}

// victory buttons
$('#btn-continue-campaign').addEventListener('click', ()=>{
  // unlock next era by boosting level (simple)
  state.player.level = Math.max(state.player.level, (ERAS.findIndex(e=>e.key===state.currentEra)+2));
  updateMeta();
  saveState();
  showMap();
});
$('#btn-return-map').addEventListener('click', ()=> showMap());

function updateHPDisplay(){
  const p = state.player;
  const b = state.boss;
  const pf = Math.max(0, (p.hp / p.maxHP) * 100);
  const bf = b.maxHP ? Math.max(0, (b.hp / b.maxHP) * 100) : 0;
  $('#hp-player').style.width = `${pf}%`;
  $('#hp-boss').style.width = `${bf}%`;
  $('#hp-player-text').textContent = `${p.hp}/${p.maxHP}`;
  $('#hp-boss-text').textContent = `${b.hp}/${b.maxHP}`;
  updateMeta();
}

// small util
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }

// register service worker for offline
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(() => {
    console.log('SW registered');
  }).catch(e => console.warn('SW failed', e));
}

// on load show menu or map depending on state
if(state.currentScene === 'map') showMap();
else showScene('menu');
updateMeta();
