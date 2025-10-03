// Simple top-down shooter
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  width: canvas.width,
  height: canvas.height,
  player: { x: canvas.width / 2 - 20, y: canvas.height - 80, w: 40, h: 40, speed: 300 },
  bullets: [],
  enemies: [],
  enemyTimer: 0,
  enemyInterval: 1200,
  score: 0,
  lives: 3,
  running: false,
  lastTime: 0,
  _spaceDown: false,
};

const keys = {};
window.addEventListener('keydown', e => {
  // Prevent spacebar from activating focused buttons when playing
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
  }
  keys[e.key] = true;
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const bulletsEl = document.getElementById('bullets');
const startBtn = document.getElementById('start-button');

function spawnEnemy() {
  const size = 32;
  const x = Math.random() * (state.width - size);
  if (window.console && console.debug) console.debug('spawnEnemy at', x);
  state.enemies.push({ x, y: -size, w: size, h: size, speed: 80 + Math.random() * 80 });
  if (window.console && console.debug) console.debug('enemies length', state.enemies.length);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt) {
  if (!state.running) return;

  const p = state.player;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x -= p.speed * dt;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x += p.speed * dt;
  p.x = Math.max(0, Math.min(state.width - p.w, p.x));

  // Shooting: use a time-based cooldown instead of relying on keyup/keyDown state
  state.shotTimer = state.shotTimer || 0;
  state.shotCooldown = state.shotCooldown || 0.18; // seconds between shots
  state.shotTimer += dt;
  if ((keys[' '] || keys['Space']) && state.bullets.length < 20) {
    if (state.shotTimer >= state.shotCooldown) {
      state.bullets.push({ x: p.x + p.w / 2 - 4, y: p.y - 10, w: 8, h: 16, speed: 500 });
      state.shotTimer = 0;
    }
  }

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.y -= b.speed * dt;
    if (b.y + b.h < 0) state.bullets.splice(i, 1);
  }

  state.enemyTimer += dt * 1000;
  if (state.enemyTimer > state.enemyInterval) {
    state.enemyTimer = 0;
    spawnEnemy();
    state.enemyInterval = Math.max(400, state.enemyInterval - 10);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.y += e.speed * dt;
    if (e.y > state.height) {
      state.enemies.splice(i, 1);
      state.lives -= 1;
      updateHUD();
      if (state.lives <= 0) return gameOver();
    }
  }

  // Collisions: bullets vs enemies
  // Do not splice while iterating; mark removals then remove after to avoid index corruption
  const enemiesToRemove = new Set();
  const bulletsToRemove = new Set();
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    for (let j = 0; j < state.bullets.length; j++) {
      const b = state.bullets[j];
      // guard: ensure numeric values
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      if (rectsOverlap(e, b)) {
        enemiesToRemove.add(i);
        bulletsToRemove.add(j);
        // debug log
        if (window.console && console.debug) console.debug('hit:', {enemyIndex: i, bulletIndex: j, enemy: e, bullet: b});
        state.score += 100;
        break; // stop testing this enemy
      }
    }
  }
  if (enemiesToRemove.size > 0 || bulletsToRemove.size > 0) {
    // remove bullets (by filtering indices not in bulletsToRemove)
    state.bullets = state.bullets.filter((_, idx) => !bulletsToRemove.has(idx));
    // remove enemies
    state.enemies = state.enemies.filter((_, idx) => !enemiesToRemove.has(idx));
    updateHUD();
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (rectsOverlap(e, state.player)) {
      state.enemies.splice(i, 1);
      state.lives -= 1;
      updateHUD();
      if (state.lives <= 0) return gameOver();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = '#061A2B';
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = '#4EE1FF';
  const p = state.player;
  ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = '#FFEA00';
  state.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  ctx.fillStyle = '#FF6B6B';
  state.enemies.forEach(e => ctx.fillRect(e.x, e.y, e.w, e.h));

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(0, state.height - 80);
  ctx.lineTo(state.width, state.height - 80);
  ctx.stroke();
}

function loop(timestamp) {
  if (!state.running) return;
  const dt = (timestamp - state.lastTime) / 1000 || 0;
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  state.bullets.length = 0;
  state.enemies.length = 0;
  state.score = 0;
  state.lives = 3;
  state.enemyInterval = 1200;
  state.enemyTimer = 0;
  state.running = true;
  state.lastTime = performance.now();
  updateHUD();
  requestAnimationFrame(loop);
}

function updateHUD() {
  scoreEl.textContent = `スコア: ${state.score}`;
  livesEl.textContent = `残機: ${state.lives}`;
  if (bulletsEl) bulletsEl.textContent = `弾: ${state.bullets.length}`;
}

function gameOver() {
  state.running = false;
  alert(`ゲームオーバー\nスコア: ${state.score}`);
}

startBtn.addEventListener('click', () => { startGame(); startBtn.blur(); });

window.__state = state;