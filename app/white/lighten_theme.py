#!/usr/bin/env python3
"""Светлая тема для white/index.html: перекраска CSS в <style>."""
from __future__ import annotations

import re
from pathlib import Path

PATH = Path(__file__).resolve().parent / "index.html"
RGBA_WHITE = re.compile(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)")

TEXT_ON_LIGHT: dict[float, str] = {
    0.96: "rgba(28, 28, 30, 0.95)",
    0.95: "rgba(28, 28, 30, 0.94)",
    0.94: "rgba(28, 28, 30, 0.93)",
    0.92: "rgba(28, 28, 30, 0.90)",
    0.90: "rgba(28, 28, 30, 0.88)",
    0.88: "rgba(28, 28, 30, 0.92)",
    0.85: "rgba(28, 28, 30, 0.82)",
    0.82: "rgba(28, 28, 30, 0.82)",
    0.78: "rgba(28, 28, 30, 0.78)",
    0.75: "rgba(28, 28, 30, 0.75)",
    0.72: "rgba(60, 60, 67, 0.78)",
    0.68: "rgba(60, 60, 67, 0.74)",
    0.65: "rgba(60, 60, 67, 0.72)",
    0.60: "rgba(60, 60, 67, 0.68)",
    0.58: "rgba(60, 60, 67, 0.65)",
    0.55: "rgba(60, 60, 67, 0.62)",
    0.50: "rgba(60, 60, 67, 0.58)",
    0.45: "rgba(60, 60, 67, 0.55)",
    0.42: "rgba(60, 60, 67, 0.52)",
    0.40: "rgba(60, 60, 67, 0.50)",
    0.38: "rgba(60, 60, 67, 0.52)",
    0.36: "rgba(60, 60, 67, 0.48)",
    0.35: "rgba(60, 60, 67, 0.46)",
    0.32: "rgba(60, 60, 67, 0.46)",
    0.30: "rgba(60, 60, 67, 0.42)",
    0.28: "rgba(60, 60, 67, 0.40)",
}


def nearest_text_rgba(alpha: float) -> str:
    if alpha in TEXT_ON_LIGHT:
        return TEXT_ON_LIGHT[alpha]
    nearest = min(TEXT_ON_LIGHT.keys(), key=lambda k: abs(k - alpha))
    if abs(nearest - alpha) < 0.021:
        return TEXT_ON_LIGHT[nearest]
    return f"rgba(60, 60, 67, {min(0.78, max(0.35, (1 - alpha) * 0.9)):.2f})"


def black_overlay(alpha: float) -> str:
    if alpha <= 0.06:
        return "rgba(0, 0, 0, 0.065)"
    if alpha <= 0.10:
        return "rgba(0, 0, 0, 0.08)"
    if alpha <= 0.14:
        return "rgba(0, 0, 0, 0.10)"
    if alpha <= 0.20:
        return "rgba(0, 0, 0, 0.11)"
    if alpha <= 0.26:
        return "rgba(0, 0, 0, 0.13)"
    return "rgba(0, 0, 0, 0.14)"


def card_surface(alpha: float) -> str:
    if alpha <= 0.06:
        return "rgba(255, 255, 255, 0.94)"
    if alpha <= 0.12:
        return "rgba(255, 255, 255, 0.92)"
    if alpha <= 0.20:
        return "rgba(255, 255, 255, 0.88)"
    return "rgba(255, 255, 255, 0.82)"


def fill_chart(line: str, alpha: float) -> str:
    if "saranSpark" not in line:
        return black_overlay(min(max(alpha, 0.05), 0.3))
    return {
        0.12: "rgba(0, 0, 0, 0.08)",
        0.32: "rgba(0, 0, 0, 0.18)",
        0.38: "rgba(0, 0, 0, 0.22)",
        0.46: "rgba(0, 0, 0, 0.26)",
    }.get(alpha, black_overlay(alpha))


def stroke_for_line(line: str, alpha: float) -> str:
    if "saranSpark" in line or "SparkLine" in line:
        mapped = {
            0.06: "rgba(0, 0, 0, 0.06)",
            0.14: "rgba(0, 0, 0, 0.10)",
            0.20: "rgba(0, 0, 0, 0.14)",
        }.get(alpha)
        if mapped:
            return mapped
    return black_overlay(max(alpha, 0.05))


