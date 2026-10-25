import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const area = () => Main.layoutManager.getWorkAreaForMonitor(0);

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(900);
    ctx.log(`área útil: ${area().width}x${area().height}+${area().x}+${area().y}`);
    ctx.log(`0. autotiling DESLIGADO, B sozinha: ${R('B')} (centralizada, tamanho natural)`);

    st().set_boolean('autotile', true); await ctx.sleep(1200);
    ctx.log(`1. autotiling LIGADO, B sozinha (tira com A): ${R('B')}  (esperado: x=${10 + 14 * 2 + Math.round(1920 * 0.085)}, largura=${1920 - 20 - 14 * 2 - Math.round(1920 * 0.085)}, altura=${area().height - 20})`);
    await ctx.shot('u1-uma-janela-com-tira');

    // arrastar a janela única: volta a preencher
    const r = rect('B');
    await ctx.drag(r.x + r.width / 2, r.y + 18, r.x + r.width / 2 - 300, r.y + 200); await ctx.sleep(1100);
    ctx.log(`2. arrastei B: ${R('B')} (esperado igual ao passo 1: volta a preencher)`);

    // tira vazia: preenche a tela toda
    const [x, y] = itemCenter('A'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    mgr().removeFocusedFromStage(); await ctx.sleep(1100);
    dump(ctx, '3. agora com A de volta à tira');
    // sem itens na tira: fecha A
    winByTitle('A').delete(global.get_current_time()); await ctx.sleep(1500);
    ctx.log(`4. A fechada, tira vazia, B sozinha: ${R('B')} (esperado x=10, largura=${1920 - 20})`);
    await ctx.shot('u4-uma-janela-sem-tira');

    // novo app aparece: ele passa a preencher e B vai para a tira
    ctx.spawn('C', '#e5a50a', 700, 440); await ctx.waitWin('C'); await ctx.sleep(1500);
    ctx.log(`5. C abriu: C=${R('C')} (preenche com tira reservada), B minimizada=${winByTitle('B').minimized}`);

    // desligar: volta ao natural e centralizado
    st().set_boolean('autotile', false); await ctx.sleep(1300);
    ctx.log(`6. autotiling DESLIGADO de novo: C=${R('C')} (esperado 700x440 centralizada)`);
}
