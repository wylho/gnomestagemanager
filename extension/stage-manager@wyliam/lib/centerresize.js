// SPDX-License-Identifier: GPL-3.0-or-later
// Resize from the center (Alt + drag on a window edge), like the Option key on macOS.
//
// mutter owns the regular resize grab and offers no hook to change how a resize is applied, so we take over
// the gesture instead: when a resize with Alt held begins, mutter's grab is ended and a transparent shield grabs
// the pointer (same pattern as the window picker); every motion event then resizes the window symmetrically.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {centeredResize} from './layout.js';

const MIN_SIZE = {width: 240, height: 160};
const POLL_MS = 16;   // the shield does not always see the button release (the client held the implicit grab)

const CURSORS = {
    '-1,-1': 'NW_RESIZE', '0,-1': 'N_RESIZE', '1,-1': 'NE_RESIZE',
    '-1,0': 'W_RESIZE', '1,0': 'E_RESIZE',
    '-1,1': 'SW_RESIZE', '0,1': 'S_RESIZE', '1,1': 'SE_RESIZE',
};

// Sides each mouse resize operation pulls: h = -1 (left) / +1 (right), v = -1 (top) / +1 (bottom).
const DIRS = new Map(Object.keys(Meta.GrabOp)
    .filter(k => /^RESIZING_[NSEW]+$/.test(k))
    .map(k => {
        const sides = k.slice('RESIZING_'.length);
        return [Meta.GrabOp[k], {h: sides.includes('E') ? 1 : (sides.includes('W') ? -1 : 0), v: sides.includes('S') ? 1 : (sides.includes('N') ? -1 : 0)}];
    }));

/** Sides pulled by a Meta.GrabOp resize operation, or null when `op` is not a plain edge/corner resize. */
export const dirOf = op => DIRS.get(op) ?? null;

export class CenterResize {
    /**
     * @param {Meta.Window} win window being resized
     * @param {{h:number, v:number}} dir sides the user grabbed
     * @param {Mtk.Rectangle} start frame rect when the gesture began
     * @param {[number, number]} pointer pointer position when the gesture began
     * @param {number} held Clutter.ModifierType button mask that was down when the gesture began
     * @param {Mtk.Rectangle} area work area limiting the size
     * @param {(win: Meta.Window, cancelled: boolean) => void} onDone called once when the gesture ends
     */
    constructor(win, dir, start, pointer, held, area, onDone) {
        this._win = win;
        this._dir = dir;
        this._area = area;
        this._onDone = onDone;
        this._start = start;
        [this._px, this._py] = pointer;
        this._held = held;

        this._shield = new St.Widget({
            reactive: true, x: 0, y: 0,
            width: global.stage.width, height: global.stage.height,
        });
        Main.uiGroup.add_child(this._shield);
        this._shield.connect('motion-event', (_a, ev) => {
            this._move(...ev.get_coords());
            return Clutter.EVENT_STOP;
        });
        this._shield.connect('button-release-event', () => {
            this._finish(false);
            return Clutter.EVENT_STOP;
        });
        this._shield.connect('key-press-event', (_a, ev) => {
            if (ev.get_key_symbol() === Clutter.KEY_Escape)
                this._finish(true);
            return Clutter.EVENT_STOP;
        });
        this._grab = Main.pushModal(this._shield);
        if (!this._grab) {
            this._shield.destroy();
            this._shield = null;
            this._done = true;
            return;
        }
        this._poll = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POLL_MS, () => {
            const [, , mods] = global.get_pointer();
            if (mods & this._held)
                return GLib.SOURCE_CONTINUE;
            this._poll = 0;
            this._finish(false);
            return GLib.SOURCE_REMOVE;
        });
        const cursor = Clutter.CursorType[CURSORS[`${dir.h},${dir.v}`]];
        if (cursor !== undefined)
            global.stage.set_cursor_type(cursor);
    }

    /** False when the pointer grab could not be obtained and the gesture never started. */
    get running() { return !this._done; }

    _stopPoll() {
        if (this._poll)
            GLib.source_remove(this._poll);
        this._poll = 0;
    }

    _move(x, y) {
        if (this._done)
            return;
        if (!this._win.get_compositor_private()) { // window went away mid-gesture
            this._finish(true);
            return;
        }
        const r = centeredResize(this._start, this._dir, x - this._px, y - this._py, this._area, MIN_SIZE);
        this._win.move_resize_frame(true, r.x, r.y, r.width, r.height);
    }

    _finish(cancelled) {
        if (this._done)
            return;
        if (!cancelled) {
            const [x, y] = global.get_pointer();
            this._move(x, y); // a última posição pode ter chegado depois do último movimento visto
            if (this._done) // a janela sumiu e o próprio _move já encerrou
                return;
        }
        this._done = true;
        this._stopPoll();
        if (cancelled && this._win.get_compositor_private())
            this._win.move_resize_frame(true, this._start.x, this._start.y, this._start.width, this._start.height);
        this._release();
        this._onDone(this._win, cancelled);
    }

    /** Ends the gesture without telling anyone (extension being disabled). */
    destroy() {
        if (this._done)
            return;
        this._done = true;
        this._stopPoll();
        this._release();
    }

    _release() {
        global.stage.set_cursor_type(Clutter.CursorType.DEFAULT);
        try {
            Main.popModal(this._grab);
        } catch (_e) { /* grab already gone (shield destroyed, session locked...) */ }
        this._grab = null;
        this._shield.destroy();
        this._shield = null;
    }
}
