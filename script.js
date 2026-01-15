

/* Version: #3 */

// === KONFIGURASJON & GLOBALE VARIABLER ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Spillinnstillinger
let config = {
    laser: { dmg: 2, range: 130, speed: 30, cost: 50, color: '#ff0055' },
    boom: { dmg: 4, range: 120, speed: 30, cost: 100, color: '#aa00ff' },
    cannon: { dmg: 15, range: 150, speed: 200, cost: 400, color: '#00ffaa' },
    enemy: { hpBase: 5, hpScale: 3, speed: 1.0 }, // Litt saktere for bedre balanse
    waves: { startCount: 4, growth: 1 }
};

// Tilstand
let gold = 500;
let lives = 10;
let currentWave = 1;
let isGameRunning = false;
let frame = 0;
let currentTool = 'laser'; // Hvilket tårn er valgt i menyen
let selectedHero = null;   // Hvilket tårn er valgt på kartet

// Entitetslister
let heroes = [];
let enemies = [];
let projectiles = [];
let summons = []; // Spøkelser, eksplosjoner etc.
let particles = []; // Nytt partikkelsystem

// Bølgestyring
let waveActive = true;
let spawnedInWave = 0;
let enemiesInWave = 4;
let waveTimer = 0;

// Kart / Veipunkter (Samme som før, men optimalisert tegning)
const waypoints = [
    {x:0, y:100}, 
    {x:700, y:100}, 
    {x:700, y:300}, 
    {x:100, y:300}, 
    {x:100, y:500}, 
    {x:850, y:500}
];

console.log("Script lastet. Klar til å starte.");

// === HOVEDFUNKSJONER ===

function startGame() {
    console.log("Starter spillet...");
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'flex';
    isGameRunning = true;
    updateUI();
    gameLoop();
}

function updateDevStats() {
    console.log("Oppdaterer dev-stats...");
    config.laser.dmg = parseFloat(document.getElementById('dL').value);
    config.boom.dmg = parseFloat(document.getElementById('dB').value);
    config.cannon.dmg = parseFloat(document.getElementById('dC').value);
    
    // Oppdaterer waves config hvis spillet ikke har kommet for langt
    let newStartCount = parseInt(document.getElementById('wCount').value);
    if (currentWave === 1) {
        enemiesInWave = newStartCount;
    }
    console.log("Stats oppdatert:", config);
}

// === PARTIKKEL SYSTEM (GRAFIKK) ===
class Particle {
    constructor(x, y, color, speed, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * speed;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.95; // Krymp
    }

    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function spawnParticles(x, y, color, count = 5) {
    for(let i=0; i<count; i++) {
        particles.push(new Particle(x, y, color, 2, 30));
    }
}

// === KLASSER ===

class Hero {
    constructor(x, y, type) {
        this.x = x; 
        this.y = y; 
        this.type = type; 
        this.lvl = 1; 
        this.cd = 0;
        this.range = config[type].range; 
        this.dmg = config[type].dmg;
        this.isEvolved = null; 
        this.boomCount = 0; 
        console.log(`Ny helt bygget: ${type} på (${x}, ${y})`);
    }

    draw() {
        ctx.save();
        // Neon Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = config[this.type].color;
        
        // Base
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI*2);
        ctx.fill();
        
        // Indre design basert på type
        ctx.fillStyle = config[this.type].color;
        
        if (this.type === 'laser') {
            // Trekant
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - 10);
            ctx.lineTo(this.x + 8, this.y + 8);
            ctx.lineTo(this.x - 8, this.y + 8);
            ctx.fill();
        } else if (this.type === 'boom') {
            // Sirkel med "spinner"
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
            ctx.fill();
            // Tegn små "blader" som roterer
            let angle = frame * 0.1;
            for(let i=0; i<3; i++) {
                let bx = this.x + Math.cos(angle + i*2) * 12;
                let by = this.y + Math.sin(angle + i*2) * 12;
                ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
            }
        } else if (this.type === 'cannon') {
            // Firkant
            ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
        }