def pick_context(line: str, pos: int) -> str:
    pre = line[max(0, pos - 120) : pos]
    # «border: 1px solid …» — перед rgba идёт «solid», не «border:»
    if re.search(r"\b(border(?:-[^\s:]+)?|outline)\b", pre) and re.search(
        r"\b(solid|dashed|dotted)\s+$", pre
    ):
        return "border"
    if re.search(
        r"(color|text-decoration-color|-webkit-text-fill-color)(\s*[^{};]*)?:\s*$",
        pre,
    ):
        return "text"
    if re.search(r"\bstroke\b(\s+[^{}:;]*)?:\s*$", pre):
        return "stroke"
    if re.search(r"\bfill\b(\s+[^{}:;]*)?:\s*$", pre):
        return "fill"
    if re.search(r"\b(border(?:-[^\s:]+)?|outline)(\s+[^{};]*)?:\s*$", pre):
        return "border"
    if re.search(r"\bbackground(?:-[^\s:]+)?(\s+[^{};]*)?:\s*$", pre):
        return "bg"
    chunk = line[max(0, pos - 200) : pos]
    if "box-shadow:" in chunk:
        return "shadow"
    return "other"


def replace_in_line(line: str) -> str:
    raw = line
    out: list[str] = []
    last = 0
    for m in RGBA_WHITE.finditer(raw):
        out.append(raw[last : m.start()])
        a = float(m.group(1))
        ctx = pick_context(raw, m.start())
        if ctx == "text":
            repl = nearest_text_rgba(a)
        elif ctx == "border":
            repl = black_overlay(a)
        elif ctx == "stroke":
            repl = stroke_for_line(raw, a)
        elif ctx == "fill":
            repl = fill_chart(raw, a)
        elif ctx == "bg":
            repl = card_surface(a) if a < 0.86 else "rgba(245, 245, 248, 0.95)"
        elif ctx == "shadow":
            repl = f"rgba(0, 0, 0, {min(0.20, max(0.05, a * 0.25)):.2f})"
        else:
            repl = card_surface(min(a + 0.35, 0.95))

        out.append(repl)
        last = m.end()
    out.append(raw[last:])
    return "".join(out)


