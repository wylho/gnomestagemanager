import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;

export default async function (ctx) {
    st().set_boolean('autotile', true);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a'], ['D', '#3584e4']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    // 3 e 2 itens na tira para sobrar uma tira com itens enquanto o grupo preenche
    let [x, y] = itemCenter('C'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    dump(ctx, '1. D+C em autotiling (tira ainda com B e A)');
    await ctx.shot('t1-duas');
    [x, y] = itemCenter('B'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    dump(ctx, '2. D+C+B em autotiling');
    await ctx.shot('t2-tres');
    [x, y] = itemCenter('A'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    dump(ctx, '3. quatro janelas, tira vazia: preenche a tela toda');
    await ctx.shot('t3-quatro');

    // redimensionar: arrasta a borda direita da janela da esquerda
    const left = ['A', 'B', 'C', 'D'].map(t => [t, rect(t)]).sort((p, q) => p[1].x - q[1].x)[0];
    const [lt, lr] = left;
    ctx.log(`4. redimensionar ${lt} (${R(lt)}) pela borda direita +150px`);
    await ctx.drag(lr.x + lr.width + 3, lr.y + lr.height / 2, lr.x + lr.width + 153, lr.y + lr.height / 2); await ctx.sleep(1200);
    ctx.log(`   depois: ${R(lt)}  (largura ${rect(lt).width} vs ${lr.width} antes)`);
    dump(ctx, '4. depois de redimensionar (vizinhas se acomodam)');
    await ctx.shot('t4-redimensionada');

    // trocar: arrastar uma janela e soltar sobre outra
    const rs = ['A', 'B', 'C', 'D'].map(t => [t, rect(t)]);
    const [t0, r0] = rs[0], [t1, r1] = rs[1];
    const before0 = R(t0), before1 = R(t1);
    await ctx.drag(r0.x + r0.width / 2, r0.y + 18, r1.x + r1.width / 2, r1.y + r1.height / 2); await ctx.sleep(1200);
    ctx.log(`5. soltei ${t0} sobre ${t1}: ${t0} ${before0} -> ${R(t0)} ; ${t1} ${before1} -> ${R(t1)} (esperado: trocaram de célula)`);
    await ctx.shot('t5-trocadas');

    // tirar uma janela do grupo: tudo se reorganiza e preenche
    mgr().removeFocusedFromStage(); await ctx.sleep(1100);
    dump(ctx, '6. removida uma do grupo (restantes preenchem)');
    await ctx.shot('t6-removida');

    // desligar autotiling: volta ao mosaico
    st().set_boolean('autotile', false); await ctx.sleep(1200);
    dump(ctx, '7. autotile desligado (mosaico de volta)');
}
