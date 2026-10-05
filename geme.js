// ==========================================
// ゲーム本編制御プログラム (game.js)
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.5;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;

let gameState = 'START'; // START, PLAYING, GAMEOVER, CLEAR
let currentStage = 1;
const maxStages = 5;
let score = 0;
let lives = 3;

let cameraX = 0;
let keys = {};
let projectiles = [];
let respawnPoint = { x: 50, y: 300 };

// プレイヤー情報
const player = {
    x: 50, y: 300, width: 32, height: 32,
    vx: 0, vy: 0, speed: 4.5, jumpPower: -11,
    grounded: false, powered: false, facing: 'right',
    invulnerable: 0,
    reset() {
        this.x = respawnPoint.x;
        this.y = respawnPoint.y;
        this.vx = 0;
        this.vy = 0;
        this.invulnerable = 60;
    }
};

let stageData = { platforms: [], blocks: [], items: [], enemies: [], goal: null };

// ステージ生成処理
function generateStage(stageNum) {
    const data = { platforms: [], blocks: [], items: [], enemies: [], goal: null };
    
    if (stageNum < 5) {
        // 通常ステージ（すべてジャンプで余裕で届く高さ・距離設計）
        data.platforms.push({ x: 0, y: 380, w: 600, h: 70 });
        data.platforms.push({ x: 700, y: 380, w: 700, h: 70 }); // 100pxの谷間
        data.platforms.push({ x: 1500, y: 380, w: 800, h: 70 });
        
        // 低めの足場
        data.platforms.push({ x: 300, y: 290, w: 120, h: 20 });
        data.platforms.push({ x: 800, y: 280, w: 150, h: 20 });
        data.platforms.push({ x: 1100, y: 270, w: 120, h: 20 });
        data.platforms.push({ x: 1700, y: 290, w: 150, h: 20 });

        // パワーブロック＆通常ブロック
        data.blocks.push({ x: 200, y: 260, w: 32, h: 32, type: 'power', hit: false });
        data.blocks.push({ x: 450, y: 260, w: 32, h: 32, type: 'normal' });
        data.blocks.push({ x: 900, y: 250, w: 32, h: 32, type: 'power', hit: false });

        // クリスタル（スコアアイテム）
        for(let i = 0; i < 8; i++) {
            data.items.push({ x: 250 + i * 200, y: 220, w: 16, h: 16, type: 'crystal', collected: false });
        }

        // 敵（バグドローン）
        data.enemies.push({ x: 500, y: 350, w: 30, h: 30, vx: -1.5, minX: 400, maxX: 580, alive: true });
        data.enemies.push({ x: 1000, y: 350, w: 30, h: 30, vx: -2, minX: 850, maxX: 1150, alive: true });

        // ポータル（ゴール）
        data.goal = { x: 2150, y: 300, w: 40, h: 80 };
    } else {
        // Stage 5 (ボスステージ)
        data.platforms.push({ x: 0, y: 380, w: 1000, h: 70 });
        data.blocks.push({ x: 150, y: 260, w: 32, h: 32, type: 'power', hit: false });
        data.blocks.push({ x: 800, y: 260, w: 32, h: 32, type: 'power', hit: false });
    }

    return data;
}

