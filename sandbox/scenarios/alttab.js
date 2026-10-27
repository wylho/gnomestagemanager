// SPDX-License-Identifier: GPL-3.0-or-later
// Alt+Tab na ordem de uso (como no Windows): um toque alterna entre os dois últimos apps.
// Rodar com 2 monitores e only-primary=false: A, B, C no monitor 0 e D no 1. Cada monitor tem uma janela visível
// e o GNOME põe as visíveis antes das minimizadas, então sem a correção o Alt+Tab pula para o outro monitor.
// SANDBOX_SEM_CORRECAO=1: mesmo roteiro com a ordem do GNOME, para ver o defeito.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {dump, mgr, winByTitle} from './helpers.js';

const st = () => Extension.lookupByUUID('stage-manager@wyliam')._settings;
const focused = () => global.display.focus_window?.get_title() ?? '(nenhuma)';
const titles = ws => ws.filter(w => w.get_window_type() === Meta.WindowType.NORMAL).map(w => w.get_title()).join(' ');
const raw = () => titles(global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null));
const ours = () => mgr()._altTab._whileOrdering(() => titles(global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)));
const rawApps = () => Shell.AppSystem.get_default().get_running().map(a => a.get_windows().map(w => w.get_title()).join('+')).join(' ');
const apps = () => mgr()._altTab._whileOrdering(() =>
    Shell.AppSystem.get_default().get_running().map(a => a.get_windows().map(w => w.get_title()).join('+')).join(' '));

export default async function (ctx) {
    for (const [t, c] of [['A', '#c01c28'], ['B', '#26a269'], ['C', '#e5a50a']]) {
        ctx.spawn(t, c, 640, 400, `org.sandbox.${t}`);
        await ctx.waitWin(t);
        await ctx.sleep(900);
    }
    ctx.spawn('D', '#1c71d8', 640, 400, 'org.sandbox.D');
    await ctx.waitWin('D');
    await ctx.sleep(900);
    winByTitle('D').move_to_monitor(1);
    await ctx.sleep(1500);
    if (GLib.getenv('SANDBOX_SEM_CORRECAO'))
        mgr()._altTab.stop();
    const altTab = async (tabs = 1) => {
        ctx.keyDown(Clutter.KEY_Alt_L); await ctx.sleep(40);
        await ctx.key(Clutter.KEY_Tab, tabs);
        ctx.keyUp(Clutter.KEY_Alt_L); await ctx.sleep(900);
    };
    let ok = true;
    const expect = (label, want) => {
        const got = focused();
        if (got !== want)
            ok = false;
        ctx.log(`${got === want ? 'ok ' : '!! '}${label}: foco=${got} (esperado ${want}) | mutter=[${raw()}] nossa=[${ours()}] apps GNOME=[${rawApps()}] apps nossa=[${apps()}]`);
    };

    dump(ctx, 'A, B, C no monitor 0 e D no 1');
    expect('0. D aberta no monitor 1', 'D');
    await altTab(); expect('1. Alt+Tab volta ao anterior (outro monitor)', 'C');
    await altTab(2); expect('2. Alt+Tab+Tab vai ao terceiro', 'B');
    await altTab(); expect('3. um toque volta para C, não para D do outro monitor', 'C');
    await ctx.shot('alttab-3');
    await altTab(); expect('4. e de novo para B', 'B');
    await altTab(2); expect('5. Alt+Tab+Tab agora vai a D', 'D');
    await altTab(); expect('6. um toque volta para B', 'B');

    // Minimizar à mão manda para o fim (como no Windows).
    winByTitle('B').minimize(); await ctx.sleep(900);
    ctx.log(`7. B minimizada à mão: foco=${focused()} nossa=[${ours()}] (B deve ser a última)`);
    if (!ours().endsWith('B'))
        ok = false;

    st().set_boolean('enabled', false); await ctx.sleep(900);
    const restored = !String(AltTab.AppSwitcherPopup.prototype._init).includes('_whileOrdering');
    ctx.log(`${restored ? 'ok ' : '!! '}8. Organizador desligado: _init original de volta=${restored}`);
    st().set_boolean('enabled', true); await ctx.sleep(900);
    await altTab(); ctx.log(`9. religado e Alt+Tab: foco=${focused()} (sem erro)`);
    ctx.log(ok && restored ? 'RESULTADO: tudo certo' : 'RESULTADO: !! falhou');
}
