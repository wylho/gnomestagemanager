#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Ferramenta de tradução (usa o Babel; não precisa do pacote gettext).

  tools/i18n.py extract   gera po/stage-manager@wyliam.pot a partir de _() e ngettext() no código
  tools/i18n.py update    funde o .pot nos po/<idioma>.po (mantém o que já foi traduzido)
  tools/i18n.py compile   gera extension/stage-manager@wyliam/locale/<idioma>/LC_MESSAGES/stage-manager@wyliam.mo
  tools/i18n.py check     confere: sem mensagens sem tradução, formatos %s/%d iguais, plurais completos

Instalação do Babel: sudo apt install python3-babel
"""
import os
import re
import sys
from datetime import datetime, timezone

from babel.messages import Catalog
from babel.messages.extract import extract_from_dir
from babel.messages.mofile import write_mo
from babel.messages.pofile import read_po, write_po

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "stage-manager@wyliam"
EXT = os.path.join(ROOT, "extension", DOMAIN)
PO_DIR = os.path.join(ROOT, "po")
POT = os.path.join(PO_DIR, f"{DOMAIN}.pot")
LANGS = ["pt_BR", "es", "fr", "de", "ru", "it", "zh_CN", "ja"]
PLURALS = {
    "pt_BR": "nplurals=2; plural=(n > 1);",
    "es": "nplurals=2; plural=(n != 1);",
    "fr": "nplurals=2; plural=(n > 1);",
    "de": "nplurals=2; plural=(n != 1);",
    "it": "nplurals=2; plural=(n != 1);",
    "ru": "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);",
    "zh_CN": "nplurals=1; plural=0;",
    "ja": "nplurals=1; plural=0;",
}


def extract():
    cat = Catalog(project="Stage Manager", version="1", msgid_bugs_address="https://github.com/wylho/gnomestagemanager/issues",
                  copyright_holder="Stage Manager contributors", charset="utf-8")
    cat.creation_date = datetime.now(timezone.utc)
    for fname, lineno, msg, comments, ctx in extract_from_dir(
            EXT, method_map=[("**.js", "javascript")], keywords={"_": None, "ngettext": (1, 2)},
            comment_tags=["TRANSLATORS:"], options_map={"**.js": {}}):
        cat.add(msg, locations=[(os.path.relpath(os.path.join(EXT, fname), ROOT), lineno)], auto_comments=comments, context=ctx)
    os.makedirs(PO_DIR, exist_ok=True)
    with open(POT, "wb") as f:
        write_po(f, cat, width=100, sort_by_file=True)
    print(f"{len(cat)} mensagens -> {os.path.relpath(POT, ROOT)}")


def update():
    with open(POT, "rb") as f:
        pot = read_po(f)
    for lang in LANGS:
        path = os.path.join(PO_DIR, f"{lang}.po")
        if os.path.exists(path):
            with open(path, "rb") as f:
                cat = read_po(f, locale=lang)
            cat.update(pot, no_fuzzy_matching=True)
        else:
            cat = Catalog(locale=lang, project="Stage Manager", charset="utf-8", fuzzy=False)
            cat.update(pot)
        cat.mime_headers = [("Plural-Forms", PLURALS[lang])]
        cat.fuzzy = False
        cat.header_comment = (f"# {lang} translations for Stage Manager.\n# Copyright (C) 2026 Stage Manager contributors.\n"
                              "# Distributed under the same license as the Stage Manager project.")
        cat.language_team = f"{lang} <https://github.com/wylho/gnomestagemanager/issues>"
        cat.last_translator = "Stage Manager contributors"
        cat.revision_date = datetime.now(timezone.utc)
        with open(path, "wb") as f:
            write_po(f, cat, width=100, sort_by_file=True)
    print("atualizados:", ", ".join(LANGS))


def compile_all():
    n = 0
    for lang in LANGS:
        with open(os.path.join(PO_DIR, f"{lang}.po"), "rb") as f:
            cat = read_po(f, locale=lang)
        out = os.path.join(EXT, "locale", lang, "LC_MESSAGES")
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, f"{DOMAIN}.mo"), "wb") as f:
            write_mo(f, cat, use_fuzzy=False)
        n += 1
    print(f"{n} idiomas compilados em extension/{DOMAIN}/locale/")


def fmt(s):
    return sorted(re.findall(r"%(?:\d+\$)?[sd]", s or ""))


def check():
    with open(POT, "rb") as f:
        pot = read_po(f)
    bad = 0
    for lang in LANGS:
        with open(os.path.join(PO_DIR, f"{lang}.po"), "rb") as f:
            cat = read_po(f, locale=lang)
        for m in pot:
            if not m.id:
                continue
            t = cat.get(m.id, m.context)
            if t is None or not t.string or (isinstance(t.string, tuple) and not all(t.string)):
                print(f"[{lang}] sem tradução: {m.id if isinstance(m.id, str) else m.id[0]!r}")
                bad += 1
                continue
            msgid = m.id if isinstance(m.id, str) else m.id[0]
            strs = t.string if isinstance(t.string, tuple) else (t.string,)
            if isinstance(m.id, tuple) and len(strs) != cat.num_plurals:
                print(f"[{lang}] plurais incompletos: {msgid!r}")
                bad += 1
            for s in strs:
                if fmt(s) != fmt(msgid) and not (isinstance(m.id, tuple) and fmt(s) in (fmt(m.id[0]), fmt(m.id[1]), [])):
                    print(f"[{lang}] formato diferente: {msgid!r} -> {s!r}")
                    bad += 1
    print("OK: nada faltando" if not bad else f"{bad} problema(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "extract":
        extract()
    elif cmd == "update":
        update()
    elif cmd == "compile":
        compile_all()
    elif cmd == "check":
        sys.exit(check())
    else:
        print(__doc__)
        sys.exit(2)
