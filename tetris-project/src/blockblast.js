// 積み上げ型ブロックブラスト
const COLS = 8;
const ROWS = 8;
const BLOCK_SIZE = 40;
// 白基調の寒色系パレット（やや濃く、紫系を追加）
const COLORS = ['#f3fbff','#dff5ff','#cfeaff','#9fdff6','#7fcff6','#6fb8e6','#b9a8ff','#a08bff'];
const SHAPES = [
  // Tetromino + some extra shapes
  [[1,1,1,1]], // I
  [[1,1],[1,1]], // O
  [[0,1,0],[1,1,1]], // T
  [[1,1,0],[0,1,1]], // S
  [[0,1,1],[1,1,0]], // Z
  [[1,0,0],[1,1,1]], // J
  [[0,0,1],[1,1,1]], // L
  // Additional small shapes
  [[1]], // single
  [[1,1]], // domino
  [[1],[1],[1]], // vertical 3
  [[1,1,1]], // horizontal 3
  [[1,0],[1,0],[1,1]], // small L (3 tall)
  [[0,1],[0,1],[1,1]], // mirrored small L
  [[0,1,0],[1,1,1],[0,1,0]], // plus-like
  [[1,1,1],[0,1,0],[0,1,0]] // T-like tall
];
let grid = Array.from({length:ROWS},()=>Array(COLS).fill(0));
let blockScore = 0;
let gameOver = false;
const scoreEl = document.getElementById('scoreDisplay');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const paletteDiv = document.getElementById('blockPalette');

function drawGrid() {
  if (!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // 升目（グリッド線）を描画（淡い寒色）
  ctx.strokeStyle = '#d7ecf8';
  ctx.lineWidth = 1;
  for(let y=0; y<=ROWS; y++){
    ctx.beginPath();
    ctx.moveTo(0, y*BLOCK_SIZE);
    ctx.lineTo(COLS*BLOCK_SIZE, y*BLOCK_SIZE);
    ctx.stroke();
  }
  for(let x=0; x<=COLS; x++){
    ctx.beginPath();
    ctx.moveTo(x*BLOCK_SIZE, 0);
    ctx.lineTo(x*BLOCK_SIZE, ROWS*BLOCK_SIZE);
    ctx.stroke();
  }
  // ブロックを描画（正方形）
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(grid[y][x]){
        const color = getColor(grid[y][x]-1);
        const gx = x*BLOCK_SIZE, gy = y*BLOCK_SIZE;
  ctx.fillStyle = color;
  ctx.fillRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
  // ガラス風の光沢（上部に半透明グラデ）
  const glossGrad = ctx.createLinearGradient(gx, gy, gx, gy + BLOCK_SIZE * 0.5);
  glossGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  glossGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = glossGrad;
  ctx.fillRect(gx + 2, gy + 2, BLOCK_SIZE - 4, Math.floor(BLOCK_SIZE * 0.45));
  // 小さなハイライト点
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(gx + BLOCK_SIZE * 0.26, gy + BLOCK_SIZE * 0.16, BLOCK_SIZE * 0.12, BLOCK_SIZE * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 輪郭
  ctx.strokeStyle = '#7eaec4';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }
}

function getColor(idx){
  if(typeof idx === 'number' && idx >= 0 && idx < COLORS.length) return COLORS[idx];
  return '#dfeef7'; // フォールバックは淡い寒色グレー
}

function clearLines(){
  let lines = 0;
  for(let y=ROWS-1;y>=0;y--){
    if(grid[y].every(cell=>cell)){
      grid.splice(y,1);
      grid.unshift(Array(COLS).fill(0));
      lines++;
      y++;
    }
  }
  if(lines>0){
  // ライン消去ボーナス
  blockScore += lines*150;
  updateScore();
    drawGrid();
  }
}

function canPlaceBlock(shape, px, py){
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        let nx = px + x;
        let ny = py + y;
        if(nx<0||nx>=COLS||ny<0||ny>=ROWS) return false; // 枠外はNG
        if(grid[ny][nx] !== 0) return false; // 重なりはNG
      }
    }
  }
  return true;
}

function placeBlock(shape, px, py, colorIdx){
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        let nx = px + x;
        let ny = py + y;
        // canPlaceBlockで判定済みなので、枠内かつ空きのみ配置
        grid[ny][nx] = colorIdx+1;
      }
    }
  }
  // 置いたブロック数に応じた得点
  let placed = 0;
  for(let y=0;y<shape.length;y++) for(let x=0;x<shape[y].length;x++) if(shape[y][x]){
    const nx = px+x, ny = py+y;
    if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS) placed++;
  }
  blockScore += placed * 10;
  updateScore();
  clearLines();
  drawGrid();
}

function updateScore(){
  if(scoreEl) scoreEl.textContent = `スコア: ${blockScore}`;
}

function drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY){
  const base = getColor(colorIdx);
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        const gx = offsetX + x*BLOCK_SIZE;
        const gy = offsetY + y*BLOCK_SIZE;
  ctx2d.fillStyle = base;
  ctx2d.fillRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
  // プレビューにも光沢
  const pGrad = ctx2d.createLinearGradient(gx, gy, gx, gy + BLOCK_SIZE * 0.5);
  pGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx2d.fillStyle = pGrad;
  ctx2d.fillRect(gx + 2, gy + 2, BLOCK_SIZE - 4, Math.floor(BLOCK_SIZE * 0.45));
  ctx2d.fillStyle = 'rgba(255,255,255,0.55)';
  ctx2d.beginPath();
  ctx2d.ellipse(gx + BLOCK_SIZE * 0.26, gy + BLOCK_SIZE * 0.16, BLOCK_SIZE * 0.12, BLOCK_SIZE * 0.06, 0, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.strokeStyle = '#7eaec4';
  ctx2d.lineWidth = 1;
  ctx2d.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }
}

