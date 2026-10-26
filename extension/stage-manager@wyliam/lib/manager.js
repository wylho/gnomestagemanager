// SPDX-License-Identifier: GPL-3.0-or-later
// Controlador: liga o modelo (palco/tira) às janelas reais do mutter.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {_} from './i18n.js';
import {layoutAux, layoutSet} from './layout.js';
import {Stage, aux} from './model.js';
import * as Tiling from './tiling.js';
import {CenterResize, dirOf} from './centerresize.js';
import {WindowPicker} from './picker.js';
import {Strip} from './strip.js';
import {appKeyOf, classOf, isExcluded, isManageable, isMoveOp, isPip, isResizeOp, rootOf, setPipPatterns} from './windows.js';

const ALL_AT_ONCE = 1;
const LAYOUT_MOSAIC = 0;
const PIP_CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const STICKY = 'sticky';   // chave de palco dos monitores secundários quando as áreas de trabalho só existem no primário
const DRAG_POLL_MS = 60;

const HANDOFF_TIMEOUT_MS = 400;   // quanto esperar o mutter encerrar o arrasto antes de desistir da simetria

const rect = r => new Mtk.Rectangle({x: r.x, y: r.y, width: r.width, height: r.height});

export class StageManager {
    get active() { return this._started; }

    constructor(settings) {
        this._settings = settings;
        this._mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._started = false;
    }

    // ------------------------------------------------------------------ ciclo de vida

    start() {
        if (this._started)
            return;
        this._started = true;
        this._stages = new Map();      // Workspace -> Map(monitor -> Stage)
        this._setOf = new Map();       // Meta.Window -> StageSet
        this._tracked = new Map();     // Meta.Window -> [id...]
        this._hiddenByUs = new Set();  // janelas que NÓS minimizamos
        this._placed = new Set();      // janelas que o usuário posicionou à mão (não recentralizar)
        this._pipAspect = new Map();   // PiP -> proporção (largura/altura) do vídeo
        this._grabbing = false;        // há um arrasto/redimensionamento do usuário em andamento
        this._centerTimer = 0;
        this._centerResize = null;
        this._centerHandoff = 0;
        this._handoff = null;
        this._centerBudget = 6;        // correções automáticas seguidas (evita laço com apps teimosos)
        this._pending = new Set();     // timeouts de janelas novas esperando o título
        this._pref = new Map();        // Meta.Window -> tamanho que o usuário escolheu (antes de encolher p/ caber)
        this._conns = [];
        this._strips = new Map();      // monitor -> Strip atrás das janelas
        this._fronts = new Map();      // monitor -> Strip da frente (hover/arrasto)
        this._busy = 0;
        this._drag = null;
        this._dragTimer = 0;

        aux.is = isPip;
        this._applyPipSettings();
        const lm = Main.layoutManager;
        if (lm._startingUp) {
            this._startupId = lm.connect('startup-complete', () => {
                lm.disconnect(this._startupId);
                this._startupId = 0;
                this._boot();
            });
        } else {
            this._boot();
        }
    }

    stop() {
        if (!this._started)
            return;
        this._started = false;
        const lm = Main.layoutManager;
        if (this._startupId) {
            lm.disconnect(this._startupId);
            this._startupId = 0;
        }
        if (!this._stages)
            return;

        if (this._dragTimer)
            GLib.source_remove(this._dragTimer);
        this._dragTimer = 0;
        for (const id of this._pending)
            GLib.source_remove(id);
        this._pending.clear();
        if (this._centerTimer)
            GLib.source_remove(this._centerTimer);
        this._centerTimer = 0;
        if (this._centerHandoff)
            GLib.source_remove(this._centerHandoff);
        this._centerHandoff = 0;
        this._centerResize?.destroy();
        this._centerResize = null;
        this._handoff = null;
        this._keyboard = null;
        this._picker?.cancel();
        this._picker = null;
        aux.is = () => false;
        setPipPatterns([], false);

        // Devolve tudo como estava: só mexemos no que nós minimizamos.
        this._internal(() => {
            for (const w of this._hiddenByUs) {
                try {
                    if (w.minimized)
                        w.unminimize();
                } catch (_e) { /* janela já destruída */ }
            }
        });
        this._hiddenByUs.clear();

        for (const [obj, id] of this._conns)
            obj.disconnect(id);
        this._conns = [];
        for (const [win, ids] of this._tracked) {
            for (const id of ids)
                win.disconnect(id);
        }
        this._tracked.clear();
        this._eachStrip(s => s.destroy());
        this._strips.clear();
        this._fronts.clear();
        this._stages = null;
        this._setOf = null;
    }

    _boot() {
        if (!this._started)
            return;
        this._buildStrips();

        const d = global.display;
        this._on(d, 'notify::focus-window', () => this._onFocus());
        this._on(d, 'grab-op-begin', (_d, win, op) => this._onGrabBegin(win, op));
        this._on(d, 'grab-op-end', (_d, win, op) => this._onGrabEnd(win, op));
        this._on(d, 'in-fullscreen-changed', () => this._updateAllStripStates());
        this._on(d, 'window-entered-monitor', (_d, _monitor, win) => this._onEnteredMonitor(win));
        this._on(global.window_manager, 'map', (_wm, actor) => this._onMap(actor));
        this._on(global.workspace_manager, 'workspace-switched', () => this._refreshStrips());
        this._on(global.workspace_manager, 'workspace-removed', (_m, ws) => this._stages.delete(ws));
        this._on(Main.layoutManager, 'monitors-changed', () => {
            this._buildStrips();
            this._refreshStrips();
            this._updateAllStripStates();
        });
        this._on(Main.sessionMode, 'updated', () => this._updateAllStripStates());
        this._on(Main.overview, 'showing', () => this._eachStrip(s => s.setSessionHidden(true)));
        this._on(Main.overview, 'hiding', () => this._eachStrip(s => s.setSessionHidden(false)));
        this._on(global.stage, 'captured-event', (_s, ev) => this._onStageEvent(ev));
        for (const k of ['autotile', 'autotile-strip-always', 'autotile-margin', 'autotile-gap', 'show-recents', 'pip-enabled', 'pip-patterns', 'pip-corner', 'pip-max-width']) {
            this._on(this._settings, `changed::${k}`, () => {
                if (k === 'pip-enabled' || k === 'pip-patterns')
                    this._applyPipSettings();
                for (const st of this._allStages()) {
                    if (!(st.active && st.active.windows.length >= 1 && this._isCurrent(st)))
                        continue;
                    if (k === 'autotile')
                        st.active.tree = null;
                    if (k === 'pip-corner')
                        st.sets.forEach(x => { x.pipCorner = null; });
                    this._applyStripMode(st);
                    this._layoutSet(st.active);
                    this._sync(st, {focus: false});
                }
            });
        }
        this._on(this._mutter, 'changed::workspaces-only-on-primary', () => {
            this.stop();
            this.start();
        });
        this._on(this._settings, 'changed::excluded-classes', () => this._applyExclusions());
        for (const k of ['strip-side', 'thumbnail-width', 'max-recents'])
            this._on(this._settings, `changed::${k}`, () => this._refreshStrips());

        this._adoptExisting();
    }

