// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {_} from './i18n.js';

const Toggle = GObject.registerClass(
class StageManagerToggle extends QuickToggle {
    _init(settings) {
        super._init({
            title: _('Stage Manager'),
            iconName: 'view-grid-symbolic',
            toggleMode: true,
        });
        settings.bind('enabled', this, 'checked', Gio.SettingsBindFlags.DEFAULT);
    }
});

export const Indicator = GObject.registerClass(
class StageManagerIndicator extends SystemIndicator {
    _init(settings) {
        super._init();
        this.quickSettingsItems.push(new Toggle(settings));
    }

    destroy() {
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});
