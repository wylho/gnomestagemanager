import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const stageOf = (i = 0) => mgr()._stageFor(global.workspace_manager.get_active_workspace(), i);

export default async function (ctx) {
    // --- dock embaixo + tira à esquerda
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) {
        ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(900);
    }
    await ctx.sleep(1500);
    const wa = Main.layoutManager.getWorkAreaForMonitor(0);
    ctx.log(`área útil: ${wa.width}x${wa.height}+${wa.x}+${wa.y}`);
    dump(ctx, '1. com dock');
    await ctx.shot('e1-dock-embaixo');

    // --- animação no meio: clica em B e captura 130ms depois
    const [x, y] = itemCenter('B');
    ctx.move(x, y); await ctx.sleep(200);
    ctx.click(x, y); await ctx.sleep(130);
    await ctx.shot('e2-animacao-meio');
    await ctx.sleep(1200);
    dump(ctx, '2. depois do clique');

    // --- visão geral
    Main.overview.show(); await ctx.sleep(1200);
    await ctx.shot('e3-visao-geral');
    ctx.log(`   tira visível na visão geral? ${mgr()._strips.get(0).actor.visible}`);
    Main.overview.hide(); await ctx.sleep(1000);
    ctx.log(`   tira visível depois? ${mgr()._strips.get(0).actor.visible}`);

    // --- diálogo transitório: acompanha a janela-mãe, não vira conjunto
    ctx.spawn('P', '#613583', 640, 400, '', 'dlg'); await ctx.waitWin('P'); await ctx.sleep(3200);
    const dlg = winByTitle('P-dlg');
    dump(ctx, '3. janela P com diálogo (esperado: palco={P}, diálogo não é conjunto)');
    ctx.log(`   diálogo existe=${!!dlg} minimizado=${dlg?.minimized} transient=${dlg?.get_transient_for()?.get_title()}`);
    await ctx.shot('e4-dialogo');
    const [x2, y2] = itemCenter('B');
    await ctx.click(x2, y2); await ctx.sleep(1200);
    ctx.log(`   após trocar para B: diálogo minimizado=${dlg?.minimized} visível=${dlg?.showing_on_its_workspace?.()}`);

    // --- todas de uma vez
    st().set_enum('group-mode', 1);
    ctx.spawn('G1', '#1a5fb4', 500, 380, 'org.stagetest.same'); await ctx.waitWin('G1'); await ctx.sleep(1000);
    ctx.spawn('G2', '#e66100', 500, 380, 'org.stagetest.same'); await ctx.waitWin('G2'); await ctx.sleep(1500);
    dump(ctx, '4. todas de uma vez: G1 e G2 do mesmo app (esperado: juntas no palco)');
    st().set_enum('group-mode', 0);

    // --- áreas de trabalho: cada uma com seu palco
    const wsm = global.workspace_manager;
    wsm.append_new_workspace(false, global.get_current_time());
    wsm.get_workspace_by_index(1).activate(global.get_current_time()); await ctx.sleep(1200);
    ctx.spawn('W2', '#26a269', 640, 400); await ctx.waitWin('W2'); await ctx.sleep(1500);
    dump(ctx, '5. área 2: nova janela W2 (esperado: palco={W2}, tira vazia)');
    ctx.log(`   tira da área 2: itens=${mgr()._strips.get(0)._count}`);
    wsm.get_workspace_by_index(0).activate(global.get_current_time()); await ctx.sleep(1200);
    ctx.log(`   voltou à área 1: itens na tira=${mgr()._strips.get(0)._count} palco=${stageOf().active.windows.map(w => w.get_title())}`);
    await ctx.shot('e5-area-1-de-volta');
}
