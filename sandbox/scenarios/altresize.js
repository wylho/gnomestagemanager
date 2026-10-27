// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {winByTitle} from './helpers.js';

const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const rect = t => winByTitle(t).get_frame_rect();
const C = r => [r.x + r.width / 2, r.y + r.height / 2];

async function resize(ctx, title, grab, d, withAlt) {
    const w = winByTitle(title);
    w.move_resize_frame(true, 610, 330, 700, 440); await ctx.sleep(500);
    const r0 = rect(title), c0 = C(r0);
    const samples = [];
    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => { const r = rect(title); samples.push({w: r.width, h: r.height, c: C(r)}); return GLib.SOURCE_CONTINUE; });
    const [gx, gy] = grab(r0);
    ctx.move(gx, gy); await ctx.sleep(200);
    if (withAlt) { ctx.keyDown(Clutter.KEY_Alt_L); await ctx.sleep(100); }
    ctx.mouseDown(); await ctx.sleep(150);
    await ctx.moveSmooth(gx, gy, gx + d[0], gy + d[1], 24); await ctx.sleep(300);
    ctx.mouseUp(); await ctx.sleep(150);
    if (withAlt) ctx.keyUp(Clutter.KEY_Alt_L);
    await ctx.sleep(500);
    GLib.source_remove(id);
    const r1 = rect(title), c1 = C(r1);
    // tremor: quantas vezes a largura mudou de direção durante o arrasto
    let flips = 0, prev = 0;
    for (let i = 1; i < samples.length; i++) { const dw = samples[i].w - samples[i - 1].w; if (dw && prev && Math.sign(dw) !== Math.sign(prev)) flips++; if (dw) prev = dw; }
    const drift = Math.max(...samples.map(s => Math.hypot(s.c[0] - c0[0], s.c[1] - c0[1])));
    return {antes: `${r0.width}x${r0.height}`, depois: `${r1.width}x${r1.height}`, deltaW: r1.width - r0.width, deltaH: r1.height - r0.height,
        centroFinal: `${Math.abs(c1[0] - c0[0]).toFixed(0)},${Math.abs(c1[1] - c0[1]).toFixed(0)} px de desvio`, desvioMaxDuranteArrasto: drift.toFixed(0), inversoesDeLargura: flips, amostras: samples.length};
}

export default async function (ctx) {
    st().set_boolean('recenter-after-resize', false);          // isolar o efeito do arrasto
    ctx.spawn('B', '#26a269', 700, 440); await ctx.waitWin('B'); await ctx.sleep(1500);
    const right = r => [r.x + r.width + 3, r.y + r.height / 2];
    const left = r => [r.x - 3, r.y + r.height / 2];
    const se = r => [r.x + r.width + 3, r.y + r.height + 3];
    const log = (n, o) => ctx.log(`${n}: ${JSON.stringify(o)}`);
    const mode = m => st().set_string('center-resize', m);
    mode('alt');
    log('1. alt: borda direita +100 SEM Alt (esperado: +100 normal)', await resize(ctx, 'B', right, [100, 0], false));
    log('2. alt: borda direita +100 COM Alt (esperado: +200, centro parado)', await resize(ctx, 'B', right, [100, 0], true));
    log('3. alt: borda esquerda -60 COM Alt (esperado: +120, centro parado)', await resize(ctx, 'B', left, [-60, 0], true));
    log('4. alt: canto sudeste +80,+60 COM Alt (esperado: +160 x +120, centro parado)', await resize(ctx, 'B', se, [80, 60], true));
    log('5. alt: borda direita -80 COM Alt (encolher: esperado -160, centro parado)', await resize(ctx, 'B', right, [-80, 0], true));
    mode('always');
    log('6. always: borda direita +100 SEM Alt (esperado: +200, centro parado)', await resize(ctx, 'B', right, [100, 0], false));
    log('7. always: canto sudeste +80,+60 SEM Alt (esperado: +160 x +120, centro parado)', await resize(ctx, 'B', se, [80, 60], false));
    log('8. always: borda esquerda -60 SEM Alt (esperado: +120, centro parado)', await resize(ctx, 'B', left, [-60, 0], false));
    log('9. always: borda direita +100 COM Alt (esperado: normal, +100)', await resize(ctx, 'B', right, [100, 0], true));
    mode('off');
    log('10. off: borda direita +100 SEM Alt (esperado: +100 normal)', await resize(ctx, 'B', right, [100, 0], false));
    log('11. off: borda direita +100 COM Alt (esperado: +100 normal)', await resize(ctx, 'B', right, [100, 0], true));
}
