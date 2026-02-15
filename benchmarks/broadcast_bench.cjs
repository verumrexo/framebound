// Mock projectiles
const projectiles = Array.from({ length: 50 }, (_, i) => ({
    x: Math.round(Math.random() * 1000),
    y: Math.round(Math.random() * 1000),
    angle: parseFloat(Math.random().toFixed(4)),
    type: 'bullet',
    speed: Math.round(400 + Math.random() * 400),
    damage: 10
}));

function measureUnbatched() {
    let bytes = 0;
    projectiles.forEach(p => {
        const payload = {
            x: p.x,
            y: p.y,
            angle: p.angle,
            type: p.type,
            speed: p.speed,
            damage: p.damage
        };
        // Estimation of JSON size + socket.io overhead (approx 20 bytes per packet)
        bytes += JSON.stringify(['enemy_shoot', payload]).length + 20;
    });
    return bytes;
}

function measureBatched() {
    const shoots = projectiles.map(p => ({
        x: p.x,
        y: p.y,
        angle: p.angle,
        type: p.type,
        speed: p.speed,
        damage: p.damage
    }));
    // Estimation of JSON size + socket.io overhead (approx 20 bytes for one packet)
    return JSON.stringify(['enemy_shoots', shoots]).length + 20;
}

const unbatchedSize = measureUnbatched();
const batchedSize = measureBatched();

console.log("Unbatched Total Size (approx): " + unbatchedSize + " bytes");
console.log("Batched Total Size (approx): " + batchedSize + " bytes");
console.log("Reduction: " + ((1 - batchedSize / unbatchedSize) * 100).toFixed(2) + "%");
