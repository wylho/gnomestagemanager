import {dump, mgr, itemCenter} from './helpers.js';
export default async function (ctx) {
    ctx.move(300, 500);
    for (const [t, c, w, h] of [['Editor', '#c01c28', 760, 460], ['Terminal', '#26a269', 640, 420], ['Navegador', '#3584e4', 900, 520], ['Notas', '#e5a50a', 560, 400]]) {
        ctx.spawn(t, c, w, h); await ctx.waitWin(t); await ctx.sleep(900);
    }
    ctx.move(2500, 300);
    for (const [t, c] of [['Chat', '#9141ac'], ['Email', '#e66100']]) { ctx.spawn(t, c, 600, 400); await ctx.waitWin(t); await ctx.sleep(900); }
    await ctx.sleep(1500);
    await ctx.shot('1-um-janela-por-vez');
    for (const t of ['Navegador', 'Terminal']) { const [x, y] = itemCenter(t); await ctx.click(x, y, {shift: true}); await ctx.sleep(1200); }
    ctx.move(1000, 900); await ctx.sleep(500);
    await ctx.shot('2-grupo-em-mosaico');
}
