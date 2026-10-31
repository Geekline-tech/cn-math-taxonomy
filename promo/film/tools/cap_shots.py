import asyncio, pathlib, sys
from playwright.async_api import async_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / 'shots'
OUT.mkdir(exist_ok=True)
BASE = 'https://origin.new.tg'
W, H, SCALE = 1920, 1080, 2

SHOTS = [
    ('home', f'{BASE}/', '.ant-card, .ant-typography', None),
    ('explore', f'{BASE}/explore?subject=math&id=cnm_221&grade=9', '.react-flow__node', 8),
    ('explore_plain', f'{BASE}/explore?subject=math', '.react-flow__node', 4),
    ('diagnose', f'{BASE}/diagnose?subject=math', '.ant-card', None),
    ('children', f'{BASE}/children', '.ant-card', None),
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=SCALE,
                                  locale='zh-CN', timezone_id='Asia/Shanghai')
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)[:120]))
        for name, url, sel, need in SHOTS:
            await page.goto(url, wait_until='networkidle', timeout=60000)
            try:
                await page.wait_for_selector(sel, timeout=25000)
            except Exception as e:
                print('  warn', name, 'selector timeout')
            if need:
                for _ in range(40):
                    n = await page.locator('.react-flow__node').count()
                    if n >= need:
                        break
                    await page.wait_for_timeout(250)
            await page.wait_for_timeout(1400)
            path = OUT / f'{name}.png'
            await page.screenshot(path=str(path), animations='disabled')
            from PIL import Image
            im = Image.open(path)
            print(f'{name:14s} {im.size[0]}x{im.size[1]}  {path.stat().st_size//1024} KB')
        print('page errors:', errs[:3] or 'none')
        await b.close()

asyncio.run(main())