// キー操作
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if ((e.code === 'KeyF' || e.code === 'ShiftLeft') && player.powered && gameState === 'PLAYING') {
        shootProjectile();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

function shootProjectile() {
    projectiles.push({
        x: player.facing === 'right' ? player.x + player.width : player.x - 10,
        y: player.y + player.height / 2 - 4,
        w: 12, h: 8,
        vx: player.facing === 'right' ? 8 : -8
    });
}

function startGame() {
    score = 0;
    lives = 3;
    currentStage = 1;
    loadStage(currentStage);
    document.getElementById('overlay').style.display = 'none';
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

function loadStage(stageNum) {
    respawnPoint = { x: 50, y: 300 };
    player.reset();
    stageData = generateStage(stageNum);
    projectiles = [];
    document.getElementById('stage-disp').innerText = stageNum;
    updateUI();
    
    const bossUi = document.getElementById('boss-ui');
    if (stageNum === 5) {
        bossUi.style.display = 'block';
        if (window.bossInstance) {
            window.bossInstance.reset();
            window.bossInstance.updateUI();
        }
    } else {
        bossUi.style.display = 'none';
    }
}

// メインフレーム処理
function update() {
    if (gameState !== 'PLAYING') return;

    // 左右移動
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx = player.speed;
        player.facing = 'right';
    } else if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx = -player.speed;
        player.facing = 'left';
    } else {
        player.vx *= 0.8;
    }

    // ジャンプ
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }

    // 重力＆位置更新
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    if (player.invulnerable > 0) player.invulnerable--;
    if (player.x < 0) player.x = 0;

    // ★穴（谷底）に落下した時の判定：その場復活！
    if (player.y > CANVAS_HEIGHT + 50) {
        damagePlayer();
        return;
    }

    // 足場との判定
    player.grounded = false;
    stageData.platforms.forEach(p => {
        if (player.x < p.x + p.w && player.x + player.width > p.x &&
            player.y + player.height > p.y && player.y + player.height - player.vy <= p.y + 10) {
            player.y = p.y - player.height;
            player.vy = 0;
            player.grounded = true;
        }
    });

    // ブロック判定
    stageData.blocks.forEach(b => {
        if (player.x < b.x + b.w && player.x + player.width > b.x &&
            player.y < b.y + b.h && player.y + player.height > b.y) {
            if (player.vy < 0 && player.y >= b.y + b.h - 10) {
                player.vy = 0;
                player.y = b.y + b.h;
                if (b.type === 'power' && !b.hit) {
                    b.hit = true;
                    stageData.items.push({ x: b.x + 4, y: b.y - 25, w: 24, h: 24, type: 'core', collected: false });
                }
            } else if (player.vy > 0 && player.y + player.height - player.vy <= b.y + 10) {
                player.y = b.y - player.height;
                player.vy = 0;
                player.grounded = true;
            }
        }
    });

    // アイテム収集
    stageData.items.forEach(item => {
        if (!item.collected && player.x < item.x + item.w && player.x + player.width > item.x &&
            player.y < item.y + item.h && player.y + player.height > item.y) {
            item.collected = true;
            if (item.type === 'crystal') {
                score += 100;
            } else if (item.type === 'core') {
                player.powered = true;
                player.height = 44;
                score += 500;
            }
            updateUI();
        }
    });

    // 敵判定
    stageData.enemies.forEach(e => {
        if (!e.alive) return;
        e.x += e.vx;
        if (e.x < e.minX || e.x > e.maxX) e.vx *= -1;

        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            if (player.vy > 0 && player.y + player.height - player.vy <= e.y + 12) {
                e.alive = false;
                player.vy = -7;
                score += 200;
                updateUI();
            } else {
                damagePlayer();
            }
        }
    });

    // Stage 5：ボス更新処理（boss.js連携）
    if (currentStage === 5 && window.bossInstance) {
        window.bossInstance.update(
            player,
            projectiles,
            () => damagePlayer(),
            () => {
                score += 5000;
                stageData.goal = { x: 700, y: 300, w: 40, h: 80 }; // クリアポータル出現
            }
        );
    }

    // 弾の更新処理
    projectiles.forEach((p, idx) => {
        p.x += p.vx;
        if (p.isEnemy) {
            if (player.x < p.x + p.w && player.x + player.width > p.x &&
                player.y < p.y + p.h && player.y + player.height > p.y) {
                damagePlayer();
                projectiles.splice(idx, 1);
            }
        } else {
            if (currentStage === 5 && window.bossInstance && window.bossInstance.alive) {
                const b = window.bossInstance;
                if (p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y) {
                    b.takeDamage(1, () => {
                        score += 5000;
                        stageData.goal = { x: 700, y: 300, w: 40, h: 80 };
                    });
                    projectiles.splice(idx, 1);
                }
            }
        }
    });

    // ゴール到達判定
    if (stageData.goal) {
        const g = stageData.goal;
        if (player.x < g.x + g.w && player.x + player.width > g.x &&
            player.y < g.y + g.h && player.y + player.height > g.y) {
            if (currentStage < maxStages) {
                currentStage++;
                loadStage(currentStage);
            } else {
                gameWin();
            }
        }
    }

    cameraX = Math.max(0, player.x - 200);
}

// 被弾・落下ダメージ処理
function damagePlayer() {
    if (player.invulnerable > 0) return;

    if (player.powered) {
        player.powered = false;
        player.height = 32;
        player.invulnerable = 60;
    } else {
        lives--;
        updateUI();
        if (lives <= 0) {
            gameOver();
        } else {
            player.reset(); // 直前の復活ポイントからリスポーン！
        }
    }
}

function updateUI() {
    document.getElementById('score-disp').innerText = String(score).padStart(5, '0');
    document.getElementById('life-disp').innerText = '♥'.repeat(Math.max(0, lives));
}

function gameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('overlay-title').innerText = 'GAME OVER';
    document.getElementById('overlay-title').style.color = '#ff0055';
    document.getElementById('overlay-msg').innerText = `最終スコア: ${score}`;
    document.getElementById('overlay').style.display = 'flex';
}

function gameWin() {
    gameState = 'CLEAR';
    document.getElementById('overlay-title').innerText = 'MISSION COMPLETE!';
    document.getElementById('overlay-title').style.color = '#00f3ff';
    document.getElementById('overlay-msg').innerText = `全5ステージクリア！おめでとうございます！\n最終スコア: ${score}`;
    document.getElementById('overlay').style.display = 'flex';
}

// 描画処理
function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // 地面・足場
    stageData.platforms.forEach(p => {
        ctx.fillStyle = '#121225';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    // ブロック
    stageData.blocks.forEach(b => {
        ctx.fillStyle = b.hit ? '#333' : '#ff00ff';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(b.x, b.y, b.w, b.h);
    });

    // アイテム
    stageData.items.forEach(item => {
        if (item.collected) return;
        if (item.type === 'crystal') {
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.arc(item.x + 8, item.y + 8, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (item.type === 'core') {
            ctx.fillStyle = '#00f3ff';
            ctx.fillRect(item.x, item.y, item.w, item.h);
        }
    });

    // 敵
    stageData.enemies.forEach(e => {
        if (!e.alive) return;
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(e.x, e.y, e.w, e.h);
    });

    // ボス描画 (Stage 5)
    if (currentStage === 5 && window.bossInstance) {
        window.bossInstance.draw(ctx);
    }

    // 弾
    projectiles.forEach(p => {
        ctx.fillStyle = p.isEnemy ? '#ff0000' : '#00f3ff';
        ctx.fillRect(p.x, p.y, p.w, p.h);
    });

    // ゴール
    if (stageData.goal) {
        const g = stageData.goal;
        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(g.x, g.y, g.w, g.h);
    }

    // プレイヤー（サイバーネコ）
    if (player.invulnerable % 4 < 2) {
        ctx.fillStyle = player.powered ? '#ff00ff' : '#00f3ff';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        // ネコ耳
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + 8, player.y - 8);
        ctx.lineTo(player.x + 12, player.y);
        ctx.fill();
    }

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING') {
        requestAnimationFrame(gameLoop);
    }
}
