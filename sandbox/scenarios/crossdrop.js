// SPDX-License-Identifier: GPL-3.0-or-later
// Arrastar entre monitores: janelas e miniaturas da tira, soltas na tira, sobre um item, sobre uma janela ou na tela.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {mgr, winByTitle} from './helpers.js';

const stageOf = i => mgr()._stageFor(mgr()._wsKey(i), i);
const names = s => s.windows.map(w => w.get_title()).join('+');
const st = i => { const s = stageOf(i); return `m${i}: palco=${s.active ? '{' + names(s.active) + '}' : '-'} tira=[${s.recents.map(names).join(',')}]`; };
const state = (ctx, label) => ctx.log(`${label}\n   ${st(0)} | ${st(1)}  (A em m${winByTitle('A')?.get_monitor()})`);
const itemCenter = (mon, title) => {
    const set = stageOf(mon).recents.find(s => s.windows.some(w => w.get_title() === title));
    const r = mgr()._strips.get(mon).slotRect(set);
    return [r.x + r.width / 2, r.y + r.height / 2];
};
const titleBar = t => { const r = winByTitle(t).get_frame_rect(); return [r.x + r.width / 2, r.y + 18]; };

export default async function (ctx) {
    ctx.move(300, 500);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 620, 400); await ctx.waitWin(t); await ctx.sleep(900); }
    ctx.move(2500, 300);
    for (const [t, c] of [['C', '#e5a50a'], ['D', '#3584e4']]) { ctx.spawn(t, c, 520, 340); await ctx.waitWin(t); await ctx.sleep(900); }
    await ctx.sleep(1000);
    state(ctx, '0. inicial: B no palco do m0 (A na tira); D no palco do m1 (C na tira)');
    const g1 = mgr()._strips.get(1).geometry();
    const col = [g1.x + g1.thumbW / 2, g1.area.y + g1.area.height - 80];

    // 1. janela do m0 solta na COLUNA da tira do m1 (quadradinho): só muda de monitor, entra na tira de lá
    let [x, y] = titleBar('B');
    await ctx.drag(x, y, col[0], col[1]); await ctx.sleep(1500);
    state(ctx, '1. B arrastada até a coluna da tira do m1 (esperado: B na tira do m1; A assume o palco do m0)');
    await ctx.shot('cd-1-tira');

    // 2. janela do m0 solta SOBRE UM ITEM da tira do m1: agrupa com ele
    [x, y] = titleBar('A');
    const [ix, iy] = itemCenter(1, 'C');
    await ctx.drag(x, y, ix, iy); await ctx.sleep(1500);
    state(ctx, '2. A arrastada sobre a miniatura de C no m1 (esperado: palco do m1 = C+A)');

    // 3. janela nova no m0 solta sobre a janela aberta do m1: metade esquerda agrupa, direita só muda de monitor
    ctx.move(300, 500); ctx.spawn('E', '#9141ac', 560, 360); await ctx.waitWin('E'); await ctx.sleep(1200);
    const ar = winByTitle('C').get_frame_rect();
    [x, y] = titleBar('E');
    await ctx.drag(x, y, ar.x + ar.width * 0.4, ar.y + ar.height / 2); await ctx.sleep(1500);
    state(ctx, '3a. E arrastada sobre a METADE ESQUERDA de uma janela do m1 (esperado: palco do m1 = C+A+E)');
    await ctx.shot('cd-3a-agrupou');
    ctx.move(300, 500); ctx.spawn('F', '#613583', 560, 360); await ctx.waitWin('F'); await ctx.sleep(1200);
    const ar2 = winByTitle('E').get_frame_rect();
    [x, y] = titleBar('F');
    await ctx.drag(x, y, ar2.x + ar2.width * 0.85, ar2.y + ar2.height / 2); await ctx.sleep(1500);
    state(ctx, '3b. F arrastada sobre a METADE DIREITA (esperado: palco do m1 = F; C+A+E vai para a tira)');

    // 4. miniatura da tira do m1 arrastada para a TELA do m0 (vira o palco de lá)
    const [cx, cy] = itemCenter(1, 'C');
    await ctx.drag(cx, cy, 700, 500); await ctx.sleep(1500);
    state(ctx, '4. miniatura do grupo C+A+E arrastada para a tela do m0 (esperado: palco do m0 = C+A+E)');
    await ctx.shot('cd-4-item-na-tela');

    // 5. miniatura da tira do m1 solta na COLUNA da tira do m0 (só muda de monitor, entra na tira de lá)
    const g0 = mgr()._strips.get(0).geometry();
    let [bx, by] = itemCenter(1, 'B');
    await ctx.drag(bx, by, g0.x + g0.thumbW / 2, g0.area.y + g0.area.height - 80); await ctx.sleep(1500);
    state(ctx, '5. miniatura de B (m1) arrastada para a coluna da tira do m0 (esperado: B na tira do m0)');

    // 6. miniatura da tira do m1 solta SOBRE UM ITEM da tira do m0: agrupa com ele
    [bx, by] = itemCenter(1, 'D');
    const [tx, ty] = itemCenter(0, 'B');
    await ctx.drag(bx, by, tx, ty); await ctx.sleep(1500);
    state(ctx, '6. miniatura de D (m1) arrastada sobre a miniatura de B (m0) (esperado: palco do m0 = B+D, trazido ao palco)');

    // 7. o que aparece durante o arrasto: metades "Agrupar / Só mudar de monitor" e o quadradinho
    ctx.move(300, 500); ctx.spawn('G', '#e66100', 520, 340); await ctx.waitWin('G'); await ctx.sleep(1200);
    const r7 = winByTitle('F').get_frame_rect();
    [x, y] = titleBar('G');
    ctx.move(x, y); await ctx.sleep(200); ctx.mouseDown(); await ctx.sleep(150);
    await ctx.moveSmooth(x, y, r7.x + r7.width * 0.3, r7.y + r7.height / 2, 20); await ctx.sleep(500);
    await ctx.shot('cd-7a-metades');
    await ctx.moveSmooth(r7.x + r7.width * 0.3, r7.y + r7.height / 2, g1.x + g1.thumbW / 2, g1.area.y + 300, 20); await ctx.sleep(600);
    await ctx.shot('cd-7b-quadradinho');
    ctx.mouseUp(); await ctx.sleep(1200);
    state(ctx, '7. G solta na coluna do m1 (esperado: G na tira do m1)');
}
