import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '..', 'public', 'images', 'manual');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport to a nice laptop size
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  
  console.log('Navigating to local dev server...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Helper to inject a red box pointer and text
  async function drawPointer(selector, label, color = '#ef4444') {
    await page.evaluate((sel, lab, col) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      
      const box = document.createElement('div');
      box.className = 'manual-pointer';
      box.style.position = 'fixed';
      box.style.top = (rect.top - 4) + 'px';
      box.style.left = (rect.left - 4) + 'px';
      box.style.width = (rect.width + 8) + 'px';
      box.style.height = (rect.height + 8) + 'px';
      box.style.border = `3px solid ${col}`;
      box.style.borderRadius = '6px';
      box.style.zIndex = '999999';
      box.style.pointerEvents = 'none';
      box.style.boxShadow = `0 0 0 2px rgba(255,255,255,0.8), 0 0 15px ${col}88`;
      
      const labelEl = document.createElement('div');
      labelEl.innerText = lab;
      labelEl.style.position = 'absolute';
      labelEl.style.top = '-32px';
      labelEl.style.left = '50%';
      labelEl.style.transform = 'translateX(-50%)';
      labelEl.style.background = col;
      labelEl.style.color = 'white';
      labelEl.style.padding = '4px 12px';
      labelEl.style.borderRadius = '999px';
      labelEl.style.fontSize = '14px';
      labelEl.style.fontWeight = '600';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
      
      // Little triangle pointing down
      const triangle = document.createElement('div');
      triangle.style.position = 'absolute';
      triangle.style.bottom = '-6px';
      triangle.style.left = '50%';
      triangle.style.transform = 'translateX(-50%)';
      triangle.style.borderLeft = '6px solid transparent';
      triangle.style.borderRight = '6px solid transparent';
      triangle.style.borderTop = `6px solid ${col}`;
      
      labelEl.appendChild(triangle);
      box.appendChild(labelEl);
      document.body.appendChild(box);
    }, selector, label, color);
  }

  async function clearPointers() {
    await page.evaluate(() => {
      document.querySelectorAll('.manual-pointer').forEach(el => el.remove());
    });
  }

  // Helper to crop to a specific element with padding
  async function screenshotElement(filename, selector, padding = 40) {
    const el = await page.$(selector);
    if (!el) {
      console.log(`Element ${selector} not found for ${filename}`);
      return;
    }
    const box = await el.boundingBox();
    await page.screenshot({
      path: path.join(outDir, filename),
      clip: {
        x: Math.max(0, box.x - padding),
        y: Math.max(0, box.y - padding),
        width: box.width + padding * 2,
        height: box.height + padding * 2
      }
    });
    console.log(`Saved ${filename}`);
  }

  // --- Step 1: Country Switcher ---
  await clearPointers();
  await drawPointer('header .flex.items-center.gap-2', 'Switch Country');
  await screenshotElement('step01-country.png', 'header');

  // --- Step 2: Location Search ---
  await clearPointers();
  // Wait for the place search combobox
  await page.waitForSelector('[role="combobox"]', { timeout: 5000 }).catch(() => {});
  await drawPointer('[role="combobox"]', 'Search for a city');
  await screenshotElement('step02-search.png', '.absolute.top-6.left-6.z-10.w-80'); // The sidebar wrapper

  // --- Step 3: Indicator Picker ---
  await clearPointers();
  await drawPointer('button[aria-haspopup="listbox"]', 'Change Metric');
  await screenshotElement('step03-indicator.png', '.absolute.top-6.left-6.z-10.w-80');

  // --- Step 4: Map & Grid ---
  await clearPointers();
  // We want to capture the map with the legend
  await drawPointer('.absolute.bottom-8.right-8', 'Color Legend', '#0284c7');
  await page.screenshot({ path: path.join(outDir, 'step04-map.png') });
  console.log(`Saved step04-map.png`);

  // --- Step 5: Location Panel (Simulate Click) ---
  // Click roughly in the center of the screen to open the panel
  await page.mouse.click(720, 450);
  await new Promise(r => setTimeout(r, 1000)); // Wait for panel slide out
  await clearPointers();
  await drawPointer('section.w-\\[380px\\]', 'Point Analytics Panel');
  await page.screenshot({ path: path.join(outDir, 'step05-panel.png') });
  console.log(`Saved step05-panel.png`);

  console.log('All screenshots captured!');
  await browser.close();
}

run().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