    _on(obj, signal, fn) { this._conns.push([obj, obj.connect(signal, fn)]); }

    /** Executa `fn` marcando que as mudanças de janela são nossas, não do usuário. */
    _internal(fn) {
        this._busy++;
        try {
            return fn();
        } finally {
            this._busy--;
        }
    }

    // ------------------------------------------------------------------ modelo <-> janelas

    _onlyPrimary() { return this._mutter.get_boolean('workspaces-only-on-primary'); }

    /** Monitor secundário com áreas de trabalho só no primário: as janelas ali são fixas e ganham um palco único. */
    _isStickyMonitor(monitor) { return this._onlyPrimary() && monitor !== Main.layoutManager.primaryIndex; }

    /** Chave do "espaço" (área de trabalho) do palco visível neste monitor. */
    _wsKey(monitor) {
        return this._isStickyMonitor(monitor) ? STICKY : global.workspace_manager.get_active_workspace();
    }

    _eligible(win) {
        return isManageable(win, this._settings.get_strv('excluded-classes'), this._isStickyMonitor(this._monitorOf(win)));
    }

    _monitorOf(win) {
        const m = win.get_monitor();
        return m >= 0 ? m : Main.layoutManager.primaryIndex;
    }

    _stageFor(ws, monitor) {
        let per = this._stages.get(ws);
        if (!per) {
            per = new Map();
            this._stages.set(ws, per);
        }
        let st = per.get(monitor);
        if (!st) {
            st = new Stage(ws, monitor);
            per.set(monitor, st);
        }
        return st;
    }

    _stageForWindow(win) {
        const m = this._monitorOf(win);
        return this._stageFor(this._isStickyMonitor(m) ? STICKY : (win.get_workspace() ?? this._wsKey(m)), m);
    }

    _isCurrent(stage) {
        return stage.workspace === STICKY || stage.workspace === global.workspace_manager.get_active_workspace();
    }

    _stripOf(stage) { return this._strips.get(stage.monitor) ?? null; }
    _frontOf(stage) { return this._fronts.get(stage.monitor) ?? null; }
    _eachStrip(fn) { [...this._strips.values(), ...this._fronts.values()].forEach(fn); }

    _allStages() { return [...this._stages.values()].flatMap(m => [...m.values()]); }

    _track(win) {
        if (this._tracked.has(win))
            return;
        const ids = [
            win.connect('notify::minimized', () => this._onMinimizedChanged(win)),
            win.connect('notify::maximized-horizontally', () => this._onMaximizeChanged(win)),
            win.connect('notify::maximized-vertically', () => this._onMaximizeChanged(win)),
            win.connect('workspace-changed', () => this._onWorkspaceChanged(win)),
            win.connect('size-changed', () => this._onSizeChanged(win)),
            win.connect('position-changed', () => this._onPositionChanged(win)),
            win.connect('unmanaged', () => this._onGone(win)),
            win.connect('notify::title', () => this._onTitleChanged(win)),
        ];
        this._tracked.set(win, ids);
    }

    _untrack(win) {
        const ids = this._tracked.get(win);
        if (!ids)
            return;
        for (const id of ids)
            win.disconnect(id);
        this._tracked.delete(win);
    }

    /** Cria o conjunto da janela, respeitando o modo "todas de uma vez". Não coloca no palco. */
    _newSetFor(win, stage) {
        if (this._settings.get_enum('group-mode') === ALL_AT_ONCE) {
            const key = appKeyOf(win);
            const same = stage.sets.find(s => s.windows.some(w => appKeyOf(w) === key));
            if (same) {
                same.add(win);
                same.lastFocused = win;
                this._setOf.set(win, same);
                return same;
            }
        }
        const set = stage.newSet();
        set.add(win);
        set.lastFocused = win;
        this._setOf.set(win, set);
        return set;
    }

    _adoptExisting() {
        const display = global.display;
        const wsm = global.workspace_manager;
        const focus = display.focus_window ? rootOf(display.focus_window) : null;
        const seen = new Set();
        const byStage = new Map();

        for (let i = 0; i < wsm.get_n_workspaces(); i++) {
            const ws = wsm.get_workspace_by_index(i);
            for (const win of display.get_tab_list(Meta.TabList.NORMAL, ws)) {
                if (seen.has(win))
                    continue; // janela fixa aparece na lista de todas as áreas
                seen.add(win);
                if (!this._eligible(win))
                    continue;
                this._track(win);
                if (win.minimized)
                    continue; // minimizada pelo usuário: fica de fora até voltar
                const stage = this._stageForWindow(win);
                if (!byStage.has(stage))
                    byStage.set(stage, []);
                byStage.get(stage).push(win);
            }
        }
        for (const [stage, wins] of byStage) {
            const hasMain = wins.some(w => !isPip(w));
            const pipsHere = hasMain ? wins.filter(isPip) : [];
            for (const w of wins.filter(x => !pipsHere.includes(x))) {
                const s = this._newSetFor(w, stage);
                if (!stage.recents.includes(s))
                    stage.recents.push(s);
            }
            const active = stage.recents.find(s => focus && s.has(focus)) ?? stage.recents[0];
            stage.recents = stage.recents.filter(s => s !== active);
            stage.active = active;
            for (const p of pipsHere) {
                active.add(p);
                this._setOf.set(p, active);
            }
        }
        for (const stage of this._allStages())
            this._sync(stage, {focus: false, layout: true});
        this._refreshStrips();
    }

    // ------------------------------------------------------------------ esconder / mostrar

