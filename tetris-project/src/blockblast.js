// 積み上げ型ブロックブラスト
const COLS = 8;
const ROWS = 8;
const BLOCK_SIZE = 40;
const COLORS = ['#e57373','#64b5f6','#81c784','#ffd54f','#ba68c8','#4dd0e1','#f06292'];
const SHAPES = [
  [[1,1,1,1]], // I
  [[1,1],[1,1]], // O
  [[0,1,0],[1,1,1]], // T
  [[1,1,0],[0,1,1]], // S
  [[0,1,1],[1,1,0]], // Z
  [[1,0,0],[1,1,1]], // J
  [[0,0,1],[1,1,1]]  // L
];
let grid = Array.from({length:ROWS},()=>Array(COLS).fill(0));
let blockScore = 0;
let gameOver = false;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const paletteDiv = document.getElementById('blockPalette');

function drawGrid() {
  if (!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // 升目（グリッド線）を描画
  ctx.strokeStyle = '#bbb';
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
  // ブロックを描画
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(grid[y][x]){
        ctx.fillStyle = COLORS[grid[y][x]-1];
        ctx.fillRect(x*BLOCK_SIZE,y*BLOCK_SIZE,BLOCK_SIZE,BLOCK_SIZE);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x*BLOCK_SIZE,y*BLOCK_SIZE,BLOCK_SIZE,BLOCK_SIZE);
      }
    }
  }
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
    blockScore += lines*100;
    drawGrid();
  }
}

function canPlaceBlock(shape, px, py){
  let canPlace = false;
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        let nx = px + x;
        let ny = py + y;
        if(nx<0||nx>=COLS||ny<0||ny>=ROWS) continue; // 枠外は無視
        if(grid[ny][nx]) return false; // 枠内で重なりがあればNG
        canPlace = true; // 枠内に1つでも置ければOK
      }
    }
  }
  return canPlace;
}

function placeBlock(shape, px, py, colorIdx){
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        let nx = px + x;
        let ny = py + y;
        if(nx<0||nx>=COLS||ny<0||ny>=ROWS) continue; // 枠外は無視
        grid[ny][nx] = colorIdx+1;
      }
    }
  }
  clearLines();
  drawGrid();
}

function drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY){
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        ctx2d.fillStyle = COLORS[colorIdx];
        ctx2d.fillRect(offsetX + x*BLOCK_SIZE, offsetY + y*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx2d.strokeStyle = '#333';
        ctx2d.strokeRect(offsetX + x*BLOCK_SIZE, offsetY + y*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }
}

let currentPalette = [];
let selectedBlockIdx = null;
function createPalette(){
  paletteDiv.innerHTML = '';
  if(currentPalette.length === 0){
    let count = 0;
    while(count < 3){
      const idx = Math.floor(Math.random()*SHAPES.length);
      const shape = SHAPES[idx];
      if(shape.length <= ROWS && shape[0].length <= COLS){
        currentPalette.push({shape: shape, colorIdx: idx});
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
      createPalette();
    });
    paletteDiv.appendChild(canvasEl);
  });
}

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
  if(canPlaceBlock(shape, px, py)){
    placeBlock(shape, px, py, colorIdx);
    currentPalette.splice(selectedBlockIdx, 1);
    selectedBlockIdx = null;
    createPalette();
    if(currentPalette.length === 0){
      setTimeout(()=>{ currentPalette = []; createPalette(); }, 300);
    }
  } else {
    alert('その位置には置けません');
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
