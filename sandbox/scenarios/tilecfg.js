import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {mgr, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;

export default async function (ctx) {
    st().set_boolean('autotile-strip-always', false);   // sem reservar tira: facilita conferir margem
    st().set_boolean('autotile', true);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    mgr().addSetToStage(mgr()._stageFor(mgr()._wsKey(0), 0).recents[0]); await ctx.sleep(1200);
    // sem tira reservada, 2 janelas: usa a área toda
    const ar = Main.layoutManager.getWorkAreaForMonitor(0);
    const wins = ['A', 'B'].filter(t => !winByTitle(t).minimized);
    ctx.log(`área útil ${ar.width}x${ar.height}+${ar.x}+${ar.y}; visíveis: ${wins.join(',')}`);
    const show = label => ctx.log(`${label}: ${wins.map(t => `${t}=${R(t)}`).join('  ')}`);
    show('1. margem=10 espaço=10 (padrão)');
    st().set_int('autotile-margin', 40); st().set_int('autotile-gap', 30); await ctx.sleep(1000);
    show('2. margem=40 espaço=30');
    const rs = wins.map(rect), left = rs.reduce((a, r) => a.x < r.x ? a : r), right = rs.reduce((a, r) => a.x > r.x ? a : r);
    ctx.log(`   margem esquerda=${left.x - ar.x} (esperado 40); espaço entre janelas=${right.x - (left.x + left.width)} (esperado 30); margem direita=${ar.x + ar.width - (right.x + right.width)} (esperado 40); topo=${left.y - ar.y} (esperado 40)`);
    await ctx.shot('c2-margem40-espaco30');
    st().set_int('autotile-margin', 0); st().set_int('autotile-gap', 0); await ctx.sleep(1000);
    show('3. margem=0 espaço=0');

    // largura da tira
    st().set_boolean('autotile', false); await ctx.sleep(800);
    ctx.spawn('C', '#e5a50a', 700, 440); await ctx.waitWin('C'); await ctx.sleep(1200);
    const strip = mgr()._strips.get(0);
    const sets = mgr()._stageFor(mgr()._wsKey(0), 0).recents;
    ctx.log(`4. largura padrão da miniatura: ${strip.slotRect(sets[0]).width}px (esperado 160)`);
    st().set_int('thumbnail-width', 96); await ctx.sleep(900);
    ctx.log(`5. thumbnail-width=96: ${strip.slotRect(sets[0]).width}px (esperado 96)`);
    try { st().set_int('thumbnail-width', 0); } catch (e) { ctx.log(`6. tentar 0 é recusado: ${e.message.slice(0, 60)}`); }
    ctx.log(`   valor atual ainda: ${st().get_int('thumbnail-width')}`);
}
