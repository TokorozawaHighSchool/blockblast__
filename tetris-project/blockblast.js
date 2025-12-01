// 積み上げ型ブロックブラスト
const COLS = 8;
const ROWS = 8;
// BLOCK_SIZE will be computed dynamically to make the canvas fill the available space
// 画面サイズ変動を防ぐため固定ブロックサイズ
let BLOCK_SIZE = 60;
// 白基調の寒色系パレット（やや濃く、紫系を追加）
const COLORS = [
  // 先頭の淡色は視認性が低かったため、やや濃くしてコントラストを上げる
  '#C2AAE6','#77B6C2','#5C9BBC','#F03C32','#ACA7BB','#ABD3D8','#A58CDC','#A590AF', // 寒色系（調整済）
  '#7CA1F0','#FF8C9B','#4DD7E3','#FAC31E', // 赤・オレンジ・黄系
  '#00A6FE','#DCFF50','#6EB487','#64C8F0', // 緑・エメラルド系
  '#C10E49','#5A5FAA','#DC3C41','#8C4664', // 青・紫・ピンク系
   '#192332','#2C35BD','#D8E9FC','#BA6EA5', // パステル系
   '#A09BD8', // 追加のパステル系
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
  ,
  // 追加シェイプ: ここから種類を増やす
  [[0,1,0],[1,1,1],[0,1,0]], // プラス型（5ブロック）
  [[1,0,1],[1,1,1]], // U字型（上に隙間）
  [[1,1],[1,0]], // 2x2 の一欠け（3ブロック）
  [[1,1,0],[0,1,1],[0,0,1]], // ねじれたスネーク系（複雑形）
  [[1,0,0],[1,1,1],[0,0,1]], // 中間の複合L
  [[1,1,1,1,1]], // 横長5
  [[1],[1,1,1],[1]] // 小さな十字に近い形（5ブロック）
];

// NOTE: Rare-shapes are chosen by name, not hard-coded indices, to avoid index drift.
// Rare candidates: 3x3 square, large L (left/right), composite L variant.

// Helper to compare shapes (2D arrays of 0/1)
function shapesEqual(a, b){
  if(!a || !b) return false;
  if(a.length !== b.length) return false;
  for(let y=0;y<a.length;y++){
    if(a[y].length !== b[y].length) return false;
    for(let x=0;x<a[y].length;x++){
      if(a[y][x] !== b[y][x]) return false;
    }
  }
  return true;
}

// Patterns we consider rare (base orientation)
const RARE_PATTERNS = [
  [[1,1,1],[1,1,1],[1,1,1]], // 3x3 full square
  [[1,1,1],[1,0,0],[1,0,0]], // large L (left)
  [[1,1,1],[0,0,1],[0,0,1]], // large L (right)
  [[1,0,0],[1,1,1],[0,0,1]]  // composite L
];

// Compute rare indices dynamically from SHAPES to avoid index drift
const RARE_SHAPE_INDICES = SHAPES.reduce((acc, sh, i)=>{
  if(RARE_PATTERNS.some(p => shapesEqual(sh, p))) acc.push(i);
  return acc;
}, []);

const blocks = [
  // 他のブロック定義
  [[1,1]],
  [[1,1,1]],
  // ...他の形...
];
let grid = Array.from({length:ROWS},()=>Array(COLS).fill(0));
let blockScore = 0;
// 表示用のスコア（アニメで表示される値）
let displayedScore = 0;
// スコアアニメーション用の状態
let scoreAnim = { raf: null, from: 0, to: 0, start: 0, duration: 600 };
// comboCount: number of successive clears in a row. Used to compute combo bonus: 10 * comboCount
let comboCount = 0;
let gameOver = false;
// ライン消去アニメ中かどうか（アニメ中は一時的に置けなくても game over 表示を抑止する）
let clearingInProgress = false;
// 1ゲームあたりに生成できるブロックのセル数合計の上限（配置済みセル数 + パレット内セル数合計で管理）
const BLOCKS_PER_GAME_LIMIT = 5000;
// スコア換算の倍率（1で現状のスコア）
// ユーザ要望によりデフォルトを大きく設定（以前は 3）
// ここを変えるだけで全体の得点を増やせます
const SCORE_MULTIPLIER = 10;
// パレット表示は盤面より少し大きく（比率）
const PALETTE_SCALE = 1.05;
// プレイヤーが実際に配置したセル数の合計をカウント
let blocksPlaced = 0;
const scoreEl = document.getElementById('scoreDisplay');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const paletteDiv = document.getElementById('blockPalette');
if(!paletteDiv) {
  alert('paletteDivが取得できません。HTMLに<div id="blockPalette"></div>があるか確認してください。');
}

