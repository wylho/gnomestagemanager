// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    for (const t of ['B', 'A']) { const [x, y] = itemCenter(t); await ctx.click(x, y, {shift: true}); await ctx.sleep(1000); }
    dump(ctx, '1. grupo de 3 em mosaico');
    await ctx.shot('r1-mosaico');

    // --- aumentar a janela C pelo canto inferior direito (arrastando o mouse)
    for (const [t, dx, dy] of [['C', 260, 160], ['A', 200, 120]]) {
        const r0 = rect(t);
        ctx.log(`2. aumentar ${t}: antes ${R(t)}; arrastando o canto +${dx},+${dy}`);
        await ctx.drag(r0.x + r0.width + 3, r0.y + r0.height + 3, r0.x + r0.width + 3 + dx, r0.y + r0.height + 3 + dy); await ctx.sleep(1200);
        const r1 = rect(t);
        const pedido = mgr()._pref.get(winByTitle(t)) ?? {width: r1.width, height: r1.height};
        ctx.log(`   depois: ${R(t)}  | pedido≈${r0.width + dx}x${r0.height + dy} | ${r1.width >= r0.width ? 'CRESCEU' : 'ENCOLHEU (BUG)'}`);
        ctx.log(`   vizinhas: ${['A', 'B', 'C'].filter(x => x !== t).map(x => `${x}=${R(x)}`).join('  ')}`);
        await ctx.shot(`r2-aumentou-${t}`);
    }
}
