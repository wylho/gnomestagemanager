// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const center = t => { const r = rect(t); return `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`; };

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    ctx.log(`1. B no palco, centralizada: centro=${center('B')} (esperado 960,528)`);

    // arrasta B pelo título para outro lugar
    const r = rect('B');
    await ctx.drag(r.x + 350, r.y + 18, r.x + 350 - 400, r.y + 18 + 150); await ctx.sleep(900);
    const moved = R('B');
    ctx.log(`2. arrastei B: agora ${moved} (centro=${center('B')})`);

    // troca para A e volta para B
    let [x, y] = itemCenter('A'); await ctx.click(x, y); await ctx.sleep(1200);
    [x, y] = itemCenter('B'); await ctx.click(x, y); await ctx.sleep(1200);
    ctx.log(`3. troquei para A e voltei para B: ${R('B')}  -> ${R('B') === moved ? 'FICOU ONDE EU DEIXEI (consistente)' : 'MUDOU DE LUGAR (bug)'}`);

    // atalho "centralizar": reorganizar o grupo (para 1 janela = centralizar)
    mgr().arrangeGroup(); await ctx.sleep(900);
    ctx.log(`4. Super+Alt+R: centro=${center('B')} (esperado 960,528)`);

    // com "lembrar posição" desligado, sempre centraliza ao voltar
    st().set_boolean('remember-position', false);
    await ctx.drag(rect('B').x + 350, rect('B').y + 18, rect('B').x - 100, rect('B').y + 100); await ctx.sleep(900);
    const moved2 = R('B');
    [x, y] = itemCenter('A'); await ctx.click(x, y); await ctx.sleep(1200);
    [x, y] = itemCenter('B'); await ctx.click(x, y); await ctx.sleep(1200);
    ctx.log(`5. lembrar-posição DESLIGADO: movi (${moved2}), troquei e voltei: centro=${center('B')} (esperado 960,528)`);
}
