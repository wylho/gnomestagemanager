import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

const strip = () => mgr()._strips.get(0);
const front = () => mgr()._fronts.get(0);
const order = ctx => {
    const behind = strip().actor.get_parent() === Main.layoutManager._backgroundGroup;
    ctx.log(`   tira de trás: ${behind ? 'dentro do papel de parede (ATRÁS das janelas)' : 'FORA do lugar'} visível=${strip().actor.visible}; tira da frente: visível=${front().actor.visible} covered=${front()._covered}`);
};

export default async function (ctx) {
    for (const [t, c, w, h] of [['A', '#c01c28', 700, 440], ['B', '#26a269', 700, 440], ['Grande', '#3584e4', 1000, 600]]) {
        ctx.spawn(t, c, w, h); await ctx.waitWin(t); await ctx.sleep(900);
    }
    await ctx.sleep(1200);
    winByTitle('Grande').move_resize_frame(true, 100, 60, 1700, 930); await ctx.sleep(900);
    dump(ctx, '1. janela grande (1700x930 em x=100, cobrindo parte da tira) no palco; a tira deve aparecer ATRÁS dela');
    order(ctx);
    await ctx.shot('b1-janela-grande');

    // passar o mouse na parte VISÍVEL da tira não pode criar uma cópia por cima
    const rr = strip().slotRect(mgr()._stageFor(mgr()._wsKey(0), 0).recents.find(s => s.windows[0].get_title() === 'B'));
    ctx.move(rr.x + 30, rr.y + rr.height / 2); await ctx.sleep(900);
    ctx.log(`1b. mouse sobre a parte visível da tira: tira da frente visível=${front().actor.visible} (esperado false), covered=${front()._covered} (esperado false)`);
    ctx.move(1000, 540); await ctx.sleep(700);

    // parte visível da tira (à esquerda da janela) continua clicável
    const [x, y] = itemCenter('B');
    const r = strip().slotRect(mgr()._stageFor(mgr()._wsKey(0), 0).recents.find(s => s.windows[0].get_title() === 'B'));
    const wr = winByTitle('Grande').get_frame_rect();
    ctx.log(`   item B: x=${r.x}..${r.x + r.width}; janela grande começa em x=${wr.x} (item ${r.x + r.width > wr.x ? 'cortado' : 'livre'} pela janela)`);
    await ctx.click(r.x + 20, y); await ctx.sleep(1200);
    dump(ctx, '2. clique na parte VISÍVEL do item B (esperado: B vai ao palco)');
    order(ctx);

    // voltar para a grande e maximizar: tira totalmente coberta; borda a traz para frente
    const [gx, gy] = itemCenter('Grande');
    await ctx.click(gx - 40, gy); await ctx.sleep(1200);
    const g = winByTitle('Grande'); g.maximize(); await ctx.sleep(1100);
    ctx.log('3. janela maximizada'); order(ctx);
    await ctx.shot('b2-maximizada-tira-atras');
    ctx.move(2, 540); await ctx.sleep(800);
    ctx.log('4. ponteiro na borda esquerda'); order(ctx);
    await ctx.shot('b3-borda-traz-para-frente');
    ctx.move(1000, 540); await ctx.sleep(1500);
    ctx.log('5. ponteiro saiu'); order(ctx);
    g.unmaximize(); await ctx.sleep(1000);

    // grupo grande: usa a tela toda, cobrindo a tira
    const sets = mgr()._stageFor(mgr()._wsKey(0), 0).recents;
    for (const s of [...sets]) { const rr = strip().slotRect(s); await ctx.click(rr.x + 20, rr.y + rr.height / 2, {shift: true}); await ctx.sleep(1100); }
    dump(ctx, '6. grupo com todas as janelas (mosaico em tela cheia)');
    order(ctx);
    await ctx.shot('b4-grupo-cheio');
}