        // Level indikator (Ringer rundt)
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0; // Ingen glow på tekst/ringer for lesbarhet
        if (this.lvl > 1) {
            ctx.beginPath(); ctx.arc(this.x, this.y, 22, 0, Math.PI*2); ctx.stroke();
        }
        if (this.lvl > 2) {
            ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI*2); ctx.stroke();
        }

        // Valgt-markering
        if(selectedHero === this) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    update() {
        if(this.cd > 0) this.cd--;
        if(this.cd <= 0) {
            // Finn fiende innen rekkevidde
            let target = enemies.find(e => Math.hypot(e.x - this.x, e.y - this.y) < this.range);
            
            if(target) {
                if(this.type === 'boom') {
                    if(this.boomCount === 0) { // Kan bare kaste hvis den har en boomerang klar
                        this.launchBoomerang(target);
                        if(this.isEvolved === 'extra') {
                            // Multi-kast: Kast en til med litt forsinkelse/vinkel
                            setTimeout(() => this.launchBoomerang(target, 0.8), 100); 
                        }
                        this.cd = 999; // Låst til retur
                    }
                } else {
                    // Laser og Kanon
                    projectiles.push(new Projectile(this.x, this.y, target, this));
                    this.cd = config[this.type].speed;
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
        this.x = x; 
        this.y = y; 
        this.parent = parent; 
        this.target = target;
        this.type = parent.type; 
        this.active = true;
        
        // Beregn vinkel
        this.angle = Math.atan2(target.y - y, target.x - x) + angleOffset;
        this.t = 0; // Tid for boomerang bane
        this.hits = []; // Fiender truffet av denne boomerangen
    }

    update() {
        if(this.type === 'boom') {
            // Boomerang logikk: Oval bane ut og tilbake
            this.t += 0.05;
            let reach = this.parent.range;
            this.x = this.parent.x + Math.cos(this.angle) * Math.sin(this.t) * reach;
            this.y = this.parent.y + Math.sin(this.angle) * Math.sin(this.t) * reach;
            
            // Lag spor
            if (frame % 3 === 0) spawnParticles(this.x, this.y, this.parent.isEvolved ? '#ffd700' : '#aa00ff', 1);

            // Sjekk kollisjon
            enemies.forEach(e => {
                if(Math.hypot(e.x - this.x, e.y - this.y) < 20 && !this.hits.includes(e)) {
                    this.hitEnemy(e);
                    this.hits.push(e); // Unngå å treffe samme fiende flere ganger per kast (med mindre cooldown resettes)
                }
            });

            if(this.t >= Math.PI) { // Boomerang retur
                this.active = false;
                this.parent.boomCount--;
                this.parent.cd = 20; // Kort pause før neste kast
            }

        } else {
            // Laser / Kanon logikk (homing missile style)
            if(!this.target || this.target.hp <= 0) { 
                this.active = false; 
                return; 
            }
            
            let d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            let speed = (this.type === 'cannon') ? 4 : 10; // Kanon er tregere men sterkere

            if(d < 10) {
                // Treff!
                if(this.type === 'cannon') {
                    // Area of Effect
                    spawnParticles(this.x, this.y, '#00ffaa', 10);
                    enemies.forEach(e => { 
                        if(Math.hypot(e.x - this.x, e.y - this.y) < 80) {
                            e.hp -= this.parent.dmg;
                        }
                    });
                } else {
                    // Single target
                    this.target.hp -= this.parent.dmg;
                    spawnParticles(this.x, this.y, '#ff0055', 3);
                }
                this.active = false;
            } else { 
                // Flytt mot målet
                this.x += (this.target.x - this.x) / d * speed; 
                this.y += (this.target.y - this.y) / d * speed; 
            }
        }
    }

    hitEnemy(e) {
        e.hp -= this.parent.dmg;
        spawnParticles(e.x, e.y, '#ffffff', 2);

        // EVOLUTION LOGIC
        if (this.parent.isEvolved === 'bomb') {
            summons.push(new Explosion(this.x, this.y));
            enemies.forEach(e2 => { 
                if(Math.hypot(e2.x - this.x, e2.y - this.y) < 50) e2.hp -= 3; 
            });
        }
        
        if (this.parent.isEvolved === 'necro' && e.hp <= 0) {
            console.log("Necromancer kill! Spawning ghost at end of path.");
            summons.push(new Ghost(e.maxHp)); // Spawner Ghost
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = config[this.type].color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, (this.type === 'cannon' ? 6 : 4), 0, Math.PI*2); 
        ctx.fill();
        ctx.restore();
    }
}

class Ghost {
    constructor(hpStrength) {
        // Necromancer Fix: Start på slutten av banen
        let startNodeIndex = waypoints.length - 1;
        let startNode = waypoints[startNodeIndex];
        
        this.x = startNode.x;
        this.y = startNode.y;
        this.wpIndex = startNodeIndex; // Nåværende waypoint indeks
        this.targetWpIndex = startNodeIndex - 1; // Neste mål (bakover)
        
        this.dmg = 1; // Skade per tick ved kontakt
        this.speed = 1.5;
        this.hp = hpStrength * 0.5; // Spøkelset har 50% av fiendens HP
        this.maxHp = this.hp;
        this.active = true;
        this.color = "cyan";
    }

    update() {
        // Finn mål-koordinater
        if (this.targetWpIndex < 0) {
            this.active = false; // Nådde starten av banen
            return;
        }

        let target = waypoints[this.targetWpIndex];
        let d = Math.hypot(target.x - this.x, target.y - this.y);

        // Bevegelse
        if (d < 5) {
            this.wpIndex--;
            this.targetWpIndex--;
        } else {
            this.x += (target.x - this.x) / d * this.speed;
            this.y += (target.y - this.y) / d * this.speed;
        }

        // Kollisjon med fiender (Spøkelset angriper fiender det møter)
        enemies.forEach(e => {
            if (Math.hypot(e.x - this.x, e.y - this.y) < 25) {
                e.hp -= 0.5; // Skade over tid
                spawnParticles(e.x, e.y, "cyan", 1);
                this.hp -= 0.1; // Spøkelset mister "energi" ved kamp
            }
        });

        if (this.hp <= 0) this.active = false;
        
        // Trail effect
        if(frame % 5 === 0) spawnParticles(this.x, this.y, "rgba(0, 255, 255, 0.5)", 1);
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 12, 0, Math.PI*2);
        ctx.fill();
        // Øyne
        ctx.fillStyle = "black";
        ctx.beginPath(); ctx.arc(this.x-4, this.y-2, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+4, this.y-2, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Explosion {
    constructor(x, y) { 
        this.x = x; 
        this.y = y; 
        this.life = 15; 
        this.active = true; 
        spawnParticles(x, y, '#ffaa00', 10); // Masse partikler
    }
    update() { this.life--; if(this.life <= 0) this.active = false; }
    draw() { 
        ctx.save();
        ctx.fillStyle = `rgba(255, 165, 0, ${this.life/15})`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "orange";
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, 30, 0, Math.PI*2); 
        ctx.fill(); 
        ctx.restore();
    }
}

class Enemy {
    constructor() {
        this.wp = 0; 
        this.x = waypoints[0].x; 
        this.y = waypoints[0].y;
        this.hp = config.enemy.hpBase + (currentWave * config.enemy.hpScale);
        this.maxHp = this.hp; 
        this.speed = config.enemy.speed;
        this.freeze = 0;
    }

    update() {
        let t = waypoints[this.wp + 1];
        let d = Math.hypot(t.x - this.x, t.y - this.y);
        
        if(d < 5) {
            this.wp++; 
        } else { 
            this.x += (t.x - this.x) / d * this.speed; 
            this.y += (t.y - this.y) / d * this.speed; 
        }
        
        if(this.wp >= waypoints.length - 1) { 
            lives--; 
            enemies.splice(enemies.indexOf(this), 1); 
            updateUI();
            console.log("Fiende nådde mål. Liv tapt.");
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#ef4444";
        ctx.fillStyle = "#ef4444"; 
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, 12, 0, Math.PI*2); 
        ctx.fill();
        
        // HP Bar
        ctx.shadowBlur = 0;
        ctx.fillStyle = "black";
        ctx.fillRect(this.x - 10, this.y - 20, 20, 4);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(this.x - 10, this.y - 20, 20 * (Math.max(0, this.hp) / this.maxHp), 4);
        ctx.restore();
    }
}

// === TEGNING AV BANEN ===

function drawGrid() {
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=canvas.width; x+=40) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for(let y=0; y<=canvas.height; y+=40) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
}

function drawPath() {
    // Glow effect for path
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#38bdf8"; // Neon blue
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 44; // Border
    ctx.lineJoin = "round"; 
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y); 
    waypoints.forEach(w => ctx.lineTo(w.x, w.y)); 
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset glow for inner road
    ctx.strokeStyle = "#1e293b"; // Dark road color
    ctx.lineWidth = 38; 
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y); 
    waypoints.forEach(w => ctx.lineTo(w.x, w.y)); 
    ctx.stroke();

    // Senterlinje (Stiplet)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y); 
    waypoints.forEach(w => ctx.lineTo(w.x, w.y)); 
    ctx.stroke();
    ctx.setLineDash([]);
}

