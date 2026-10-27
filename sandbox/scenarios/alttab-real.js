// SPDX-License-Identifier: GPL-3.0-or-later
// Alt+Tab com apps reais (com .desktop), trocando de app pelo Alt+Tab e pela tira.
// SANDBOX_SEM_CORRECAO=1 roda com a ordem do GNOME, para comparar.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {mgr} from './helpers.js';

const tracker = Shell.WindowTracker.get_default();
const nameOf = w => tracker.get_window_app(w)?.get_name() ?? w.get_title();
const normalWins = () => global.get_window_actors().map(a => a.meta_window).filter(w => w.get_window_type() === Meta.WindowType.NORMAL);
const focused = () => (global.display.focus_window ? nameOf(global.display.focus_window) : '(nenhuma)');
const rawApps = () => Shell.AppSystem.get_default().get_running().map(a => a.get_name()).join(' | ');
const rawTab = () => global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null).map(nameOf).join(' | ');

export default async function (ctx) {
    const open = async argv => {
        const before = normalWins().length;
        ctx.launch(argv);
        const t0 = GLib.get_monotonic_time();
        while (normalWins().length <= before && GLib.get_monotonic_time() - t0 < 25e6) await ctx.sleep(200);
        await ctx.sleep(1500);
    };
    if (GLib.getenv('SANDBOX_SEM_CORRECAO'))
        mgr()._altTab.stop();
    await open(['gnome-characters']);
    // SANDBOX_X11=1: a Calculadora abre via XWayland (como o Chrome, o Figma e o Steam na sessão real).
    if (GLib.getenv('SANDBOX_X11')) {
        const before = normalWins().length;
        ctx.launch(['gnome-calculator'], {GDK_BACKEND: 'x11'});
        const t0 = GLib.get_monotonic_time();
        while (normalWins().length <= before && GLib.get_monotonic_time() - t0 < 25e6) await ctx.sleep(200);
        await ctx.sleep(1500);
    } else {
        await open(['gnome-calculator']);
    }
    await open(['gnome-clocks']);
    await ctx.sleep(1000);

    const altTab = async (tabs = 1) => {
        ctx.keyDown(Clutter.KEY_Alt_L); await ctx.sleep(40);
        await ctx.key(Clutter.KEY_Tab, tabs);
        ctx.keyUp(Clutter.KEY_Alt_L); await ctx.sleep(1200);
    };
    const stage = () => mgr()._stageFor(mgr()._wsKey(0), 0);
    const clickStrip = async name => {
        const set = stage().recents.find(s => s.windows.some(w => nameOf(w) === name));
        const r = mgr()._strips.get(0).slotRect(set);
        await ctx.click(r.x + r.width / 2, r.y + r.height / 2);
        await ctx.sleep(1500);
    };
    let fails = 0;
    const expect = (label, want) => {
        const got = focused();
        if (got !== want)
            fails++;
        ctx.log(`${got === want ? 'ok ' : '!! '}${label}: foco=${got} (esperado ${want})\n     GNOME apps=[${rawApps()}] mutter=[${rawTab()}]`);
    };

    const [chars, calc, clocks] = ['Characters', 'Calculator', 'Clocks'];
    ctx.log(`apps: ${normalWins().map(w => `${nameOf(w)}${w.get_client_type() === Meta.WindowClientType.X11 ? ' (X11)' : ''}`).join(', ')}`);
    expect('0. abertos Caracteres, Calculadora, Relógios', clocks);
    await altTab(); expect('1. Alt+Tab', calc);
    await altTab(); expect('2. Alt+Tab', clocks);
    await clickStrip(chars); expect('3. clique na tira (Caracteres)', chars);
    await altTab(); expect('4. Alt+Tab depois da tira', clocks);
    await altTab(); expect('5. Alt+Tab', chars);
    await altTab(2); expect('6. Alt+Tab+Tab', calc);
    await altTab(); expect('7. Alt+Tab', chars);
    ctx.log(fails ? `RESULTADO: !! ${fails} falha(s)` : 'RESULTADO: tudo certo');
}
