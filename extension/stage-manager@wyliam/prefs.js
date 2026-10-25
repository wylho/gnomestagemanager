import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const shortcuts = _ => [
    ['toggle-stage-manager', _('Turn Stage Manager on/off')],
    ['toggle-autotile', _('Turn group autotiling on/off')],
    ['toggle-exception', _("Ignore / manage again the focused window's app")],
    ['pick-exception', _('Pick a window to ignore with the mouse')],
    ['switch-recent', _('Switch to the most recent set in the strip')],
    ['add-to-stage', _('Add the most recent set to the stage')],
    ['remove-from-stage', _('Remove the focused window from the group')],
    ['arrange-group', _('Rearrange the group as a mosaic')],
    ['reveal-desktop', _('Show the desktop')],
];

export default class StageManagerPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const s = this.getSettings();
        const _ = str => this.gettext(str);
        window.set_default_size(680, 820);

        const page = new Adw.PreferencesPage({title: _('Stage Manager'), icon_name: 'view-grid-symbolic'});
        window.add(page);

        const switchRow = (group, key, title, subtitle = '') => {
            const row = new Adw.SwitchRow({title, subtitle});
            s.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
            return row;
        };
        const comboRow = (group, key, title, subtitle, options) => {
            const row = new Adw.ComboRow({title, subtitle, model: Gtk.StringList.new(options)});
            row.selected = s.get_enum(key);
            row.connect('notify::selected', () => s.set_enum(key, row.selected));
            s.connect(`changed::${key}`, () => { row.selected = s.get_enum(key); });
            group.add(row);
        };
        const spinRow = (group, key, title, subtitle, max, min = 0) => {
            const row = new Adw.SpinRow({
                title, subtitle,
                adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: 1, page_increment: 10}),
            });
            s.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };

        const general = new Adw.PreferencesGroup({title: _('General')});
        page.add(general);
        switchRow(general, 'enabled', _('Stage Manager on'));
        switchRow(general, 'show-recents', _('Show recent apps'), _('When off, the strip only appears when the pointer touches the screen edge.'));
        comboRow(general, 'group-mode', _('Windows of an app'),
            _('One at a time: each new window gets its own stage. All at once: windows of the same app go to the same stage.'),
            [_('One at a time'), _('All at once')]);
        switchRow(general, 'always-center', _('Center when entering the stage'), _('Super+Alt+R centers the window (or rearranges the group) whenever you want.'));
        switchRow(general, 'lock-center', _('Always keep centered (outside autotiling)'), _('The window returns to the center as soon as you drop it or finish resizing it. Overrides “remember position”.'));
        switchRow(general, 'remember-position', _('Remember the position of windows moved by hand'), _('When off, the window always returns to the center when entering the stage.'));
        switchRow(general, 'recenter-after-resize', _('Re-center after resizing'));
        switchRow(general, 'click-wallpaper', _('Clicking the wallpaper shows the desktop'),
            _('Windows go to the strip; click again to bring them back.'));

        const groups = new Adw.PreferencesGroup({
            title: _('Window groups'),
            description: _('Drag a thumbnail from the strip onto the stage, or use Shift+click, or the + button on the thumbnail. To remove a window, drag it onto the strip.'),
        });
        page.add(groups);
        switchRow(groups, 'autotile', _('Autotiling (like Pop Shell)'),
            _('Windows on the stage fill the whole screen in a tree layout, leaving the app strip on the left. Resizing moves the divider; dropping a window onto another swaps them. Replaces the mosaic.'));
        switchRow(groups, 'autotile-strip-always', _('Strip always visible with autotiling'),
            _('When off, the strip hides (it appears when the pointer touches the edge) and windows use the whole screen.'));
        spinRow(groups, 'autotile-margin', _('Autotiling margin (px)'), _('Distance between windows and the screen edge (and the strip).'), 200);
        spinRow(groups, 'autotile-gap', _('Autotiling gap between windows (px)'), '', 200);
        comboRow(groups, 'group-layout', _('Group layout'),
            _('Mosaic: rearranges when a window joins or leaves, is resized, or is dropped onto another. Free: only arranges when the composition of the group changes.'),
            // TRANSLATORS: layout mode where the user arranges windows freely (no automatic rearranging)
            [_('Mosaic'), _('Free')]);

        const pip = new Adw.PreferencesGroup({
            title: _('Picture-in-Picture'),
            description: _('Picture-in-Picture from Firefox and Chrome stays in the stage group where it appears (and goes away with it). Only its width takes part in tiling; the height follows the video aspect ratio. Drag the PiP to another corner to move it.'),
        });
        page.add(pip);
        switchRow(pip, 'pip-enabled', _('Treat Picture-in-Picture as an exception'));
        comboRow(pip, 'pip-corner', _('PiP corner'), '', [_('Bottom right'), _('Bottom left'), _('Top right'), _('Top left')]);
        spinRow(pip, 'pip-max-width', _('Maximum PiP width (% of the area)'), '', 60, 10);
        const pipRow = new Adw.EntryRow({title: _('PiP title patterns (comma-separated)'), show_apply_button: true});
        pipRow.text = s.get_strv('pip-patterns').join(', ');
        pipRow.connect('apply', () => s.set_strv('pip-patterns', pipRow.text.split(',').map(x => x.trim()).filter(Boolean)));
        pip.add(pipRow);

        // TRANSLATORS: the side column of app thumbnails (recent apps)
        const stripTitle = _('Strip');
        const strip = new Adw.PreferencesGroup({title: stripTitle});
        page.add(strip);
        comboRow(strip, 'strip-side', _('Strip side'), '', [_('Left'), _('Right')]);
        spinRow(strip, 'thumbnail-width', _('Thumbnail width (px)'), _('Minimum 96 px.'), 400, 96);
        spinRow(strip, 'max-recents', _('Maximum items in the strip'), _('0 = as many as fit the screen height.'), 20);

        const keys = new Adw.PreferencesGroup({
            title: _('Shortcuts'),
            description: _('GTK format, for example &lt;Super&gt;&lt;Alt&gt;s. Leave empty to disable. Press Enter to apply.'),
        });
        page.add(keys);
        for (const [key, title] of shortcuts(_)) {
            const row = new Adw.EntryRow({title, show_apply_button: true});
            row.text = s.get_strv(key)[0] ?? '';
            row.connect('apply', () => {
                const text = row.text.trim();
                if (text === '') {
                    s.set_strv(key, []);
                    row.remove_css_class('error');
                    return;
                }
                const [ok] = Gtk.accelerator_parse(text);
                if (!ok) {
                    row.add_css_class('error');
                    return;
                }
                row.remove_css_class('error');
                s.set_strv(key, [text]);
            });
            keys.add(row);
        }

        const excl = new Adw.PreferencesGroup({
            title: _('Exclusions'),
            description: _('Apps that Stage Manager ignores: they stay loose, outside the stage and the strip. Default: GNOME Sushi (org.gnome.NautilusPreviewer).'),
        });
        page.add(excl);

        // Escolher uma janela aberta (como no Pop Shell): a extensão abre o seletor e o clique adiciona a classe.
        const pick = new Adw.ActionRow({
            title: _('Pick an open window…'),
            subtitle: _('After clicking here, click the window to ignore (for apps in the strip, click its thumbnail). Esc cancels.'),
            activatable: true,
        });
        pick.add_suffix(new Gtk.Image({icon_name: 'find-location-symbolic'}));
        pick.connect('activated', () => s.set_boolean('pick-request', true));
        excl.add(pick);

        const add = new Adw.EntryRow({title: _('Add a class manually (WM_CLASS / app-id)'), show_apply_button: true});
        add.connect('apply', () => {
            const cls = add.text.trim();
            const list = s.get_strv('excluded-classes');
            if (cls && !list.includes(cls))
                s.set_strv('excluded-classes', [...list, cls]);
            add.text = '';
        });
        excl.add(add);

        // Lista atual, cada item com botão de remover.
        let rows = [];
        const rebuild = () => {
            rows.forEach(r => excl.remove(r));
            rows = [];
            for (const cls of s.get_strv('excluded-classes')) {
                const row = new Adw.ActionRow({title: cls});
                const del = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: _('Manage this app again'),
                });
                del.connect('clicked', () => s.set_strv('excluded-classes', s.get_strv('excluded-classes').filter(x => x !== cls)));
                row.add_suffix(del);
                excl.add(row);
                rows.push(row);
            }
        };
        s.connect('changed::excluded-classes', rebuild);
        rebuild();
    }
}
