// SPDX-License-Identifier: GPL-3.0-or-later
// Operações aleatórias (semente fixa) + verificação de invariantes depois de cada uma.
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {mgr, winByTitle} from './helpers.js';

import GLib from 'gi://GLib';
let seed = parseInt(GLib.getenv('SANDBOX_SEED') ?? '20261025');
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const now = () => global.get_current_time();
const COLORS = ['#c01c28', '#26a269', '#e5a50a', '#3584e4', '#9141ac', '#e66100', '#613583'];

function invariants(ctx, label) {
    const m = mgr();
    if (!m?._stages) return [];
    const errs = [];
    const ws = global.workspace_manager.get_active_workspace();
    const seen = new Map();
    for (const [w, per] of m._stages) {
        for (const [mon, st] of per) {
            const sets = st.sets;
            for (const set of sets) {
                if (set.windows.length === 0) errs.push(`conjunto vazio no modelo (${set.id})`);
                for (const win of set.windows) {
                    if (seen.has(win)) errs.push(`janela ${win.get_title()} em dois conjuntos`);
                    seen.set(win, set);
                    if (m._setOf.get(win) !== set) errs.push(`_setOf de ${win.get_title()} diverge do modelo`);
                    if (!win.get_compositor_private()) errs.push(`janela morta ${win.get_title()} no modelo (stage.mon=${mon} chave=${typeof w === 'string' ? w : 'ws'} ativo=${st.active === set} setOf=${m._setOf.get(win) === set} tracked=${m._tracked.has(win)})`);
                }
            }
            if (st.recents.includes(st.active)) errs.push('ativo também está na tira');
            if (w === ws || w === 'sticky') {
                for (const set of st.recents) for (const win of set.windows)
                    if (!win.minimized) errs.push(`tira: ${win.get_title()} NÃO está minimizada`);
                if (st.active) for (const win of st.active.windows)
                    if (win.minimized) errs.push(`palco: ${win.get_title()} está minimizada`);
            }
        }
    }
    if (m._centerResize || m._handoff || m._grabbing) errs.push(`gesto de redimensionamento preso (centerResize=${!!m._centerResize} handoff=${!!m._handoff} grabbing=${m._grabbing}) modalCount=${Main.modalCount}`);
    for (const win of m._setOf.keys()) if (!seen.has(win)) errs.push(`_setOf tem ${win.get_title()} fora de qualquer conjunto`);
    for (const a of global.get_window_actors()) {
        const win = a.meta_window;
        if (win.get_window_type() === Meta.WindowType.NORMAL && !win.get_transient_for() && !win.is_on_all_workspaces() &&
            !win.minimized && !seen.has(win)) errs.push(`janela visível ${win.get_title()} fora do modelo`);
    }
    if (errs.length) ctx.log(`!! ${label}: ${[...new Set(errs)].join(' | ')}`);
    return errs;
}

