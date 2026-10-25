// SPDX-License-Identifier: GPL-3.0-or-later
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const act = () => mgr()._stageFor(global.workspace_manager.get_active_workspace(), 0).active;

export default async function (ctx) {
    for (const [t, c, w, h] of [['A', '#c01c28', 700, 440], ['B', '#26a269', 600, 500], ['C', '#e5a50a', 800, 450]]) {
        ctx.spawn(t, c, w, h); await ctx.waitWin(t); await ctx.sleep(800);
    }
    await ctx.sleep(1200);
    let [x, y] = itemCenter('B');
    await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    dump(ctx, '1. duas janelas (C+B) lado a lado');
    await ctx.shot('n1-duas-lado-a-lado');

    // redimensionar C pelo canto inferior direito (mouse): vizinha deve se ajustar
    const rc = rect('C');
    ctx.log(`2. antes: C=${R('C')} B=${R('B')}`);
    const hx = rc.x + rc.width + 3, hy = rc.y + rc.height + 3;
    await ctx.drag(hx, hy, hx - 150, hy - 60); await ctx.sleep(1100);
    ctx.log(`2. depois de arrastar o canto de C 150px p/ dentro: C=${R('C')} B=${R('B')}`);
    const rc2 = rect('C');
    await ctx.drag(rc2.x + rc2.width + 3, rc2.y + rc2.height + 3, rc2.x + rc2.width + 140, rc2.y + rc2.height + 60); await ctx.sleep(1100);
    ctx.log(`2. depois de aumentar C de novo: C=${R('C')} B=${R('B')}`);
    await ctx.shot('n2-apos-redimensionar');

    // botão "+" da miniatura de A: passa o mouse e clica no botão
    const strip = mgr()._strips.get(0);
    const [ax, ay] = itemCenter('A');
    ctx.move(ax, ay); await ctx.sleep(500);
    const r = strip.slotRect(act().stage.recents[0]);
    await ctx.click(r.x + r.width - 17, r.y + 17); await ctx.sleep(1100);
    dump(ctx, '3. clicou no "+" da miniatura de A (esperado: 3 janelas no palco)');
    await ctx.shot('n3-botao-mais');

    // com a tira vazia, arrastar uma janela do grupo para a borda mostra o alvo
    const rb = rect('B');
    await ctx.drag(rb.x + rb.width / 2, rb.y + 18, 80, 540); await ctx.sleep(1100);
    dump(ctx, '4. B arrastada para o alvo da tira (esperado: B sai, palco com A+C)');
    await ctx.shot('n4-alvo-com-tira-vazia');

    // atalho de reorganizar depois de bagunçar
    winByTitle('A').move_frame(true, 200, 600); await ctx.sleep(300);
    mgr().arrangeGroup(); await ctx.sleep(900);
    dump(ctx, '5. arrangeGroup (reorganizou)');

    // modo livre: redimensionar não mexe nos vizinhos
    const {Extension} = await import('resource:///org/gnome/shell/extensions/extension.js');
    Extension.lookupByUUID('stage-manager@wyliam')._settings.set_enum('group-layout', 1); await ctx.sleep(300);
    const rc3 = rect('C'), a0 = R('A');
    await ctx.drag(rc3.x + rc3.width + 3, rc3.y + rc3.height + 3, rc3.x + rc3.width - 100, rc3.y + rc3.height - 50); await ctx.sleep(900);
    ctx.log(`6. modo livre: A antes=${a0} depois=${R('A')} (esperado igual); C=${R('C')}`);
}
