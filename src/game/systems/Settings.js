export class Settings {
    constructor(game) {
        this.game = game;
        this.settingsMenu = null;
        this.backCallback = null;
        this.activeTab = 'display';
        this.fullscreenChangeHandler = null;

        this.defaults = {
            masterVolume: 0.8,
            musicVolume: 0.4,
            sfxVolume: 0.6,
            rasterScale: 3,
            showFps: true,
            cursorShape: '4-lines',
            cursorThickness: 2,
            cursorLength: 15,
            cursorGap: 3,
            cursorColor: '#00ffff',
            cursorOutline: true,
            showDamageNumbers: true,
            damageNumberMode: 'singular',
            eyeCandy: true
        };

        this.sliderStates = {
            master: { current: 80, target: 80 },
            music: { current: 40, target: 40 },
            sfx: { current: 60, target: 60 },
            cursorThickness: { current: 2, target: 2 },
            cursorLength: { current: 15, target: 15 },
            cursorGap: { current: 3, target: 3 }
        };

        this.setupTimeout = null;
        this.load();
    }

    load() {
        this.game.showDamageNumbers = this.defaults.showDamageNumbers;
        this.game.damageNumberMode = this.defaults.damageNumberMode;
        this.game.eyeCandy = this.defaults.eyeCandy;
        this.game.showFps = this.defaults.showFps;
        this.game.cursorSettings = this.normalizeCursorSettings(this.game.cursorSettings);

        try {
            const saved = localStorage.getItem('framebound_cursor_settings');
            if (saved) this.game.cursorSettings = this.normalizeCursorSettings(JSON.parse(saved));
        } catch (e) {
            console.warn('[Settings] Failed to load cursor settings:', e);
        }
        this.syncCursorSliderStates();

        try {
            const saved = localStorage.getItem('framebound_game_settings');
            const parsed = saved ? JSON.parse(saved) : {};
            const normalized = this.normalizeGameSettings(parsed);
            this.game.showDamageNumbers = normalized.showDamageNumbers;
            this.game.damageNumberMode = normalized.damageNumberMode;
            this.game.eyeCandy = normalized.eyeCandy;
            this.game.showFps = normalized.showFps;
            this.applyRasterScale(normalized.rasterScale);
        } catch (e) {
            console.warn('[Settings] Failed to load game settings:', e);
            this.applyRasterScale(this.defaults.rasterScale);
        }
    }

    syncCursorSliderStates() {
        const settings = this.game.cursorSettings;
        this.sliderStates.cursorThickness.current = this.sliderStates.cursorThickness.target = settings.thickness;
        this.sliderStates.cursorLength.current = this.sliderStates.cursorLength.target = settings.length;
        this.sliderStates.cursorGap.current = this.sliderStates.cursorGap.target = settings.gap;
    }

    normalizeCursorSettings(value) {
        const settings = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const numberInRange = (candidate, fallback, min, max) => (
            Number.isFinite(candidate) ? Math.max(min, Math.min(max, candidate)) : fallback
        );
        const validShapes = new Set(['dot', 'circle', '3-lines', '4-lines']);

        return {
            shape: validShapes.has(settings.shape) ? settings.shape : this.defaults.cursorShape,
            thickness: numberInRange(settings.thickness, this.defaults.cursorThickness, 1, 10),
            length: numberInRange(settings.length, this.defaults.cursorLength, 5, 50),
            gap: numberInRange(settings.gap, this.defaults.cursorGap, 0, 20),
            color: typeof settings.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(settings.color)
                ? settings.color
                : this.defaults.cursorColor,
            outline: typeof settings.outline === 'boolean' ? settings.outline : this.defaults.cursorOutline
        };
    }

    normalizeGameSettings(value) {
        const settings = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const validModes = new Set(['singular', 'additive']);
        const validRasterScales = new Set([1, 2, 3]);

        return {
            showDamageNumbers: typeof settings.showDamageNumbers === 'boolean'
                ? settings.showDamageNumbers
                : this.defaults.showDamageNumbers,
            damageNumberMode: validModes.has(settings.damageNumberMode)
                ? settings.damageNumberMode
                : this.defaults.damageNumberMode,
            eyeCandy: typeof settings.eyeCandy === 'boolean' ? settings.eyeCandy : this.defaults.eyeCandy,
            rasterScale: validRasterScales.has(settings.rasterScale)
                ? settings.rasterScale
                : this.defaults.rasterScale,
            showFps: typeof settings.showFps === 'boolean' ? settings.showFps : this.defaults.showFps
        };
    }

    applyRasterScale(value) {
        const rasterScale = this.normalizeGameSettings({ rasterScale: value }).rasterScale;
        if (this.game.renderer?.setRasterScale) this.game.renderer.setRasterScale(rasterScale);
        else if (this.game.renderer?.viewport) {
            this.game.renderer.viewport.setWorldPixelScale?.(rasterScale);
            this.game.renderer.resize?.();
        }
        this.game.rasterScale = rasterScale;
        return rasterScale;
    }

    saveGameSettings() {
        try {
            localStorage.setItem('framebound_game_settings', JSON.stringify({
                showDamageNumbers: this.game.showDamageNumbers,
                damageNumberMode: this.game.damageNumberMode,
                eyeCandy: this.game.eyeCandy !== false,
                rasterScale: this.game.rasterScale ?? this.defaults?.rasterScale ?? 3,
                showFps: this.game.showFps !== false
            }));
        } catch (e) {
            console.warn('[Settings] Failed to save game settings:', e);
        }
    }

    saveCursorSettings() {
        try {
            localStorage.setItem('framebound_cursor_settings', JSON.stringify(this.game.cursorSettings));
        } catch (e) {
            console.warn('[Settings] Failed to save cursor settings:', e);
        }
    }

    stopUpdating() {
        if (this.setupTimeout !== null) {
            clearTimeout(this.setupTimeout);
            this.setupTimeout = null;
        }
        if (this.fullscreenChangeHandler) {
            document.removeEventListener?.('fullscreenchange', this.fullscreenChangeHandler);
            this.fullscreenChangeHandler = null;
        }
    }

    render(parentOverlay, backCallback, activeTab = this.activeTab) {
        const audio = this.game.audio;
        this.settingsMenu = parentOverlay;
        this.backCallback = backCallback;
        this.activeTab = activeTab;
        this.sliderStates.master.current = this.sliderStates.master.target = Math.round(audio.masterGain.gain.value * 100);
        this.sliderStates.music.current = this.sliderStates.music.target = Math.round(audio.musicGain.gain.value * 100);
        this.sliderStates.sfx.current = this.sliderStates.sfx.target = Math.round(audio.sfxGain.gain.value * 100);
        this.game.cursorSettings = this.normalizeCursorSettings(this.game.cursorSettings);
        this.syncCursorSliderStates();
        this.applyRasterScale(this.game.rasterScale ?? this.defaults.rasterScale);

        const settings = this.game.cursorSettings;
        const tab = name => `
            <button id="settings-tab-${name}" type="button" class="settings-tab" role="tab" data-settings-tab="${name}" aria-controls="settings-panel-${name}" aria-selected="${this.activeTab === name}">${name}</button>
        `;

        parentOverlay.innerHTML = `
            <div class="settings-container">
                <div class="ui-kicker">frame operating parameters</div>
                <div class="settings-heading">
                    <h2 class="settings-title">system settings</h2>
                    <span class="settings-status">changes apply live</span>
                </div>
                <div class="settings-tabs" role="tablist" aria-label="settings sections">
                    ${tab('display')}${tab('audio')}${tab('gameplay')}${tab('reticle')}
                </div>
                <div class="settings-content">
                    <section id="settings-panel-display" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-display" data-settings-panel="display">
                        <div class="setting-group-label">display // presentation</div>
                        <div class="setting-row">
                            <div class="label-row"><span>hard-raster scale</span><span class="val-display" id="txt-rasterScale">${this.game.rasterScale}x</span></div>
                            <div class="raster-options" role="radiogroup" aria-label="hard-raster scale">
                                ${[1, 2, 3].map(scale => `<button type="button" class="raster-option ${scale === this.game.rasterScale ? 'is-selected' : ''}" data-raster-scale="${scale}" role="radio" aria-checked="${scale === this.game.rasterScale}">${scale}x</button>`).join('')}
                            </div>
                            <div class="setting-help">world pixel blocks only; logical camera extent stays unchanged</div>
                        </div>
                        <div class="setting-row setting-row-inline">
                            <div><div class="label-row"><span>browser fullscreen</span></div><div class="setting-help">not saved; browsers require a user gesture</div></div>
                            <button type="button" id="btn-fullscreen" class="setting-control">enter fullscreen</button>
                        </div>
                        <div class="checkbox-row"><span>show fps</span><input type="checkbox" id="chk-showFps" class="setting-checkbox" ${this.game.showFps !== false ? 'checked' : ''}></div>
                    </section>

                    <section id="settings-panel-audio" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-audio" data-settings-panel="audio">
                        <div class="setting-group-label">audio // signal mix</div>
                        ${this.createFloatySlider('master', 'master volume', this.sliderStates.master.current)}
                        ${this.createFloatySlider('music', 'music stream', this.sliderStates.music.current)}
                        ${this.createFloatySlider('sfx', 'action feedback', this.sliderStates.sfx.current)}
                    </section>

                    <section id="settings-panel-gameplay" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-gameplay" data-settings-panel="gameplay">
                        <div class="setting-group-label">gameplay // combat telemetry</div>
                        <div class="checkbox-row"><span>eye candy</span><input type="checkbox" id="chk-eyeCandy" class="setting-checkbox" ${this.game.eyeCandy !== false ? 'checked' : ''}></div>
                        <div class="checkbox-row"><span>damage popups</span><input type="checkbox" id="chk-showDamage" class="setting-checkbox" ${this.game.showDamageNumbers ? 'checked' : ''}></div>
                        <div class="setting-row"><div class="label-row"><span>damage logic</span></div><select id="sel-damageMode" class="ui-select"><option value="singular" ${this.game.damageNumberMode === 'singular' ? 'selected' : ''}>discrete</option><option value="additive" ${this.game.damageNumberMode === 'additive' ? 'selected' : ''}>accumulative</option></select></div>
                    </section>

                    <section id="settings-panel-reticle" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-reticle" data-settings-panel="reticle">
                        <div class="setting-group-label">reticle // targeting computer</div>
                        <div class="reticle-layout">
                            <div class="reticle-preview" id="reticle-preview" aria-label="live reticle preview"><span></span></div>
                            <div class="reticle-fields">
                                <div class="setting-row"><div class="label-row"><span>reticle geometry</span></div><select id="sel-cursorShape" class="ui-select"><option value="dot" ${settings.shape === 'dot' ? 'selected' : ''}>nanopoint</option><option value="circle" ${settings.shape === 'circle' ? 'selected' : ''}>orbital ring</option><option value="3-lines" ${settings.shape === '3-lines' ? 'selected' : ''}>tri-focus</option><option value="4-lines" ${settings.shape === '4-lines' ? 'selected' : ''}>quad-lock</option></select></div>
                                <div class="color-row"><span>beam color</span><input type="color" id="clr-cursorColor" class="color-picker" value="${settings.color}"></div>
                                <div class="checkbox-row"><span>contrast outline</span><input type="checkbox" id="chk-cursorOutline" class="setting-checkbox" ${settings.outline ? 'checked' : ''}></div>
                            </div>
                        </div>
                        ${this.createFloatySlider('cursorThickness', 'line thickness', this.sliderStates.cursorThickness.current, 1, 10)}
                        ${this.createFloatySlider('cursorLength', 'reticle span', this.sliderStates.cursorLength.current, 5, 50)}
                        ${this.createFloatySlider('cursorGap', 'central void', this.sliderStates.cursorGap.current, 0, 20)}
                    </section>
                </div>
                <div class="settings-actions"><button id="btn-settings-reset" type="button" class="menu-btn settings-reset">reset settings</button><button id="btn-settings-back" type="button" class="menu-btn settings-back" data-index="esc">back</button></div>
            </div>
        `;

        this.stopUpdating();
        this.setActiveTab(this.activeTab);
        this.setupTimeout = setTimeout(() => {
            this.setupTimeout = null;
            this.bindControls(audio);
        }, 0);
    }

    bindControls(audio) {
        const query = selector => this.settingsMenu?.querySelector?.(selector);
        ['master', 'music', 'sfx', 'cursorThickness', 'cursorLength', 'cursorGap'].forEach(key => {
            const input = query(`#rng-${key}`);
            if (!input) return;
            input.oninput = event => {
                const value = Number.parseInt(event.target.value, 10);
                this.sliderStates[key].current = this.sliderStates[key].target = value;
                this.updateSliderUI(key, value);
                if (key === 'master') audio.setMasterVolume(value / 100);
                if (key === 'music') audio.setMusicVolume(value / 100);
                if (key === 'sfx') audio.setSfxVolume(value / 100);
                if (key.startsWith('cursor')) {
                    const prop = key.replace('cursor', '').toLowerCase();
                    this.game.cursorSettings[prop] = value;
                    this.updateReticlePreview();
                    this.saveCursorSettings();
                }
            };
        });

        query('#sel-cursorShape').onchange = event => { this.game.cursorSettings.shape = event.target.value; this.updateReticlePreview(); this.saveCursorSettings(); };
        query('#clr-cursorColor').oninput = event => { this.game.cursorSettings.color = event.target.value; this.updateReticlePreview(); this.saveCursorSettings(); };
        query('#chk-cursorOutline').onchange = event => { this.game.cursorSettings.outline = event.target.checked; this.updateReticlePreview(); this.saveCursorSettings(); };
        query('#chk-showDamage').onchange = event => { this.game.showDamageNumbers = event.target.checked; this.saveGameSettings(); };
        query('#sel-damageMode').onchange = event => { this.game.damageNumberMode = event.target.value; this.saveGameSettings(); };
        query('#chk-eyeCandy').onchange = event => { this.game.eyeCandy = event.target.checked; this.saveGameSettings(); };
        query('#chk-showFps').onchange = event => { this.game.showFps = event.target.checked; this.saveGameSettings(); };

        this.settingsMenu.querySelectorAll('[data-settings-tab]').forEach(button => {
            button.onclick = () => this.setActiveTab(button.dataset.settingsTab);
        });
        this.settingsMenu.querySelectorAll('[data-raster-scale]').forEach(button => {
            button.onclick = () => {
                this.applyRasterScale(Number(button.dataset.rasterScale));
                this.saveGameSettings();
                this.updateRasterControls();
            };
        });

        const fullscreenButton = query('#btn-fullscreen');
        fullscreenButton.onclick = () => this.toggleFullscreen();
        this.fullscreenChangeHandler = () => this.updateFullscreenLabel();
        document.addEventListener?.('fullscreenchange', this.fullscreenChangeHandler);
        this.updateFullscreenLabel();
        this.updateReticlePreview();

        query('#btn-settings-reset').onclick = () => {
            this.resetToDefaults();
            this.render(this.settingsMenu, this.backCallback, this.activeTab);
        };
        query('#btn-settings-back').onclick = () => {
            this.stopUpdating();
            if (this.backCallback) this.backCallback();
        };
    }

    setActiveTab(tab) {
        const validTab = ['display', 'audio', 'gameplay', 'reticle'].includes(tab) ? tab : 'display';
        this.activeTab = validTab;
        this.settingsMenu?.querySelectorAll?.('[data-settings-tab]').forEach(button => {
            const selected = button.dataset.settingsTab === validTab;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-selected', String(selected));
        });
        this.settingsMenu?.querySelectorAll?.('[data-settings-panel]').forEach(panel => {
            const selected = panel.dataset.settingsPanel === validTab;
            panel.hidden = !selected;
            panel.classList.toggle('is-active', selected);
        });
    }

    updateRasterControls() {
        const value = this.game.rasterScale;
        this.settingsMenu?.querySelector?.('#txt-rasterScale')?.replaceChildren(`${value}x`);
        this.settingsMenu?.querySelectorAll?.('[data-raster-scale]').forEach(button => {
            const selected = Number(button.dataset.rasterScale) === value;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-checked', String(selected));
        });
    }

    updateFullscreenLabel() {
        const button = this.settingsMenu?.querySelector?.('#btn-fullscreen');
        if (button) button.textContent = document.fullscreenElement ? 'exit fullscreen' : 'enter fullscreen';
    }

    async toggleFullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen?.();
            else await document.documentElement?.requestFullscreen?.();
        } catch (error) {
            console.warn('[Settings] Fullscreen request was rejected:', error);
        }
        this.updateFullscreenLabel();
    }

    resetToDefaults() {
        const defaults = this.defaults;
        this.game.cursorSettings = this.normalizeCursorSettings({
            shape: defaults.cursorShape,
            thickness: defaults.cursorThickness,
            length: defaults.cursorLength,
            gap: defaults.cursorGap,
            color: defaults.cursorColor,
            outline: defaults.cursorOutline
        });
        this.game.showDamageNumbers = defaults.showDamageNumbers;
        this.game.damageNumberMode = defaults.damageNumberMode;
        this.game.eyeCandy = defaults.eyeCandy;
        this.game.showFps = defaults.showFps;
        this.applyRasterScale(defaults.rasterScale);
        this.sliderStates.master.current = this.sliderStates.master.target = defaults.masterVolume * 100;
        this.sliderStates.music.current = this.sliderStates.music.target = defaults.musicVolume * 100;
        this.sliderStates.sfx.current = this.sliderStates.sfx.target = defaults.sfxVolume * 100;
        this.game.audio.setMasterVolume(defaults.masterVolume);
        this.game.audio.setMusicVolume(defaults.musicVolume);
        this.game.audio.setSfxVolume(defaults.sfxVolume);
        this.syncCursorSliderStates();
        this.saveCursorSettings();
        this.saveGameSettings();
    }

    createFloatySlider(id, label, startVal, min = 0, max = 100) {
        const pct = ((startVal - min) / (max - min)) * 100;
        return `
            <div class="setting-row" id="container-${id}">
                <div class="label-row"><span>${label}</span><span id="txt-${id}" class="val-display">${Math.round(startVal)}${max === 100 && min === 0 ? '%' : ''}</span></div>
                <div class="slider-outer"><div class="slider-track"></div><div id="fill-${id}" class="slider-fill" style="width: ${pct}%"></div><div id="thumb-${id}" class="slider-thumb" style="left: ${pct}%"></div><input type="range" id="rng-${id}" min="${min}" max="${max}" step="1" value="${startVal}" class="slider-input" aria-label="${label}"></div>
            </div>
        `;
    }

    updateSliderUI(id, value) {
        const input = this.settingsMenu?.querySelector?.(`#rng-${id}`);
        if (!input) return;
        const min = Number.parseInt(input.min, 10);
        const max = Number.parseInt(input.max, 10);
        const pct = ((value - min) / (max - min)) * 100;
        this.settingsMenu.querySelector(`#fill-${id}`)?.style.setProperty('width', `${pct}%`);
        this.settingsMenu.querySelector(`#thumb-${id}`)?.style.setProperty('left', `${pct}%`);
        const text = this.settingsMenu.querySelector(`#txt-${id}`);
        if (text) text.textContent = `${Math.round(value)}${max === 100 && min === 0 ? '%' : ''}`;
    }

    updateReticlePreview() {
        const preview = this.settingsMenu?.querySelector?.('#reticle-preview');
        if (!preview) return;
        const settings = this.game.cursorSettings;
        preview.dataset.shape = settings.shape;
        preview.style.setProperty('--reticle-color', settings.color);
        preview.style.setProperty('--reticle-thickness', `${settings.thickness}px`);
        preview.style.setProperty('--reticle-length', `${Math.max(8, settings.length * 1.25)}px`);
        preview.style.setProperty('--reticle-gap', `${Math.max(1, settings.gap / 2)}px`);
        preview.classList.toggle('has-outline', settings.outline);
    }
}