// 均等色分布: カラーバッグ（全色をシャッフルして使い切りで補充）
let colorBag = [];
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
function refillColorBag(){
  colorBag = shuffle(Array.from({length: COLORS.length}, (_,i)=>i));
}
function nextColorIdx(){
  if(colorBag.length === 0) refillColorBag();
  return colorBag.pop();
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
          const glowGrad = ctx.createLinearGradient(gx, gy, gx, gy + BLOCK_SIZE);
          glowGrad.addColorStop(0, 'rgba(255,255,0,0.95)');
          glowGrad.addColorStop(0.5, 'rgba(255,255,180,0.85)');
          glowGrad.addColorStop(1, 'rgba(255,255,255,0.7)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = '#ffe600';
          ctx.lineWidth = 3;
          ctx.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
        }
        // 光沢や輪郭
        const glossGrad = ctx.createLinearGradient(gx, gy, gx, gy + BLOCK_SIZE * 0.5);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
        ctx.fillStyle = glossGrad;
        ctx.fillRect(gx + 2, gy + 2, BLOCK_SIZE - 4, Math.floor(BLOCK_SIZE * 0.45));
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(gx + BLOCK_SIZE * 0.26, gy + BLOCK_SIZE * 0.16, BLOCK_SIZE * 0.12, BLOCK_SIZE * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7eaec4';
        ctx.lineWidth = 1;
        ctx.strokeRect(gx, gy, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }
  // ゲームオーバー時に「No Space」をブロック風フォントで表示
  if(gameOver && ctx){
    // DOMオーバーレイが存在して表示中なら、キャンバス上の重複描画は行わない
    try{
      const ov = document.getElementById('gameOverOverlay');
      if(ov && ov.style.display && ov.style.display !== 'none'){
        // DOM側で表示しているためキャンバス描画はスキップ
      } else {
        ctx.save();
        // 半透明オーバーレイで背景を暗くする
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 大きな見出し（英語）
        const mainMsg = 'GAME OVER';
        const mainFontSize = Math.floor(canvas.width * 0.16); // 画面幅に対して大きめ
        ctx.font = `bold ${mainFontSize}px 'Press Start 2P', 'Arial Black', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 外枠（暗）→ 内側の明色で視認性を確保
        ctx.lineWidth = Math.max(6, Math.floor(canvas.width * 0.02));
        ctx.strokeStyle = '#222';
        ctx.strokeText(mainMsg, canvas.width/2, canvas.height/2 - Math.floor(mainFontSize*0.08));
        ctx.fillStyle = '#ffe600';
        ctx.fillText(mainMsg, canvas.width/2, canvas.height/2 - Math.floor(mainFontSize*0.08));

        // 補助テキスト（日本語または短い説明）
        const subMsg = '置けるブロックがありません';
        const subFontSize = Math.floor(canvas.width * 0.055);
        ctx.font = `bold ${subFontSize}px 'Arial', sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(subMsg, canvas.width/2, canvas.height/2 + Math.floor(mainFontSize*0.26));

        ctx.restore();
      }
    }catch(e){
      // documentが未定義等、何かあっても致命的にはしない
    }
  }
}

// Resize logic: compute BLOCK_SIZE so that the grid (COLS x ROWS) fits the viewport
// 以前は画面に合わせて動的リサイズしていたが、サイズが変わる問題があるため固定サイズで描画する。
function initFixedCanvas(){
  if(!canvas) return;
  const width = COLS * BLOCK_SIZE;
  const height = ROWS * BLOCK_SIZE;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  if (ctx && ctx.scale) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGrid();
}

// debounce helper
function debounce(fn, wait=120){
  let t = null;
  return function(...a){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this,a), wait);
  };
}