    _hide(win, slot) {
        if (win.minimized || !win.can_minimize())
            return;
        if (slot)
            win.set_icon_geometry(rect(slot));
        this._hiddenByUs.add(win);
        this._internal(() => win.minimize());
    }

    _show(win, from) {
        if (!win.minimized)
            return;
        if (from)
            win.set_icon_geometry(rect(from));
        this._internal(() => win.unminimize());
        this._hiddenByUs.delete(win);
    }

    // ---------- exceções (apps que o Organizador Visual ignora)

    /** Janela que o usuário escolheu ignorar: guarda a classe do app nas preferências. */
    excludeWindow(win) {
        const cls = win && classOf(win);
        if (!cls) {
            Main.notify(_('Stage Manager'), _('Could not identify the app of this window.'));
            return;
        }
        const list = this._settings.get_strv('excluded-classes');
        if (!list.includes(cls))
            this._settings.set_strv('excluded-classes', [...list, cls]);
        this._osd(_('Ignoring: %s').format(cls));
    }

    /** Atalho: alterna entre ignorar e gerenciar o aplicativo da janela em foco. */
    toggleException() {
        const win = global.display.focus_window;
        const cls = win && classOf(win);
        if (!cls)
            return;
        const list = this._settings.get_strv('excluded-classes');
        if (list.includes(cls)) {
            this._settings.set_strv('excluded-classes', list.filter(c => c !== cls));
            this._osd(_('Managed again: %s').format(cls));
        } else {
            this.excludeWindow(win);
        }
    }

    /** Abre o seletor: clicar numa janela (ou miniatura da tira) a coloca nas exceções. */
    pickException() {
        if (this._picker)
            return;
        const itemAt = (x, y, rectOnly = false) => {
            for (const s of [...this._fronts.values(), ...this._strips.values()]) {
                const hit = s.itemAt(x, y, rectOnly);
                if (hit)
                    return hit;
            }
            return null;
        };
        this._picker = new WindowPicker(itemAt, win => {
            this._picker = null;
            if (win)
                this.excludeWindow(win);
        });
    }

    _osd(text) {
        Main.osdWindowManager.showAll(Gio.ThemedIcon.new('view-grid-symbolic'), text, null);
    }

    /** A lista de exceções mudou: solta o que passou a ser ignorado e passa a gerenciar o que deixou de ser. */
    _applyExclusions() {
        if (!this._stages)
            return;
        const excl = this._settings.get_strv('excluded-classes');
        for (const win of [...this._setOf.keys()]) {
            if (isExcluded(win, excl))
                this._release(win);
        }
        for (const a of global.get_window_actors()) {
            const win = a.meta_window;
            if (!this._setOf.has(win) && !win.minimized && this._eligible(win))
                this._classifyNew(win);
        }
    }

    /** Tira a janela do Organizador Visual sem fechá-la (e a traz de volta se estava na tira). */
    _release(win) {
        this._untrack(win);
        this._hiddenByUs.delete(win);
        this._pref.delete(win);
        this._placed.delete(win);
        this._pipAspect.delete(win);
        const r = this._removeFromModel(win);
        if (win.minimized)
            this._internal(() => win.unminimize());
        if (!r)
            return;
        if (r.wasActive && r.emptied && r.stage.recents[0])
            this.activateSet(r.stage.recents[0], {focus: false});
        else
            this._sync(r.stage, {focus: false, layout: r.wasActive});
    }

    // ---------- Picture-in-Picture

    _applyPipSettings() {
        setPipPatterns(this._settings.get_strv('pip-patterns'), this._settings.get_boolean('pip-enabled'));
    }

    _pipAspectOf(win) {
        let a = this._pipAspect.get(win);
        if (!a) {
            const sz = this._pref.get(win) ?? (() => {
                const r = win.get_frame_rect();
                return {width: r.width, height: r.height};
            })();
            a = sz.width / Math.max(1, sz.height);
            this._pipAspect.set(win, a);
        }
        return a;
    }

    _pipCorner(set) {
        return set.pipCorner ?? PIP_CORNERS[this._settings.get_enum('pip-corner')];
    }

    /** O PiP entra no grupo do palco (fica visível só nele e some junto), sem tomar o foco. */
    _joinPip(win, set) {
        set.add(win);
        this._setOf.set(win, set);
        this._sync(set.stage, {focus: false, layout: true});
    }

    /** Retângulos de mosaico/centralização para o conjunto, sem mexer nas janelas. */
    _computeLayout(set, pinWin = null) {
        const stage = set.stage;
        const area = Main.layoutManager.getWorkAreaForMonitor(stage.monitor);
        const movable = set.windows.filter(w => !w.is_maximized() && !w.is_fullscreen() && w.allows_move());
        let pips = movable.filter(isPip);
        let mains = movable.filter(w => !isPip(w));
        if (!mains.length) {
            mains = movable; // só há PiP no conjunto: trata como janela comum
            pips = [];
        }
        const sizeOf = w => this._pref.get(w) ?? (() => {
            const r = w.get_frame_rect();
            return {width: r.width, height: r.height};
        })();
        const tiling = this._tilingActive(set);
        const strip = this._stripOf(stage);
        const res = tiling && strip ? strip.reservedSpace() : {left: true, width: 0};
        const m = tiling ? this._settings.get_int('autotile-margin') : 24;
        const gap = tiling ? this._settings.get_int('autotile-gap') : 16;

        // Área útil, menos a tira (só no autotiling, que a deixa à mostra).
        let base = {x: area.x + (res.left ? res.width : 0), y: area.y, width: area.width - res.width, height: area.height};

        // PiP: só a largura entra no tiling; altura pela proporção, num canto.
        let pipRects = [];
        if (pips.length) {
            const col = layoutAux(base, pips.map(w => ({width: sizeOf(w).width, aspect: this._pipAspectOf(w)})), {
                corner: this._pipCorner(set),
                maxFrac: this._settings.get_int('pip-max-width') / 100,
                gap, margin: m, innerMargin: tiling ? m : 24,
            });
            pipRects = col.rects;
            base = col.rest;
        }

        const wins = [...mains, ...pips];
        const sizes = wins.map(sizeOf);
        if (tiling && mains.length >= 1) {
            // Autotiling: as janelas preenchem a área restante.
            const rect = {
                x: base.x + m,
                y: base.y + m,
                width: Math.max(1, base.width - 2 * m),
                height: Math.max(1, base.height - 2 * m),
            };
            this._syncTree(set, mains);
            const map = Tiling.layoutTree(set.tree, rect, gap);
            return {wins, sizes, rects: [...mains.map(w => map.get(w)), ...pipRects], tiled: true, map, reserved: res.width, mainCount: mains.length};
        }
        // A mestre fica do lado em que já estava, para as janelas não trocarem de lado.
        const pinRight = pinWin ? (() => { const r = pinWin.get_frame_rect(); return r.x + r.width / 2 > area.x + area.width / 2; })() : false;
        const pinIdx = pinWin ? mains.indexOf(pinWin) : -1;
        const rects = layoutSet(base, mains.map(sizeOf), pinIdx >= 0 ? {pin: pinIdx, pinRight} : {});
        return {wins, sizes, rects: [...rects, ...pipRects], mainCount: mains.length};
    }

