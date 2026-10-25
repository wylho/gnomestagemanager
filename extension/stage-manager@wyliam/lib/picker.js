// Seletor de janela (como o do Pop Shell): destaca a janela sob o ponteiro; clicar escolhe, Esc cancela.
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {_} from './i18n.js';

const PICKABLE = new Set([Meta.WindowType.NORMAL, Meta.WindowType.DIALOG, Meta.WindowType.MODAL_DIALOG, Meta.WindowType.UTILITY]);

export class WindowPicker {
    /**
     * @param {(x:number, y:number) => Meta.Window|null} itemAt janela representada por uma miniatura da tira naquele ponto
     * @param {(win: Meta.Window|null) => void} onDone chamado com a janela escolhida (ou null se cancelou)
     */
    constructor(itemAt, onDone) {
        this._itemAt = itemAt;
        this._onDone = onDone;
        this._target = null;

        this._shield = new St.Widget({
            reactive: true,
            x: 0, y: 0,
            width: global.stage.width,
            height: global.stage.height,
            style_class: 'sm-picker-shield',
        });
        this._frame = new St.Widget({style_class: 'sm-picker-frame', visible: false});
        this._hint = new St.Label({
            style_class: 'sm-picker-hint',
            text: _('Click the window Stage Manager should ignore. Esc cancels.'),
        });
        Main.uiGroup.add_child(this._shield);
        Main.uiGroup.add_child(this._frame);
        Main.uiGroup.add_child(this._hint);
        const mon = Main.layoutManager.primaryMonitor;
        this._hint.set_position(mon.x + Math.round((mon.width - this._hint.width) / 2), mon.y + 48);

        this._shield.connect('motion-event', (_a, ev) => {
            const [x, y] = ev.get_coords();
            this._hover(x, y);
            return Clutter.EVENT_STOP;
        });
        this._shield.connect('button-press-event', (_a, ev) => {
            const [x, y] = ev.get_coords();
            const win = this._pick(x, y);
            this._finish(ev.get_button() === Clutter.BUTTON_PRIMARY ? win : null);
            return Clutter.EVENT_STOP;
        });
        this._shield.connect('key-press-event', (_a, ev) => {
            if (ev.get_key_symbol() === Clutter.KEY_Escape)
                this._finish(null);
            return Clutter.EVENT_STOP;
        });

        this._grab = Main.pushModal(this._shield);
        this._shield.grab_key_focus();
    }

    /** Janela sob o ponto: miniatura da tira primeiro, depois a janela visível mais acima. */
    _pick(x, y) {
        const fromStrip = this._itemAt(x, y);
        if (fromStrip)
            return fromStrip;
        const wins = global.get_window_actors().map(a => a.meta_window)
            .filter(w => !w.minimized && w.showing_on_its_workspace() && PICKABLE.has(w.get_window_type()));
        for (const w of global.display.sort_windows_by_stacking(wins).reverse()) {
            const r = w.get_frame_rect();
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
                return w;
        }
        return null;
    }

    _hover(x, y) {
        this._target = this._pick(x, y);
        if (!this._target) {
            this._frame.hide();
            return;
        }
        const strip = this._itemAt(x, y, true);
        const r = strip ?? this._target.get_frame_rect();
        this._frame.set_position(r.x, r.y);
        this._frame.set_size(r.width, r.height);
        this._frame.show();
    }

    _finish(win) {
        if (this._done)
            return;
        this._done = true;
        if (this._grab) {
            try {
                Main.popModal(this._grab);
            } catch (_e) { /* já desfeito (ator destruído) */ }
        }
        this._grab = null;
        this._shield.destroy();
        this._frame.destroy();
        this._hint.destroy();
        this._onDone(win);
    }

    cancel() { this._finish(null); }
}