// initialize sizing on load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initFixedCanvas();
} else {
  window.addEventListener('DOMContentLoaded', initFixedCanvas);
}

// handle window resize
// リサイズ時もサイズを維持（何もしない）
// window.addEventListener('resize', ()=>{});

// パレットの中身が変わったら高さが変わるため再計算
try{
  if (paletteDiv) {
  // 高さ変化を監視してもキャンバスサイズは変えない
  const mo = new MutationObserver(()=>{});
    mo.observe(paletteDiv, { childList: true, subtree: true, attributes: true });
  }
}catch(e){/* ignore */}

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
  // ライン消去アニメが始まるのでフラグを立てる
  clearingInProgress = true;
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
  // 新スコア: 同時消去本数に応じた基点 × (comboCount+1)
  // 基点テーブル（1~6本）: [10,20,60,120,200,300]
  const baseByLines = [0,10,20,60,120,200,300];
  const clamped = Math.max(0, Math.min(lines, 6));
  const base = baseByLines[clamped] || 0;
  const comboMultiplier = (comboCount + 1);
  addToScore(base * comboMultiplier);
  comboCount++;
        updateScore();
        drawGrid();
        // 全消し判定（盤面がすべて0）
        const isAllClear = grid.every(row => row.every(cell => cell === 0));
        if(isAllClear) {
          addToScore(1000 * SCORE_MULTIPLIER); // 全消しボーナス
          updateScore();
        }
        // この時点で消去アニメは完了。判定前にフラグを解除しておく。
        clearingInProgress = false;

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
            showGameOverOverlay();
          }
        }
        // 仕上げの再描画（必要に応じて）
        drawGrid();
  }, 180);
    }, 180);
  } else {
    // リセット: 連続消去が途切れたらコンボを0に戻す
    comboCount = 0;
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
    addToScore(placed);
  updateScore();
  clearLines();
  drawGrid();
  // プレイヤーが実際に配置した回数をカウント
  // 配置したブロックのマス数合計を加算
  let placedCells = 0;
  for(let y=0;y<shape.length;y++) for(let x=0;x<shape[y].length;x++) if(shape[y][x]){
    const nx = px+x, ny = py+y;
    if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS) placedCells++;
  }
  blocksPlaced += placedCells;
}

function updateScore(){
  if(!scoreEl) return;
  // 桁区切りで表示（例: 1,234）
  scoreEl.textContent = `スコア: ${formatNumber(displayedScore)}`;
}

