import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {mgr, winByTitle} from './helpers.js';
const stageAt = (m, ws = null) => mgr()._stageFor(ws ?? mgr()._wsKey(m), m);
const names = s => s.windows.map(w => w.get_title()).join('+');
const state = (ctx, label) => ctx.log(`${label}: ` + [0, 1].map(m => { const st = stageAt(m); return `m${m} palco=${st.active ? names(st.active) : '-'} tira=[${st.recents.map(names)}]`; }).join(' | '));

export default async function (ctx) {
    ctx.move(300, 500);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) { ctx.spawn(t, c, 640, 400); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    state(ctx, '1. inicial');
    const setOf = t => stageAt(0).recents.find(s => s.windows[0].get_title() === t);

    mgr().moveSetToMonitor(setOf('A'), 1); await ctx.sleep(1200);
    state(ctx, '2. "Mover para o monitor 2" o item A');
    ctx.log(`   A está no monitor ${winByTitle('A').get_monitor()} e minimizada=${winByTitle('A').minimized} (esperado 1, true)`);
    const stripA = mgr()._strips.get(1);
    ctx.log(`   tira do monitor 2: itens=${stripA._count}`);
    await ctx.shot('mm-menu-mover');

    // trazer A para o palco do monitor 2: ela deve aparecer lá
    const sa = stageAt(1).recents[0];
    mgr().activateSet(sa); await ctx.sleep(1200);
    state(ctx, '3. A trazida ao palco do monitor 2');
    const ar = Main.layoutManager.getWorkAreaForMonitor(1), r = winByTitle('A').get_frame_rect();
    ctx.log(`   A em ${r.x},${r.y} ${r.width}x${r.height}; área do monitor 2: ${ar.x},${ar.y} ${ar.width}x${ar.height} -> dentro=${r.x >= ar.x && r.x + r.width <= ar.x + ar.width}`);

    // área de trabalho: B vai para a 2
    const wsm = global.workspace_manager;
    wsm.append_new_workspace(false, global.get_current_time());
    const sb = setOf('B');
    mgr().moveSetToWorkspace(sb, 1); await ctx.sleep(1200);
    state(ctx, '4. "Mover para a área 2" o item B (nesta área B some da tira)');
    wsm.get_workspace_by_index(1).activate(global.get_current_time()); await ctx.sleep(1300);
    state(ctx, '5. na área 2 (B deve estar na tira de lá)');
    wsm.get_workspace_by_index(0).activate(global.get_current_time()); await ctx.sleep(1300);
    state(ctx, '6. de volta à área 1');
}
