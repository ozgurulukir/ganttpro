import asyncio
import os
import subprocess
import time
from playwright.async_api import async_playwright

def start_preview_server():
    print("Building application for preview...")
    subprocess.run(["pnpm", "build"], check=True)
    print("Starting preview server on port 4173...")
    proc = subprocess.Popen(
        ["pnpm", "preview", "--port", "4173"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(2)
    return proc

async def capture_screenshots():
    os.makedirs("docs/images", exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1600, 'height': 900},
            device_scale_factor=2
        )
        page = await context.new_page()
        await page.goto('http://localhost:4173/')
        await page.wait_for_timeout(1000)

        # 1. Click Guest Mode
        guest_btn = await page.query_selector('#loginGuestBtn')
        if guest_btn:
            await guest_btn.click()
            await page.wait_for_timeout(1000)

        # 2. Open Project Modal and create demo project
        await page.click('#projSelector')
        await page.wait_for_timeout(500)
        await page.click('[data-action="new-proj"]')
        await page.wait_for_timeout(500)

        await page.fill('#pName', 'Hardware Product Development')
        await page.select_option('#pTemplate', 'hardware')
        await page.wait_for_timeout(300)
        await page.click('#projSubmitBtn')
        await page.wait_for_timeout(2000)

        # 3. Main Gantt View (Light Mode)
        await page.screenshot(path='docs/images/gantt-main.png')
        print('Saved docs/images/gantt-main.png')

        # 4. Workload View
        await page.evaluate('document.querySelector("button[data-cv=workload]").click()')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='docs/images/gantt-workload.png')
        print('Saved docs/images/gantt-workload.png')

        # Switch back to Gantt View
        await page.evaluate('document.querySelector("button[data-cv=gantt]").click()')
        await page.wait_for_timeout(500)

        # 5. Dark Mode View
        await page.evaluate('document.querySelector("#darkBtn").click()')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='docs/images/gantt-dark.png')
        print('Saved docs/images/gantt-dark.png')

        await browser.close()

if __name__ == "__main__":
    proc = start_preview_server()
    try:
        asyncio.run(capture_screenshots())
    finally:
        proc.terminate()
        proc.wait()
