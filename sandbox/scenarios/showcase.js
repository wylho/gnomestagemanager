// SPDX-License-Identifier: GPL-3.0-or-later
// Demonstração para o README: apps reais do GNOME, quadros gravados com as animações
// desaceleradas (slow_down_factor) e remontados na velocidade normal (frames.json).
import GLib from 'gi://GLib';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {mgr, itemCenter} from './helpers.js';

const DEMO = GLib.getenv('SANDBOX_DEMO');
const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const normalWins = () => global.get_window_actors().map(a => a.meta_window).filter(w => w.get_window_type() === 0 && !w.get_transient_for());

export default async function (ctx) {
    GLib.mkdir_with_parents(`${ctx.out}/frames`, 0o755);
    const frames = [];
    let n = 0;
    const now = () => GLib.get_monotonic_time() / 1000;
    const snap = async (ms, slow = 1) => {           // um quadro que fica `ms` na tela (já em tempo "normal")
        const name = `frames/f${String(++n).padStart(4, '0')}`;
        await ctx.shot(name, true);
        frames.push({f: `${name}.png`, d: Math.round(ms)});
    };
    const burst = async (realMs, slow) => {           // vários quadros seguidos; duração = intervalo real / slow
        const t0 = now();
        let last = t0;
        while (now() - t0 < realMs) {
            const name = `frames/f${String(++n).padStart(4, '0')}`;
            await ctx.shot(name, true);
            const t = now();
            frames.push({f: `${name}.png`, d: Math.max(30, Math.round((t - last) / slow))});
            last = t;
        }
    };
    const open = async (argv) => {
        const before = normalWins().length;
        ctx.launch(argv);
        const t0 = now();
        while (normalWins().length <= before && now() - t0 < 25000) await ctx.sleep(200);
        await ctx.sleep(1500);
    };

    await open(['gnome-characters']);
    await open(['gnome-calculator']);
    ctx.launch(['ptyxis', '-s', '--', 'bash', '--norc', '-i'], {PS1: '$ '});
    await ctx.sleep(4500);
    await open(['gnome-text-editor', `${DEMO}/notes.md`]);
    await open(['gnome-text-editor', '--new-window', `${DEMO}/stage_manager.py`]);
    await ctx.sleep(2500);
    ctx.log(`janelas: ${normalWins().map(w => w.get_title()).join(' | ')}`);

    const settings = St.Settings.get();
    const stage = () => mgr()._stageFor(mgr()._wsKey(0), 0);
    const centerOf = (match) => {
        const set = stage().recents.find(s => s.windows.some(w => match(w)));
        if (!set) throw new Error('item da tira não encontrado');
        const r = mgr()._strips.get(0).slotRect(set);
        return [r.x + r.width / 2, r.y + r.height / 2];
    };

    // 0) palco e tira
    ctx.move(1500, 300); await ctx.sleep(600);
    await ctx.shot('still-stage');
    await snap(1600);

    // 1) passar o mouse numa miniatura e clicar: troca de palco
    let [x, y] = centerOf(w => /Ptyxis/i.test(w.get_wm_class() ?? ''));
    await ctx.moveSmooth(1500, 300, x, y, 10); await ctx.sleep(500);
    await snap(900);
    settings.slow_down_factor = 4;
    await ctx.click(x, y); await burst(2400, 4);
    settings.slow_down_factor = 1; await ctx.sleep(700);
    await snap(1300);

    // 2) Shift+clique: adiciona ao palco (grupo em mosaico)
    [x, y] = centerOf(w => /notes\.md/i.test(w.get_title() ?? ''));
    await ctx.moveSmooth(960, 540, x, y, 8); await ctx.sleep(400);
    settings.slow_down_factor = 4;
    await ctx.click(x, y, {shift: true}); await burst(2600, 4);
    settings.slow_down_factor = 1; await ctx.sleep(700);
    await ctx.shot('still-mosaic');
    await snap(1700);

    // 3) mais um no grupo
    [x, y] = centerOf(w => /stage_manager\.py/i.test(w.get_title() ?? ''));
    await ctx.moveSmooth(960, 540, x, y, 8); await ctx.sleep(400);
    settings.slow_down_factor = 4;
    await ctx.click(x, y, {shift: true}); await burst(2600, 4);
    settings.slow_down_factor = 1; await ctx.sleep(700);
    await snap(1500);

    // 4) autotiling
    st().set_boolean('autotile', true);
    settings.slow_down_factor = 1; await ctx.sleep(1500);
    await ctx.shot('still-autotile');
    await snap(2000);
    st().set_boolean('autotile', false); await ctx.sleep(1200);

    // 5) menu de contexto da tira
    const sets = stage().recents;
    if (sets.length) {
        const r = mgr()._strips.get(0).slotRect(sets[0]);
        await ctx.moveSmooth(960, 700, r.x + r.width / 2, r.y + r.height / 2, 8);
        await ctx.rightClick(r.x + r.width / 2, r.y + r.height / 2); await ctx.sleep(900);
        await ctx.shot('still-menu');
        await snap(2200);
    }

    GLib.file_set_contents(`${ctx.out}/frames.json`, JSON.stringify(frames));
    ctx.log(`${frames.length} quadros gravados`);
}
