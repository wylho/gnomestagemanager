// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const stripInfo = ctx => { const s = mgr()._strips.get(0); ctx.log(`   tira: _shown=${s._shown} visível=${s.actor.visible} opac=${Math.round(s.actor.opacity)} itens=${s._count}`); };
const now = () => global.get_current_time();

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) {
        ctx.spawn(t, c, 660, 420); await ctx.waitWin(t); await ctx.sleep(900);
    }
    await ctx.sleep(900);
    dump(ctx, '1. inicial (palco=C tira=[B,A])'); stripInfo(ctx);

    winByTitle('C').minimize(); await ctx.sleep(900);
    dump(ctx, '2. usuário minimizou C (palco vazio; tira=[C,B,A])'); stripInfo(ctx);
    await ctx.shot('l2-palco-vazio');

    winByTitle('B').activate(now()); await ctx.sleep(1100);
    dump(ctx, '3. Alt-Tab/dock ativou B (palco=B tira=[C,A])');

    winByTitle('B').delete(now()); await ctx.sleep(1500);
    dump(ctx, '4. fechou B (palco promove C; tira=[A])');

    await ctx.click(1000, 950); await ctx.sleep(1000);
    dump(ctx, '5a. clicou no papel de parede (palco vazio)'); stripInfo(ctx);
    await ctx.shot('l5-area-de-trabalho');
    await ctx.click(1000, 950); await ctx.sleep(1000);
    dump(ctx, '5b. clicou de novo (volta C)');

    winByTitle('C').maximize(); await ctx.sleep(900);
    dump(ctx, '6a. maximizou C (tira some)'); stripInfo(ctx);
    ctx.move(2, 500); await ctx.sleep(700);
    ctx.log('   (ponteiro na borda esquerda)'); stripInfo(ctx);
    await ctx.shot('l6-maximizada-hover-borda');
    ctx.move(900, 500); await ctx.sleep(1200);
    winByTitle('C').unmaximize(); await ctx.sleep(900);
    dump(ctx, '6b. restaurou C (tira volta)'); stripInfo(ctx);

    // janela cobrindo a tira
    const c = winByTitle('C'); c.move_frame(true, 40, 300); await ctx.sleep(700);
    dump(ctx, '7a. C movida por cima da tira (tira some)'); stripInfo(ctx);
    c.move_frame(true, 600, 300); await ctx.sleep(700);
    dump(ctx, '7b. C longe da tira'); stripInfo(ctx);

    // auto-ocultar
    const st = Extension.lookupByUUID('stage-manager@wyliam')._settings;
    st.set_boolean('show-recents', false); await ctx.sleep(800);
    ctx.log('8a. show-recents=false'); stripInfo(ctx);
    ctx.move(2, 500); await ctx.sleep(700); ctx.log('8b. ponteiro na borda'); stripInfo(ctx);
    await ctx.shot('l8-autohide-revelada');
    ctx.move(900, 500); await ctx.sleep(1200); ctx.log('8c. ponteiro saiu'); stripInfo(ctx);
    st.set_boolean('show-recents', true); await ctx.sleep(600);

    // desligar: tudo volta
    st.set_boolean('enabled', false); await ctx.sleep(1500);
    dump(ctx, '9. desligado (nenhuma minimizada por nós)');
    st.set_boolean('enabled', true); await ctx.sleep(1500);
    dump(ctx, '10. religado'); stripInfo(ctx);
}
