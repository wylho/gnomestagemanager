// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

const menuOf = t => { const s = mgr()._stageFor(mgr()._wsKey(0), 0); const set = s.recents.find(x => x.windows.some(w => w.get_title() === t)); return mgr()._strips.get(0)._items.get(set)?._menu; };
const labels = menu => menu._getMenuItems().map(i => i.label?.text ?? (i.actor.has_style_class_name?.('popup-separator-menu-item') ? '---' : '?'));
const clickMenuItem = async (ctx, menu, text) => {
    const it = menu._getMenuItems().find(i => i.label?.text === text);
    if (!it) throw new Error(`item "${text}" não existe no menu`);
    const [x, y] = it.actor.get_transformed_position(); const [w, h] = it.actor.get_transformed_size();
    await ctx.click(x + w / 2, y + h / 2); await ctx.sleep(1100);
};

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a'], ['D', '#3584e4']]) { ctx.spawn(t, c, 640, 400); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    let [x, y] = itemCenter('B');
    await ctx.rightClick(x, y);
    const menu = menuOf('B');
    ctx.log(`1. botão direito em B: menu aberto=${menu?.isOpen}; itens: ${labels(menu).join(' | ')}`);
    await ctx.shot('m1-menu');

    await clickMenuItem(ctx, menu, 'Bring to the stage');
    dump(ctx, '2. "Trazer para o palco" (esperado: B no palco)');

    // grupo de 2 no strip? junta B+A em um conjunto (Shift) e testa os itens de grupo
    [x, y] = itemCenter('A'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1000);
    const st = mgr()._stageFor(mgr()._wsKey(0), 0);
    mgr().removeFocusedFromStage(); await ctx.sleep(900);   // A volta para a tira
    mgr().addSetToStage(st.recents.find(s => s.windows[0].get_title() === 'A')); await ctx.sleep(900);
    dump(ctx, '3. grupo B+A no palco; C e D na tira');
    [x, y] = itemCenter('C'); await ctx.click(x, y, {shift: true}); await ctx.sleep(900);
    // coloca o grupo inteiro (B+A+C) na tira para testar itens de conjunto com várias janelas
    mgr().toggleReveal(0); await ctx.sleep(1100);
    dump(ctx, '4. grupo B+A+C na tira (palco vazio)');
    const grp = st.recents.find(s => s.windows.length > 1);
    const r = mgr()._strips.get(0).slotRect(grp);
    await ctx.rightClick(r.x + r.width / 2, r.y + r.height / 2);
    const gm = mgr()._strips.get(0)._items.get(grp)._menu;
    ctx.log(`   menu do grupo: ${labels(gm).join(' | ')}`);
    await ctx.shot('m2-menu-grupo');
    await clickMenuItem(ctx, gm, 'Split the windows in the strip');
    dump(ctx, '5. "Separar as janelas na tira" (esperado: B, A, C em itens separados)');

    // fechar pela tira
    [x, y] = itemCenter('C'); await ctx.rightClick(x, y);
    await clickMenuItem(ctx, menuOf('C'), 'Close window');
    await ctx.sleep(800);
    dump(ctx, '6. "Fechar janela" em C (esperado: C some)');

    // autotiling pelo menu
    [x, y] = itemCenter('A'); await ctx.rightClick(x, y);
    const am = menuOf('A');
    const sw = am._getMenuItems().find(i => i.label?.text === 'Autotiling for groups');
    ctx.log(`7. interruptor de autotiling no menu: ${!!sw}, estado=${sw?.state}`);
    sw?.toggle(); await ctx.sleep(500);
    ctx.log(`   depois de alternar: autotile=${Extension.lookupByUUID('stage-manager@wyliam')._settings.get_boolean('autotile')}`);
    am.close();
}
