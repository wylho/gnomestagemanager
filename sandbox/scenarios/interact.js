// SPDX-License-Identifier: GPL-3.0-or-later
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

export default async function (ctx) {
    for (const [t, c, w, h] of [['A', '#c01c28', 700, 440], ['B', '#26a269', 620, 400], ['C', '#e5a50a', 680, 420]]) {
        ctx.spawn(t, c, w, h); await ctx.waitWin(t); await ctx.sleep(1000);
    }
    await ctx.sleep(1000);
    dump(ctx, '1. três janelas (esperado palco=C tira=[B,A])');

    let [x, y] = itemCenter('B');
    await ctx.click(x, y); await ctx.sleep(900);
    dump(ctx, '2. clique em B (esperado palco=B tira=[C,A]: C assume o lugar de B)');
    await ctx.shot('i2-clique-em-B');

    [x, y] = itemCenter('A');
    await ctx.click(x, y, {shift: true}); await ctx.sleep(900);
    dump(ctx, '3. Shift+clique em A (esperado palco={B+A} tira=[C])');
    await ctx.shot('i3-shift-clique-A');

    [x, y] = itemCenter('C');
    await ctx.drag(x, y, 1000, 500); await ctx.sleep(900);
    dump(ctx, '4. arrastar C para o palco (esperado palco={B+A+C} tira=[])');
    await ctx.shot('i4-arrastar-C-para-palco');

    mgr().removeFocusedFromStage(); await ctx.sleep(900);
    dump(ctx, '5. remover janela em foco do conjunto (esperado uma sai para a tira)');
    await ctx.shot('i5-removida');
}
