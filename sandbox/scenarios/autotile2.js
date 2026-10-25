import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const info = ctx => { const s = mgr()._strips.get(0), f = mgr()._fronts.get(0); ctx.log(`   tira de trás: visível=${s.actor.visible} modo=${s._mode}; tira da frente: visível=${f.actor.visible}; janelas visíveis: ${['A','B','C','D'].filter(t => !winByTitle(t).minimized).map(t => t + '@x' + rect(t).x).join(' ')}`); };

export default async function (ctx) {
    st().set_boolean('autotile', true);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a'], ['D', '#3584e4']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(1000);
    let [x, y] = itemCenter('C'); await ctx.click(x, y, {shift: true}); await ctx.sleep(1100);
    ctx.log('1. autotiling, tira sempre visível (padrão), show-recents=true'); info(ctx);

    st().set_boolean('show-recents', false); await ctx.sleep(1200);
    ctx.log('2. show-recents=false mas autotiling impõe "sempre visível"'); info(ctx);
    await ctx.shot('s2-sempre-visivel');

    st().set_boolean('autotile-strip-always', false); await ctx.sleep(1300);
    ctx.log('3. autotile-strip-always=false: tira escondida, janelas ocupam a tela toda'); info(ctx);
    await ctx.shot('s3-escondida');
    ctx.move(2, 540); await ctx.sleep(900);
    ctx.log('4. ponteiro na borda esquerda: a tira da frente aparece'); info(ctx);
    await ctx.shot('s4-borda');
    ctx.move(1000, 540); await ctx.sleep(1500);
    ctx.log('5. ponteiro saiu'); info(ctx);

    // com um grupo SEM autotiling, show-recents=false volta a valer a regra normal
    st().set_boolean('autotile', false); await ctx.sleep(1200);
    ctx.log('6. autotile desligado, show-recents=false (regra normal: auto-ocultar)'); info(ctx);
    st().set_boolean('show-recents', true); st().set_boolean('autotile-strip-always', true);
}
