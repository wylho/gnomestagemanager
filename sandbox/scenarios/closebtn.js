// SPDX-License-Identifier: GPL-3.0-or-later
// Botão × e clique do meio nas miniaturas da tira.
import Clutter from 'gi://Clutter';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {mgr, winByTitle} from './helpers.js';

const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const titles = () => global.get_window_actors().map(a => a.meta_window).filter(w => w.get_window_type() === 0).map(w => w.get_title()).sort().join(',');
const itemOf = t => { const stg = mgr()._stageFor(mgr()._wsKey(0), 0); const set = stg.recents.find(s => s.windows.some(w => w.get_title() === t)); return mgr()._strips.get(0)._items.get(set); };

export default async function (ctx) {
    ctx.move(300, 500);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a'], ['D', '#3584e4']]) { ctx.spawn(t, c, 600, 380); await ctx.waitWin(t); await ctx.sleep(900); }
    await ctx.sleep(800);
    ctx.log(`0. janelas: ${titles()} (palco D; tira A,B,C)`);

    // clique do meio em A
    let it = itemOf('A'); let [x, y] = it.actor.get_transformed_position(); let [w, h] = it.actor.get_transformed_size();
    ctx.move(x + w / 2, y + h / 2); await ctx.sleep(300);
    ctx.mouseDown(Clutter.BUTTON_MIDDLE); await ctx.sleep(60); ctx.mouseUp(Clutter.BUTTON_MIDDLE); await ctx.sleep(1200);
    ctx.log(`1. clique do meio na miniatura de A -> janelas: ${titles()} (esperado: sem A)`);

    // botão ×: passa o mouse em B e clica no canto superior esquerdo da miniatura
    it = itemOf('B'); [x, y] = it.actor.get_transformed_position(); [w, h] = it.actor.get_transformed_size();
    ctx.move(x + w / 2, y + h / 2); await ctx.sleep(500);
    await ctx.shot('cb-hover');
    const [cx, cy] = it._close.get_transformed_position(); const [cw, ch] = it._close.get_transformed_size();
    ctx.log(`   botão × visível: opacidade=${it._close.opacity} em ${Math.round(cx)},${Math.round(cy)} ${cw}x${ch}`);
    await ctx.click(cx + cw / 2, cy + ch / 2); await ctx.sleep(1200);
    ctx.log(`2. clique no × de B -> janelas: ${titles()} (esperado: sem B)`);

    // opção desligada: sem botão, mas o clique do meio continua
    st().set_boolean('show-close-button', false); await ctx.sleep(500);
    it = itemOf('C'); ctx.log(`3. opção desligada: botão existe=${!!it._close}`);
    [x, y] = it.actor.get_transformed_position(); [w, h] = it.actor.get_transformed_size();
    ctx.move(x + w / 2, y + h / 2); await ctx.sleep(300);
    ctx.mouseDown(Clutter.BUTTON_MIDDLE); await ctx.sleep(60); ctx.mouseUp(Clutter.BUTTON_MIDDLE); await ctx.sleep(1200);
    ctx.log(`   clique do meio em C -> janelas: ${titles()} (esperado: só D)`);
}