    _layoutSet(set, pinWin = null) {
        const {wins, sizes, rects, tiled, map, reserved} = this._computeLayout(set, pinWin);
        if (!wins.length)
            return;
        if (tiled) {
            this._internal(() => wins.forEach((w, i) => {
                const r = rects[i];
                const cur = w.get_frame_rect();
                this._placed.delete(w);
                if (!this._pref.has(w))
                    this._pref.set(w, {width: cur.width, height: cur.height}); // tamanho natural, para quando sair do grupo
                if (cur.width !== r.width || cur.height !== r.height)
                    w.move_resize_frame(false, r.x, r.y, r.width, r.height);
                else
                    w.move_frame(false, r.x, r.y);
            }));
            set.tileRects = map;
            set.tileReserved = reserved;
            set.arranged = true;
            return;
        }
        this._internal(() => wins.forEach((w, i) => {
            const r = rects[i];
            const cur = w.get_frame_rect();
            this._placed.delete(w); // agora é a extensão que posiciona
            if (r.width !== sizes[i].width || r.height !== sizes[i].height) {
                if (!this._pref.has(w))
                    this._pref.set(w, {width: sizes[i].width, height: sizes[i].height});
            } else {
                this._pref.delete(w);
            }
            if (cur.width !== r.width || cur.height !== r.height)
                w.move_resize_frame(false, r.x, r.y, r.width, r.height);
            else
                w.move_frame(false, r.x, r.y);
        }));
        set.arranged = true;
    }

    // ---------- redimensionar a partir do centro (Alt)