// === SPILL-LØKKE ===

function gameLoop() {
    if(!isGameRunning) return;
    
    // Renskjerm
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Tegn Bakgrunn
    drawGrid();
    drawPath();

    // Håndter Bølger
    if(waveActive) {
        if(frame % 60 === 0 && spawnedInWave < enemiesInWave) { 
            enemies.push(new Enemy()); 
            spawnedInWave++; 
        }
        if(spawnedInWave >= enemiesInWave && enemies.length === 0) { 
            waveActive = false; 
            waveTimer = 180; // 3 sekunder pause
            gold += 100 + (currentWave * 10); 
            console.log(`Bølge ${currentWave} ferdig. Gull: ${gold}`);
            updateUI();
        }
    } else { 
        if(waveTimer-- <= 0) { 
            currentWave++; 
            spawnedInWave = 0; 
            waveActive = true; 
            enemiesInWave = Math.floor(enemiesInWave * 1.3); 
            console.log(`Starter Bølge ${currentWave}. Antall fiender: ${enemiesInWave}`);
            updateUI();
        } 
    }

    // Oppdater og tegn objekter
    summons.forEach((s, i) => { s.update(); s.draw(); if(!s.active) summons.splice(i, 1); });
    heroes.forEach(h => { h.update(); h.draw(); });
    enemies.forEach((e, i) => { 
        e.update(); 
        e.draw(); 
        if(e.hp <= 0) { 
            enemies.splice(i, 1); 
            gold += 15; 
            updateUI();
        } 
    });
    projectiles.forEach((p, i) => { p.update(); p.draw(); if(!p.active) projectiles.splice(i, 1); });
    particles.forEach((p, i) => { p.update(); p.draw(); if(p.life <= 0) particles.splice(i, 1); });

    frame++;
    if(lives > 0) requestAnimationFrame(gameLoop); 
    else {
        alert("GAME OVER! Du nådde bølge " + currentWave);
        location.reload();
    }
}

