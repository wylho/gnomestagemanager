// A tira: coluna de miniaturas ao vivo dos conjuntos que não estão no palco.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {_, ngettext} from './i18n.js';
import {clamp, stripSlots} from './layout.js';
import {aux} from './model.js';

const SIDE_PAD = 14;       // distância da borda da tela
const FRAME_PAD = 10;      // folga da caixa da tira em volta dos itens
const STACK_OFFSET = 7;    // deslocamento das janelas empilhadas do mesmo conjunto
const ANIM_MS = 220;
const WATCH_MS = 150;       // confere o ponteiro enquanto a tira está revelada por hover
const WATCH_MISSES = 3;     // vezes seguidas fora da tira antes de escondê-la

const aspectOf = win => {
    if (!win)
        return 0.62;
    const r = win.get_frame_rect();
    return r.width > 0 ? r.height / r.width : 0.62;
};

const signature = (set, w, h) => {
    const top = set.top;
    const r = top ? top.get_frame_rect() : {width: 0, height: 0};
    return [w, h, top?.get_id(), set.windows.map(x => x.get_id()).join(','), r.width, r.height].join('|');
};

class StripItem {
    constructor(strip, set) {
        this._strip = strip;
        this.set = set;
        this._sig = '';
        this.actor = new St.Button({
            style_class: 'sm-item',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        this.actor._delegate = this;
        this.content = new St.Widget({});
        this.actor.set_child(this.content);

        this.actor.connect('clicked', () => this._onClicked());
        this.actor.connect('notify::hover', () => this._onHover());

        const rightClick = new Clutter.ClickGesture({
            required_button: Clutter.BUTTON_SECONDARY,
            recognize_on_press: true,
        });
        rightClick.connect('recognize', () => this.popupMenu());
        this.actor.add_action(rightClick);

        this._draggable = DND.makeDraggable(this.actor, {restoreOnSuccess: false});
        this._draggable.connect('drag-begin', () => {
            this.actor.opacity = 110;
            this._strip.dragBegin(this);
        });
        this._draggable.connect('drag-end', () => {
            this.actor.opacity = 255;
            this._strip.dragEnd();
        });
    }

    // ---------- menu de contexto

    popupMenu() {
        const left = this._strip.geometry().left;
        if (!this._menu) {
            this._menu = new PopupMenu.PopupMenu(this.actor, 0.5, left ? St.Side.LEFT : St.Side.RIGHT);
            this._menu.actor.hide();
            Main.uiGroup.add_child(this._menu.actor);
            this._menuManager = new PopupMenu.PopupMenuManager(this.actor);
            this._menuManager.addMenu(this._menu);
            this._menu.connect('open-state-changed', (_m, open) => this._strip.setMenuOpen(open));
            Main.overview.connectObject('showing', () => this._menu?.close(), this);
        }
        this._menu.removeAll();
        this._fillMenu(this._menu);
        this._menu.open(BoxPointer.PopupAnimation.FULL);
        return Clutter.EVENT_STOP;
    }

    _fillMenu(menu) {
        const m = this._strip.manager;
        const set = this.set;
        const stage = set.stage;
        const wins = [...set.windows];
        const app = set.top ? Shell.WindowTracker.get_default().get_window_app(set.top) : null;
        const clip = (t, n = 38) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
        const sep = () => menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // TRANSLATORS: fallback name shown in the menu header when the app is unknown
        const appName = app?.get_name() ?? _('Window');
        const head = new PopupMenu.PopupMenuItem(
            wins.length > 1
                ? ngettext('%s (%d window)', '%s (%d windows)', wins.length).format(appName, wins.length)
                : appName,
            {reactive: false, can_focus: false});
        head.add_style_class_name('sm-menu-title');
        menu.addMenuItem(head);

        menu.addAction(_('Bring to the stage'), () => m.activateSet(set));
        if (stage.active && stage.active !== set)
            menu.addAction(_('Add to the stage group'), () => m.addSetToStage(set));

        if (wins.length > 1) {
            const sub = new PopupMenu.PopupSubMenuMenuItem(_('Bring only one window'));
            for (const w of wins)
                sub.menu.addAction(clip(w.get_title() || _('Untitled')), () => m.activateWindowOnly(set, w));
            menu.addMenuItem(sub);
            menu.addAction(_('Split the windows in the strip'), () => m.splitSet(set));
        }

        sep();
        if (app?.can_open_new_window())
            menu.addAction(_('New window'), () => app.open_new_window(-1));
        menu.addAction(wins.length > 1 ? _('Close all windows') : _('Close window'), () => m.closeSet(set));
        if (app)
            menu.addAction(_('Quit app'), () => app.request_quit());

        const monitors = Main.layoutManager.monitors;
        const canWorkspace = !m.isStickyMonitor(stage.monitor) && global.workspace_manager.get_n_workspaces() > 1;
        if (monitors.length > 1 || canWorkspace)
            sep();
        if (monitors.length > 1) {
            const sub = new PopupMenu.PopupSubMenuMenuItem(_('Move to monitor'));
            monitors.forEach((_mon, i) => {
                if (i !== stage.monitor)
                    sub.menu.addAction(_('Monitor %d').format(i + 1), () => m.moveSetToMonitor(set, i));
            });
            menu.addMenuItem(sub);
        }
        if (canWorkspace) {
            const sub = new PopupMenu.PopupSubMenuMenuItem(_('Move to workspace'));
            const n = global.workspace_manager.get_n_workspaces();
            for (let i = 0; i < n; i++) {
                if (global.workspace_manager.get_workspace_by_index(i) !== stage.workspace)
                    sub.menu.addAction(_('Workspace %d').format(i + 1), () => m.moveSetToWorkspace(set, i));
            }
            menu.addMenuItem(sub);
        }

        sep();
        const settings = this._strip.settings;
        const auto = new PopupMenu.PopupSwitchMenuItem(_('Autotiling for groups'), settings.get_boolean('autotile'));
        auto.connect('toggled', (_i, state) => settings.set_boolean('autotile', state));
        menu.addMenuItem(auto);
        if (stage.active?.windows.length > 1)
            menu.addAction(_('Rearrange the stage group'), () => m.arrangeGroup(stage.monitor));
        menu.addAction(stage.active ? _('Show the desktop') : _('Back to the stage'), () => m.toggleReveal(stage.monitor));
        if (set.top)
            menu.addAction(_('Ignore this app (do not manage)'), () => m.excludeWindow(set.top));
        menu.addAction(_('Preferences…'), () => Extension.lookupByUUID('stage-manager@wyliam')?.openPreferences());
    }

    getDragActor() {
        return new Clutter.Clone({
            source: this.content,
            width: this.content.width,
            height: this.content.height,
            opacity: 230,
        });
    }

    getDragActorSource() { return this.actor; }

    _onClicked() {
        const ev = Clutter.get_current_event();
        const shift = !!ev && (ev.get_state() & Clutter.ModifierType.SHIFT_MASK) !== 0;
        this._strip.manager.onItemClicked(this.set, {shift});
    }

    _onHover() {
        this.actor.set_pivot_point(0.5, 0.5);
        const hovered = this.actor.hover;
        this._add?.ease({opacity: hovered ? 255 : 0, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this.actor.ease({
            scale_x: hovered ? 1.05 : 1,
            scale_y: hovered ? 1.05 : 1,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    /** Recria as miniaturas se algo mudou (membros, janela do topo, tamanho). */
    update(w, h) {
        const sig = signature(this.set, w, h);
        if (sig === this._sig)
            return;
        this._sig = sig;
        this.actor.set_size(w, h);
        this.content.set_size(w, h);
        this.content.destroy_all_children();

        const top = this.set.top;
        if (!top)
            return;
        const real = this.set.windows.filter(x => !aux.is(x));
        const ordered = [top, ...(real.length ? real : this.set.windows).filter(x => x !== top)].slice(0, 3);
        const n = ordered.length;
        const iw = w - (n - 1) * STACK_OFFSET;
        const ih = h - (n - 1) * STACK_OFFSET;

        let topThumb = null;
        for (let j = n - 1; j >= 0; j--) {
            const t = this._makeThumb(ordered[j], iw, ih);
            if (!t)
                continue;
            t.set_position(t.x + j * STACK_OFFSET, t.y + (n - 1 - j) * STACK_OFFSET);
            this.content.add_child(t);
            if (j === 0)
                topThumb = t;
        }

        this._add = new St.Button({
            style_class: 'sm-add',
            child: new St.Icon({icon_name: 'list-add-symbolic', icon_size: 14}),
            opacity: this.actor.hover ? 255 : 0,
            x: w - 28, y: 6,
        });
        this._add.connect('clicked', () => this._strip.manager.addSetToStage(this.set));
        this.content.add_child(this._add);

        const app = Shell.WindowTracker.get_default().get_window_app(top);
        if (app && topThumb) {
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: 22, style_class: 'sm-badge'});
            icon.set_position(topThumb.x + 6, topThumb.y + topThumb.height - 28);
            this.content.add_child(icon);
        }
    }

    _makeThumb(win, w, h) {
        const actor = win.get_compositor_private();
        if (!actor)
            return null;
        const frame = win.get_frame_rect();
        const buf = win.get_buffer_rect();
        if (frame.width <= 0 || frame.height <= 0)
            return null;
        const s = Math.min(w / frame.width, h / frame.height);
        const tw = Math.max(1, Math.round(frame.width * s));
        const th = Math.max(1, Math.round(frame.height * s));
        const box = new St.Widget({
            style_class: 'sm-thumb',
            width: tw,
            height: th,
            x: Math.round((w - tw) / 2),
            y: Math.round((h - th) / 2),
            clip_to_allocation: true,
        });
        // O clone desenha a janela inteira (com sombra): recortamos na moldura visível.
        box.add_child(new Clutter.Clone({
            source: actor,
            scale_x: s,
            scale_y: s,
            x: -(frame.x - buf.x) * s,
            y: -(frame.y - buf.y) * s,
        }));
        return box;
    }

    fadeOutAndDestroy() {
        this.actor.reactive = false;
        this.actor.ease({
            opacity: 0,
            duration: ANIM_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => this.destroy(),
        });
    }

    destroy() {
        this._draggable?.fakeRelease?.();
        Main.overview.disconnectObject(this);
        this._menu?.destroy();
        this._menu = null;
        this.actor.destroy();
    }
}

/** Zona que recebe o conjunto arrastado da tira e o adiciona ao palco. */
class DropZone {
    constructor(strip) {
        const g = strip.geometry();
        const x0 = g.left ? g.mon.x + g.thumbW + 2 * SIDE_PAD : g.mon.x;
        const w = g.mon.width - g.thumbW - 2 * SIDE_PAD;
        this._strip = strip;
        this.actor = new St.Widget({
            style_class: 'sm-dropzone',
            reactive: true,
            x: x0, y: g.area.y, width: w, height: g.area.height,
            opacity: 0,
        });
        this.actor._delegate = this;
        Main.layoutManager.addChrome(this.actor);
        this.actor.ease({opacity: 255, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
    }

    handleDragOver(source) {
        return source instanceof StripItem ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.NO_DROP;
    }

    acceptDrop(source) {
        if (!(source instanceof StripItem))
            return false;
        this._strip.manager.addSetToStage(source.set);
        return true;
    }

    destroy() {
        Main.layoutManager.removeChrome(this.actor);
        this.actor.destroy();
    }
}

/**
 * Uma tira por monitor, em duas camadas que nunca trocam de pai (reparentar um ator dentro do próprio
 * evento derruba o Shell):
 *  - `front = false`: fica ATRÁS das janelas (dentro do grupo do papel de parede), como no macOS.
 *  - `front = true`: camada de cima, normalmente escondida; só aparece ao encostar na borda quando a
 *    tira de trás está coberta/oculta, e como alvo de arrasto.
 */
export class Strip {
    constructor(manager, settings, monitor, front = false) {
        this.front = front;
        this.manager = manager;
        this.monitor = monitor;
        this.settings = settings;
        this._settings = settings;
        this._menuOpen = false;
        this._stage = null;
        this._items = new Map();
        this._count = 0;
        this._box = null;            // caixa atual da tira (coordenadas absolutas)
        this._covered = false;       // janela maximizada ou por cima da tira
        this._mode = null;           // null | 'always' | 'hidden': imposto pelo autotiling
        this._sessionHidden = false; // visão geral aberta
        this._hover = false;
        this._drag = null;           // {over, multi} enquanto se arrasta uma janela
        this._itemDrag = false;
        this._dead = false;
        this._fullscreen = false;
        this._watch = 0;
        this._phBox = null;
        this._ph = null;
        this._shown = false;

        this.actor = new St.Widget({
            name: 'stage-manager-strip',
            style_class: 'sm-strip',
            reactive: true,
            visible: false,
            opacity: 0,
        });
        this.actor.connect('enter-event', () => { this._setHover(true); return Clutter.EVENT_PROPAGATE; });
        this.actor.connect('destroy', () => { this._dead = true; });
        // A camada da frente NÃO usa trackFullscreen: o Shell força `visible=true` nesses atores e anularia o
        // "escondida". A tela cheia é tratada aqui mesmo (setFullscreen).
        if (front)
            Main.layoutManager.addChrome(this.actor);
        else
            Main.layoutManager._backgroundGroup.add_child(this.actor);

        // Faixa fina na borda (só na camada da frente): traz a tira à frente quando ela está oculta/coberta.
        this._edge = new St.Widget({style_class: 'sm-edge', reactive: true, visible: false});
        this._edge.connect('enter-event', () => { this._setHover(true); return Clutter.EVENT_PROPAGATE; });
        if (front)
            Main.layoutManager.addChrome(this._edge);
    }

    // ---------- geometria

    geometry() {
        const mon = Main.layoutManager.monitors[this.monitor];
        const area = Main.layoutManager.getWorkAreaForMonitor(this.monitor);
        const thumbW = clamp(this._settings.get_int('thumbnail-width'), 96, 400);
        const left = this._settings.get_enum('strip-side') === 0;
        const x = left ? mon.x + SIDE_PAD : mon.x + mon.width - SIDE_PAD - thumbW;
        return {mon, area, thumbW, left, x};
    }

    _slots(sets) {
        const g = this.geometry();
        const r = stripSlots(g.area, sets.map(s => aspectOf(s.top)), {
            thumbW: g.thumbW, x: g.x, maxItems: this._settings.get_int('max-recents'),
        });
        return {g, ...r};
    }

    /** Onde o item do conjunto está (ou ficaria) na tela; serve de destino da animação de minimizar. */
    slotRect(set) {
        if (!this._stage)
            return null;
        const sets = this._stage.recents;
        const s = this._slots(sets);
        const i = sets.indexOf(set);
        return i >= 0 && i < s.count ? s.rects[i] : this.overflowSlot();
    }

    currentSlots() { return this._stage ? this._slots(this._stage.recents) : null; }

    overflowSlot() {
        const g = this.geometry();
        return {x: g.x, y: g.area.y + g.area.height - 40, width: g.thumbW, height: 30};
    }

    /** Janela representada pela miniatura sob o ponto (ou, com `rectOnly`, o retângulo do item). */
    itemAt(x, y, rectOnly = false) {
        if (!this.actor.visible)
            return null;
        for (const item of this._items.values()) {
            const [ix, iy] = item.actor.get_transformed_position();
            const [iw, ih] = item.actor.get_transformed_size();
            if (x >= ix && x <= ix + iw && y >= iy && y <= iy + ih)
                return rectOnly ? {x: ix, y: iy, width: iw, height: ih} : item.set.top;
        }
        return null;
    }

    /** Espaço lateral que o autotiling deve deixar para a tira (0 se ela não está ocupando a tela). */
    reservedSpace() {
        const g = this.geometry();
        const has = !this._autoHide() && !!this._stage?.recents.length;
        return {left: g.left, width: has ? g.thumbW + 2 * SIDE_PAD : 0};
    }

    /**
     * A janela `r` esconde a tira por inteiro (ou deixa só uma nesga)? Só nesse caso faz sentido a cópia da
     * frente; se sobra um pedaço visível, a tira de trás é usada ali mesmo, sem duplicata por cima.
     */
    coversBox(r) {
        const b = this._box;
        if (!b)
            return false;
        const coversVertically = r.y <= b.y + 4 && r.y + r.height >= b.y + b.height - 4;
        if (!coversVertically)
            return false;
        const left = Math.max(0, Math.min(b.x + b.width, r.x) - b.x);
        const right = Math.max(0, b.x + b.width - Math.max(b.x, r.x + r.width));
        return left + right < 32;
    }

    containsPoint(x, y, slack = 16) {
        const b = this._box ?? this._phBox;
        return !!b && x >= b.x - slack && x <= b.x + b.width + slack && y >= b.y - slack && y <= b.y + b.height + slack;
    }

    // ---------- estado

    setStage(stage) { this._stage = stage; }
    setFullscreen(v) { if (this._fullscreen !== v) { this._fullscreen = v; this._apply(); } }
    /** Autotiling pode impor a tira sempre visível ('always') ou escondida ('hidden'); null = regra normal. */
    setMode(mode) { if (this._mode !== mode) { this._mode = mode; this._apply(); } }
    /** Enquanto o menu de contexto de um item está aberto, a tira não pode se esconder debaixo dele. */
    setMenuOpen(v) { if (this._menuOpen !== v) { this._menuOpen = v; this._apply(); } }
    setCovered(v) { if (this._covered !== v) { this._covered = v; this._apply(); } }
    setSessionHidden(v) { if (this._sessionHidden !== v) { this._sessionHidden = v; this._apply(); } }

    /** Arrasto de janela em andamento: `multi` mantém a tira como alvo; senão ela sai da frente. */
    setWindowDrag(state) {
        if (this._dead)
            return;
        const changed = JSON.stringify(state) !== JSON.stringify(this._drag);
        this._drag = state;
        this._syncPlaceholder();
        if (changed)
            this._apply();
    }

    /** Sem itens na tira, arrastar uma janela do grupo mostra um alvo para largá-la. */
    _syncPlaceholder() {
        const need = this.front && !!this._drag?.multi && this._count === 0;
        if (need && !this._ph) {
            const g = this.geometry();
            const h = Math.round(g.thumbW * 0.6);
            this._phBox = {x: g.x, y: g.area.y + Math.round((g.area.height - h) / 2), width: g.thumbW, height: h};
            this._ph = new St.Widget({style_class: 'sm-placeholder', reactive: false, opacity: 0, ...this._phBox});
            Main.layoutManager.addChrome(this._ph);
            this._ph.ease({opacity: 255, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        } else if (!need && this._ph) {
            Main.layoutManager.removeChrome(this._ph);
            this._ph.destroy();
            this._ph = null;
            this._phBox = null;
        }
        if (this._ph) {
            if (this._drag?.over)
                this._ph.add_style_pseudo_class('drop');
            else
                this._ph.remove_style_pseudo_class('drop');
        }
    }

    refresh() {
        if (this._dead)
            return;
        const sets = this._stage ? this._stage.recents : [];
        const {g, rects, count, top, bottom} = this._slots(sets);
        this._count = count;

        const keep = new Set(sets.slice(0, count));
        for (const [set, item] of [...this._items]) {
            if (!keep.has(set)) {
                this._items.delete(set);
                item.fadeOutAndDestroy();
            }
        }
        if (count === 0) {
            this._box = null;
            this._apply();
            return;
        }

        const box = {x: g.x - FRAME_PAD, y: top - FRAME_PAD, width: g.thumbW + 2 * FRAME_PAD, height: bottom - top + 2 * FRAME_PAD};
        // Mantém os itens no mesmo lugar absoluto ao mover a origem da caixa.
        const dx = this.actor.x - box.x;
        const dy = this.actor.y - box.y;
        for (const item of this._items.values())
            item.actor.set_position(item.actor.x + dx, item.actor.y + dy);
        this.actor.set_position(box.x, box.y);
        this.actor.set_size(box.width, box.height);

        sets.slice(0, count).forEach((set, i) => {
            const r = rects[i];
            const rx = r.x - box.x;
            const ry = r.y - box.y;
            let item = this._items.get(set);
            if (!item) {
                item = new StripItem(this, set);
                this._items.set(set, item);
                this.actor.add_child(item.actor);
                item.update(r.width, r.height);
                item.actor.set_position(rx, ry);
                item.actor.opacity = 0;
                item.actor.ease({opacity: 255, duration: ANIM_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            } else {
                item.update(r.width, r.height);
                item.actor.ease({x: rx, y: ry, duration: ANIM_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            }
        });
        this._box = box;
        this._apply();
    }

    // ---------- aparecer / esconder

    _autoHide() {
        if (this._mode)
            return this._mode === 'hidden';
        return !this._settings.get_boolean('show-recents');
    }

    _apply() {
        if (this._dead)
            return;
        const have = this._count > 0 && !this._sessionHidden && !this._fullscreen && this._box;
        const autoHide = this._autoHide();
        let show;
        if (!this.front) {
            // Atrás das janelas: sempre aparece (janela grande a corta); some só no modo auto-ocultar.
            show = !!have && (!autoHide || this._menuOpen);
        } else {
            // À frente: só quando a de trás estaria oculta/coberta, ou como alvo de arrasto.
            const dragReveal = !!this._drag?.multi || this._itemDrag;
            const hoverReveal = (this._hover || this._menuOpen) && !this._drag && !this._itemDrag && (this._covered || autoHide);
            show = !!have && (dragReveal || hoverReveal);
            this.actor.remove_style_pseudo_class('drop');
            if (this._drag?.multi && this._drag.over)
                this.actor.add_style_pseudo_class('drop');
            this._positionEdge(!!have && (this._covered || autoHide) && !show);
        }

        if (show === this._shown && (show ? this.actor.visible : true))
            return;
        this._shown = show;
        const g = this.geometry();
        const away = (g.left ? -1 : 1) * (g.thumbW + 2 * SIDE_PAD + FRAME_PAD);
        if (show) {
            this.actor.show();
            this.actor.ease({translation_x: 0, opacity: 255, duration: ANIM_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        } else {
            this.actor.ease({
                translation_x: away, opacity: 0, duration: ANIM_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => { if (!this._shown) this.actor.hide(); },
            });
        }
    }

    _positionEdge(on) {
        this._edge.visible = on;
        if (!on)
            return;
        const g = this.geometry();
        this._edge.set_position(g.left ? g.mon.x : g.mon.x + g.mon.width - 4, g.area.y);
        this._edge.set_size(4, g.area.height);
    }

    _pointerAtEdge(x, y) {
        const g = this.geometry();
        const atX = g.left ? x <= g.mon.x + 4 : x >= g.mon.x + g.mon.width - 4;
        return atX && y >= g.area.y && y <= g.area.y + g.area.height;
    }

    /**
     * Revelar por hover: o `leave-event` não é confiável (a faixa da borda some quando a tira
     * aparece), então um vigia confere o ponteiro até ele sair de vez.
     */
    _setHover(v) {
        if (!v)
            return;
        this._hover = true;
        this._apply();
        if (this._watch)
            return;
        let misses = 0;
        this._watch = GLib.timeout_add(GLib.PRIORITY_DEFAULT, WATCH_MS, () => {
            const [x, y] = global.get_pointer();
            misses = (this.containsPoint(x, y, 8) || this._pointerAtEdge(x, y)) ? 0 : misses + 1;
            if (misses < WATCH_MISSES)
                return GLib.SOURCE_CONTINUE;
            this._watch = 0;
            this._hover = false;
            this._apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    // ---------- arrastar da tira para o palco

    dragBegin(_item) {
        this._itemDrag = true;
        this._zone = new DropZone(this);
        this._apply();
    }

    dragEnd() {
        this._itemDrag = false;
        this._zone?.destroy();
        this._zone = null;
        this._apply();
    }

    destroy() {
        this._dead = true;
        if (this._watch)
            GLib.source_remove(this._watch);
        this._zone?.destroy();
        if (this._ph) {
            Main.layoutManager.removeChrome(this._ph);
            this._ph.destroy();
        }
        for (const item of this._items.values())
            item.destroy();
        this._items.clear();
        if (this.front) {
            Main.layoutManager.removeChrome(this.actor);
            Main.layoutManager.removeChrome(this._edge);
        }
        this.actor.destroy();
        this._edge.destroy();
    }
}
