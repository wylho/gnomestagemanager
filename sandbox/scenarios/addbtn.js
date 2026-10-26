// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {mgr, itemCenter} from './helpers.js';
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const items = () => [...mgr()._strips.get(0)._items.values()];
export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) { ctx.spawn(t, c, 640, 400); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(900);
    ctx.log(`1. padrão (show-add-button=${st().get_boolean('show-add-button')}): itens com botão + = ${items().filter(i => i._add).length} de ${items().length}`);
    const [x, y] = itemCenter('B'); ctx.move(x, y); await ctx.sleep(500);
    await ctx.shot('add-on');
    st().set_boolean('show-add-button', false); await ctx.sleep(800);
    ctx.log(`2. desligado: itens com botão + = ${items().filter(i => i._add).length} de ${items().length} (esperado 0)`);
    ctx.move(x, y + 3); await ctx.sleep(500);
    await ctx.shot('add-off');
    // com o botão desligado, Shift+clique continua adicionando ao grupo
    await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    const st0 = mgr()._stageFor(mgr()._wsKey(0), 0);
    ctx.log(`3. Shift+clique continua funcionando: palco=${st0.active.windows.map(w => w.get_title())}`);
    st().set_boolean('show-add-button', true); await ctx.sleep(800);
    ctx.log(`4. religado: itens com botão + = ${items().filter(i => i._add).length} de ${items().length}`);
}
