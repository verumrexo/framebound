import { XPOrb } from '../../shared/entities/XPOrb.js';
import { GoldOrb } from '../../shared/entities/GoldOrb.js';
import { HPOrb } from '../../shared/entities/HPOrb.js';

export class LootDropSystem {
    constructor(game, { random = Math.random } = {}) {
        this.game = game;
        this.random = random;
    }

    spawnAsteroidLoot(asteroid) {
        if (asteroid.type === 'crystal_blue' || asteroid.type === 'crystal_gold') {
            let count = 0;
            // Size Category: small, medium, large
            if (asteroid.sizeCategory === 'large') {
                count = 5 + Math.floor(this.random() * 2); // 5-6
            } else if (asteroid.sizeCategory === 'medium') {
                count = 3 + Math.floor(this.random() * 2); // 3-4
            } else {
                count = 1 + Math.floor(this.random() * 2); // 1-2 (Small)
            }

            for (let k = 0; k < count; k++) {
                const offsetX =
                    asteroid.x + (this.random() - 0.5) * 20;
                const offsetY =
                    asteroid.y + (this.random() - 0.5) * 20;

                if (asteroid.type === 'crystal_blue') {
                    this.game.xpOrbs.push(new XPOrb(offsetX, offsetY, 10));
                } else {
                    this.game.goldOrbs.push(new GoldOrb(offsetX, offsetY, 1));
                }
            }
        }
        this.game.audio.play('asteroid_break', { volume: 0.5, randomizePitch: 0.2 });
    }

    spawnCrateLoot(crate) {
        let count = 0;
        const totalTiles = crate.wTiles * crate.hTiles;

        // Variant 2 (Green) = HP (Special Logic)
        if (crate.variant === 2) {
            if (totalTiles >= 4) count = 3; // Large (2x2)
            else if (totalTiles >= 2) count = 2; // Medium (1x2)
            else count = 1; // Small (1x1)

            for (let k = 0; k < count; k++) {
                const offsetX =
                    crate.x + (this.random() - 0.5) * 20;
                const offsetY =
                    crate.y + (this.random() - 0.5) * 20;
                this.game.hpOrbs.push(new HPOrb(offsetX, offsetY, 10));
            }
        } else {
            // Variant 0 (XP) & 1 (Gold)
            if (totalTiles >= 4) {
                count = 5 + Math.floor(this.random() * 2); // 5-6 (Large)
            } else if (totalTiles >= 2) {
                count = 3 + Math.floor(this.random() * 2); // 3-4 (Medium)
            } else {
                count = 1 + Math.floor(this.random() * 2); // 1-2 (Small)
            }

            for (let k = 0; k < count; k++) {
                const offsetX =
                    crate.x + (this.random() - 0.5) * 20;
                const offsetY =
                    crate.y + (this.random() - 0.5) * 20;

                if (crate.variant === 0) {
                    this.game.xpOrbs.push(new XPOrb(offsetX, offsetY, 10));
                } else {
                    this.game.goldOrbs.push(new GoldOrb(offsetX, offsetY, 1));
                }
            }
        }
        this.game.audio.play('crate_break', { volume: 0.5, randomizePitch: 0.2 });
    }
}
