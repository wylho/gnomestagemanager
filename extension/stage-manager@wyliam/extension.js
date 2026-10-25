// SPDX-License-Identifier: GPL-3.0-or-later
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Indicator} from './lib/indicator.js';
import {StageManager} from './lib/manager.js';

export default class StageManagerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._manager = new StageManager(this._settings);
        this._indicator = new Indicator(this._settings);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        this._enabledId = this._settings.connect('changed::enabled', () => this._syncEnabled());
        // As preferências pedem o seletor de janela ligando esta chave (outro processo, sem acesso ao Shell).
        this._pickId = this._settings.connect('changed::pick-request', () => {
            if (!this._settings.get_boolean('pick-request'))
                return;
            this._settings.set_boolean('pick-request', false);
            if (this._manager?.active)
                this._manager.pickException();
        });
        this._addKeys();
        this._syncEnabled();
    }

    disable() {
        for (const k of this._keys ?? [])
            Main.wm.removeKeybinding(k);
        this._keys = null;
        this._settings?.disconnect(this._enabledId);
        this._settings?.disconnect(this._pickId);
        this._manager?.stop();
        this._indicator?.destroy();
        this._manager = null;
        this._indicator = null;
        this._settings = null;
    }

    _syncEnabled() {
        if (this._settings.get_boolean('enabled'))
            this._manager.start();
        else
            this._manager.stop();
    }

    _addKeys() {
        const run = fn => () => { if (this._manager?.active) fn(this._manager); };
        const table = {
            'toggle-stage-manager': () => this._settings.set_boolean('enabled', !this._settings.get_boolean('enabled')),
            'toggle-exception': run(m => m.toggleException()),
            'pick-exception': run(m => m.pickException()),
            'toggle-autotile': () => this._settings.set_boolean('autotile', !this._settings.get_boolean('autotile')),
            'switch-recent': run(m => m.switchToRecent()),
            'add-to-stage': run(m => m.addRecentToStage()),
            'remove-from-stage': run(m => m.removeFocusedFromStage()),
            'arrange-group': run(m => m.arrangeGroup()),
            'reveal-desktop': run(m => m.toggleReveal()),
        };
        this._keys = Object.keys(table);
        for (const [name, fn] of Object.entries(table))
            Main.wm.addKeybinding(name, this._settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, fn);
    }
}