// 色ユーティリティ
function hexToRgb(hex){
  const h = hex.replace('#','');
  const bigint = parseInt(h,16);
  if(h.length===6){
    return {r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255};
  }
  return {r:200,g:200,b:200};
}
function rgbToHex(r,g,b){
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function lightenColor(hex, amt){
  const c = hexToRgb(hex);
  const r = Math.min(255, Math.round(c.r + (255-c.r)*amt));
  const g = Math.min(255, Math.round(c.g + (255-c.g)*amt));
  const b = Math.min(255, Math.round(c.b + (255-c.b)*amt));
  return rgbToHex(r,g,b);
}
function darkenColor(hex, amt){
  const c = hexToRgb(hex);
  const r = Math.max(0, Math.round(c.r*(1-amt)));
  const g = Math.max(0, Math.round(c.g*(1-amt)));
  const b = Math.max(0, Math.round(c.b*(1-amt)));
  return rgbToHex(r,g,b);
}

// 回転（90度時計回り）
function rotateShape(shape){
  const h = shape.length;
  const w = shape[0].length;
  const out = Array.from({length: w}, ()=>Array(h).fill(0));
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      out[x][h-1-y] = shape[y][x];
    }
  }
  return out;
}

// 左右反転
function flipShape(shape){
  return shape.map(row => row.slice().reverse());
}

let currentPalette = [];
let selectedBlockIdx = null;
let previewPx = null;
let previewPy = null;
function createPalette(){
  paletteDiv.innerHTML = '';
  if(currentPalette.length === 0){
    let count = 0;
    while(count < 3){
      const idx = Math.floor(Math.random()*SHAPES.length);
      let shape = SHAPES[idx];
      // ランダム回転
      const rotations = Math.floor(Math.random()*4);
      for(let r=0;r<rotations;r++) shape = rotateShape(shape);
      // ランダム反転
      if(Math.random() < 0.5) shape = flipShape(shape);
      // 枠内に収まるサイズのみ追加
      if(shape.length <= ROWS && shape[0].length <= COLS){
        const colorChoice = Math.floor(Math.random()*COLORS.length);
        currentPalette.push({shape: shape, colorIdx: colorChoice});
        count++;
      }
    }
  }
  currentPalette.forEach((item, i) => {
    const shape = item.shape;
    const colorIdx = item.colorIdx;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = shape[0].length*BLOCK_SIZE;
    canvasEl.height = shape.length*BLOCK_SIZE;
    canvasEl.className = 'block-item';
    if(selectedBlockIdx === i) canvasEl.style.border = '2px solid #2196f3';
    const ctx2d = canvasEl.getContext('2d');
    drawBlockPreview(shape, colorIdx, ctx2d, 0, 0);
    canvasEl.addEventListener('click', () => {
      selectedBlockIdx = i;
      previewPx = null; previewPy = null;
      createPalette();
    });
    paletteDiv.appendChild(canvasEl);
  });
}

// クリックで配置（選択中ブロックがあれば）
canvas.onmousedown = function(e) {
  if(selectedBlockIdx === null || !currentPalette[selectedBlockIdx]) return;
  const shape = currentPalette[selectedBlockIdx].shape;
  const colorIdx = currentPalette[selectedBlockIdx].colorIdx;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  let px = Math.floor(mx / BLOCK_SIZE);
  let py = Math.floor(my / BLOCK_SIZE);
  // 形どおりに配置できるか判定
  if(canPlaceBlock(shape, px, py)){
    placeBlock(shape, px, py, colorIdx);
    currentPalette.splice(selectedBlockIdx, 1);
    selectedBlockIdx = null;
    previewPx = null; previewPy = null;
    createPalette();
    if(currentPalette.length === 0){
      setTimeout(()=>{ currentPalette = []; createPalette(); }, 300);
    }
  } else {
    alert('その位置には置けません');
  }
};

// マウス移動でプレビュー表示
canvas.onmousemove = function(e){
  if(selectedBlockIdx === null || !currentPalette[selectedBlockIdx]) return;
  const shape = currentPalette[selectedBlockIdx].shape;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  let px = Math.floor(mx / BLOCK_SIZE);
  let py = Math.floor(my / BLOCK_SIZE);
  previewPx = px; previewPy = py;
  // redraw with preview
  drawGrid();
  // draw preview if possible
  // drawBlockPreview expects ctx2d and offset; use main ctx with alpha
  if(previewPx !== null && previewPy !== null){
    // show preview even if partially outside, but align to grid
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawBlockPreview(shape, currentPalette[selectedBlockIdx].colorIdx, ctx, previewPx*BLOCK_SIZE, previewPy*BLOCK_SIZE);
    ctx.restore();
  }
};

function startBlockGame(){
  grid = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  blockScore = 0;
  gameOver = false;
  currentPalette = [];
  drawGrid();
  createPalette();
}

if(canvas && ctx && paletteDiv){
  startBlockGame();
}
