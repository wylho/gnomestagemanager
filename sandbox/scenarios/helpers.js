// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const mgr = () => Extension.lookupByUUID('stage-manager@wyliam')?._manager;

export function dump(ctx, label) {
    const m = mgr();
    if (!m?._stages) { ctx.log(`--- ${label}\n  (gerenciador parado)`); } 
    const t = s => (s ? `{${s.windows.map(w => w.get_title()).join('+')}}` : '-');
    const ws = global.workspace_manager.get_active_workspace();
    const lines = [`--- ${label}`];
    for (const [i] of Main.layoutManager.monitors.entries()) {
        const st = m?._stages ? m._stageFor(m._wsKey(i), i) : null;
        if (st) lines.push(`monitor ${i}: palco=${t(st.active)} tira=[${st.recents.map(t).join(', ')}]`);
    }
    for (const a of global.get_window_actors()) {
        const w = a.meta_window;
        if (w.get_window_type() !== 0) continue;
        const r = w.get_frame_rect();
        lines.push(`  ${w.get_title().padEnd(6)} ${r.width}x${r.height}+${r.x}+${r.y} min=${w.minimized} max=${w.is_maximized()} foco=${w.has_focus()}`);
    }
    ctx.log(lines.join('\n'));
}

/** Centro (absoluto) do item da tira que contém a janela de título `title`. */
export function itemCenter(title) {
    const m = mgr();
    const ws = global.workspace_manager.get_active_workspace();
    const st = m._stageFor(m._wsKey(0), 0);
    const set = st.recents.find(s => s.windows.some(w => w.get_title() === title));
    const r = m._strips.get(0).slotRect(set);
    return [r.x + r.width / 2, r.y + r.height / 2];
}
export const winByTitle = t => global.get_window_actors().map(a => a.meta_window).find(w => w.get_title() === t);