function formatNumber(n){
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// スロット風にスコアを増加させる
function addToScore(amount){
  if(typeof amount !== 'number' || amount <= 0) return;
  // ブロックの実スコアは即時反映（ゲームロジックが参照するため）
  blockScore += Math.floor(amount);
  // 目的地を更新
  const now = performance.now();
  // 既にアニメ中なら現在の表示値を起点にして延長
  if(scoreAnim.raf){
    // 現在の表示値を算出して上書き
    cancelAnimationFrame(scoreAnim.raf);
    scoreAnim.raf = null;
    // displayedScore はすでに最新のフレーム値
  }
  scoreAnim.from = displayedScore;
  scoreAnim.to = blockScore;
  // durationを増分に応じて調整（大きい増分は長めに見せるが最大2000ms）
  const delta = Math.abs(scoreAnim.to - scoreAnim.from);
  scoreAnim.duration = Math.min(1600, 300 + Math.sqrt(delta) * 45);
  scoreAnim.start = now;
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  // slotっぽいランダム挙動: 末尾の桁をランダムに揺らしながら収束
  function step(){
    const t = Math.min(1, (performance.now() - scoreAnim.start) / scoreAnim.duration);
    const e = easeOutCubic(t);
    const base = Math.floor(scoreAnim.from + (scoreAnim.to - scoreAnim.from) * e);
    // ジッター: アニメ終盤は小さく、序盤は大きめ
    const jitterMax = Math.max(0, Math.floor((1 - e) * 50));
    const jitter = jitterMax > 0 ? Math.floor((Math.random() - 0.5) * jitterMax) : 0;
    displayedScore = Math.max(0, base + jitter);
    updateScore();
    if(t < 1){
      scoreAnim.raf = requestAnimationFrame(step);
    } else {
      // 終了時は正確な最終値にセット
      displayedScore = scoreAnim.to;
      updateScore();
      scoreAnim.raf = null;
    }
  }
  scoreAnim.raf = requestAnimationFrame(step);
}

function drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY, blockSize = BLOCK_SIZE){
  const base = getColor(colorIdx);
  // プレビュー用: 必ず正方形で描画
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(shape[y][x]){
        // 正方形で描画
  const size = blockSize;
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
  // DEBUG: 現在の配置セル数とパレット状態をログ
  try{
    let debugCurrentCells = 0;
    for(let i=0;i<currentPalette.length;i++){
      const s = currentPalette[i].shape;
      for(let yy=0; yy<s.length; yy++) for(let xx=0; xx<s[yy].length; xx++) if(s[yy][xx]) debugCurrentCells++;
    }
    console.debug('[createPalette] blocksPlaced=', blocksPlaced, 'currentPalette.length=', currentPalette.length, 'currentPaletteCells=', debugCurrentCells, 'limit=', BLOCKS_PER_GAME_LIMIT);
  }catch(e){/* ignore */}
    // 新仕様: currentPalette が空のときに3個まとめて生成する
    if(currentPalette.length === 0){
      // 形カテゴリの定義: コンボを狙いやすいバーとフィラーを優先
      const isBarShape = (s)=>{
        const h = s.length, w = s[0].length;
        const cells = s.flat().reduce((a,b)=>a+b,0);
        // 1行または1列で連続ブロックのみ（2~5程度をバー扱い）
        const oneRow = h === 1 && cells === w && w >= 2;
        const oneCol = w === 1 && cells === h && h >= 2;
        return oneRow || oneCol;
      };
      const isFillerShape = (s)=>{
        const cells = s.flat().reduce((a,b)=>a+b,0);
        // 小型フィラー: 2~4マス程度
        return cells >= 2 && cells <= 4;
      };
      const pickShapeIdx = ()=>{
        // 重み: バー 35%, フィラー 35%, 標準 24%, レア 6%
        const r = Math.random();
        if(r < 0.35){
          // バーから選択
          const barIndices = SHAPES.map((sh,i)=>({sh,i})).filter(x=>isBarShape(x.sh)).map(x=>x.i);
          if(barIndices.length) return barIndices[Math.floor(Math.random()*barIndices.length)];
        } else if(r < 0.70){
          // フィラーから選択
          const fillerIndices = SHAPES.map((sh,i)=>({sh,i})).filter(x=>isFillerShape(x.sh)).map(x=>x.i);
          if(fillerIndices.length) return fillerIndices[Math.floor(Math.random()*fillerIndices.length)];
        } else if(r < 0.94){
          // 標準（その他）
          const others = SHAPES.map((sh,i)=>({sh,i})).filter(x=>!isBarShape(x.sh) && !isFillerShape(x.sh) && !RARE_SHAPE_INDICES.includes(x.i)).map(x=>x.i);
          if(others.length) return others[Math.floor(Math.random()*others.length)];
        }
        // レア（残り）
        if(RARE_SHAPE_INDICES.length){
          return RARE_SHAPE_INDICES[Math.floor(Math.random()*RARE_SHAPE_INDICES.length)];
        }
        // フォールバック
        return Math.floor(Math.random()*SHAPES.length);
      };

      let batch = [];
      let tries = 0;
      while(batch.length < 3 && tries < 300){
        let idx = pickShapeIdx();
        let shape = SHAPES[idx];
        // バーは回転で横縦をミックス、その他は適度に変化
        const rotations = Math.floor(Math.random()*4);
        for(let r=0;r<rotations;r++) shape = rotateShape(shape);
        if(Math.random() < 0.5) shape = flipShape(shape);
        const blockCount = shape.flat().reduce((a,b)=>a+b,0);
        // 盤面に収まる形のみに限定
        if(shape.length <= ROWS && shape[0].length <= COLS){
          batch.push({shape: shape, cellCount: blockCount});
        }
        tries++;
      }
      // バッチ制約: 少なくとも1つバー、1つフィラーを含むよう調整
      const hasBar = batch.some(it=>isBarShape(it.shape));
      const hasFiller = batch.some(it=>isFillerShape(it.shape));
      if(!hasBar || !hasFiller){
        // 足りないカテゴリを追加/置換
        const needBar = !hasBar;
        const needFiller = !hasFiller;
        const ensureCategory = (predicate)=>{
          const candidates = SHAPES.filter(predicate);
          if(!candidates.length) return null;
          let s = candidates[Math.floor(Math.random()*candidates.length)];
          // 軽く回転
          if(Math.random()<0.5) s = rotateShape(s);
          return {shape: s, cellCount: s.flat().reduce((a,b)=>a+b,0)};
        };
        if(needBar){
          const barItem = ensureCategory(isBarShape);
          if(barItem){
            if(batch.length < 3) batch.push(barItem);
            else batch[0] = barItem;
          }
        }
        if(needFiller){
          const fillerItem = ensureCategory(isFillerShape);
          if(fillerItem){
            if(batch.length < 3) batch.push(fillerItem);
            else batch[1 % batch.length] = fillerItem;
          }
        }
        // 3つに収める
        batch = batch.slice(0,3);
      }
      // batch の合計セル数を計算し、上限を越えない範囲で currentPalette に追加
      let batchCells = batch.reduce((s,it)=>s+it.cellCount,0);
      if(blocksPlaced + batchCells <= BLOCKS_PER_GAME_LIMIT){
        // 色を付けて currentPalette に追加
        batch.forEach(it=>{
          const colorChoice = nextColorIdx();
          currentPalette.push({shape: it.shape, colorIdx: colorChoice});
        });
      } else {
        // 上限超過の場合、可能な限り頭から詰める（例えば1つか2つだけ追加）
        let acc = 0;
        for(let i=0;i<batch.length;i++){
          if(blocksPlaced + acc + batch[i].cellCount <= BLOCKS_PER_GAME_LIMIT){
            const colorChoice = nextColorIdx();
            currentPalette.push({shape: batch[i].shape, colorIdx: colorChoice});
            acc += batch[i].cellCount;
          }
        }
        // それでも空なら単一セルを試す
        if(currentPalette.length === 0 && blocksPlaced + 2 <= BLOCKS_PER_GAME_LIMIT){
          currentPalette.push({shape: [[1,1]], colorIdx: nextColorIdx()});
        }
        // 上限により追加できなければ gameOver をセット
        if(currentPalette.length === 0 && blocksPlaced >= BLOCKS_PER_GAME_LIMIT){
          if(!gameOver){ gameOver = true; showGameOverOverlay(); }
        }
      }
  console.debug('[createPalette] batch (combo-lean) -> cells', currentPalette.map(p=>p.shape.flat().reduce((a,b)=>a+b,0)));
    }
  // パレット生成後に上限到達していれば、以降はパレットを生成しない
  // currentPalette のセル数合計を計算して判定する
  {
    let currentPaletteCells = 0;
    for(let i=0;i<currentPalette.length;i++){
      const s = currentPalette[i].shape;
      for(let yy=0; yy<s.length; yy++) for(let xx=0; xx<s[yy].length; xx++) if(s[yy][xx]) currentPaletteCells++;
    }
    if(blocksPlaced + currentPaletteCells >= BLOCKS_PER_GAME_LIMIT){
      // 既に配置済みセル数 + パレット内セル数合計が上限に達している場合、これ以上の生成は行わない。
      // currentPalette はそのまま残し、プレイヤーは配置を続けられる。
    }
  }
  currentPalette.forEach((item, i) => {
    const shape = item.shape;
    const colorIdx = item.colorIdx;
    // プレビューは必ず正方形のcanvas（最大サイズ基準）
    const blockW = shape[0].length;
    const blockH = shape.length;
  const paletteBlock = Math.max(20, Math.round(BLOCK_SIZE * PALETTE_SCALE));
  const canvasSize = Math.max(blockW, blockH) * paletteBlock;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = canvasSize;
    canvasEl.height = canvasSize;
    canvasEl.className = 'block-item';
    if(selectedBlockIdx === i) canvasEl.style.border = '2px solid #2196f3';
    const ctx2d = canvasEl.getContext('2d');
    // 中央に配置
  const offsetX = Math.floor((canvasSize - blockW*paletteBlock)/2);
  const offsetY = Math.floor((canvasSize - blockH*paletteBlock)/2);
  drawBlockPreview(shape, colorIdx, ctx2d, offsetX, offsetY, paletteBlock);
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
      // ライン消去アニメ中は一時的に置けないだけかもしれないので表示を抑止
      if(!gameOver && !clearingInProgress) {
        gameOver = true;
        showGameOverOverlay();
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
  // DEBUG: ログ配置後の状態
  try{ console.debug('[onmousedown] placed shape; blocksPlaced=', blocksPlaced, 'currentPalette.length=', currentPalette.length); }catch(e){}
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
  // ゲーム開始時に配置カウンタをリセット
  blocksPlaced = 0;
  drawGrid();
  createPalette();
}

if(canvas && ctx && paletteDiv){
  startBlockGame();
}

// --- GAME OVER オーバーレイ要素の挿入と表示制御 ---
// ページの body に配置することで、キャンバス外にはみ出しても確実に見える
const gameOverOverlayId = 'gameOverOverlay';
function ensureGameOverOverlay(){
  if(document.getElementById(gameOverOverlayId)) return;
  const ov = document.createElement('div');
  ov.id = gameOverOverlayId;
  ov.style.position = 'fixed';
  ov.style.left = '50%';
  ov.style.top = '50%';
  ov.style.transform = 'translate(-50%, -50%)';
  ov.style.pointerEvents = 'none';
  ov.style.zIndex = '9999';
  // はみ出しても見えるように大きなテキストと外側スペースを用意
  ov.style.padding = '20px 40px';
  ov.style.whiteSpace = 'nowrap';
  ov.style.textAlign = 'center';
  ov.style.display = 'none';
  // 影と縁取りはcanvas内と似せる
  // 文字のみ表示（枠線・背景なし）。大きめの文字と外側テキストシャドウで視認性を確保
  ov.innerHTML = `<div style="display:inline-block;padding:0 8px;font-family:'Press Start 2P','Arial Black',sans-serif;font-size:32px;color:#a08bff;text-shadow:0 6px 18px rgba(32,64,85,0.35), 0 0 40px rgba(160,139,255,0.25);">GAME OVER</div>`;
  document.body.appendChild(ov);
}

function showGameOverOverlay(){
  ensureGameOverOverlay();
  const ov = document.getElementById(gameOverOverlayId);
  if(!ov) return;
  // 状態と表示を同期
  gameOver = true;
  ov.style.display = 'block';
  // 画面サイズに対して文字を大きくして見切れを回避
  const inner = ov.firstElementChild;
  const baseSize = Math.max(28, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.08));
  inner.style.fontSize = baseSize + 'px';
  // pointerEvents を有効にしても良ければクリックでリスタート等を実装可能
}

function hideGameOverOverlay(){
  const ov = document.getElementById(gameOverOverlayId);
  if(ov) ov.style.display = 'none';
}

// ウィンドウリサイズ時にサイズを調整
window.addEventListener('resize', ()=>{
  const ov = document.getElementById(gameOverOverlayId);
  if(ov && ov.style.display === 'block') showGameOverOverlay();
});