export default async function (ctx) {
    const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
    let n = 0, total = 0;
    const titles = () => global.get_window_actors().map(a => a.meta_window).filter(w => w.get_window_type() === 0 && !w.get_transient_for()).map(w => w.get_title());
    const nMon = Main.layoutManager.monitors.length;
    let curMon = 0;
    const stage = () => mgr()._stageFor(mgr()._wsKey(curMon), curMon);

    const ops = {
        async spawn() { const mo = Main.layoutManager.monitors[Math.floor(rnd() * nMon)]; ctx.move(mo.x + mo.width / 2, mo.y + 200); const t = `W${++n}`; ctx.spawn(t, pick(COLORS), 420 + Math.floor(rnd() * 400), 320 + Math.floor(rnd() * 250)); await ctx.waitWin(t).catch(() => {}); return `spawn ${t}`; },
        async spawnPip() { const t = rnd() > 0.5 ? 'Picture in picture' : 'Picture-in-Picture'; if (titles().includes(t)) return 'spawnPip -'; ctx.spawn(t, '#613583', 460, 260); await ctx.waitWin(t).catch(() => {}); return `spawnPip ${t}`; },
        async close() { const t = pick(titles()); if (!t) return 'close -'; const w = winByTitle(t); const set = mgr()._setOf.get(w); winByTitle(t)?.delete(now()); return `close ${t} (mon=${w?.get_monitor()} sticky=${w?.is_on_all_workspaces()} stage.mon=${set?.stage.monitor} chave=${typeof set?.stage.workspace === 'string' ? set.stage.workspace : 'ws'})`; },
        async clickItem() { const s = stage(); if (!s.recents.length) return 'clickItem -'; const set = pick(s.recents); mgr().onItemClicked(set, {shift: false}); return `clickItem ${set.top?.get_title()}`; },
        async shiftClick() { const s = stage(); if (!s.recents.length) return 'shiftClick -'; const set = pick(s.recents); mgr().onItemClicked(set, {shift: true}); return `shiftClick ${set.top?.get_title()}`; },
        async userMinimize() { const a = stage().active; if (!a) return 'userMinimize -'; const w = pick(a.windows); w.minimize(); return `userMinimize ${w.get_title()}`; },
        async userActivate() { const t = pick(titles()); if (!t) return 'activate -'; winByTitle(t)?.activate(now()); return `activate ${t}`; },
        async removeFocused() { mgr().removeFocusedFromStage(); return 'removeFocused'; },
        async reveal() { mgr().toggleReveal(); return 'reveal'; },
        async maximize() { const a = stage().active; if (!a) return 'maximize -'; const w = pick(a.windows); if (w.is_maximized()) w.unmaximize(); else w.maximize(); return `maximize-toggle ${w.get_title()}`; },
        async moveMonitor() { const a = stage().active; if (!a || nMon < 2) return 'moveMonitor -'; const w = pick(a.windows); w.move_to_monitor((w.get_monitor() + 1) % nMon); return `moveMonitor ${w.get_title()}`; },
        async autotile() { st().set_boolean('autotile', !st().get_boolean('autotile')); return `autotile=${st().get_boolean('autotile')}`; },
        async arrange() { mgr().arrangeGroup(); return 'arrange'; },
        async groupMode() { st().set_enum('group-mode', Math.floor(rnd() * 2)); return 'groupMode'; },
        async edgeResize() {
            const a = stage().active; if (!a) return 'edgeResize -';
            const w = pick(a.windows); const r = w.get_frame_rect();
            const [sx, sy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]);
            const gx = sx > 0 ? r.x + r.width + 3 : sx < 0 ? r.x - 3 : r.x + r.width / 2;
            const gy = sy > 0 ? r.y + r.height + 3 : sy < 0 ? r.y - 3 : r.y + r.height / 2;
            const mode = pick(['always', 'always', 'alt', 'off']); st().set_string('center-resize', mode);
            const alt = rnd() > 0.5;
            const dx = Math.round((rnd() - 0.5) * 300), dy = Math.round((rnd() - 0.5) * 240);
            const fate = rnd();
            if (alt) ctx.keyDown(Clutter.KEY_Alt_L);
            ctx.move(gx, gy); await ctx.sleep(150);
            ctx.mouseDown(); await ctx.sleep(120);
            await ctx.moveSmooth(gx, gy, gx + dx, gy + dy, 8);
            let end = 'solta';
            if (fate < 0.15) { w.delete(now()); end = 'fecha a janela'; }
            else if (fate < 0.3) { await ctx.key(Clutter.KEY_Escape); end = 'Esc'; }
            await ctx.sleep(100);
            ctx.mouseUp(); if (alt) ctx.keyUp(Clutter.KEY_Alt_L);
            return `edgeResize ${w.get_title()} lado=${sx},${sy} d=${dx},${dy} modo=${mode} alt=${alt} fim=${end}`;
        },
        async toggleEnabled() { st().set_boolean('enabled', false); await ctx.sleep(500); st().set_boolean('enabled', true); return 'toggle enabled off/on'; },
    };
    const names = Object.keys(ops);
    const weights = {spawn: 4, spawnPip: 2, close: 3, clickItem: 5, shiftClick: 3, userMinimize: 2, userActivate: 4, removeFocused: 2, reveal: 1, maximize: 1, arrange: 1, autotile: 2, moveMonitor: 3, groupMode: 1, toggleEnabled: 1, edgeResize: 6};
    const bag = names.flatMap(k => new Array(weights[k]).fill(k));

    for (let i = 0; i < 4; i++) await ops.spawn();
    await ctx.sleep(1200);
    let failures = 0;
    for (let step = 1; step <= 70; step++) {
        curMon = Math.floor(rnd() * nMon);
        const op = pick(bag);
        let desc;
        try { desc = await ops[op](); } catch (e) { desc = `${op} EXC ${e}`; ctx.log(`!! exceção em ${op}: ${e}\n${e.stack}`); failures++; }
        if (desc.startsWith('edgeResize')) ctx.log(`passo ${step}: ${desc}`);
        await ctx.sleep(750);
        const errs = invariants(ctx, `passo ${step} (${desc})`);
        total += errs.length;
        if (step % 10 === 0) ctx.log(`passo ${step}: ${desc} | janelas=${titles().length} m${curMon} palco=${stage().active?.windows.map(w => w.get_title()) ?? '-'} tira=${stage().recents.length}`);
    }
    // limpeza: fecha tudo, modelo deve esvaziar
    for (const t of titles()) winByTitle(t)?.delete(now());
    await ctx.sleep(2500);
    curMon = 0; const st0 = stage();
    ctx.log(`FIM: violações=${total} exceções=${failures}; janelas restantes=${titles().length}; palco0=${st0.active ? 'ocupado' : 'vazio'}; tira0=${st0.recents.length}; _setOf=${mgr()._setOf.size}`);
}
