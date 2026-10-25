// SPDX-License-Identifier: GPL-3.0-or-later
import {itemCenter} from './helpers.js';
export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) {
        ctx.spawn(t, c, 760, 480); await ctx.waitWin(t); await ctx.sleep(900);
    }
    await ctx.sleep(1500);
    const [x, y] = itemCenter('B');
    ctx.move(x, y); await ctx.sleep(300);
    await ctx.click(x, y);
    await ctx.shot('a1');
    await ctx.sleep(120);
    await ctx.shot('a2');
    await ctx.sleep(1500);
    await ctx.shot('a3');
}
