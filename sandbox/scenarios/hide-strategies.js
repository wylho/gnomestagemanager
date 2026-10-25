// Mede, por estratégia de esconder uma janela, se o cliente continua recebendo quadros
// e se um Clutter.Clone dela continua renderizando.
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default async function (ctx) {
    ctx.spawn('A', '#c01c28', 700, 420);
    ctx.spawn('B', '#26a269', 700, 420);
    const A = await ctx.waitWin('A'), B = await ctx.waitWin('B');
    await ctx.sleep(1500);
    A.move_frame(true, 700, 80); B.move_frame(true, 80, 80);
    await ctx.sleep(500);
    ctx.log(`start: A=${JSON.stringify(A.get_frame_rect().x)} B=${JSON.stringify(B.get_frame_rect().x)} minimized=${B.minimized}`);

    const bActor = B.get_compositor_private();
    const holder = new St.Widget({x: 1500, y: 100, width: 380, height: 240, style: 'background-color: #222'});
    const clone = new Clutter.Clone({source: bActor, scale_x: 0.5, scale_y: 0.5});
    holder.add_child(clone);
    Main.layoutManager.uiGroup.add_child(holder);

    async function measure(name) {
        const f0 = ctx.frames('B');
        await ctx.sleep(1500);
        const f1 = ctx.frames('B');
        ctx.log(`${name}: frames +${f1 - f0} em 1.5s  (minimized=${B.minimized} actorVisible=${bActor.visible} opacity=${bActor.opacity})`);
        await ctx.shot(name);
    }

    await measure('1-baseline-visivel');

    B.minimize(); await ctx.sleep(900);
    await measure('2-minimizada');
    B.unminimize(); await ctx.sleep(900);

    const r = B.get_frame_rect();
    B.move_frame(true, -5000, 100); await ctx.sleep(500);
    await measure('3-fora-da-tela');
    B.move_frame(true, 80, 80); await ctx.sleep(500);

    bActor.hide(); await ctx.sleep(300);
    await measure('4-actor-hide');
    bActor.show(); await ctx.sleep(300);

    bActor.opacity = 0; await ctx.sleep(300);
    await measure('5-opacidade-0');
    bActor.opacity = 255;

    A.move_frame(true, 80, 80); A.raise(); await ctx.sleep(500);
    await measure('6-coberta-por-outra');
}
