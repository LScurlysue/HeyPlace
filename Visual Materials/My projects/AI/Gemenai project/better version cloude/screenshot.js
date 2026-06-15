const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  // Desktop main view
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:8088/index.html");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/desktop-main.png" });

  // Trip planner modal
  await page.click("#trip-planner-btn");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "shots/trip-planner.png" });
  await page.click("#trip-modal-close");
  await page.waitForTimeout(300);

  // Help modal
  await page.click("#help-btn");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "shots/help-modal.png" });
  await page.click("#help-modal-close");
  await page.waitForTimeout(300);

  await page.close();

  // Mobile view
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await page.goto("http://localhost:8088/index.html");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/mobile-main.png" });
  await page.close();

  await browser.close();
  console.log("done");
})();