    /**
     * Redimensionar com o mouse segurando Alt: a janela cresce/encolhe dos dois lados, mantendo o centro (como a
     * tecla Option no macOS). O mutter começa o arrasto normalmente e não deixa ninguém mudar a conta dele, nem
     * encerrá-lo por API; então cancelamos o arrasto com um Esc virtual (a janela volta ao tamanho inicial) e,
     * quando o mutter avisa que terminou, o gesto passa para CenterResize. Só vale fora do autotiling.
     * Devolve true quando assumiu o gesto.
     */
    _beginCenterResize(win, op) {
        const dir = dirOf(op);
        if (!dir || this._centerResize || this._handoff || !this._settings.get_boolean('resize-from-center'))
            return false;
        const [px, py, mods] = global.get_pointer();
        if (!(mods & Clutter.ModifierType.MOD1_MASK))
            return false;
        const base = rootOf(win);
        const set = this._setOf.get(base);
        if (!set || set.stage.active !== set || base !== win || isPip(base) || this._tilingActive(set) ||
            base.is_maximized() || base.is_fullscreen())
            return false;
        this._handoff = {
            win: base, set, dir, pointer: [px, py], start: base.get_frame_rect(),
            area: Main.layoutManager.getWorkAreaForMonitor(this._monitorOf(base)),
        };
        // Cancelar dentro do sinal que iniciou o arrasto é frágil: espera o mutter terminar de começá-lo.
        this._centerHandoff = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._centerHandoff = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HANDOFF_TIMEOUT_MS, () => {
                this._centerHandoff = 0;
                this._handoff = null; // o mutter não encerrou o arrasto: ele segue valendo, sem simetria
                return GLib.SOURCE_REMOVE;
            });
            this._pressEscape();
            return GLib.SOURCE_REMOVE;
        });
        return true;
    }

    _pressEscape() {
        this._keyboard ??= global.stage.context.get_backend().get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const t = GLib.get_monotonic_time();
        this._keyboard.notify_keyval(t, Clutter.KEY_Escape, Clutter.KeyState.PRESSED);
        this._keyboard.notify_keyval(t + 1000, Clutter.KEY_Escape, Clutter.KeyState.RELEASED);
    }

    /** O mutter acabou de cancelar o arrasto que Alt iniciou: agora o gesto é nosso. */
    _startCenterResize() {
        const h = this._handoff;
        this._handoff = null;
        if (this._centerHandoff)
            GLib.source_remove(this._centerHandoff);
        this._centerHandoff = 0;
        if (!h.win.get_compositor_private() || h.win.is_maximized())
            return;
        this._grabbing = true;
        this._centerResize = new CenterResize(h.win, h.dir, h.start, h.pointer, h.area, (w, cancelled) => {
            this._centerResize = null;
            this._grabbing = false;
            this._centerBudget = 6;
            if (cancelled)
                this._layoutSet(h.set);
            else
                this._afterUserResize(w);
        });
        if (!this._centerResize.running) {
            this._centerResize = null;
            this._grabbing = false;
        }
    }

    /** Janela que o usuário moveu à mão e que deve ficar onde está. */
    _lockCenter() { return this._settings.get_boolean('lock-center'); }

    _isPlaced(win) {
        return !this._lockCenter() && this._placed.has(win) && this._settings.get_boolean('remember-position');
    }

    /**
     * "Sempre centralizada": se o próprio app (ou qualquer um) mexeu na posição fora de um arrasto nosso,
     * confere em seguida e recentraliza. Só posição, para não brigar com apps que têm tamanho mínimo.
     */
    _scheduleCenterCheck(set) {
        if (!this._lockCenter() || this._grabbing || this._busy || set.stage.active !== set || this._tilingActive(set))
            return;
        if (this._centerTimer || this._centerBudget <= 0)
            return;
        this._centerTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            this._centerTimer = 0;
            if (!this._stages || this._grabbing || set.stage.active !== set || !this._lockCenter())
                return GLib.SOURCE_REMOVE;
            const {wins, rects} = this._computeLayout(set);
            const off = wins.some((w, i) => {
                const r = w.get_frame_rect();
                return Math.abs(r.x - rects[i].x) > 2 || Math.abs(r.y - rects[i].y) > 2;
            });
            if (off) {
                this._centerBudget--;
                this._layoutSet(set);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _tilingActive(set) { return this._settings.get_boolean('autotile') && set.windows.length >= 1; }

    /** Mantém a árvore de autotiling igual às janelas do conjunto (entram junto da que estava em foco). */
    _syncTree(set, wins) {
        for (const w of Tiling.leaves(set.tree)) {
            if (!wins.includes(w))
                set.tree = Tiling.removeLeaf(set.tree, w);
        }
        for (const w of wins) {
            if (!Tiling.leaves(set.tree).includes(w))
                set.tree = Tiling.insertLeaf(set.tree, w, wins.includes(set.lastFocused) ? set.lastFocused : null);
        }
    }

    _isMosaic() { return this._settings.get_enum('group-layout') === LAYOUT_MOSAIC; }

    /** Soltou uma janela do grupo: sobre outra posição do mosaico, troca de lugar; fora do grupo, fica livre. */
    _reorderByDrop(set, win) {
        const {wins, rects, tiled, mainCount} = this._computeLayout(set);
        const idx = wins.indexOf(win);
        if (idx < 0 || idx >= mainCount)
            return;
        if (tiled) {
            // Autotiling: soltou sobre a célula de outra janela? Troca as duas. Sempre volta para a célula.
            const [qx, qy] = global.get_pointer();
            const j = rects.slice(0, mainCount).findIndex(r => qx >= r.x && qx <= r.x + r.width && qy >= r.y && qy <= r.y + r.height);
            if (j >= 0 && j !== idx)
                Tiling.swapLeaves(set.tree, win, wins[j]);
            this._layoutSet(set);
            return;
        }
        const [px, py] = global.get_pointer();
        const pad = 80;
        const mr = rects.slice(0, mainCount);
        const x0 = Math.min(...mr.map(r => r.x)) - pad;
        const x1 = Math.max(...mr.map(r => r.x + r.width)) + pad;
        const y0 = Math.min(...mr.map(r => r.y)) - pad;
        const y1 = Math.max(...mr.map(r => r.y + r.height)) + pad;
        if (px < x0 || px > x1 || py < y0 || py > y1) {
            if (this._lockCenter())
                this._layoutSet(set);
            else
                set.arranged = true; // largou longe do grupo: posição livre
            return;
        }
        let j = idx;
        let bestD = Infinity;
        mr.forEach((r, k) => {
            const d = Math.hypot(px - (r.x + r.width / 2), py - (r.y + r.height / 2));
            if (d < bestD) {
                bestD = d;
                j = k;
            }
        });
        if (j !== idx) {
            const target = wins[j];
            set.windows.splice(set.windows.indexOf(win), 1);
            set.windows.splice(set.windows.indexOf(target) + (j > idx ? 1 : 0), 0, win);
        }
        this._layoutSet(set);
    }

    /** Atalho: refaz o mosaico do grupo do palco. */
    arrangeGroup(monitor = null) {
        const stage = monitor === null ? this._pointerStage() : this._currentStage(monitor);
        const set = stage.active;
        if (!set)
            return;
        for (const w of set.windows)
            this._pref.delete(w);
        this._layoutSet(set);
    }

    /**
     * Reconcilia as janelas com o modelo: tudo que está na tira fica minimizado (voando até o
     * seu item), o conjunto do palco aparece, centralizado se `layout`.
     */
    _sync(stage, {focus = true, layout = false, showFrom = null} = {}) {
        const current = this._isCurrent(stage);
        const strip = this._stripOf(stage);
        const front = this._frontOf(stage);
        if (strip && current) {
            strip.setStage(stage);
            front?.setStage(stage);
        }
        this._applyStripMode(stage);
        const slots = strip && current ? strip.currentSlots() : null;

        stage.recents.forEach((set, i) => {
            const slot = slots ? (slots.rects[i] ?? strip.overflowSlot()) : null;
            for (const w of set.windows)
                this._hide(w, slot);
        });

        const act = stage.active;
        if (act) {
            // Autotiling: a largura reservada para a tira muda quando entra/sai item dela.
            const stale = this._tilingActive(act) && act.tileReserved !== (strip ? strip.reservedSpace().width : 0);
            if (layout || stale)
                this._layoutSet(act);
            for (const w of act.windows)
                this._show(w, showFrom);
            this._raiseSet(act, focus);
        }

        if (strip && current) {
            strip.refresh();
            front?.refresh();
            this._updateStripState(stage);
        }
    }

    _raiseSet(set, focus) {
        const top = set.top;
        this._internal(() => {
            for (const w of set.windows) {
                if (w !== top)
                    w.raise();
            }
            top?.raise();
            if (focus && top)
                top.activate(global.get_current_time());
            for (const w of set.windows) {
                if (isPip(w) && w !== top)
                    w.raise(); // o PiP fica por cima, sem tomar o foco
            }
        });
    }

    /** Regra da tira para o palco: com um grupo em autotiling ela fica sempre visível ou escondida, conforme a opção. */
    _applyStripMode(stage) {
        const act = stage.active;
        const mode = act && this._tilingActive(act)
            ? (this._settings.get_boolean('autotile-strip-always') ? 'always' : 'hidden')
            : null;
        this._stripOf(stage)?.setMode(mode);
        this._frontOf(stage)?.setMode(mode);
    }

    _updateStripState(stage) {
        const strip = this._stripOf(stage);
        if (!strip || !this._isCurrent(stage))
            return;
        const act = stage.active;
        const covers = w => !w.minimized && (w.is_maximized() || w.is_fullscreen() || strip.coversBox(w.get_frame_rect()));
        const isCovered = !!act && act.windows.some(covers);
        strip.setCovered(isCovered);
        this._frontOf(stage)?.setCovered(isCovered);
    }

    _updateAllStripStates() {
        for (const [monitor, strip] of this._strips) {
            const fs = global.display.get_monitor_in_fullscreen(monitor) || Main.sessionMode.isLocked;
            strip.setFullscreen(fs);
            this._fronts.get(monitor)?.setFullscreen(fs);
        }
        this._allStages().forEach(s => this._updateStripState(s));
    }

    _buildStrips() {
        this._eachStrip(s => s.destroy());
        this._strips.clear();
        this._fronts.clear();
        Main.layoutManager.monitors.forEach((_m, i) => {
            this._strips.set(i, new Strip(this, this._settings, i, false));
            this._fronts.set(i, new Strip(this, this._settings, i, true));
        });
    }

    _refreshStrips() {
        if (!this._stages)
            return;
        for (const [monitor, strip] of this._strips) {
            const stage = this._stageFor(this._wsKey(monitor), monitor);
            strip.setStage(stage);
            strip.refresh();
            this._fronts.get(monitor)?.setStage(stage);
            this._fronts.get(monitor)?.refresh();
            this._updateStripState(stage);
        }
    }

    // ------------------------------------------------------------------ ações públicas

    activateSet(set, {focus = true} = {}) {
        const stage = set.stage;
        if (stage.active === set) {
            if (focus)
                this._raiseSet(set, true);
            return;
        }
        const strip = this._stripOf(stage);
        const from = strip && this._isCurrent(stage) ? strip.slotRect(set) : null;
        stage.activate(set);
        const layout = this._tilingActive(set) ||
            (set.windows.length === 1
                ? this._settings.get_boolean('always-center') && !this._isPlaced(set.windows[0])
                : !set.arranged);
        this._sync(stage, {focus, layout, showFrom: from});
    }

    onItemClicked(set, {shift}) {
        if (shift)
            this.addSetToStage(set);
        else
            this.activateSet(set);
    }

    /** Junta um conjunto da tira ao que está no palco. */
    addSetToStage(set) {
        const stage = set.stage;
        if (stage.active === set)
            return;
        if (!stage.active) {
            this.activateSet(set);
            return;
        }
        const strip = this._stripOf(stage);
        const from = strip && this._isCurrent(stage) ? strip.slotRect(set) : null;
        const moved = [...set.windows];
        const merged = stage.mergeIntoActive(set);
        for (const w of moved)
            this._setOf.set(w, merged);
        merged.lastFocused = moved.at(-1);
        this._sync(stage, {focus: true, layout: true, showFrom: from});
    }

    /** Atalho: conjunto mais recente da tira entra no palco (trocando). */
    switchToRecent() {
        const stage = this._pointerStage();
        const next = stage?.recents[0];
        if (next)
            this.activateSet(next);
    }

    /** Atalho: conjunto mais recente da tira entra junto com o do palco. */
    addRecentToStage() {
        const stage = this._pointerStage();
        const next = stage?.recents[0];
        if (next)
            this.addSetToStage(next);
    }

    // ---------- ações do menu de contexto da tira

    isStickyMonitor(monitor) { return this._isStickyMonitor(monitor); }

    /** Traz só uma janela de um conjunto com várias: ela vira conjunto próprio e vai ao palco. */
    activateWindowOnly(set, win) {
        if (set.windows.length < 2) {
            this.activateSet(set);
            return;
        }
        const n = set.stage.detach(win);
        this._setOf.set(win, n);
        this.activateSet(n);
    }

    /** Separa as janelas de um conjunto da tira, cada uma no seu item. */
    splitSet(set) {
        const stage = set.stage;
        for (const w of set.windows.slice(1)) {
            const n = stage.detach(w);
            this._setOf.set(w, n);
        }
        this._sync(stage, {focus: false});
    }

    closeSet(set) {
        const t = global.get_current_time();
        for (const w of [...set.windows])
            w.delete(t);
    }

    /** Move um conjunto da tira para a tira de outro monitor (centralizando as janelas lá). */
    moveSetToMonitor(set, monitor) {
        const from = set.stage;
        const to = this._currentStage(monitor);
        if (from === to)
            return;
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor);
        from.removeSet(set);
        set.stage = to;
        set.arranged = false;
        to.recents.unshift(set);
        this._internal(() => set.windows.forEach(w => {
            const r = w.get_frame_rect();
            w.move_frame(true, area.x + Math.round((area.width - r.width) / 2), area.y + Math.round((area.height - r.height) / 2));
        }));
        this._sync(from, {focus: false});
        this._sync(to, {focus: false});
    }

    /** Move um conjunto da tira para a tira de outra área de trabalho. */
    moveSetToWorkspace(set, index) {
        const ws = global.workspace_manager.get_workspace_by_index(index);
        const from = set.stage;
        if (!ws || from.workspace === ws || this._isStickyMonitor(from.monitor))
            return;
        const to = this._stageFor(ws, from.monitor);
        from.removeSet(set);
        set.stage = to;
        to.recents.unshift(set);
        this._internal(() => set.windows.forEach(w => w.change_workspace(ws)));
        this._sync(from, {focus: false});
        this._sync(to, {focus: false});
    }

    /** Atalho: tira a janela em foco do conjunto; se era a única, esvazia o palco. */
    removeFocusedFromStage() {
        const fw = global.display.focus_window;
        const win = fw ? rootOf(fw) : null;
        const set = win && this._setOf.get(win);
        if (!set || set.stage.active !== set)
            return;
        const stage = set.stage;
        if (set.windows.length > 1) {
            const n = stage.detach(win);
            this._setOf.set(win, n);
        } else {
            stage.sendActiveToStrip();
        }
        this._sync(stage, {focus: true, layout: true});
    }

    /** Mostrar a área de trabalho: manda o palco para a tira; de novo, traz de volta. */
    toggleReveal(monitor = null) {
        const stage = this._currentStage(monitor ?? Main.layoutManager.primaryIndex);
        if (stage.active) {
            stage.sendActiveToStrip();
            this._sync(stage, {focus: false});
        } else {
            const back = stage.restoreSet ?? stage.recents[0];
            if (back)
                this.activateSet(back);
        }
    }

    _currentStage(monitor) {
        return this._stageFor(this._wsKey(monitor), monitor);
    }

    _pointerStage() {
        const [x, y] = global.get_pointer();
        const m = global.display.get_monitor_index_for_rect(new Mtk.Rectangle({x, y, width: 1, height: 1}));
        return this._currentStage(m >= 0 ? m : Main.layoutManager.primaryIndex);
    }

    // ------------------------------------------------------------------ eventos

    _onMap(actor) {
        const win = actor.meta_window;
        if (!win || this._setOf.has(win))
            return;
        if (!win.get_title()) {
            // Título ainda não chegou: espera um instante para saber se é um PiP.
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                this._pending.delete(id);
                if (this._stages && win.get_compositor_private())
                    this._classifyNew(win);
                return GLib.SOURCE_REMOVE;
            });
            this._pending.add(id);
            return;
        }
        this._classifyNew(win);
    }

    _classifyNew(win) {
        if (!this._stages || this._setOf.has(win) || !this._eligible(win))
            return;
        this._track(win);
        const stage = this._stageForWindow(win);
        if (isPip(win) && stage.active) {
            this._joinPip(win, stage.active);
            return;
        }
        const set = this._newSetFor(win, stage);
        if (stage.active === set)
            this._sync(stage, {layout: true});
        else
            this.activateSet(set);
    }

    /** O título virou "Picture-in-Picture" depois de a janela abrir: desfaz o palco próprio e junta ao grupo atual. */
    _onTitleChanged(win) {
        if (this._busy || !this._stages || !isPip(win))
            return;
        const own = this._setOf.get(win);
        if (!own || own.windows.length !== 1)
            return;
        const stage = own.stage;
        const wasActive = stage.active === own;
        const prev = wasActive ? stage.recents[0] : stage.active;
        if (!prev || prev === own)
            return;
        this._removeFromModel(win);
        if (wasActive)
            this.activateSet(prev, {focus: false});
        this._joinPip(win, prev);
    }

    /** Tira a janela do modelo. @returns {{stage, wasActive, emptied}|null} */
    _removeFromModel(win) {
        const set = this._setOf.get(win);
        this._setOf.delete(win);
        if (!set)
            return null;
        const stage = set.stage;
        const wasActive = stage.active === set;
        const res = stage.removeWindow(win);
        if (!res) {
            // Conjunto novo que nunca entrou nas listas.
            set.remove(win);
            return null;
        }
        return {stage, wasActive, emptied: res.emptied};
    }

    /**
     * A janela deixou de existir. Usamos `unmanaged` da própria janela: o `destroy` do Shell não
     * dispara para janelas minimizadas (as que estão na tira).
     */
    _onGone(win) {
        if (!this._stages)
            return;
        this._untrack(win);
        this._hiddenByUs.delete(win);
        this._pref.delete(win);
        this._placed.delete(win);
        this._pipAspect.delete(win);
        const r = this._removeFromModel(win);
        if (!r)
            return;
        const {stage, wasActive, emptied} = r;
        if (wasActive && emptied) {
            const next = stage.recents[0];
            if (next)
                this.activateSet(next);
            else
                this._sync(stage, {focus: false});
        } else {
            this._sync(stage, {focus: false, layout: wasActive});
        }
    }

    _onFocus() {
        if (this._busy || !this._started || !this._stages)
            return;
        const fw = global.display.focus_window;
        if (!fw)
            return;
        const win = rootOf(fw);
        if (!this._eligible(win))
            return;
        let set = this._setOf.get(win);
        if (!set) {
            this._track(win);
            set = this._newSetFor(win, this._stageForWindow(win));
        }
        if (!isPip(win))
            set.lastFocused = win;
        if (set.stage.active !== set)
            this.activateSet(set, {focus: false});
    }

    _onMinimizedChanged(win) {
        if (this._busy || !this._stages)
            return;
        const set = this._setOf.get(win);
        if (!set) {
            if (!win.minimized && this._eligible(win)) {
                const s = this._newSetFor(win, this._stageForWindow(win));
                this.activateSet(s, {focus: false});
            }
            return;
        }
        const stage = set.stage;
        if (win.minimized) {
            // O usuário minimizou: a janela vai para a tira.
            if (stage.active !== set)
                return;
            if (set.windows.length > 1) {
                const n = stage.detach(win);
                this._setOf.set(win, n);
            } else {
                stage.sendActiveToStrip();
            }
            this._sync(stage, {focus: false, layout: true});
        } else if (stage.active !== set) {
            this.activateSet(set, {focus: false});
        }
    }

    /** Janela movida para outro monitor sem arrasto (atalho de teclado, API): muda de palco. */
    _onEnteredMonitor(win) {
        if (this._drag || this._busy || !this._stages)
            return;
        const set = this._setOf.get(win);
        if (set && set.stage.active === set && this._monitorOf(win) !== set.stage.monitor)
            this._onWorkspaceMonitorMoved(win);
    }

    _onMaximizeChanged(win) {
        const set = this._setOf.get(win);
        if (set)
            this._updateStripState(set.stage);
    }

    _onPositionChanged(win) {
        const set = this._setOf.get(win);
        if (!set || set.stage.active !== set || this._busy)
            return;
        this._updateStripState(set.stage);
        this._scheduleCenterCheck(set);
    }

    _onSizeChanged(win) {
        const set = this._setOf.get(win);
        if (set && set.stage.active === set && !this._busy) {
            this._updateStripState(set.stage);
            this._scheduleCenterCheck(set);
        }
        if (!set || set.stage.active === set || this._busy)
            return;
        const strip = this._stripOf(set.stage);
        if (strip && this._isCurrent(set.stage)) {
            strip.refresh();
            this._frontOf(set.stage)?.refresh();
        }
    }

    _onWorkspaceChanged(win) {
        if (this._busy || !this._stages)
            return;
        const set = this._setOf.get(win);
        if (!set || set.stage.workspace === STICKY || set.stage.workspace === win.get_workspace())
            return;
        const r = this._removeFromModel(win);
        if (r) {
            if (r.wasActive && r.emptied && r.stage.recents[0])
                this.activateSet(r.stage.recents[0]);
            else
                this._sync(r.stage, {focus: false, layout: r.wasActive});
        }
        if (win.get_workspace() && this._eligible(win)) {
            const stage = this._stageForWindow(win);
            this.activateSet(this._newSetFor(win, stage));
        }
    }

    // ------------------------------------------------------------------ arrastar / redimensionar janelas

    _onGrabBegin(win, op) {
        if (!this._stages || !win)
            return;
        this._grabbing = true;
        if (isResizeOp(op) && this._beginCenterResize(win, op))
            return;
        if (!isMoveOp(op))
            return;
        const base = rootOf(win);
        const set = this._setOf.get(base);
        if (!set)
            return;
        this._drag = {win: base, set, multi: set.windows.length > 1 && set.stage.active === set};
        this._dragTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DRAG_POLL_MS, () => {
            this._pollDrag();
            return GLib.SOURCE_CONTINUE;
        });
        this._pollDrag();
    }

    _pollDrag() {
        const d = this._drag;
        if (!d)
            return;
        const strip = this._frontOf(d.set.stage);
        if (!strip)
            return;
        const [x, y] = global.get_pointer();
        strip.setWindowDrag({multi: d.multi, over: strip.containsPoint(x, y)});
    }

    _onGrabEnd(win, op) {
        if (!this._stages || !win)
            return;
        this._grabbing = false;
        if (this._handoff) { // cancelado por nós para passar o gesto ao CenterResize
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this._handoff && this._stages)
                    this._startCenterResize();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }
        this._centerBudget = 6; // o usuário agiu: renova o crédito de correções automáticas
        const d = this._drag;
        if (d && rootOf(win) === d.win) {
            if (this._dragTimer)
                GLib.source_remove(this._dragTimer);
            this._dragTimer = 0;
            this._drag = null;
            this._placed.add(d.win); // arrastou: a posição passa a ser dele
            const stage = d.set.stage;
            const strip = this._frontOf(stage);
            const [x, y] = global.get_pointer();
            const dropped = !!strip && d.multi && strip.containsPoint(x, y);
            strip?.setWindowDrag(null);
            if (dropped && stage.active === d.set && d.set.windows.length > 1) {
                const n = stage.detach(d.win);
                this._setOf.set(d.win, n);
                this._sync(stage, {focus: true, layout: true});
            } else if (isPip(d.win) && stage.active === d.set && d.set.windows.some(w => !isPip(w))) {
                this._dropPip(d.set, d.win);
            } else if (this._monitorOf(d.win) !== stage.monitor) {
                this._onWorkspaceMonitorMoved(d.win);
            } else if (stage.active === d.set && this._tilingActive(d.set)) {
                this._reorderByDrop(d.set, d.win); // autotiling: troca de célula ou volta para a própria
            } else if (d.multi && stage.active === d.set && (this._isMosaic() || this._lockCenter())) {
                this._reorderByDrop(d.set, d.win);
            } else if (!d.multi && stage.active === d.set && this._lockCenter()) {
                this._layoutSet(d.set); // sempre centralizada: volta ao centro assim que solta
            }
            return;
        }
        if (isResizeOp(op))
            this._afterUserResize(win);
    }

    /** O usuário terminou de redimensionar `win` (arrasto do mutter ou Alt a partir do centro): ajusta o resto do palco. */
    _afterUserResize(win) {
        const base = rootOf(win);
        const set = this._setOf.get(base);
        if (!set || set.stage.active !== set || base.is_maximized() || base.is_fullscreen()) {
            this._pref.delete(base);
            return;
        }
        if (isPip(base) && set.windows.some(w => !isPip(w))) {
            // PiP redimensionado: nova largura/proporção; a coluna e as outras janelas se ajustam.
            const r = base.get_frame_rect();
            this._pref.set(base, {width: r.width, height: r.height});
            this._pipAspect.set(base, r.width / Math.max(1, r.height));
            this._layoutSet(set);
            return;
        }
        if (set.windows.length === 1 && !this._tilingActive(set)) {
            this._pref.delete(base); // o usuário escolheu este tamanho
            if (this._lockCenter() || (this._settings.get_boolean('recenter-after-resize') && !this._isPlaced(base)))
                this._layoutSet(set); // recentraliza (sempre, se "manter centralizada"; senão só se não posicionada à mão)
        } else if (this._tilingActive(set)) {
            // Autotiling: o divisor acompanha a borda que o usuário puxou; as vizinhas se acomodam.
            const old = set.tileRects?.get(base);
            if (old)
                Tiling.adjustForResize(set.tree, base, old, base.get_frame_rect(), this._settings.get_int('autotile-gap'));
            this._layoutSet(set);
        } else if (this._isMosaic() || this._lockCenter()) {
            // Autoajuste: a janela redimensionada FICA com o tamanho pedido e as vizinhas cedem.
            const r = base.get_frame_rect();
            this._pref.set(base, {width: r.width, height: r.height});
            this._layoutSet(set, base);
        } else {
            this._pref.delete(base);
        }
    }

    /** Soltou o PiP: ele vai para o canto mais próximo do ponteiro e o resto se reorganiza. */
    _dropPip(set, win) {
        const area = Main.layoutManager.getWorkAreaForMonitor(set.stage.monitor);
        const [px, py] = global.get_pointer();
        const right = px > area.x + area.width / 2;
        const bottom = py > area.y + area.height / 2;
        set.pipCorner = `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`;
        this._placed.delete(win);
        this._layoutSet(set);
    }

    /** A janela foi arrastada para outro monitor: passa a viver no palco de lá. */
    _onWorkspaceMonitorMoved(win) {
        const r = this._removeFromModel(win);
        if (r) {
            if (r.wasActive && r.emptied && r.stage.recents[0])
                this.activateSet(r.stage.recents[0]);
            else
                this._sync(r.stage, {focus: false, layout: r.wasActive});
        }
        if (this._eligible(win))
            this.activateSet(this._newSetFor(win, this._stageForWindow(win)));
    }

    // ------------------------------------------------------------------ clique no papel de parede

    _onStageEvent(ev) {
        if (ev.type() !== Clutter.EventType.BUTTON_PRESS || ev.get_button() !== 1)
            return Clutter.EVENT_PROPAGATE;
        if (!this._stages || !this._settings.get_boolean('click-wallpaper'))
            return Clutter.EVENT_PROPAGATE;
        if (Main.overview.visible || Main.modalCount > 0)
            return Clutter.EVENT_PROPAGATE;
        const [x, y] = ev.get_coords();
        const a = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
        const onDesktop = a instanceof Meta.BackgroundActor ||
            a?.meta_window?.get_window_type() === Meta.WindowType.DESKTOP;
        if (!onDesktop)
            return Clutter.EVENT_PROPAGATE;
        const m = global.display.get_monitor_index_for_rect(new Mtk.Rectangle({x, y, width: 1, height: 1}));
        this.toggleReveal(m >= 0 ? m : null);
        return Clutter.EVENT_PROPAGATE;
    }
}
