// 積み上げ型ブロックブラスト
const COLS = 8;
const ROWS = 8;
const BLOCK_SIZE = 60;
// 白基調の寒色系パレット（やや濃く、紫系を追加）
const COLORS = [
  // 先頭の淡色は視認性が低かったため、やや濃くしてコントラストを上げる
  '#cd9fe2ff','#94f3eeff','#b7e6f5','#83dff0','#5fcff0','#4b9fd8','#b9a8ff','#a08bff', // 寒色系（調整済）
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
  ,
  // 追加シェイプ: ここから種類を増やす
  [[1,1,1],[1,1,1]], // 横長2x3長方形（6ブロック）
  [[0,1,0],[1,1,1],[0,1,0]], // プラス型（5ブロック）
  [[1,0,1],[1,1,1]], // U字型（上に隙間）
  [[1,1],[1,0]], // 2x2 の一欠け（3ブロック）
  [[1,1,0],[0,1,1],[0,0,1]], // ねじれたスネーク系（複雑形）
  [[1,0,0],[1,1,1],[0,0,1]], // 中間の複合L
  [[1,1,1,1,1]], // 横長5
  [[1],[1,1,1],[1]] // 小さな十字に近い形（5ブロック）
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
// 表示用のスコア（アニメで表示される値）
let displayedScore = 0;
// スコアアニメーション用の状態
let scoreAnim = { raf: null, from: 0, to: 0, start: 0, duration: 600 };
let comboMultiplier = 1;
let gameOver = false;
// 1ゲームあたりに生成できるブロックのセル数合計の上限（配置済みセル数 + パレット内セル数合計で管理）
const BLOCKS_PER_GAME_LIMIT = 5000;
// スコア換算の倍率（1で現状のスコア）
// ユーザ要望によりデフォルトを 3 に設定（以前は 5）
const SCORE_MULTIPLIER = 3;
// プレイヤーが実際に配置したセル数の合計をカウント
let blocksPlaced = 0;
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
    addToScore((lines*50*comboMultiplier) * SCORE_MULTIPLIER);
  addToScore((lines*100*comboMultiplier) * SCORE_MULTIPLIER);
        comboMultiplier++;
        updateScore();
        drawGrid();
        // 全消し判定（盤面がすべて0）
        const isAllClear = grid.every(row => row.every(cell => cell === 0));
        if(isAllClear) {
          addToScore(1000 * SCORE_MULTIPLIER); // 全消しボーナス
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
            showGameOverOverlay();
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
  addToScore(placed * SCORE_MULTIPLIER);
  addToScore(placed * SCORE_MULTIPLIER);
  addToScore(placed * SCORE_MULTIPLIER); // 2倍加点
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
      let batch = [];
      let tries = 0;
      while(batch.length < 3 && tries < 300){
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
          batch.push({shape: shape, cellCount: blockCount});
        }
        tries++;
      }
      // batch の合計セル数を計算し、上限を越えない範囲で currentPalette に追加
      let batchCells = batch.reduce((s,it)=>s+it.cellCount,0);
      if(blocksPlaced + batchCells <= BLOCKS_PER_GAME_LIMIT){
        // 色を付けて currentPalette に追加
        batch.forEach(it=>{
          const colorChoice = Math.floor(Math.random()*COLORS.length);
          currentPalette.push({shape: it.shape, colorIdx: colorChoice});
        });
      } else {
        // 上限超過の場合、可能な限り頭から詰める（例えば1つか2つだけ追加）
        let acc = 0;
        for(let i=0;i<batch.length;i++){
          if(blocksPlaced + acc + batch[i].cellCount <= BLOCKS_PER_GAME_LIMIT){
            const colorChoice = Math.floor(Math.random()*COLORS.length);
            currentPalette.push({shape: batch[i].shape, colorIdx: colorChoice});
            acc += batch[i].cellCount;
          }
        }
        // それでも空なら単一セルを試す
        if(currentPalette.length === 0 && blocksPlaced + 1 <= BLOCKS_PER_GAME_LIMIT){
          currentPalette.push({shape: [[1]], colorIdx: 0});
        }
        // 上限により追加できなければ gameOver をセット
        if(currentPalette.length === 0 && blocksPlaced >= BLOCKS_PER_GAME_LIMIT){
          if(!gameOver){ gameOver = true; showGameOverOverlay(); }
        }
      }
      console.debug('[createPalette] batch fill -> added', currentPalette.map(p=>p.shape.flat().reduce((a,b)=>a+b,0)));
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

