"""
지도 마커 그림(PNG)과 그 목록(src/map/markerImages.ts)을 만든다
네이버 지도 SDK 마커는 이미지를 지도 엔진이 그리므로, 웹의 HTML 마커 대신 모양별 그림을 미리 만들어 둠
숫자("3/5")는 그림에 넣지 않고 SDK 캡션으로 가운데에 얹음 → 색 · 글자 수 조합만 그림으로 만들면 됨

실행: python3 mobile/scripts/generate-marker-images.py (Pillow 필요). 색을 바꾸면 다시 실행
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

MOBILE = Path(__file__).resolve().parent.parent
OUT_DIR = MOBILE / "assets" / "markers"
TS_FILE = MOBILE / "src" / "map" / "markerImages.ts"
THEME_COLORS = MOBILE.parent / "packages" / "core" / "src" / "lib" / "theme.ts"
FONT = MOBILE / "node_modules" / "pretendard" / "dist" / "public" / "static" / "Pretendard-Bold.otf"

# 그림 배율. 파일 이름에 @3x를 붙여 RN이 화면 배율에 맞춰 크기를 계산하게 함
SCALE = 3
# 웹 StationMarker와 같은 값 (글자 13 · 좌우 여백 8 · 위아래 여백 4 · 흰 테두리 2)
TEXT_SIZE = 13
PAD_X = 8
PAD_Y = 4
BORDER = 2
# 그림자를 그릴 여백 (웹 drop-shadow 0 2px 2px)
SHADOW = 3
# 웹 색 점과 같은 크기 (반지름 6, 안쪽 색 4)
DOT_RADIUS = 6
DOT_INNER_RADIUS = 4
# 숫자 글자 수 ("3/5" = 3 … "120/120" = 7)
TEXT_LENGTHS = range(3, 8)
# 마커 색 이름 → theme.ts 색 토큰
COLOR_TOKENS = {
    "low": "congestion-free",
    "medium": "congestion-normal",
    "high": "congestion-busy",
    "unknown": "congestion-unknown",
    "unavailable": "congestion-unavailable",
    "recommended": "marker-recommended",
}


def read_theme_colors():
    """theme.ts의 COLORS에서 'token': '#rrggbb' 줄을 읽음 (웹 · 앱 색을 한 곳에서 관리)"""
    colors = {}
    for line in THEME_COLORS.read_text(encoding="utf-8").splitlines():
        parts = line.strip().rstrip(",").split(":")
        # 'congestion-free': '#16a34a' 모양인 줄만 씀
        if len(parts) == 2 and parts[1].strip().startswith("'#"):
            colors[parts[0].strip().strip("'")] = parts[1].strip().strip("'")
    return colors


def pill_size(length, font):
    """글자 수에 맞는 알약 크기(pt). 가장 넓은 숫자(0)로 재서 어떤 숫자도 들어가게 함"""
    text_width = font.getlength("0" * (length - 1) + "/") / SCALE
    return round(text_width + (PAD_X + BORDER) * 2), TEXT_SIZE + 6 + (PAD_Y + BORDER) * 2


def with_shadow(shape, size):
    """도형 아래로 2pt 내린 흐린 그림자를 깔아 웹 drop-shadow와 비슷하게 함"""
    width, height = size
    canvas = Image.new("RGBA", ((width + SHADOW * 2) * SCALE, (height + SHADOW * 2) * SCALE))
    alpha = shape.getchannel("A").point(lambda a: a * 64 // 255)
    shadow = Image.new("RGBA", shape.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(SCALE))
    canvas.alpha_composite(shadow, (SHADOW * SCALE, (SHADOW + 2) * SCALE))
    canvas.alpha_composite(shape, (SHADOW * SCALE, SHADOW * SCALE))
    return canvas


def draw_pill(color, size):
    """흰 테두리 알약. 글자는 SDK 캡션이 그리므로 바탕만"""
    width, height = size[0] * SCALE, size[1] * SCALE
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=height // 2, fill="white")
    inset = BORDER * SCALE
    draw.rounded_rectangle(
        (inset, inset, width - 1 - inset, height - 1 - inset),
        radius=height // 2 - inset,
        fill=color,
    )
    return image


def draw_dot(color):
    """흰 테두리 색 점"""
    size = DOT_RADIUS * 2 * SCALE
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 0, size - 1, size - 1), fill="white")
    inset = (DOT_RADIUS - DOT_INNER_RADIUS) * SCALE
    draw.ellipse((inset, inset, size - 1 - inset, size - 1 - inset), fill=color)
    return image


def main():
    colors = read_theme_colors()
    font = ImageFont.truetype(str(FONT), TEXT_SIZE * SCALE)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pills = {}
    for name, token in COLOR_TOKENS.items():
        color = colors[token]
        pills[name] = {}
        for length in TEXT_LENGTHS:
            size = pill_size(length, font)
            with_shadow(draw_pill(color, size), size).save(OUT_DIR / f"pill-{name}-{length}@3x.png")
            pills[name][length] = size
        draw_dot(color).save(OUT_DIR / f"dot-{name}@3x.png")

    # 그림 목록 TS. require는 정적 문자열이어야 Metro가 묶을 수 있어 파일로 만들어 둠
    lines = [
        "// 자동 생성 파일. mobile/scripts/generate-marker-images.py로 다시 만듦 (직접 고치지 않음, prettier 제외)",
        "// RN 그림은 정적 require로만 번들에 묶여서 require를 씀",
        "/* eslint-disable @typescript-eslint/no-require-imports */",
        "",
        "/** 마커 색 이름. 혼잡도 5가지 + 추천 */",
        f"export type MarkerColor = {' | '.join(json.dumps(n).replace(chr(34), chr(39)) for n in COLOR_TOKENS)}",
        "",
        "/** 숫자를 얹는 알약 그림. 글자 수(3~7)별로 넓이가 다름. 크기는 그림자를 뺀 알약 크기(pt) */",
        f"export const PILL_SHADOW = {SHADOW}",
        "export const PILL_IMAGES: Record<MarkerColor, Record<number, { image: number; width: number; height: number }>> = {",
    ]
    for name in COLOR_TOKENS:
        lines.append(f"  {name}: {{")
        for length, (width, height) in pills[name].items():
            lines.append(
                f"    {length}: {{ image: require('../../assets/markers/pill-{name}-{length}.png'), width: {width}, height: {height} }},"
            )
        lines.append("  },")
    lines += [
        "}",
        "",
        "/** 숫자 없이 색만 보여 주는 점 그림 */",
        f"export const DOT_SIZE = {DOT_RADIUS * 2}",
        "export const DOT_IMAGES: Record<MarkerColor, number> = {",
    ]
    for name in COLOR_TOKENS:
        lines.append(f"  {name}: require('../../assets/markers/dot-{name}.png'),")
    lines += ["}", ""]
    TS_FILE.parent.mkdir(parents=True, exist_ok=True)
    TS_FILE.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
