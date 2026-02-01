
export class Settings {
    constructor(game) {
        this.game = game;
        this.settingsMenu = null;
        this.active = false;

        // Default settings
        this.defaults = {
            masterVolume: 0.8,
            musicVolume: 0.4,
            sfxVolume: 0.6,
            pixelSize: 1,
            antiAliasing: false,
            cssPixelation: true,
            resolutionScale: 1.0,
            cursorShape: '4-lines', // 'dot', 'circle', '3-lines', '4-lines'
            cursorThickness: 2,
            cursorLength: 15,
            cursorGap: 3,
            cursorColor: '#00ffff',
            cursorOutline: true
        };

        // State for floaty sliders
        this.sliderStates = {
            master: { current: 80, target: 80 },
            music: { current: 40, target: 40 },
            sfx: { current: 60, target: 60 },
            cursorThickness: { current: 2, target: 2 },
            cursorLength: { current: 15, target: 15 },
            cursorGap: { current: 3, target: 3 }
        };

        this.updateInterval = null;
        this.load();
    }

    load() {
        // persistence if needed later
    }

    render(parentOverlay, backCallback) {
        const audio = this.game.audio;
        const renderer = this.game.renderer;

        // Sync current states with audio engine on open
        this.sliderStates.master.target = this.sliderStates.master.current = Math.round(audio.masterGain.gain.value * 100);
        this.sliderStates.music.target = this.sliderStates.music.current = Math.round(audio.musicGain.gain.value * 100);
        this.sliderStates.sfx.target = this.sliderStates.sfx.current = Math.round(audio.sfxGain.gain.value * 100);

        const pixelSize = renderer.pixelSize;
        const antiAliasing = renderer.smoothingEnabled;
        const cssPixelation = renderer.pixelatedCSS;

        // Ensure defaults if not present
        if (!this.game.cursorSettings) {
            this.game.cursorSettings = {
                shape: this.defaults.cursorShape,
                thickness: this.defaults.cursorThickness,
                length: this.defaults.cursorLength,
                gap: this.defaults.cursorGap,
                color: this.defaults.cursorColor,
                outline: this.defaults.cursorOutline
            };
        }

        const settings = this.game.cursorSettings;

        parentOverlay.innerHTML = `
            <style>
                .settings-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 550px;
                    padding: 20px;
                }
                .settings-content {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                    max-height: 70vh;
                    overflow-y: auto;
                    padding-right: 15px;
                    scrollbar-width: thin;
                }
                .setting-group-label {
                    color: #444;
                    font-size: 10px;
                    border-bottom: 2px solid #222;
                    padding-bottom: 8px;
                    margin-top: 15px;
                    text-transform: lowercase;
                    letter-spacing: 4px;
                }
                .setting-row {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .label-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #888;
                    text-transform: lowercase;
                }
                .val-display {
                    color: #00ffff;
                    font-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                    min-width: 45px;
                    text-align: right;
                }
                
                /* THE FLOATY SLIDER */
                .slider-outer {
                    position: relative;
                    width: 100%;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }
                .slider-track {
                    width: 100%;
                    height: 4px;
                    background: #111;
                    border: 1px solid #333;
                    border-radius: 2px;
                }
                .slider-fill {
                    position: absolute;
                    left: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #004444, #00ffff);
                    border-radius: 2px;
                    pointer-events: none;
                    box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
                }
                .slider-thumb {
                    position: absolute;
                    width: 14px;
                    height: 20px;
                    background: #00ffff;
                    border: 1px solid white;
                    box-shadow: 0 0 15px #00ffff, inset 0 0 5px white;
                    border-radius: 2px;
                    pointer-events: none;
                    transform: translateX(-50%);
                    z-index: 2;
                }
                .slider-input {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 3;
                }

                .checkbox-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #888;
                    font-size: 12px;
                    text-transform: lowercase;
                    padding: 5px 0;
                }
                .setting-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: #00ffff;
                }
                .color-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #888;
                    font-size: 12px;
                    text-transform: lowercase;
                    padding: 5px 0;
                }
                .color-picker {
                    width: 40px;
                    height: 24px;
                    border: 1px solid #333;
                    background: #111;
                    cursor: pointer;
                    padding: 0;
                }
            </style>

            <div class="settings-container">
                <h2 style="color: #00ffff; margin-bottom: 40px; font-size: 32px; text-shadow: 0 0 20px #00ffff; text-transform: lowercase; letter-spacing: -2px;">terminal config</h2>
                
                <div class="settings-content">
                    <div class="setting-group-label">acoustic output</div>
                    
                    ${this.createFloatySlider('master', 'master volume', this.sliderStates.master.current)}
                    ${this.createFloatySlider('music', 'music stream', this.sliderStates.music.current)}
                    ${this.createFloatySlider('sfx', 'action feedback', this.sliderStates.sfx.current)}

                    <div class="setting-group-label">visual matrix</div>

                    <div class="setting-row">
                        <div class="label-row">
                            <span>mosaic density</span>
                            <span class="val-display">${pixelSize}px</span>
                        </div>
                        <div class="slider-outer">
                            <div class="slider-track"></div>
                            <div class="slider-fill" style="width: ${(pixelSize / 16) * 100}%"></div>
                            <div class="slider-thumb" style="left: ${(pixelSize / 16) * 100}%"></div>
                            <input type="range" id="rng-pixelSize" min="1" max="16" step="1" value="${pixelSize}" class="slider-input">
                        </div>
                    </div>

                    <div class="checkbox-row">
                        <span>bi-linear filter</span>
                        <input type="checkbox" id="chk-aliasing" class="setting-checkbox" ${antiAliasing ? 'checked' : ''}>
                    </div>

                    <div class="checkbox-row">
                        <span>pixelated css injection</span>
                        <input type="checkbox" id="chk-css" class="setting-checkbox" ${cssPixelation ? 'checked' : ''}>
                    </div>

                    <div class="setting-group-label">targeting computer</div>

                    <div class="setting-row">
                        <div class="label-row">
                            <span>reticle geometry</span>
                        </div>
                        <select id="sel-cursorShape" style="background: #111; color: #00ffff; border: 1px solid #333; padding: 8px; font-family: 'Press Start 2P'; font-size: 10px; width: 100%; cursor: pointer; text-transform: lowercase;">
                            <option value="dot" ${settings.shape === 'dot' ? 'selected' : ''}>nanopoint</option>
                            <option value="circle" ${settings.shape === 'circle' ? 'selected' : ''}>orbital ring</option>
                            <option value="3-lines" ${settings.shape === '3-lines' ? 'selected' : ''}>tri-focus</option>
                            <option value="4-lines" ${settings.shape === '4-lines' ? 'selected' : ''}>quad-lock</option>
                        </select>
                    </div>

                    <div class="color-row">
                        <span>beam color</span>
                        <input type="color" id="clr-cursorColor" class="color-picker" value="${settings.color}">
                    </div>

                    <div class="checkbox-row">
                        <span>contrast outline</span>
                        <input type="checkbox" id="chk-cursorOutline" class="setting-checkbox" ${settings.outline ? 'checked' : ''}>
                    </div>

                    ${this.createFloatySlider('cursorThickness', 'line thickness', this.sliderStates.cursorThickness.current, 1, 10)}
                    ${this.createFloatySlider('cursorLength', 'reticle span', this.sliderStates.cursorLength.current, 5, 50)}
                    ${this.createFloatySlider('cursorGap', 'central void', this.sliderStates.cursorGap.current, 0, 20)}
                </div>

                <button id="btn-settings-back" class="menu-btn" style="width: 280px; margin-top: 50px; font-size: 14px;">return to main_process</button>
            </div>
        `;

        if (this.updateInterval) clearInterval(this.updateInterval);

        // Setup Listeners
        setTimeout(() => {
            const audio = this.game.audio;
            const renderer = this.game.renderer;

            ['master', 'music', 'sfx', 'cursorThickness', 'cursorLength', 'cursorGap'].forEach(key => {
                const input = document.getElementById(`rng-${key}`);
                if (input) {
                    input.oninput = (e) => {
                        this.sliderStates[key].target = parseInt(e.target.value);

                        if (key === 'master') audio.setMasterVolume(this.sliderStates[key].target / 100);
                        if (key === 'music') audio.setMusicVolume(this.sliderStates[key].target / 100);
                        if (key === 'sfx') audio.setSfxVolume(this.sliderStates[key].target / 100);

                        if (key.startsWith('cursor')) {
                            const prop = key.replace('cursor', '').toLowerCase();
                            this.game.cursorSettings[prop] = this.sliderStates[key].target;
                        }
                    };
                }
            });

            const rngPixel = document.getElementById('rng-pixelSize');
            if (rngPixel) {
                rngPixel.oninput = (e) => {
                    const v = parseInt(e.target.value);
                    renderer.setPixelSize(v);
                    this.render(parentOverlay, backCallback); // Re-render for simplicity on simple sliders
                };
            }

            const chkAliasing = document.getElementById('chk-aliasing');
            const chkCss = document.getElementById('chk-css');
            const selShape = document.getElementById('sel-cursorShape');
            const clrColor = document.getElementById('clr-cursorColor');
            const chkOutline = document.getElementById('chk-cursorOutline');
            const btnBack = document.getElementById('btn-settings-back');

            if (chkAliasing) chkAliasing.onchange = (e) => renderer.setSmoothing(e.target.checked);
            if (chkCss) chkCss.onchange = (e) => renderer.setPixelation(e.target.checked);
            if (selShape) selShape.onchange = (e) => this.game.cursorSettings.shape = e.target.value;
            if (clrColor) clrColor.onchange = (e) => this.game.cursorSettings.color = e.target.value;
            if (chkOutline) chkOutline.onchange = (e) => this.game.cursorSettings.outline = e.target.checked;

            if (btnBack) btnBack.onclick = () => {
                if (this.updateInterval) clearInterval(this.updateInterval);
                if (backCallback) backCallback();
            };

            // Floaty Easing Loop
            this.updateInterval = setInterval(() => {
                ['master', 'music', 'sfx', 'cursorThickness', 'cursorLength', 'cursorGap'].forEach(key => {
                    const state = this.sliderStates[key];
                    const diff = state.target - state.current;

                    if (Math.abs(diff) > 0.1) {
                        state.current += diff * 0.15;
                        this.updateSliderUI(key, state.current, key.startsWith('cursor'));
                    } else {
                        state.current = state.target;
                        this.updateSliderUI(key, state.current, key.startsWith('cursor'));
                    }
                });
            }, 1000 / 60);

            // Prevention
            const stop = (e) => e.stopPropagation();
            const interactables = document.querySelectorAll('.slider-input, .setting-checkbox, .menu-btn');
            interactables.forEach(el => {
                el.addEventListener('mousedown', stop);
                el.addEventListener('click', stop);
            });
        }, 0);
    }

