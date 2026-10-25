// SPDX-License-Identifier: GPL-3.0-or-later
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dump, mgr, winByTitle} from './helpers.js';

const stageOf = i => mgr()._stageFor(mgr()._wsKey(i), i);
const names = s => s.windows.map(w => w.get_title()).join('+');
const state = ctx => {
    const f = i => { const st = stageOf(i); return `m${i}: palco=${st.active ? '{' + names(st.active) + '}' : '-'} tira=[${st.recents.map(s => names(s)).join(',')}] tiraVisível=${mgr()._strips.get(i).actor.visible}`; };
    ctx.log(`   ${f(0)} | ${f(1)}`);
};
const slotCenter = (mon, title) => {
    const st = stageOf(mon);
    const set = st.recents.find(s => s.windows.some(w => w.get_title() === title));
    const r = mgr()._strips.get(mon).slotRect(set);
    return [r.x + r.width / 2, r.y + r.height / 2];
};
const monitorOf = t => winByTitle(t).get_monitor();

export default async function (ctx) {
    const mons = Main.layoutManager.monitors;
    ctx.log(`monitores: ${mons.map(m => `${m.width}x${m.height}+${m.x}+${m.y}`).join(' | ')}`);

    // janelas novas aparecem no monitor do ponteiro
    ctx.move(300, 500);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 620, 400); await ctx.waitWin(t); await ctx.sleep(900); }
    ctx.move(2500, 300);
    for (const [t, c] of [['C', '#e5a50a'], ['D', '#3584e4'], ['E', '#9141ac']]) { ctx.spawn(t, c, 560, 360); await ctx.waitWin(t); await ctx.sleep(900); }
    await ctx.sleep(1200);
    dump(ctx, '1. A,B abertas com ponteiro no monitor 0; C,D,E com ponteiro no monitor 1');
    ctx.log(`   monitor de cada janela: ${['A', 'B', 'C', 'D', 'E'].map(t => `${t}=m${monitorOf(t)}`).join(' ')}`);
    state(ctx);
    await ctx.shot('mm2-1-inicial');

    // clique na tira do monitor 1 só mexe no monitor 1
    let [x, y] = slotCenter(1, 'C');
    await ctx.click(x, y); await ctx.sleep(1100);
    ctx.log('2. clique na miniatura de C (tira do monitor 1)'); state(ctx);

    // Shift+clique na tira do monitor 1: mosaico na área menor
    [x, y] = slotCenter(1, 'E');
    await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    ctx.log('3. Shift+clique em E (monitor 1) -> grupo C+E no monitor 1'); state(ctx);
    const a1 = Main.layoutManager.getWorkAreaForMonitor(1);
    const inside = ['C', 'E'].every(t => { const r = winByTitle(t).get_frame_rect(); return r.x >= a1.x && r.y >= a1.y && r.x + r.width <= a1.x + a1.width && r.y + r.height <= a1.y + a1.height; });
    ctx.log(`   C e E dentro da área útil do monitor 1: ${inside}`);
    await ctx.shot('mm2-3-grupo-no-monitor-1');

    // arrastar B (monitor 0) com o mouse até o monitor 1
    const rb = winByTitle('A').get_frame_rect();
    ctx.log(`4. arrastando A (palco do monitor 0) até o centro do monitor 1`);
    await ctx.drag(rb.x + rb.width / 2, rb.y + 18, 2560, 360); await ctx.sleep(1400);
    ctx.log(`   A agora no monitor ${monitorOf('A')}`); state(ctx);
    await ctx.shot('mm2-4-arrastada-entre-monitores');

    // papel de parede do monitor 1 esvazia só ele
    await ctx.click(2000, 650); await ctx.sleep(1100);
    ctx.log('5. clique no papel de parede do monitor 1'); state(ctx);
    await ctx.click(2000, 650); await ctx.sleep(1100);
    ctx.log('5b. clique de novo (volta)'); state(ctx);

    // maximizar no monitor 1 esconde só a tira de lá
    const act1 = stageOf(1).active.top;
    act1.maximize(); await ctx.sleep(1000);
    ctx.log(`6. maximizou ${act1.get_title()} no monitor 1`); state(ctx);
    act1.unmaximize(); await ctx.sleep(1000);

    // troca de área de trabalho: as duas tiras acompanham
    const wsm = global.workspace_manager;
    wsm.append_new_workspace(false, global.get_current_time());
    wsm.get_workspace_by_index(1).activate(global.get_current_time()); await ctx.sleep(1200);
    ctx.log('7. área de trabalho 2 (vazia)'); state(ctx);
    wsm.get_workspace_by_index(0).activate(global.get_current_time()); await ctx.sleep(1200);
    ctx.log('7b. de volta à área 1'); state(ctx);
    await ctx.shot('mm2-7-final');
}
