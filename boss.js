// ==========================================
// Stage 5 専用：ボス戦制御クラス (boss.js)
// ==========================================

class BossManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 600;
        this.y = 180;
        this.w = 90;
        this.h = 90;
        this.hp = 10;
        this.maxHp = 10;
        this.vx = 2;
        this.attackTimer = 0;
        this.alive = true;
    }

    update(player, projectiles, onDamagePlayer, onBossDefeated) {
        if (!this.alive) return;

        // ボスの左右・浮遊移動
        this.x += this.vx;
        this.y += Math.sin(Date.now() / 300) * 1.5;
        if (this.x < 450 || this.x > 680) this.vx *= -1;

        // 一定間隔でレーザー弾を発射
        this.attackTimer++;
        if (this.attackTimer > 110) {
            this.attackTimer = 0;
            projectiles.push({
                x: this.x,
                y: this.y + 40,
                w: 16,
                h: 12,
                vx: -5,
                isEnemy: true
            });
        }

        // プレイヤーとの接触判定
        if (player.x < this.x + this.w && player.x + player.width > this.x &&
            player.y < this.y + this.h && player.y + player.height > this.y) {
            
            // 頭上からの踏みつけ攻撃成功！
            if (player.vy > 0 && player.y + player.height - player.vy <= this.y + 20) {
                this.takeDamage(1, onBossDefeated);
                player.vy = -9; // 跳ね返り
            } else {
                onDamagePlayer();
            }
        }
    }

    takeDamage(amount, onBossDefeated) {
        this.hp -= amount;
        this.updateUI();
        if (this.hp <= 0) {
            this.alive = false;
            if (onBossDefeated) onBossDefeated();
        }
    }

    updateUI() {
        const hpBar = document.getElementById('boss-hp');
        if (hpBar) {
            const pct = Math.max(0, (this.hp / this.maxHp) * 100);
            hpBar.style.width = pct + '%';
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        // ボス本体（メガ・バグコア）の描画
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 4;
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        // ボスの目（グリッドコア）
        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(this.x + 20, this.y + 30, 20, 20);
        ctx.fillRect(this.x + 50, this.y + 30, 20, 20);
    }
}

// グローバルインスタンスの作成
window.bossInstance = new BossManager();
