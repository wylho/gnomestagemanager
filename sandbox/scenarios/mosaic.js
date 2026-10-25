import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

const rectOf = t => { const r = winByTitle(t).get_frame_rect(); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const titlebar = t => { const r = winByTitle(t).get_frame_rect(); return [r.x + Math.round(r.width / 2), r.y + 18]; };

export default async function (ctx) {
    const defs = [['A', '#c01c28', 700, 440], ['B', '#26a269', 600, 500], ['C', '#e5a50a', 800, 450], ['D', '#3584e4', 500, 500], ['E', '#9141ac', 640, 400]];
    for (const [t, c, w, h] of defs) { ctx.spawn(t, c, w, h); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1200);
    dump(ctx, '1. cinco janelas (palco=E tira=[D,C,B,A])');

    for (const [i, t] of ['D', 'C', 'B', 'A'].entries()) {
        const [x, y] = itemCenter(t);
        await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
        dump(ctx, `2.${i + 1} Shift+clique em ${t}`);
        await ctx.shot(`m${i + 2}-janelas`);
    }

    // remover arrastando uma janela do grupo para a tira (tira vazia: aparece o alvo)
    let [x, y] = titlebar('A');
    ctx.log(`3. arrastando A (${rectOf('A')}) para a borda esquerda`);
    await ctx.drag(x, y, 60, 540); await ctx.sleep(1100);
    dump(ctx, '3. A arrastada para a tira (esperado: A sai do grupo, vai para a tira)');
    await ctx.shot('m6-removida-por-arrasto');

    // trocar de lugar: arrasta uma janela para o lugar de outra
    const before = mgr()._stageFor(global.workspace_manager.get_active_workspace(), 0).active.windows.map(w => w.get_title()).join('');
    const rs = ['E', 'D'].map(t => winByTitle(t).get_frame_rect());
    [x, y] = titlebar('E');
    await ctx.drag(x, y, rs[1].x + rs[1].width / 2, rs[1].y + rs[1].height / 2); await ctx.sleep(1100);
    const after = mgr()._stageFor(global.workspace_manager.get_active_workspace(), 0).active.windows.map(w => w.get_title()).join('');
    ctx.log(`4. ordem antes=${before} depois=${after} (E soltada sobre D)`);
    dump(ctx, '4. reordenada');
    await ctx.shot('m7-reordenada');

    // botão "+" na miniatura de A
    const strip = mgr()._strips.get(0);
    const [ax, ay] = itemCenter('A');
    await ctx.click(ax, ay - 20); // só passa o mouse? (clique no item troca; usamos o botão abaixo)
}
