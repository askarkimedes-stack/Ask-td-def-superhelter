

```javascript
/* Version: #9 */

// === KONFIGURASJON & GLOBALE VARIABLER ===
let canvas, ctx; // Deklareres her, tildeles verdi når siden er lastet

// Spillinnstillinger
let config = {
    laser: { dmg: 2, range: 130, speed: 30, cost: 50, color: '#ff0055' },
    boom: { dmg: 4, range: 120, speed: 30, cost: 100, color: '#aa00ff' },
    cannon: { dmg: 10, range: 150, speed: 200, cost: 400, color: '#00ffaa' },
    bank: { dmg: 0, range: 120, speed: 180, cost: 200, color: '#f1c40f' },
    enemy: { hpBase: 5, hpScale: 3, speed: 1.0 }, 
    waves: { startCount: 4, growth: 1 }
};

// Evolusjons-data
const evoData = {
    boom: [
        { id: 'extra', name: 'Multi-Kast', icon: '双', desc: 'Kaster 2 bomeranger i V-form' },
        { id: 'bomb', name: 'Eksplosiv', icon: '💣', desc: 'Lager eksplosjon ved treff' },
        { id: 'necro', name: 'Nekromancer', icon: '💀', desc: 'Resurrect fiender som spøkelser' }
    ],
    laser: [
        { id: 'twin', name: 'Twin Beam', icon: '⚡', desc: 'Treffer 2 fiender samtidig' },
        { id: 'hyper', name: 'Hyper Beam', icon: '🚀', desc: 'Skyter 3x raskere' }
    ],
    cannon: [
        { id: 'cluster', name: 'Cluster Bomb', icon: '✨', desc: 'Slipper 3 mini-bomber' },
        { id: 'bertha', name: 'Big Bertha', icon: '☢️', desc: 'Enorm skade og radius' }
    ],
    bank: [
        { id: 'interest', name: 'Høyrente', icon: '📈', desc: 'Genererer penger 2x raskere' },
        { id: 'tax', name: 'Skatteinnkrever', icon: '🧛', desc: 'Stjeler gull når fiender dør nær banken' }
    ]
};

// Tilstand
let gold = 500;
let lives = 10;
let currentWave = 1;
let isGameRunning = false;
let frame = 0;
let currentTool = 'laser';
let selectedHero = null;
let gameSpeed = 1;

// Entitetslister
let heroes = [];
let enemies = [];
let projectiles = [];
let summons = [];
let particles = [];
let floatingTexts = [];

// Bølgestyring
let waveActive = true;
let spawnedInWave = 0;
let enemiesInWave = 4;
let waveTimer = 0;

// Kart / Veipunkter
const waypoints = [
    {x:0, y:100}, 
    {x:700, y:100}, 
    {x:700, y:300}, 
    {x:100, y:300}, 
    {x:100, y:500}, 
    {x:850, y:500}
];

// === INITIALISERING (SIKKERHETSMECANISME) ===
// Dette sikrer at scriptet ikke krasjer hvis det lastes før HTML-en
function initGameSystem() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("KRITISK FEIL: Fant ikke <canvas id='gameCanvas'>. Sjekk HTML.");
        return;
    }
    ctx = canvas.getContext('2d');
    console.log("Spillmotor initialisert. Klar til start.");
    
    // Gjør startGame globalt tilgjengelig for HTML-knappen
    window.startGame = startGame;
}

// Vent på at DOM er klar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameSystem);
} else {
    initGameSystem();
}

// === HOVEDFUNKSJONER ===

function startGame() {
    console.log("Start-knapp trykket!");
    
    const startScreen = document.getElementById('start-screen');
    const gameUI = document.getElementById('game-ui');
    
    if(!startScreen || !gameUI) {
        console.error("Fant ikke UI-elementer!");
        return;
    }

    startScreen.style.display = 'none';
    gameUI.style.display = 'flex';
    isGameRunning = true;
    updateUI();
    gameLoop();
}

function updateDevStats() {
    config.laser.dmg = parseFloat(document.getElementById('dL').value);
    config.boom.dmg = parseFloat(document.getElementById('dB').value);
    config.cannon.dmg = parseFloat(document.getElementById('dC').value);
    let newStartCount = parseInt(document.getElementById('wCount').value);
    if (currentWave === 1) enemiesInWave = newStartCount;
    console.log("Stats oppdatert.");
}

function toggleSpeed() {
    gameSpeed = (gameSpeed === 1) ? 2 : 1;
    const btn = document.getElementById('speedBtn');
    if (gameSpeed === 2) {
        btn.innerHTML = "⏩⏩ 2x SPEED";
        btn.classList.add('active');
        btn.style.background = "#ef4444";
    } else {
        btn.innerHTML = "⏩ 1x SPEED";
        btn.classList.remove('active');
        btn.style.background = "#3b82f6";
    }
}

// === PARTIKKEL & TEKST SYSTEM ===
class Particle {
    constructor(x, y, color, speed, life) {
        this.x = x; this.y = y; this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * speed;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.life = life; this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life--; this.size *= 0.95;
    }
    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = 40; this.vy = -1;
    }
    update() {
        this.y += this.vy; this.life--;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life / 40);
        ctx.fillStyle = this.color;
        ctx.font = "bold 14px Arial";
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

function spawnParticles(x, y, color, count = 5) {
    if(!ctx) return;
    for(let i=0; i<count; i++) particles.push(new Particle(x, y, color, 2, 30));
}

function showFloatText(x, y, text, color = "#f1c40f") {
    floatingTexts.push(new FloatingText(x, y, text, color));
}

// === KLASSER ===

class Hero {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; 
        this.lvl = 1; 
        this.cd = config[type].speed;
        this.maxCd = config[type].speed;
        this.range = config[type].range; 
        this.dmg = config[type].dmg;
        this.isEvolved = null; 
        this.boomCount = 0; 
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = config[this.type].color;
        
        // Base
        ctx.fillStyle = "#1e293b";
        ctx.beginPath(); ctx.arc(this.x, this.y, 20, 0, Math.PI*2); ctx.fill();
        
        // Indre design
        ctx.fillStyle = config[this.type].color;
        if (this.type === 'laser') {
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 10); ctx.lineTo(this.x + 8, this.y + 8); ctx.lineTo(this.x - 8, this.y + 8); ctx.fill();
            if(this.isEvolved === 'twin') { ctx.fillStyle = "white"; ctx.fillRect(this.x-12, this.y-5, 4, 10); ctx.fillRect(this.x+8, this.y-5, 4, 10); }
        } else if (this.type === 'boom') {
            ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI*2); ctx.fill();
            let angle = frame * 0.1;
            for(let i=0; i<3; i++) {
                let bx = this.x + Math.cos(angle + i*2) * 12;
                let by = this.y + Math.sin(angle + i*2) * 12;
                ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
            }
        } else if (this.type === 'cannon') {
            ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
            if(this.isEvolved === 'cluster') { ctx.fillStyle = "orange"; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill(); }
        } else if (this.type === 'bank') {
            ctx.font = "20px Arial"; ctx.fillStyle = "#1e293b"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
            ctx.beginPath(); ctx.arc(this.x, this.y, 15, 0, Math.PI*2); ctx.fillStyle = "#f1c40f"; ctx.fill();
            ctx.fillStyle = "black"; ctx.fillText("$", this.x, this.y + 1);
            
            // Progress ring
            ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath();
            ctx.arc(this.x, this.y, 18, -Math.PI/2, (-Math.PI/2) + (2*Math.PI * (1 - this.cd/this.maxCd)));
            ctx.stroke();
        }

        ctx.strokeStyle = "white"; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        if (this.lvl > 1) { ctx.beginPath(); ctx.arc(this.x, this.y, 22, 0, Math.PI*2); ctx.stroke(); }
        if (this.lvl > 2) { ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI*2); ctx.stroke(); }

        if(selectedHero === this) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
    }

    update() {
        if (this.type === 'bank') {
            if (this.cd > 0) this.cd--;
            else {
                let income = 15 + (this.lvl * 5);
                gold += income;
                showFloatText(this.x, this.y - 20, `+${income}g`);
                spawnParticles(this.x, this.y, '#f1c40f', 5);
                updateUI();
                let speedMod = (this.isEvolved === 'interest') ? 0.5 : 1.0;
                this.cd = this.maxCd * speedMod;
            }
            return;
        }

        if(this.cd > 0) this.cd--;
        if(this.cd <= 0) {
            let enemiesInRange = enemies.filter(e => Math.hypot(e.x - this.x, e.y - this.y) < this.range);
            
            if(enemiesInRange.length > 0) {
                enemiesInRange.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));

                if(this.type === 'boom') {
                    if(this.boomCount === 0) {
                        let target = enemiesInRange[0];
                        if(this.isEvolved === 'extra') {
                            this.launchBoomerang(target, -0.4); 
                            this.launchBoomerang(target, 0.4); 
                        } else {
                            this.launchBoomerang(target, 0); 
                        }
                        this.cd = 999; 
                    }
                } else {
                    if (this.type === 'laser' && this.isEvolved === 'twin') {
                        for(let i=0; i<Math.min(2, enemiesInRange.length); i++) {
                            projectiles.push(new Projectile(this.x, this.y, enemiesInRange[i], this));
                        }
                    } else {
                        projectiles.push(new Projectile(this.x, this.y, enemiesInRange[0], this));
                    }
                    
                    let cdTime = config[this.type].speed;
                    if(this.type === 'laser' && this.isEvolved === 'hyper') cdTime = cdTime / 3; 
                    if(this.type === 'cannon' && this.isEvolved === 'bertha') cdTime = cdTime * 1.5; 

                    this.cd = cdTime;
                }
            }
        }
    }

    launchBoomerang(target, angleOffset = 0) {
        this.boomCount++;
        projectiles.push(new Projectile(this.x, this.y, target, this, angleOffset));
    }
}

class Projectile {
    constructor(x, y, target, parent, angleOffset = 0) {
        this.x = x; this.y = y; this.parent = parent; this.target = target;
        this.type = parent.type; this.active = true;
        let dx = target.x - x; let dy = target.y - y;
        this.angle = Math.atan2(dy, dx) + angleOffset;
        this.t = 0; this.hits = []; 
    }

    update() {
        if(this.type === 'boom') {
            this.t += 0.05;
            let reach = this.parent.range;
            this.x = this.parent.x + Math.cos(this.angle) * Math.sin(this.t) * reach;
            this.y = this.parent.y + Math.sin(this.angle) * Math.sin(this.t) * reach;
            
            if (frame % 3 === 0) spawnParticles(this.x, this.y, this.parent.isEvolved ? '#ffd700' : '#aa00ff', 1);

            enemies.forEach(e => {
                if(Math.hypot(e.x - this.x, e.y - this.y) < 20 && !this.hits.includes(e)) {
                    this.hitEnemy(e);
                    this.hits.push(e); 
                }
            });
            if(this.t >= Math.PI) { this.active = false; this.parent.boomCount--; this.parent.cd = 20; }
        } else {
            if(!this.target || this.target.hp <= 0) { this.active = false; return; }
            let d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            let speed = (this.type === 'cannon') ? 4 : 10;
            if(d < 10) {
                if(this.type === 'cannon') {
                    let radius = 80; let splashDmg = this.parent.dmg;
                    if(this.parent.isEvolved === 'bertha') { radius = 140; splashDmg *= 1.5; spawnParticles(this.x, this.y, '#ff4400', 30); }
                    else if(this.parent.isEvolved === 'cluster') { for(let i=0; i<3; i++) summons.push(new ClusterBomb(this.x, this.y)); }

                    spawnParticles(this.x, this.y, '#00ffaa', 10);
                    enemies.forEach(e => { if(Math.hypot(e.x - this.x, e.y - this.y) < radius) e.hp -= splashDmg; });
                } else {
                    this.target.hp -= this.parent.dmg;
                    spawnParticles(this.x, this.y, '#ff0055', 3);
                }
                this.active = false;
            } else { this.x += (this.target.x - this.x) / d * speed; this.y += (this.target.y - this.y) / d * speed; }
        }
    }

    hitEnemy(e) {
        e.hp -= this.parent.dmg;
        spawnParticles(e.x, e.y, '#ffffff', 2);
        if (this.parent.isEvolved === 'bomb') {
            summons.push(new Explosion(this.x, this.y));
            enemies.forEach(e2 => { if(Math.hypot(e2.x - this.x, e2.y - this.y) < 50) e2.hp -= 3; });
        }
        if (this.parent.isEvolved === 'necro' && e.hp <= 0) { summons.push(new Ghost(e.maxHp)); }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = config[this.type].color;
        if(this.type === 'cannon' && this.parent.isEvolved === 'bertha') ctx.fillStyle = '#ff4400';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); 
        let size = (this.type === 'cannon' ? 6 : 4);
        if(this.parent.isEvolved === 'bertha') size = 10;
        ctx.arc(this.x, this.y, size, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
}

class ClusterBomb {
    constructor(x, y) {
        this.x = x; this.y = y; this.angle = Math.random() * Math.PI * 2;
        this.dist = 0; this.maxDist = 40 + Math.random() * 20; this.active = true;
    }
    update() {
        if(this.dist < this.maxDist) {
            this.x += Math.cos(this.angle) * 3; this.y += Math.sin(this.angle) * 3; this.dist += 3;
        } else {
            summons.push(new Explosion(this.x, this.y));
            enemies.forEach(e => { if(Math.hypot(e.x - this.x, e.y - this.y) < 40) e.hp -= 5; });
            this.active = false;
        }
    }
    draw() { ctx.fillStyle = "yellow"; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill(); }
}

class Ghost {
    constructor(hpStrength) {
        let startNodeIndex = waypoints.length - 1; let startNode = waypoints[startNodeIndex];
        this.x = startNode.x; this.y = startNode.y;
        this.wpIndex = startNodeIndex; this.targetWpIndex = startNodeIndex - 1;
        this.speed = 1.5; this.hp = hpStrength * 0.5; this.active = true; this.color = "cyan";
    }
    update() {
        if (this.targetWpIndex < 0) { this.active = false; return; }
        let target = waypoints[this.targetWpIndex];
        let d = Math.hypot(target.x - this.x, target.y - this.y);
        if (d < 5) { this.wpIndex--; this.targetWpIndex--; } 
        else { this.x += (target.x - this.x) / d * this.speed; this.y += (target.y - this.y) / d * this.speed; }
        enemies.forEach(e => {
            if (Math.hypot(e.x - this.x, e.y - this.y) < 25) { e.hp -= 0.5; spawnParticles(e.x, e.y, "cyan", 1); this.hp -= 0.1; }
        });
        if (this.hp <= 0) this.active = false;
        if(frame % 5 === 0) spawnParticles(this.x, this.y, "rgba(0, 255, 255, 0.5)", 1);
    }
    draw() {
        ctx.save(); ctx.globalAlpha = 0.7; ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "black"; ctx.beginPath(); ctx.arc(this.x-4, this.y-2, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+4, this.y-2, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Explosion {
    constructor(x, y) { this.x = x; this.y = y; this.life = 15; this.active = true; spawnParticles(x, y, '#ffaa00', 10); }
    update() { this.life--; if(this.life <= 0) this.active = false; }
    draw() { 
        ctx.save(); ctx.fillStyle = `rgba(255, 165, 0, ${this.life/15})`;
        ctx.shadowBlur = 20; ctx.shadowColor = "orange";
        ctx.beginPath(); ctx.arc(this.x, this.y, 30, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
}

class Enemy {
    constructor() {
        this.wp = 0; this.x = waypoints[0].x; this.y = waypoints[0].y;
        this.hp = config.enemy.hpBase + (currentWave * config.enemy.hpScale);
        this.maxHp = this.hp; this.speed = config.enemy.speed;
    }
    update() {
        let t = waypoints[this.wp + 1];
        let d = Math.hypot(t.x - this.x, t.y - this.y);
        if(d < 5) this.wp++; else { this.x += (t.x - this.x) / d * this.speed; this.y += (t.y - this.y) / d * this.speed; }
        if(this.wp >= waypoints.length - 1) { lives--; enemies.splice(enemies.indexOf(this), 1); updateUI(); }
    }
    draw() {
        ctx.save(); ctx.shadowBlur = 5; ctx.shadowColor = "#ef4444"; ctx.fillStyle = "#ef4444"; 
        ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = "black"; ctx.fillRect(this.x - 10, this.y - 20, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(this.x - 10, this.y - 20, 20 * (Math.max(0, this.hp) / this.maxHp), 4);
        ctx.restore();
    }
}

// === TEGNING ===

function drawGrid() {
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.beginPath();
    for(let x=0; x<=canvas.width; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for(let y=0; y<=canvas.height; y+=40) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
}

function drawPath() {
    ctx.shadowBlur = 10; ctx.shadowColor = "#38bdf8"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 44; 
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(waypoints[0].x, waypoints[0].y); waypoints.forEach(w => ctx.lineTo(w.x, w.y)); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 38; 
    ctx.beginPath(); ctx.moveTo(waypoints[0].x, waypoints[0].y); waypoints.forEach(w => ctx.lineTo(w.x, w.y)); ctx.stroke();
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2; ctx.setLineDash([10, 15]);
    ctx.beginPath(); ctx.moveTo(waypoints[0].x, waypoints[0].y); waypoints.forEach(w => ctx.lineTo(w.x, w.y)); ctx.stroke(); ctx.setLineDash([]);
}

// === SPILL-LØKKE ===

function updateGameLogic() {
    if(waveActive) {
        if(frame % 60 === 0 && spawnedInWave < enemiesInWave) { enemies.push(new Enemy()); spawnedInWave++; }
        if(spawnedInWave >= enemiesInWave && enemies.length === 0) { 
            waveActive = false; waveTimer = 180; gold += 100 + (currentWave * 10); updateUI();
        }
    } else { 
        if(waveTimer-- <= 0) { 
            currentWave++; spawnedInWave = 0; waveActive = true; enemiesInWave = Math.floor(enemiesInWave * 1.3); updateUI();
        } 
    }

    heroes.forEach(h => h.update());
    enemies.forEach((e, i) => { 
        e.update(); 
        if(e.hp <= 0) { 
            enemies.splice(i, 1); 
            gold += 15; 
            heroes.forEach(h => {
                if(h.type === 'bank' && h.isEvolved === 'tax' && Math.hypot(h.x - e.x, h.y - e.y) < h.range) {
                    gold += 5; showFloatText(h.x, h.y - 30, "+5g", "#00ff00");
                }
            });
            updateUI(); 
        } 
    });
    summons.forEach((s, i) => { s.update(); if(!s.active) summons.splice(i, 1); });
    projectiles.forEach((p, i) => { p.update(); if(!p.active) projectiles.splice(i, 1); });
    particles.forEach((p, i) => { p.update(); if(p.life <= 0) particles.splice(i, 1); });
    floatingTexts.forEach((t, i) => { t.update(); if(t.life <= 0) floatingTexts.splice(i, 1); });
    frame++;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(); drawPath();
    summons.forEach(s => s.draw());
    heroes.forEach(h => h.draw());
    enemies.forEach(e => e.draw());
    projectiles.forEach(p => p.draw());
    particles.forEach(p => p.draw());
    floatingTexts.forEach(t => t.draw());
}

function gameLoop() {
    if(!isGameRunning) return;
    for(let i=0; i<gameSpeed; i++) updateGameLogic();
    drawGame();
    if(lives > 0) requestAnimationFrame(gameLoop); else { alert("GAME OVER!"); location.reload(); }
}

// === UI & INTERAKSJON ===

function setTool(t) { 
    currentTool = t; 
    document.querySelectorAll('.buy-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(t + 'Btn').classList.add('active');
}

// Vi legger til event listener på canvas KUN når det er klart
document.addEventListener('DOMContentLoaded', () => {
    const cvs = document.getElementById('gameCanvas');
    if(cvs) {
        cvs.addEventListener('mousedown', (e) => {
            let r = cvs.getBoundingClientRect(); let x = e.clientX - r.left; let y = e.clientY - r.top;
            let found = heroes.find(h => Math.hypot(h.x - x, h.y - y) < 20);
            if(found) { selectHero(found); return; }
            deselectHero();
            if(gold >= config[currentTool].cost) {
                heroes.push(new Hero(x, y, currentTool));
                gold -= config[currentTool].cost;
                updateUI(); spawnParticles(x, y, '#ffffff', 10);
            }
        });
    }
});

function selectHero(h) {
    selectedHero = h;
    document.getElementById('upgradeMenu').style.display = 'block';
    document.getElementById('heroTitle').innerText = h.type.toUpperCase();
    let cost = 100 * Math.pow(2, h.lvl - 1);
    document.getElementById('heroStats').innerHTML = `Lvl: ${h.lvl} | Dmg: ${h.dmg.toFixed(0)}`;
    document.getElementById('upBtn').innerText = `OPPGRADER (${cost}g)`;
}

function deselectHero() { selectedHero = null; document.getElementById('upgradeMenu').style.display = 'none'; }

function applyUpgrade() {
    if(!selectedHero) return;
    let cost = 100 * Math.pow(2, selectedHero.lvl - 1);
    if (gold < cost) return;
    gold -= cost;
    selectedHero.lvl++;
    selectedHero.dmg *= 1.5;
    selectedHero.range += 10;
    spawnParticles(selectedHero.x, selectedHero.y, '#00ff00', 15);
    if(selectedHero.lvl === 3 && !selectedHero.isEvolved) openEvoModal();
    updateUI(); selectHero(selectedHero); 
}

function openEvoModal() {
    if(!selectedHero) return;
    const optionsContainer = document.querySelector('.evo-options');
    optionsContainer.innerHTML = ''; 
    const options = evoData[selectedHero.type] || [];
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'evo-btn';
        btn.innerHTML = `<span class="icon">${opt.icon}</span><span class="label">${opt.name}</span><span class="desc">(${opt.desc})</span>`;
        btn.onclick = () => evolve(opt.id);
        optionsContainer.appendChild(btn);
    });
    document.getElementById('evo-modal').style.display = 'flex';
}

function evolve(type) {
    if(selectedHero) {
        selectedHero.isEvolved = type;
        spawnParticles(selectedHero.x, selectedHero.y, '#f1c40f', 30);
    }
    document.getElementById('evo-modal').style.display = 'none';
    deselectHero();
}

function updateUI() {
    document.getElementById('goldText').innerText = Math.floor(gold);
    document.getElementById('livesText').innerText = lives;
    document.getElementById('waveText').innerText = currentWave;
}
