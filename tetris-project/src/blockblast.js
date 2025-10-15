// 積み上げ型ブロックブラスト
const COLS = 8;
const ROWS = 8;
const BLOCK_SIZE = 60;
// 白基調の寒色系パレット（やや濃く、紫系を追加）
const COLORS = [
  '#f3fbff','#dff5ff','#cfeaff','#9fdff6','#7fcff6','#6fb8e6','#b9a8ff','#a08bff', // 既存寒色系
  '#ffb3b3','#ff6666','#ffb347','#ffe066', // 赤・オレンジ・黄系
  '#b3ffb3','#66ff66','#47ffb3','#66ffe0', // 緑・エメラルド系
  '#b3b3ff','#6666ff','#e066ff','#ff66d9', // 青・紫・ピンク系
  '#ff99cc','#ffccf9','#c2f0fc','#f6ffb3'  // パステル系
];
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
  [[1,1,1],[1,1,1],[1,1,1]], // 9マス正方形（3x3）
  [[1],[1],[1],[1]], // 縦長4
  [[1],[1],[1],[1],[1]], // 縦長5
  [[1,1,1],[0,1,0],[0,1,0]], // T-like tall
  // L字型（横3＋縦3、縦棒が端）
  [[1,1,1],[1,0,0],[1,0,0]], // L字型（左端）
  [[1,1,1],[0,0,1],[0,0,1]] // L字型（右端）
];
const blocks = [
  [[1]], // 1ブロック
  // 他のブロック定義
  [[1,1]],
  [[1,1,1]],
  // ...他の形...
];
let grid = Array.from({length:ROWS},()=>Array(COLS).fill(0));
let blockScore = 0;
let comboMultiplier = 1;
let gameOver = false;
const scoreEl = document.getElementById('scoreDisplay');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const paletteDiv = document.getElementById('blockPalette');
if(!paletteDiv) {
  alert('paletteDivが取得できません。HTMLに<div id="blockPalette"></div>があるか確認してください。');
}

