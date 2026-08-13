import { PartsLibrary } from '../../shared/parts/Part.js';
import { DOCTRINE_PART_SPECS } from '../../shared/parts/arsenal/DoctrineParts.js';

export class DoctrineTerminal {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.root = null;
        this.previouslyPaused = false;
        if (globalThis.document) this.createUi();
    }

    createUi() {
        this.root = document.createElement('div');
        this.root.id = 'doctrine-terminal';
        Object.assign(this.root.style, {
            display: 'none', position: 'fixed', inset: '0', zIndex: '1400',
            background: 'rgba(0, 5, 4, .94)', color: '#bde9df',
            fontFamily: 'monospace', overflow: 'auto', padding: '32px'
        });
        document.body.appendChild(this.root);
    }

    open() {
        if (!this.root) return false;
        this.active = true;
        this.previouslyPaused = Boolean(this.game.paused);
        this.game.paused = true;
        if (this.game.peerNetwork?.isGuest) {
            this.game.peerNetwork.sendInput?.({});
            this.game.peerNetwork.sendFireIntent?.(false, 0);
        } else if (this.game.peerNetwork?.isHost) {
            this.game.peerNetwork.flushAuthoritativeState?.();
        }
        this.render();
        this.root.style.display = 'block';
        return true;
    }

    close() {
        this.active = false;
        if (this.root) this.root.style.display = 'none';
        this.game.paused = this.previouslyPaused;
        if (this.game.peerNetwork?.isHost) {
            this.game.peerNetwork.flushAuthoritativeState?.();
        }
    }

    resetRunState() {
        this.active = false;
        this.previouslyPaused = false;
        if (this.root) this.root.style.display = 'none';
    }

    render() {
        const inventory = this.game.hangar?.inventory || {};
        const installed = new Set(
            [...(this.game.playerShip?.getUniqueParts?.() || [])].map(part => part.partId)
        );
        this.root.innerHTML = `
            <div style="max-width:1120px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:20px">
                    <div><div style="color:#55ffc2;font-size:12px">doctrine terminal // permanent stock</div>
                    <h1 style="margin:5px 0 0;color:#eafff8;font-size:26px">choose a ship doctrine</h1></div>
                    <button data-close style="background:#071512;color:#74ff6a;border:1px solid #74ff6a;padding:9px 16px;font:inherit">close</button>
                </div>
                <div style="color:#8eaaa2;margin-bottom:18px">one may be installed at a time // 90g each // shared gold: ${this.game.gold}g</div>
                <div data-cards style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px"></div>
            </div>`;
        this.root.querySelector('[data-close]').onclick = () => this.close();
        const cards = this.root.querySelector('[data-cards]');
        DOCTRINE_PART_SPECS.forEach((spec, index) => {
            const card = document.createElement('article');
            const owned = (inventory[spec.id] || 0) + (installed.has(spec.id) ? 1 : 0);
            card.style.cssText = 'border:1px solid #2e6658;background:#06100e;padding:16px;display:flex;flex-direction:column;gap:8px';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;color:#ffaa00"><strong>${spec.name}</strong><span>legendary // 2x2</span></div>
                <div style="color:#d8eee8;min-height:34px">${spec.description}</div>
                <div style="color:#74ff6a">${spec.bonuses.join('<br>')}</div>
                <div style="color:#ff6978">${spec.drawbacks.join('<br>')}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:8px">
                    <span style="color:#8eaaa2">owned: ${owned}</span>
                    <button data-buy="${index}" style="background:#102219;color:${this.game.gold >= spec.shopPrice ? '#74ff6a' : '#ff6978'};border:1px solid currentColor;padding:8px 12px;font:inherit">buy // ${spec.shopPrice}g</button>
                </div>`;
            cards.appendChild(card);
        });
        this.root.querySelectorAll('[data-buy]').forEach(button => {
            button.onclick = () => this.buy(Number(button.dataset.buy));
        });
    }

    buy(index) {
        const spec = DOCTRINE_PART_SPECS[index];
        if (!spec || this.game.gold < spec.shopPrice) return false;
        if (!globalThis.confirm?.(`buy ${spec.name} for ${spec.shopPrice}g?`)) return false;
        if (this.game.peerNetwork?.isGuest) {
            const sent = this.game.peerNetwork.sendInteraction?.('doctrine', index);
            if (sent) this.close();
            return Boolean(sent);
        }
        const purchased = this.game.worldInteractions.purchaseDoctrine(spec.id);
        if (purchased) this.render();
        return purchased;
    }
}

export function doctrineTerminalItem() {
    return {
        type: 'doctrine_terminal',
        name: 'doctrine terminal',
        description: 'opens the complete doctrine catalog.',
        price: 0
    };
}

export function doctrineDefinitions() {
    return DOCTRINE_PART_SPECS.map(spec => PartsLibrary[spec.id]).filter(Boolean);
}
