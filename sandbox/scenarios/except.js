// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const stage = () => mgr()._stageFor(mgr()._wsKey(0), 0);
const names = s => s ? s.windows.map(w => w.get_title()).join('+') : '-';
const rect = t => winByTitle(t).get_frame_rect();

export default async function (ctx) {
    ctx.spawn('Calc', '#c01c28', 600, 400, 'org.stagetest.calc'); await ctx.waitWin('Calc'); await ctx.sleep(800);
    ctx.spawn('Notas', '#26a269', 600, 400, 'org.stagetest.notes'); await ctx.waitWin('Notas'); await ctx.sleep(800);
    ctx.spawn('Chat', '#3584e4', 600, 400, 'org.stagetest.chat'); await ctx.waitWin('Chat'); await ctx.sleep(1000);
    ctx.log(`1. palco=${names(stage().active)} tira=[${stage().recents.map(names)}]`);

    // --- escolher com o mouse uma janela VISÍVEL no palco (Chat) ---
    st().set_boolean('pick-request', true); await ctx.sleep(1200);
    ctx.log(`2. seletor aberto=${!!mgr()._picker}`);
    const r = rect('Chat');
    ctx.move(r.x + 200, r.y + 150); await ctx.sleep(500);
    await ctx.shot('x1-selecionando');
    await ctx.click(r.x + 200, r.y + 150); await ctx.sleep(1100);
    ctx.log(`3. clicou em Chat: exceções=${JSON.stringify(st().get_strv('excluded-classes'))}; Chat no modelo=${mgr()._setOf.has(winByTitle('Chat'))}; palco=${names(stage().active)} tira=[${stage().recents.map(names)}]`);
    ctx.log(`   seletor fechou=${!mgr()._picker}; pick-request=${st().get_boolean('pick-request')}`);

    // --- escolher pela miniatura da tira (Calc, escondida) ---
    st().set_boolean('pick-request', true); await ctx.sleep(1200);
    const [x, y] = itemCenter('Calc');
    await ctx.click(x, y); await ctx.sleep(1100);
    ctx.log(`4. clicou na miniatura de Calc: exceções=${JSON.stringify(st().get_strv('excluded-classes'))}; Calc no modelo=${mgr()._setOf.has(winByTitle('Calc'))}; Calc minimizada=${winByTitle('Calc').minimized} (esperado false: voltou a ficar solta)`);
    ctx.log(`   palco=${names(stage().active)} tira=[${stage().recents.map(names)}]`);

    // --- Esc cancela ---
    st().set_boolean('pick-request', true); await ctx.sleep(1200);
    const before = JSON.stringify(st().get_strv('excluded-classes'));
    // Esc via teclado virtual do driver não existe: cancela pelo método (equivale ao Esc)
    mgr()._picker.cancel(); await ctx.sleep(400);
    ctx.log(`5. cancelou: exceções iguais=${JSON.stringify(st().get_strv('excluded-classes')) === before}; seletor fechou=${!mgr()._picker}`);

    // --- remover da lista: volta a ser gerenciado ---
    st().set_strv('excluded-classes', st().get_strv('excluded-classes').filter(c => c !== 'org.stagetest.chat')); await ctx.sleep(1200);
    ctx.log(`6. removeu Chat da lista: Chat no modelo=${mgr()._setOf.has(winByTitle('Chat'))}; palco=${names(stage().active)}`);

    // --- atalho de alternar (janela em foco) ---
    winByTitle('Notas').activate(global.get_current_time()); await ctx.sleep(900);
    mgr().toggleException(); await ctx.sleep(900);
    ctx.log(`7. alternar exceção em Notas: exceções=${JSON.stringify(st().get_strv('excluded-classes'))}; Notas no modelo=${mgr()._setOf.has(winByTitle('Notas'))}`);
    mgr().toggleException(); await ctx.sleep(900);
    ctx.log(`   de novo: exceções=${JSON.stringify(st().get_strv('excluded-classes'))}; Notas no modelo=${mgr()._setOf.has(winByTitle('Notas'))} (esperado true)`);

    // --- menu da tira: "Ignorar este aplicativo" ---
    const sets = stage().recents;
    ctx.log(`8. itens na tira: ${sets.map(names)}`);
}
