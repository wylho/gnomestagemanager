// SPDX-License-Identifier: GPL-3.0-or-later
import {dump, mgr} from './helpers.js';

export default async function (ctx) {
    ctx.spawn('A', '#c01c28', 760, 480);
    await ctx.waitWin('A'); await ctx.sleep(1200);
    dump(ctx, 'só A');
    ctx.spawn('B', '#26a269', 640, 420);
    await ctx.waitWin('B'); await ctx.sleep(1200);
    dump(ctx, 'A e B');
    ctx.spawn('C', '#e5a50a', 700, 440);
    await ctx.waitWin('C'); await ctx.sleep(1800);
    dump(ctx, 'A, B e C');
    await ctx.shot('basic-1-tres-janelas');
}