// === INTERAKSJON ===

function setTool(t) { 
    currentTool = t; 
    // Oppdater visuell feedback på knapper
    document.querySelectorAll('.buy-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(t + 'Btn').classList.add('active');
    console.log("Verktøy valgt:", t);
}

// Klikk på canvas
canvas.addEventListener('mousedown', (e) => {
    let r = canvas.getBoundingClientRect(); 
    let x = e.clientX - r.left;
    let y = e.clientY - r.top;
    
    // Sjekk om vi trykket på en helt
    let found = heroes.find(h => Math.hypot(h.x - x, h.y - y) < 20);
    if(found) { 
        selectHero(found); 
        return; 
    }
    
    // Hvis ikke, prøv å bygge
    deselectHero();
    if(gold >= config[currentTool].cost) {
        // Enkel sjekk for å ikke bygge oppå hverandre eller i veien (kan forbedres)
        if(isPath(x, y)) {
            console.log("Kan ikke bygge på veien!");
            return;
        }
        
        heroes.push(new Hero(x, y, currentTool));
        gold -= config[currentTool].cost;
        updateUI();
        spawnParticles(x, y, '#ffffff', 10); // Bygge-effekt
    } else {
        console.log("Ikke nok gull!");
    }
});

// Hjelpefunksjon for å sjekke om vi klikker på veien (veldig enkel sjekk mot waypoints)
function isPath(x, y) {
    // En bedre løsning ville vært å sjekke avstand til linjestykker mellom waypoints
    // Men for nå antar vi at brukeren ser hvor veien er :)
    return false; 
}

function selectHero(h) {
    selectedHero = h;
    document.getElementById('upgradeMenu').style.display = 'block';
    document.getElementById('heroTitle').innerText = h.type.toUpperCase();
    document.getElementById('heroStats').innerHTML = `Level: ${h.lvl}<br>Dmg: ${h.dmg.toFixed(1)}<br>Range: ${h.range}`;
    console.log("Helt valgt:", h);
}

function deselectHero() { 
    selectedHero = null; 
    document.getElementById('upgradeMenu').style.display = 'none'; 
}

function applyUpgrade() {
    if(!selectedHero || gold < 100) return;
    gold -= 100;
    selectedHero.lvl++;
    selectedHero.dmg *= 1.5;
    selectedHero.range += 10;
    
    spawnParticles(selectedHero.x, selectedHero.y, '#00ff00', 15);
    
    if(selectedHero.type === 'boom' && selectedHero.lvl === 3 && !selectedHero.isEvolved) {
        document.getElementById('evo-modal').style.display = 'flex';
    }
    
    updateUI();
    selectHero(selectedHero); // Oppdater stats tekst
}

function evolve(type) {
    if(selectedHero) {
        selectedHero.isEvolved = type;
        console.log("Evolusjon valgt:", type);
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
