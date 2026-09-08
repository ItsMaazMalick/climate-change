import asyncio
import os
from playwright.async_api import async_playwright

OUT_DIR = os.path.join("public", "images", "manual")
os.makedirs(OUT_DIR, exist_ok=True)

async def run():
    print("Launching browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        
        print("Navigating to local dev server...")
        await page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(5000)

        async def draw_pointer_on_locator(locator, label, color="#ef4444"):
            try:
                await locator.scroll_into_view_if_needed(timeout=5000)
                box = await locator.bounding_box(timeout=15000)
            except Exception as e:
                print(f"Warning: Element for '{label}' timed out or not found.")
                return None
            if not box:
                print(f"Warning: Element for '{label}' has no bounding box.")
                return None
            
            # Smart Label Placement: If box is near top of screen, place label below the box.
            label_pos = "top"
            if box["y"] < 50:
                label_pos = "bottom"
                
            script = f"""
            (() => {{
                const box = document.createElement('div');
                box.className = 'manual-pointer';
                box.style.position = 'fixed';
                box.style.top = '{(box['y'] - 4)}px';
                box.style.left = '{(box['x'] - 4)}px';
                box.style.width = '{(box['width'] + 8)}px';
                box.style.height = '{(box['height'] + 8)}px';
                box.style.border = '3px solid {color}';
                box.style.borderRadius = '6px';
                box.style.zIndex = '999999';
                box.style.pointerEvents = 'none';
                box.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.8), 0 0 15px {color}88';
                
                const labelEl = document.createElement('div');
                labelEl.innerText = '{label}';
                labelEl.style.position = 'absolute';
                if ('{label_pos}' === 'top') {{
                    labelEl.style.top = '-32px';
                }} else {{
                    labelEl.style.bottom = '-32px';
                }}
                labelEl.style.left = '50%';
                labelEl.style.transform = 'translateX(-50%)';
                labelEl.style.background = '{color}';
                labelEl.style.color = 'white';
                labelEl.style.padding = '4px 12px';
                labelEl.style.borderRadius = '999px';
                labelEl.style.fontSize = '14px';
                labelEl.style.fontWeight = '600';
                labelEl.style.whiteSpace = 'nowrap';
                labelEl.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                
                const triangle = document.createElement('div');
                triangle.style.position = 'absolute';
                triangle.style.left = '50%';
                triangle.style.transform = 'translateX(-50%)';
                
                if ('{label_pos}' === 'top') {{
                    triangle.style.bottom = '-6px';
                    triangle.style.borderLeft = '6px solid transparent';
                    triangle.style.borderRight = '6px solid transparent';
                    triangle.style.borderTop = '6px solid {color}';
                }} else {{
                    triangle.style.top = '-6px';
                    triangle.style.borderLeft = '6px solid transparent';
                    triangle.style.borderRight = '6px solid transparent';
                    triangle.style.borderBottom = '6px solid {color}';
                }}
                
                labelEl.appendChild(triangle);
                box.appendChild(labelEl);
                document.body.appendChild(box);
            }})();
            """
            await page.evaluate(script)
            return box

        async def clear_pointers():
            await page.evaluate("document.querySelectorAll('.manual-pointer').forEach(el => el.remove());")

        async def screenshot_box(filename, box, pad_x=60, pad_y=60):
            if not box: return
            
            # Ensure width and height are positive
            w = box["width"] + pad_x * 2
            h = box["height"] + pad_y * 2
            if w <= 0: w = 1
            if h <= 0: h = 1
            
            await page.screenshot(
                path=os.path.join(OUT_DIR, filename),
                full_page=True,
                clip={
                    "x": max(0, box["x"] - pad_x),
                    "y": max(0, box["y"] - pad_y),
                    "width": w,
                    "height": h
                }
            )
            print(f"Saved {filename}")

        # --- Phase 1: Global Navigation & State ---
        
        # Step 01: Access the platform (Hero/Header)
        await clear_pointers()
        box = await draw_pointer_on_locator(page.locator('header'), 'Global Command Center')
        await screenshot_box('step01.png', box, pad_x=10, pad_y=40)

        # Step 02: Switch territories
        await clear_pointers()
        box = await draw_pointer_on_locator(page.get_by_role("button", name="Uzbekistan").or_(page.get_by_role("button", name="Pakistan")).first, 'Switch Country')
        if not box: box = {"x": 500, "y": 10, "width": 400, "height": 40}
        await screenshot_box('step02.png', box, pad_x=40, pad_y=60)

        # Step 03: Find your land
        await clear_pointers()
        search_loc = page.locator('[aria-label="Search for a place"]').locator('..')
        box = await draw_pointer_on_locator(search_loc, 'Search Coordinates')
        await screenshot_box('step03.png', box, pad_x=40, pad_y=60)

        # Step 04: Pick an indicator
        await clear_pointers()
        indicator_loc = page.locator('.label', has_text="Climate Indicator").locator('..')
        box = await draw_pointer_on_locator(indicator_loc, 'Climate Metric')
        await screenshot_box('step04.png', box, pad_x=40, pad_y=60)

        # Step 05: Choose a scenario
        await clear_pointers()
        scenario_loc = page.locator('.label', has_text="Emissions Pathway (SSP)").locator('..')
        box = await draw_pointer_on_locator(scenario_loc, 'Emissions Pathway')
        await screenshot_box('step05.png', box, pad_x=40, pad_y=60)

        # Step 06: Set the time horizon
        await clear_pointers()
        period_loc = page.locator('.label', has_text="Time Horizon").locator('..')
        box = await draw_pointer_on_locator(period_loc, 'Time Horizon')
        await screenshot_box('step06.png', box, pad_x=40, pad_y=60)

        # Step 07: Absolute vs Anomaly
        await clear_pointers()
        display_loc = page.locator('.label', has_text="Display Mode").locator('..')
        box = await draw_pointer_on_locator(display_loc, 'Relative vs Absolute')
        await screenshot_box('step07.png', box, pad_x=40, pad_y=60)


        # --- Phase 2: Reading the Map ---
        
        # Step 08: Color Scale
        await clear_pointers()
        legend_loc = page.locator('text="Change vs 1995–2014"').or_(page.locator('text="Mean near-surface air temperature"')).first.locator('..')
        box = await draw_pointer_on_locator(legend_loc, 'Color Scale', color="#0284c7")
        if not box: box = {"x": 1000, "y": 750, "width": 400, "height": 100}
        await screenshot_box('step08.png', box, pad_x=40, pad_y=60)

        # Step 09: Uncertainty
        await clear_pointers()
        disagree_loc = page.locator('text="Hatched cells are where models disagree"').locator('..')
        box = await draw_pointer_on_locator(disagree_loc, 'Uncertainty Overlay', color="#0284c7")
        if not box: box = {"x": 1000, "y": 800, "width": 400, "height": 50}
        await screenshot_box('step09.png', box, pad_x=40, pad_y=60)

        # Step 10: Hover Grid
        await clear_pointers()
        await page.mouse.move(720, 450)
        await page.wait_for_timeout(500)
        await page.evaluate("""
            const box = document.createElement('div');
            box.className = 'manual-pointer';
            box.style.position = 'fixed';
            box.style.top = '446px'; box.style.left = '716px'; box.style.width = '8px'; box.style.height = '8px';
            box.style.border = '2px solid red'; box.style.borderRadius = '50%';
            document.body.appendChild(box);
        """)
        await screenshot_box('step10.png', {"x": 620, "y": 350, "width": 200, "height": 200}, pad_x=20, pad_y=20)


        # --- Phase 3: Location Analytics ---
        
        await page.mouse.click(720, 450)
        await page.wait_for_timeout(1500)
        
        # Step 11: Open the Location Panel
        await clear_pointers()
        panel_loc = page.locator('text="Baseline"').locator('..').locator('..').locator('..')
        box = await draw_pointer_on_locator(panel_loc, 'Point Analytics')
        if not box: box = {"x": 1000, "y": 56, "width": 400, "height": 200}
        await screenshot_box('step11.png', box, pad_x=20, pad_y=50)

        # Step 12: Seasonal cycle
        await clear_pointers()
        cycle_loc = page.locator('h3:has-text("Annual Seasonality")').locator('..').locator('..')
        box = await draw_pointer_on_locator(cycle_loc, 'Seasonal Shift')
        if not box: box = {"x": 1000, "y": 300, "width": 400, "height": 300}
        await screenshot_box('step12.png', box, pad_x=20, pad_y=50)

        # Step 13: Model spread
        await clear_pointers()
        spread_loc = page.locator('h3:has-text("Multi-Model Uncertainty")').locator('..').locator('..')
        box = await draw_pointer_on_locator(spread_loc, 'Confidence Bounds')
        if not box: box = {"x": 1000, "y": 600, "width": 400, "height": 300}
        await screenshot_box('step13.png', box, pad_x=20, pad_y=50)

        # Step 14: All Policy Pathways
        await clear_pointers()
        pathways_loc = page.locator('h3:has-text("All Policy Pathways")').locator('..').locator('..')
        box = await draw_pointer_on_locator(pathways_loc, 'Scenario Comparison')
        if not box: box = {"x": 1000, "y": 700, "width": 400, "height": 200}
        await screenshot_box('step14.png', box, pad_x=20, pad_y=50)

        # Step 15: Related Vulnerability Metrics
        await clear_pointers()
        vuln_loc = page.locator('h3:has-text("Sector Impact & Vulnerability Intelligence")').locator('..').locator('..')
        box = await draw_pointer_on_locator(vuln_loc, 'Downstream Risks')
        if not box: box = {"x": 1000, "y": 800, "width": 400, "height": 100}
        await screenshot_box('step15.png', box, pad_x=20, pad_y=50)

        # Step 16: Scientific Methodology
        await clear_pointers()
        method_loc = page.locator('h3:has-text("Scientific Variable Methodology")').locator('..').locator('..')
        box = await draw_pointer_on_locator(method_loc, 'Methodology')
        if not box: box = {"x": 1000, "y": 800, "width": 400, "height": 100}
        await screenshot_box('step16.png', box, pad_x=20, pad_y=50)

        # --- Phase 4: Side-by-Side Compare ---
        
        # Step 17: Enter Compare Mode
        await clear_pointers()
        await page.goto("http://localhost:3000/compare", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        box = await draw_pointer_on_locator(page.locator('a[href="/compare"]').first, 'Compare Tab')
        await screenshot_box('step17.png', box, pad_x=40, pad_y=40)

        # Step 18: Target Location
        await clear_pointers()
        compare_loc_field = page.locator('.label', has_text="Target Location").locator('..')
        box = await draw_pointer_on_locator(compare_loc_field, 'Select Comparison Target')
        await screenshot_box('step18.png', box, pad_x=40, pad_y=60)

        # Step 19: Configure Scenarios
        await clear_pointers()
        compare_table = page.locator('table').first
        box = await draw_pointer_on_locator(compare_table, 'Scenario Baseline vs Projections')
        await screenshot_box('step19.png', box, pad_x=40, pad_y=60)

        # Step 20: Policy Implication
        await clear_pointers()
        policy_loc = page.locator('text="Policy Implication"').locator('..')
        box = await draw_pointer_on_locator(policy_loc, 'Synthesized Conclusion')
        await screenshot_box('step20.png', box, pad_x=40, pad_y=60)


        # --- Phase 5: Hotspots ---
        
        # Step 21: Open Hotspots
        await clear_pointers()
        await page.goto("http://localhost:3000/hotspots", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        box = await draw_pointer_on_locator(page.locator('a[href="/hotspots"]').first, 'Hotspots Tab')
        await screenshot_box('step21.png', box, pad_x=40, pad_y=40)

        # Step 22: Rank Districts
        await clear_pointers()
        hotspot_list = page.locator('h2', has_text="Ranked Impact:").locator('..')
        box = await draw_pointer_on_locator(hotspot_list, 'Vulnerability Rankings')
        await screenshot_box('step22.png', box, pad_x=40, pad_y=60)


        # --- Phase 6: Places ---
        
        # Step 23: Open Places
        await clear_pointers()
        await page.goto("http://localhost:3000/places", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        box = await draw_pointer_on_locator(page.locator('a[href="/places"]').first, 'Places Directory')
        await screenshot_box('step23.png', box, pad_x=40, pad_y=40)

        # Step 24: Ecological Narratives
        await clear_pointers()
        places_grid = page.locator('h1:has-text("City & Regional Climate Profiles")').locator('..').locator('..')
        box = await draw_pointer_on_locator(places_grid, 'Ecological Narratives')
        await screenshot_box('step24.png', box, pad_x=40, pad_y=60)


        print("All 24 screenshots captured!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