    createFloatySlider(id, label, startVal, min = 0, max = 100) {
        const pct = ((startVal - min) / (max - min)) * 100;
        return `
            <div class="setting-row" id="container-${id}">
                <div class="label-row">
                    <span>${label}</span>
                    <span id="txt-${id}" class="val-display">${Math.round(startVal)}${max === 100 && min === 0 ? '%' : ''}</span>
                </div>
                <div class="slider-outer">
                    <div class="slider-track"></div>
                    <div id="fill-${id}" class="slider-fill" style="width: ${pct}%"></div>
                    <div id="thumb-${id}" class="slider-thumb" style="left: ${pct}%"></div>
                    <input type="range" id="rng-${id}" min="${min}" max="${max}" step="1" value="${startVal}" class="slider-input">
                </div>
            </div>
        `;
    }

    updateSliderUI(id, value, isRaw = false) {
        const input = document.getElementById(`rng-${id}`);
        if (!input) return;

        const min = parseInt(input.min);
        const max = parseInt(input.max);
        const pct = ((value - min) / (max - min)) * 100;

        const fill = document.getElementById(`fill-${id}`);
        const thumb = document.getElementById(`thumb-${id}`);
        const txt = document.getElementById(`txt-${id}`);

        if (fill) fill.style.width = pct + '%';
        if (thumb) thumb.style.left = pct + '%';
        if (txt) txt.innerText = Math.round(value) + (max === 100 && min === 0 ? '%' : '');
    }
}
