import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {dump, mgr, itemCenter, winByTitle} from './helpers.js';

const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const stage = () => mgr()._stageFor(mgr()._wsKey(0), 0);
const names = s => s ? s.windows.map(w => w.get_title()).join('+') : '-';
const PIP = 'Picture in picture';

export default async function (ctx) {
    st().set_boolean('autotile', true);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(900);
    ctx.log(`1. autotiling; palco=${names(stage().active)} tira=[${stage().recents.map(names)}]`);

    ctx.spawn(PIP, '#613583', 480, 270); await ctx.waitWin(PIP); await ctx.sleep(1600);
    ctx.log(`2. PiP abriu: palco=${names(stage().active)} tira=[${stage().recents.map(names)}] (esperado palco=B+PiP, A continua na tira)`);
    ctx.log(`   B=${R('B')}  PiP=${R(PIP)}  proporção PiP=${(rect(PIP).width / rect(PIP).height).toFixed(2)} (16:9=1.78)`);
    await ctx.shot('p1-pip-no-palco');

    // trocar de palco: PiP some junto com o grupo
    let [x, y] = itemCenter('A'); await ctx.click(x, y); await ctx.sleep(1300);
    ctx.log(`3. fui para A: palco=${names(stage().active)} tira=[${stage().recents.map(names)}]; PiP minimizado=${winByTitle(PIP).minimized} (esperado true)`);
    const bset = stage().recents.find(s => s.has(winByTitle('B')));
    ctx.log(`   item do grupo B+PiP usa miniatura de: ${bset.top.get_title()} (esperado B)`);
    await ctx.shot('p2-outro-palco');
    [x, y] = itemCenter('B'); await ctx.click(x, y); await ctx.sleep(1300);
    ctx.log(`4. voltei para B: palco=${names(stage().active)}; PiP minimizado=${winByTitle(PIP).minimized} (esperado false); PiP=${R(PIP)}`);

    // arrastar o PiP para o canto superior esquerdo
    const r = rect(PIP);
    await ctx.drag(r.x + r.width / 2, r.y + 18, 300, 150); await ctx.sleep(1300);
    ctx.log(`5. arrastei o PiP para o canto superior esquerdo: PiP=${R(PIP)} B=${R('B')}`);
    await ctx.shot('p3-canto-sup-esq');

    // redimensionar o PiP (canto inferior direito): mais largo -> B cede
    const r2 = rect(PIP), bw = rect('B').width;
    await ctx.drag(r2.x + r2.width + 3, r2.y + r2.height + 3, r2.x + r2.width + 103, r2.y + r2.height + 63); await ctx.sleep(1300);
    ctx.log(`6. aumentei o PiP: antes ${r2.width}x${r2.height} -> ${R(PIP)}; B ${bw} -> ${rect('B').width} de largura`);
    await ctx.shot('p4-pip-maior');

    // modo mosaico (sem autotiling): B centralizada na área que sobra
    st().set_boolean('autotile', false); await ctx.sleep(1300);
    ctx.log(`7. sem autotiling: B=${R('B')} PiP=${R(PIP)}`);
    await ctx.shot('p5-mosaico-com-pip');
    st().set_boolean('autotile', true); await ctx.sleep(900);

    // título que chega depois de abrir (como pode acontecer no Firefox)
    ctx.spawn('Navegador', '#e66100', 700, 440); await ctx.waitWin('Navegador'); await ctx.sleep(1500);
    ctx.log(`8. janela nova 'Navegador' abriu: palco=${names(stage().active)}`);
    ctx.spawn('Aguarde', '#1a5fb4', 480, 270, '', '', 'Picture-in-Picture'); await ctx.waitWin('Aguarde'); await ctx.sleep(500);
    const sw0 = names(stage().active);
    await ctx.sleep(1800);
    const late = global.get_window_actors().map(a => a.meta_window).find(w => w.get_title() === 'Picture-in-Picture');
    ctx.log(`   título virou PiP depois: palco=${names(stage().active)} (esperado Navegador+PiP+... com o PiP junto); antes do título: ${sw0}`);
    ctx.log(`   PiP tardio no mesmo conjunto que 'Navegador': ${stage().active?.windows.includes(late)}`);
    await ctx.shot('p6-pip-tardio');
}