function drawGrid(glowingRows = [], glowingCols = []) {
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
        // 光らせる行・列なら上書き
        if (glowingRows.includes(y) || glowingCols.includes(x)) {
          // 強い黄色～白グラデーションで光らせる
          const glowGrad = ctx.createLinearGradient(gx, gy, gx, gy + BLOCK_SIZE);
          glowGrad.addColorStop(0, 'rgba(255,255,0,0.95)');
          glowGrad.addColorStop(0.5, 'rgba(255,255,180,0.85)');
          glowGrad.addColorStop(1, 'rgba(255,255,255,0.7)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
          // 枠線も黄色に
          ctx.strokeStyle = '#ffe600';
          ctx.lineWidth = 3;
          ctx.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
        }
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
  // ゲームオーバー時に「No Space」をブロック風フォントで表示
  if(gameOver && ctx){
    ctx.save();
    ctx.font = `bold ${Math.floor(canvas.width/7)}px 'Press Start 2P', 'Arial Black', 'sans-serif'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 6;
    const msg = 'No Space';
    ctx.strokeText(msg, canvas.width/2, canvas.height/2);
    ctx.fillStyle = '#ffe600';
    ctx.fillText(msg, canvas.width/2, canvas.height/2);
    ctx.restore();
  }
}

function getColor(idx){
  if(typeof idx === 'number' && idx >= 0 && idx < COLORS.length) return COLORS[idx];
  return '#dfeef7'; // フォールバックは淡い寒色グレー
}

function clearLines(){
  let glowingRows = [];
  let glowingCols = [];
  // 横ライン検出
  for(let y=ROWS-1;y>=0;y--){
    if(grid[y].every(cell=>cell)){
      glowingRows.push(y);
    }
  }
  // 縦ライン検出
  for(let x=0;x<COLS;x++){
    let colFull = true;
    for(let y=0;y<ROWS;y++){
      if(!grid[y][x]){ colFull = false; break; }
    }
    if(colFull) glowingCols.push(x);
  }
  if(glowingRows.length > 0 || glowingCols.length > 0){
    // 光らせる
    drawGrid(glowingRows, glowingCols);
    setTimeout(()=>{
      drawGrid(glowingRows, glowingCols);
      setTimeout(()=>{
        let lines = 0;
        // 横ライン消去（位置はそのまま、消えた行だけ0埋め）
        for(let i=0;i<glowingRows.length;i++){
          const y = glowingRows[i];
          grid[y] = Array(COLS).fill(0);
          lines++;
        }
        // 縦ライン消去
        for(let i=0;i<glowingCols.length;i++){
          const x = glowingCols[i];
          for(let y=0;y<ROWS;y++){
            grid[y][x] = 0;
          }
          lines++;
        }
        // ライン消去ボーナス（連鎖倍率適用）
        blockScore += lines*50*comboMultiplier;
  blockScore += lines*100*comboMultiplier;
        comboMultiplier++;
        updateScore();
        drawGrid();
        // 全消し判定（盤面がすべて0）
        const isAllClear = grid.every(row => row.every(cell => cell === 0));
        if(isAllClear) {
          blockScore += 1000; // 全消しボーナス
          updateScore();
        }
        // ライン消去後にpalette内のブロックがどこにも置けない場合はゲームオーバー
        if(currentPalette.length > 0) {
          let canPlaceAny = false;
          for(let i=0; i<currentPalette.length; i++) {
            const shape = currentPalette[i].shape;
            for(let py=0; py<=ROWS-shape.length; py++) {
              for(let px=0; px<=COLS-shape[0].length; px++) {
                if(canPlaceBlock(shape, px, py)) {
                  canPlaceAny = true;
                  break;
                }
              }
              if(canPlaceAny) break;
            }
            if(canPlaceAny) break;
          }
          if(!canPlaceAny) {
            gameOver = true;
            alert('ゲームオーバー！置ける場所がありません');
          }
        }
      }, 180);
    }, 180);
  } else {
    comboMultiplier = 1;
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
  blockScore += placed;
  blockScore += placed;
  blockScore += placed; // 2倍加点
  updateScore();
  clearLines();
  drawGrid();
}

function updateScore(){
  if(scoreEl) scoreEl.textContent = `スコア: ${blockScore}`;
}

function drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY){
  const base = getColor(colorIdx);
  // プレビュー用: 必ず正方形で描画
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        // 正方形で描画
        const size = BLOCK_SIZE;
        const gx = offsetX + x*size;
        const gy = offsetY + y*size;
        ctx2d.fillStyle = base;
        ctx2d.fillRect(gx, gy, size, size);
        // 光沢
        const pGrad = ctx2d.createLinearGradient(gx, gy, gx, gy + size * 0.5);
        pGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
        pGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
        ctx2d.fillStyle = pGrad;
        ctx2d.fillRect(gx + 2, gy + 2, size - 4, Math.floor(size * 0.45));
        ctx2d.fillStyle = 'rgba(255,255,255,0.55)';
        ctx2d.beginPath();
        ctx2d.ellipse(gx + size * 0.26, gy + size * 0.16, size * 0.12, size * 0.06, 0, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.strokeStyle = '#7eaec4';
        ctx2d.lineWidth = 1;
        ctx2d.strokeRect(gx, gy, size, size);
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
  if(!paletteDiv) return;
  paletteDiv.innerHTML = '';
  if(currentPalette.length === 0){
    let count = 0;
    let tries = 0;
    while(count < 3 && tries < 100){
      // 1・2ブロックは最も低確率、3ブロックはやや低確率、9マス正方形・縦長4/5・L字型は低確率、その他は高確率
      let idx;
      const r = Math.random();
      if(r < 0.07){
        idx = Math.floor(Math.random()*2);
      }else if(r < 0.22){
        idx = 2 + Math.floor(Math.random()*3);
      }else if(r < 0.37){
        idx = 14 + Math.floor(Math.random()*9);
      }else{
        idx = 5 + Math.floor(Math.random()*(14-5));
      }
      let shape = SHAPES[idx];
      const rotations = Math.floor(Math.random()*4);
      for(let r=0;r<rotations;r++) shape = rotateShape(shape);
      if(Math.random() < 0.5) shape = flipShape(shape);
      const blockCount = shape.flat().reduce((a,b)=>a+b,0);
      const isSquare = shape.length === shape[0].length && shape.length > 1;
      if(shape.length <= ROWS && shape[0].length <= COLS && (!isSquare || blockCount <= 4)){
        const colorChoice = Math.floor(Math.random()*COLORS.length);
        currentPalette.push({shape: shape, colorIdx: colorChoice});
        count++;
      }
      tries++;
    }
    // paletteが1つも埋まらなかった場合は、必ず1ブロック（[[1]]）を追加
    if(currentPalette.length === 0){
      currentPalette.push({shape: [[1]], colorIdx: 0});
    }
  }
  currentPalette.forEach((item, i) => {
    const shape = item.shape;
    const colorIdx = item.colorIdx;
    // プレビューは必ず正方形のcanvas（最大サイズ基準）
    const blockW = shape[0].length;
    const blockH = shape.length;
    const canvasSize = Math.max(blockW, blockH) * BLOCK_SIZE;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = canvasSize;
    canvasEl.height = canvasSize;
    canvasEl.className = 'block-item';
    if(selectedBlockIdx === i) canvasEl.style.border = '2px solid #2196f3';
    const ctx2d = canvasEl.getContext('2d');
    // 中央に配置
    const offsetX = Math.floor((canvasSize - blockW*BLOCK_SIZE)/2);
    const offsetY = Math.floor((canvasSize - blockH*BLOCK_SIZE)/2);
    drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY);
    canvasEl.addEventListener('click', () => {
  selectedBlockIdx = i;
  previewPx = null; previewPy = null;
    });
    paletteDiv.appendChild(canvasEl);
  });
  // palette生成後にゲームオーバー判定
  if(currentPalette.length > 0) {
    let canPlaceAny = false;
    for(let i=0; i<currentPalette.length; i++) {
      const shape = currentPalette[i].shape;
      for(let py=0; py<=ROWS-shape.length; py++) {
        for(let px=0; px<=COLS-shape[0].length; px++) {
          if(canPlaceBlock(shape, px, py)) {
            canPlaceAny = true;
            break;
          }
        }
        if(canPlaceAny) break;
      }
      if(canPlaceAny) break;
    }
    if(!canPlaceAny) {
      if(!gameOver) {
        gameOver = true;
        alert('ゲームオーバー！置ける場所がありません');
      }
    } else {
      // 置けるブロックがあればゲーム続行
      if(gameOver) gameOver = false;
    }
  }
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
