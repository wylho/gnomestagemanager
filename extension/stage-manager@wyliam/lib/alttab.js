// SPDX-License-Identifier: GPL-3.0-or-later
// Ordem do Alt+Tab pelo uso, como no Windows: um toque volta para o app anterior.
//
// O Organizador Visual minimiza as janelas que saem do palco, e o GNOME põe as minimizadas no fim do Alt+Tab
// em dois lugares: Meta.Display.get_tab_list() (visíveis primeiro, minimizadas depois) e
// Shell.AppSystem.get_running() / Shell.App.get_windows() (quem tem janela visível vem antes). Com um monitor só
// isso não aparece (a única visível é a focada); com dois, a janela visível do outro monitor passa sempre à frente
// do app anterior e um toque no Alt+Tab pula de monitor (docs/ALT-TAB.pt-BR.md). Aqui guardamos
// a ordem real de foco e, só enquanto as janelas de troca do Shell se montam, essas três funções devolvem a
// lista nessa ordem. Minimizar à mão continua mandando a janela para o fim (como no Windows e no GNOME).
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';

const POPUPS = ['AppSwitcherPopup', 'WindowSwitcherPopup', 'WindowCyclerPopup', 'GroupCyclerPopup'];

export class AltTabOrder {
    constructor() {
        this._stamp = new Map();   // Meta.Window -> momento do último foco (maior = mais recente)
        this._clock = 0;
        this._patched = [];        // [obj, nome, original]
        this._focusId = 0;
        this._idleId = 0;
        this._ordering = 0;
    }

    start() {
        if (this._focusId)
            return;
        // Ponto de partida: a ordem que o mutter conhece agora (as minimizadas ficam atrás, como já estavam).
        const now = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (const w of now.reverse())
            this._stamp.set(w, ++this._clock);
        this._focusId = global.display.connect('notify::focus-window', () => this._queueFocus());
        this._onFocus();

        const self = this;
        for (const name of POPUPS) {
            const proto = AltTab[name]?.prototype;
            if (!proto)
                continue;
            const orig = proto._init;
            this._patch(proto, '_init', function (...args) {
                return self._whileOrdering(() => orig.apply(this, args));
            });
        }
    }

    stop() {
        if (!this._focusId)
            return;
        global.display.disconnect(this._focusId);
        this._focusId = 0;
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._idleId = 0;
        for (const [obj, name, orig] of this._patched.reverse())
            obj[name] = orig;
        this._patched = [];
        this._stamp.clear();
    }

    /** O usuário minimizou: a janela vai para o fim, como no Windows. */
    demote(win) {
        if (this._focusId)
            this._stamp.set(win, -++this._clock);
    }

    _patch(obj, name, fn) {
        this._patched.push([obj, name, obj[name]]);
        obj[name] = fn;
    }

    /**
     * Só conta o foco onde ele parou: ao trocar de palco, minimizar a janela focada faz o mutter focar outra
     * por um instante antes da janela nova, e essa de passagem não pode subir no Alt+Tab.
     */
    _queueFocus() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._onFocus();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onFocus() {
        // A janela-mãe sobe junto com o diálogo (o Alt+Tab mostra a mãe no lugar do diálogo).
        for (let w = global.display.focus_window, i = 0; w && i < 8; w = w.get_transient_for(), i++)
            this._stamp.set(w, ++this._clock);
    }

    _rank(win) { return this._stamp.get(win) ?? 0; }

    _appRank(app) { return Math.max(0, ...app.get_windows().map(w => this._rank(w))); }

    /** Ordena por uso; empates (janelas nunca focadas) mantêm a ordem que o GNOME deu. */
    _byUse(list, rank) {
        return list.map((x, i) => [x, rank(x), i])
            .sort((a, b) => b[1] - a[1] || a[2] - b[2])
            .map(([x]) => x);
    }

    _whileOrdering(fn) {
        if (this._ordering)
            return fn();
        if (this._idleId) { // foco recém-mudado que ainda não foi contado
            GLib.source_remove(this._idleId);
            this._idleId = 0;
            this._onFocus();
        }
        const self = this;
        const tabList = Meta.Display.prototype.get_tab_list;
        // Esquece janelas que já fecharam.
        const alive = new Set(tabList.call(global.display, Meta.TabList.NORMAL_ALL, null));
        for (const w of this._stamp.keys()) {
            if (!alive.has(w))
                this._stamp.delete(w);
        }
        const running = Shell.AppSystem.prototype.get_running;
        const appWindows = Shell.App.prototype.get_windows;
        Meta.Display.prototype.get_tab_list = function (...args) {
            return self._byUse(tabList.apply(this, args), w => self._rank(w));
        };
        Shell.AppSystem.prototype.get_running = function (...args) {
            return self._byUse(running.apply(this, args), a => self._appRank(a));
        };
        Shell.App.prototype.get_windows = function (...args) {
            return self._byUse(appWindows.apply(this, args), w => self._rank(w));
        };
        this._ordering++;
        try {
            return fn();
        } finally {
            this._ordering--;
            Meta.Display.prototype.get_tab_list = tabList;
            Shell.AppSystem.prototype.get_running = running;
            Shell.App.prototype.get_windows = appWindows;
        }
    }
}
