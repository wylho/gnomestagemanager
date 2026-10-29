// SPDX-License-Identifier: GPL-3.0-or-later
// Two drop zones over an open window while a window dragged in from another monitor hovers it:
// left half groups it with that window, right half only moves it to this monitor.
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {_} from './i18n.js';

export class DropChoice {
    constructor() {
        this._rect = null;
        this._zones = null;
        this._hot = null;
    }

    /** Which zone of a window frame `r` the point falls in: 'group' (left half) or 'move' (right half). */
    static zoneAt(r, x) {
        return x < r.x + r.width / 2 ? 'group' : 'move';
    }

    show(r) {
        const same = this._rect && ['x', 'y', 'width', 'height'].every(k => this._rect[k] === r[k]);
        if (same)
            return;
        this.hide();
        this._rect = {x: r.x, y: r.y, width: r.width, height: r.height};
        const half = Math.floor(r.width / 2);
        const make = (label, x, width) => {
            const zone = new St.BoxLayout({
                style_class: 'sm-choice',
                reactive: false,
                x, y: r.y, width, height: r.height,
                y_align: Clutter.ActorAlign.FILL,
                opacity: 0,
            });
            zone.add_child(new St.Label({
                text: label,
                style_class: 'sm-choice-label',
                x_expand: true, y_expand: true,
                x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
            }));
            Main.uiGroup.add_child(zone);
            zone.ease({opacity: 255, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            return zone;
        };
        this._zones = {
            group: make(_('Group'), r.x, half),
            move: make(_('Only move here'), r.x + half, r.width - half),
        };
        this._hot = null;
    }

    highlight(which) {
        if (!this._zones || which === this._hot)
            return;
        this._hot = which;
        for (const [name, zone] of Object.entries(this._zones)) {
            if (name === which)
                zone.add_style_pseudo_class('drop');
            else
                zone.remove_style_pseudo_class('drop');
        }
    }

    hide() {
        for (const zone of Object.values(this._zones ?? {}))
            zone.destroy();
        this._zones = null;
        this._rect = null;
        this._hot = null;
    }

    destroy() { this.hide(); }
}