def main() -> None:
    text = PATH.read_text(encoding="utf-8")

    chunks: list[str] = []
    in_style = False
    for line in text.splitlines(keepends=True):
        if "<style>" in line:
            in_style = True
            chunks.append(line)
            continue
        if "</style>" in line:
            chunks.append(replace_in_line(line) if in_style else line)
            in_style = False
            continue
        chunks.append(replace_in_line(line) if in_style else line)
    s = "".join(chunks)

    s = s.replace(
        '<meta name="theme-color" content="#0a0a0a">',
        '<meta name="theme-color" content="#f5f5f7">',
    )
    s = s.replace(
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
        '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    )

    old_root = """        html {
            background-color: #0a0a0a;
        }

        :root {
            --bg-color: #0a0a0a;          /* Глубокий черный фон */
            --tab-bg-active: #2c2c2e;     /* Серый фон активной кнопки */
            --text-active: #f2f2f7;       /* Светлый текст активной кнопки */
            --text-inactive: #8e8e93;     /* Приглушенный текст неактивной кнопки """
    new_root = """        html {
            background-color: #f5f5f7;
        }

        :root {
            --bg-color: #f5f5f7;          /* Светлый фон страницы */
            --tab-bg-active: #ffffff;     /* Активная плашка / карточка */
            --text-active: #1c1c1e;       /* Основной тёмный текст */
            --text-inactive: #8e8e93;     /* Вторичный текст """
    if old_root not in s:
        raise SystemExit("Ожидался исходный блок :root (тёмная тема).")
    s = s.replace(old_root, new_root)

    s = s.replace(
        """        body {
            font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Golos Text', system-ui, sans-serif;
            background-color: var(--bg-color);
            color: #FFFFFF;""",
        """        body {
            font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Golos Text', system-ui, sans-serif;
            background-color: var(--bg-color);
            color: #1c1c1e;""",
    )

    for a, b in [
        ("background: #0a0a0a; /* Фон страницы */", "background: #f5f5f7; /* Фон страницы */"),
        ("background: #0c1210;", "background: #ececf3;"),
        ("background: center / cover no-repeat #0c1210;", "background: center / cover no-repeat #ececf3;"),
        (
            "background: radial-gradient(120% 220% at 50% 0%, rgba(38, 38, 38, 0.96) 0%, rgba(22, 22, 22, 0.95) 100%);",
            "background: radial-gradient(120% 220% at 50% 0%, rgba(255, 255, 255, 0.94) 0%, rgba(240, 241, 245, 0.97) 100%);",
        ),
        (
            "background: radial-gradient(25.07% 114.58% at 64.39% 50%, rgba(34, 34, 34, 0.9) 24.04%, rgba(22, 22, 22, 0.9) 100%);",
            "background: radial-gradient(25.07% 114.58% at 64.39% 50%, rgba(255, 255, 255, 0.78) 24.04%, rgba(246, 246, 250, 0.92) 100%);",
        ),
        ("background: rgba(24, 24, 26, 0.88);", "background: rgba(255, 255, 255, 0.88);"),
        ("            background: rgba(10, 10, 10, 0.01);\n", "            background: rgba(245, 245, 247, 0.92);\n"),
        (
            "linear-gradient(155deg, rgba(90, 140, 220, 0.12), rgba(255, 255, 255, 0.04))",
            "linear-gradient(155deg, rgba(90, 140, 220, 0.18), rgba(255, 255, 255, 0.45))",
        ),
        (
            "        .richrep-lesson-thumb--g0 { background: linear-gradient(145deg, #1e2c28, #0e1412) !important; }",
            "        .richrep-lesson-thumb--g0 { background: linear-gradient(145deg, #e4f2ec, #c8dfd4) !important; }",
        ),
        (
            "        .richrep-lesson-thumb--g1 { background: linear-gradient(145deg, #252031, #100c14) !important; }",
            "        .richrep-lesson-thumb--g1 { background: linear-gradient(145deg, #ece8ff, #d8cef5) !important; }",
        ),
        (
            "        .richrep-lesson-thumb--g2 { background: linear-gradient(145deg, #1a2438, #0a0e18) !important; }",
            "        .richrep-lesson-thumb--g2 { background: linear-gradient(145deg, #dfe8fb, #c8daf8) !important; }",
        ),
        (
            "        .richrep-lesson-thumb--g3 { background: linear-gradient(145deg, #233124, #0c120e) !important; }",
            "        .richrep-lesson-thumb--g3 { background: linear-gradient(145deg, #e2f0e6, #c8e0d3) !important; }",
        ),
        (
            "        .richrep-lesson-thumb--g4 { background: linear-gradient(145deg, #2a2220, #120e0c) !important; }",
            "        .richrep-lesson-thumb--g4 { background: linear-gradient(145deg, #fde9e6, #f5d3cd) !important; }",
        ),
        (
            "            background: linear-gradient(180deg, rgba(28, 28, 30, 0.98) 0%, rgba(14, 14, 16, 0.99) 100%);",
            "            background: linear-gradient(180deg, rgba(251, 251, 253, 0.98) 0%, rgba(236, 236, 242, 0.99) 100%);",
        ),
    ]:
        s = s.replace(a, b)

    # Основной текст: было белое из hex
    for old_c, new_c in [
        ("color: #f2f2f7;", "color: #1c1c1e;"),
        ("color: #FFFFFF;", "color: #1c1c1e;"),
        ("color: #ffffff;", "color: #1c1c1e;"),
        ("color: #fff;", "color: #1c1c1e;"),
    ]:
        s = s.replace(old_c, new_c)

    # Подписи поверх превью / тёмной подложки — снова белые
    s = s.replace(
        "        .saran-card-cover-meta {\n"
        "            position: absolute;\n"
        "            left: 7px;\n"
        "            bottom: 8px;\n"
        "            max-width: calc(100% - 14px);\n"
        "            padding: 4px 10px;\n"
        "            border-radius: 10px;\n"
        "            background: rgba(0, 0, 0, 0.45);\n"
        "            font-family: 'Vela Sans', 'Golos Text', sans-serif;\n"
        "            font-weight: 600;\n"
        "            font-size: 12px;\n"
        "            line-height: 16px;\n"
        "            color: #1c1c1e;\n"
        "            pointer-events: none;",
        "        .saran-card-cover-meta {\n"
        "            position: absolute;\n"
        "            left: 7px;\n"
        "            bottom: 8px;\n"
        "            max-width: calc(100% - 14px);\n"
        "            padding: 4px 10px;\n"
        "            border-radius: 10px;\n"
        "            background: rgba(0, 0, 0, 0.45);\n"
        "            font-family: 'Vela Sans', 'Golos Text', sans-serif;\n"
        "            font-weight: 600;\n"
        "            font-size: 12px;\n"
        "            line-height: 16px;\n"
        "            color: #ffffff;\n"
        "            pointer-events: none;",
    )
    s = s.replace(
        "        .richrep-lesson-duration {\n"
        "            position: absolute;\n"
        "            left: 9px;\n"
        "            bottom: 6px;\n"
        "            min-width: 88px;\n"
        "            height: 18px;\n"
        "            padding: 0 6px;\n"
        "            box-sizing: border-box;\n"
        "            background: transparent;\n"
        "            border-radius: 12px;\n"
        "            display: flex;\n"
        "            align-items: center;\n"
        "            justify-content: center;\n"
        "            font-style: normal;\n"
        "            font-weight: 600;\n"
        "            font-size: 10px;\n"
        "            line-height: 13px;\n"
        "            letter-spacing: 0.02em;\n"
        "            color: #1c1c1e;",
        "        .richrep-lesson-duration {\n"
        "            position: absolute;\n"
        "            left: 9px;\n"
        "            bottom: 6px;\n"
        "            min-width: 88px;\n"
        "            height: 18px;\n"
        "            padding: 0 6px;\n"
        "            box-sizing: border-box;\n"
        "            background: transparent;\n"
        "            border-radius: 12px;\n"
        "            display: flex;\n"
        "            align-items: center;\n"
        "            justify-content: center;\n"
        "            font-style: normal;\n"
        "            font-weight: 600;\n"
        "            font-size: 10px;\n"
        "            line-height: 13px;\n"
        "            letter-spacing: 0.02em;\n"
        "            color: #FFFFFF;",
    )
    s = s.replace(
        "            background: rgba(0, 0, 0, 0.4);\n"
        "            font-family: 'Vela Sans', 'Golos Text', sans-serif;\n"
        "            font-weight: 600;\n"
        "            font-size: 13px;\n"
        "            line-height: 18px;\n"
        "            letter-spacing: 0.02em;\n"
        "            color: #1c1c1e;\n"
        "            pointer-events: none;\n"
        "            text-align: center;",
        "            background: rgba(0, 0, 0, 0.4);\n"
        "            font-family: 'Vela Sans', 'Golos Text', sans-serif;\n"
        "            font-weight: 600;\n"
        "            font-size: 13px;\n"
        "            line-height: 18px;\n"
        "            letter-spacing: 0.02em;\n"
        "            color: #ffffff;\n"
        "            pointer-events: none;\n"
        "            text-align: center;",
    )
    s = s.replace(
        "            letter-spacing: 0.02em;\n"
        "            color: #1c1c1e;\n"
        "            pointer-events: none;\n"
        "        }\n\n"
        "        .richrep-start-duration-count {",
        "            letter-spacing: 0.02em;\n"
        "            color: #FFFFFF;\n"
        "            pointer-events: none;\n"
        "        }\n\n"
        "        .richrep-start-duration-count {",
    )

    s = s.replace(
        "            border-radius: 50%;\n"
        "            background: #1c1c1e;\n"
        "            color: #4A4D8D;",
        "            border-radius: 50%;\n"
        "            background: #FFFFFF;\n"
        "            color: #4A4D8D;",
        1,
    )

    # Нижнее меню: неактивные иконки серые (не те что active синие)
    s = s.replace(
        """        .menu-tab:not(.active) .tab-icon svg path {
            fill: white;
            fill-opacity: 0.8;
        }""",
        """        .menu-tab:not(.active) .tab-icon svg path {
            fill: #3a3a3c;
            fill-opacity: 0.85;
        }""",
    )

    # SVG и inline
    for a, b in [
        ('stroke="rgba(255,255,255,0.85)"', 'stroke="rgba(28,28,30,0.72)"'),
        ("stroke='rgba(255,255,255,0.85)'", "stroke='rgba(28,28,30,0.72)'"),
        ("color:rgba(255,255,255,0.35)", "color:rgba(60,60,67,0.46)"),
        ("msgEl.style.color = 'rgba(255,255,255,0.65)';", "msgEl.style.color = 'rgba(60,60,67,0.72)';"),
        ("'linear-gradient(145deg, #1e2c28, #0e1412)'", "'linear-gradient(145deg, #e4f2ec, #c8dfd4)'"),
    ]:
        s = s.replace(a, b)

    PATH.write_text(s, encoding="utf-8")
    print("Обновлено:", PATH)


if __name__ == "__main__":
    main()
