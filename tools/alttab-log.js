// SPDX-License-Identifier: GPL-3.0-or-later
// Registrador de diagnóstico do Alt+Tab, carregado na sessão real pelo Looking Glass (sem sair da sessão):
//   Alt+F2 → lg → Evaluator → await import('file:///caminho/para/tools/alttab-log.js')
// Grava em ~/.cache/alttab-log.txt cada troca de foco, cada minimizar/restaurar e, a cada Alt+Tab, a ordem que
// a janela de troca montou. Para parar: altTabLogStop() no mesmo lugar (sair da sessão também para).
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const PATH = `${GLib.get_user_cache_dir()}/alttab-log.txt`;
const POPUPS = ['AppSwitcherPopup', 'WindowSwitcherPopup', 'WindowCyclerPopup', 'GroupCyclerPopup'];

globalThis.altTabLogStop?.();

const tracker = Shell.WindowTracker.get_default();
const out = Gio.File.new_for_path(PATH).append_to(Gio.FileCreateFlags.NONE, null);
const log = text => {
    const t = GLib.DateTime.new_now_local().format('%H:%M:%S.%f').slice(0, 12);
    out.write_all(`${t} ${text}\n`, null);
    out.flush(null);
};
const describe = w => {
    if (!w)
        return '(nenhuma)';
    const app = tracker.get_window_app(w)?.get_name() ?? '?';
    const x11 = w.get_client_type() === Meta.WindowClientType.X11 ? ' X11' : '';
    const min = w.minimized ? ' min' : '';
    return `${app} «${(w.get_title() ?? '').slice(0, 40)}» [mon ${w.get_monitor()}${x11}${min}]`;
};
const busy = () => {
    const m = Extension.lookupByUUID('stage-manager@wyliam')?._manager;
    return m?._busy ? ' (Organizador mexendo)' : '';
};

const conns = [];
const on = (obj, sig, fn) => conns.push([obj, obj.connect(sig, fn)]);
on(global.display, 'notify::focus-window', () => log(`FOCO  ${describe(global.display.focus_window)}${busy()}`));
on(global.window_manager, 'minimize', (_wm, actor) => log(`MIN   ${describe(actor.meta_window)}${busy()}`));
on(global.window_manager, 'unminimize', (_wm, actor) => log(`RESTAURA ${describe(actor.meta_window)}${busy()}`));
on(global.display, 'window-created', (_d, w) => log(`NOVA  ${describe(w)}`));

const patched = [];
for (const name of POPUPS) {
    const proto = AltTab[name]?.prototype;
    if (!proto)
        continue;
    const orig = proto._init;
    patched.push([proto, orig]);
    proto._init = function (...args) {
        const r = orig.apply(this, args);
        try {
            const items = (this._items ?? []).map(i => (i.app ? i.app.get_name() : describe(i.window)));
            log(`${name} mostrou: ${items.join(' | ')}`);
            log(`   GNOME apps: ${Shell.AppSystem.get_default().get_running().map(a => a.get_name()).join(' | ')}`);
            log(`   mutter:     ${global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null).map(describe).join(' | ')}`);
        } catch (e) {
            log(`   (erro ao registrar: ${e})`);
        }
        return r;
    };
}

globalThis.altTabLogStop = () => {
    for (const [obj, id] of conns)
        obj.disconnect(id);
    for (const [proto, orig] of patched)
        proto._init = orig;
    log('--- fim');
    out.close(null);
    delete globalThis.altTabLogStop;
};

log(`--- início (GNOME Shell ${Config.PACKAGE_VERSION})`);
log(`foco agora: ${describe(global.display.focus_window)}`);
