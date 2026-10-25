import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {mgr, itemCenter, winByTitle} from './helpers.js';
const rect = t => winByTitle(t).get_frame_rect();
const R = t => { const r = rect(t); return `${r.width}x${r.height}+${r.x}+${r.y}`; };
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const area = () => Main.layoutManager.getWorkAreaForMonitor(0);
const centered = t => { const r = rect(t), a = area(); return Math.abs((r.x + r.width / 2) - (a.x + a.width / 2)) <= 2 && Math.abs((r.y + r.height / 2) - (a.y + a.height / 2)) <= 2; };
const stage = () => mgr()._stageFor(mgr()._wsKey(0), 0);

export default async function (ctx) {
    ctx.log(`exclusões padrão: ${JSON.stringify(st().get_strv('excluded-classes'))}`);
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269']]) { ctx.spawn(t, c, 700, 440); await ctx.waitWin(t); await ctx.sleep(800); }
    await ctx.sleep(900);
    ctx.log(`1. B centralizada? ${centered('B')} (${R('B')})`);

    // --- SEM o bloqueio (padrão): arrastar deixa onde soltou
    let r = rect('B');
    await ctx.drag(r.x + 350, r.y + 18, r.x + 350 - 300, r.y + 18 + 160); await ctx.sleep(1100);
    ctx.log(`2. lock-center DESLIGADO, arrastei B: centralizada? ${centered('B')} (esperado false) ${R('B')}`);
    const [x0, y0] = itemCenter('A'); await ctx.click(x0, y0); await ctx.sleep(1100);
    const [x1, y1] = itemCenter('B'); await ctx.click(x1, y1); await ctx.sleep(1100);

    // --- COM o bloqueio
    st().set_boolean('lock-center', true); await ctx.sleep(500);
    r = rect('B');
    await ctx.drag(r.x + r.width / 2, r.y + 18, r.x + r.width / 2 - 350, r.y + 18 + 200); await ctx.sleep(1200);
    ctx.log(`3. lock-center LIGADO, arrastei B: centralizada? ${centered('B')} (esperado true) ${R('B')}`);

    r = rect('B');
    await ctx.drag(r.x + r.width + 3, r.y + r.height + 3, r.x + r.width + 153, r.y + r.height + 93); await ctx.sleep(1200);
    ctx.log(`4. redimensionei B (canto +150,+90): centralizada? ${centered('B')} (esperado true) ${R('B')}`);

    winByTitle('B').move_frame(true, 40, 60); await ctx.sleep(700);
    ctx.log(`5. o app mexeu na posição (move_frame direto): centralizada? ${centered('B')} (esperado true) ${R('B')}`);

    // --- grupo (mosaico) com bloqueio: largar longe do grupo também volta
    const [xa, ya] = itemCenter('A'); await ctx.click(xa, ya, {shift: true}); await ctx.sleep(1200);
    const wins = stage().active.windows.map(w => w.get_title());
    const w0 = wins[0]; const r0 = rect(w0);
    const before = R(w0);
    await ctx.drag(r0.x + r0.width / 2, r0.y + 18, 1700, 950); await ctx.sleep(1200);
    ctx.log(`6. grupo ${wins.join('+')}: arrastei ${w0} para o canto da tela: ${before} -> ${R(w0)} (esperado voltar ao mosaico)`);

    // --- exceção: Sushi não é gerenciado
    const before2 = stage().active.windows.map(w => w.get_title()).join('+');
    ctx.spawn('Sushi', '#888888', 600, 400, 'org.gnome.NautilusPreviewer'); await ctx.waitWin('Sushi'); await ctx.sleep(1500);
    const sw = winByTitle('Sushi');
    ctx.log(`7. Sushi (org.gnome.NautilusPreviewer): no modelo=${mgr()._setOf.has(sw)} (esperado false); palco antes=${before2} depois=${stage().active.windows.map(w => w.get_title()).join('+')}; minimizado=${sw.minimized}`);
}
