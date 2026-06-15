const pptxgen = require("pptxgenjs");

const NAVY = "14213D";
const TEAL = "1C7293";
const LEMON = "FFDE59";
const INK = "1E1E1E";
const MUTED = "5A6B7A";
const CARD = "F4F6F8";

const HEAD_FONT = "Trebuchet MS";
const BODY_FONT = "Calibri";

let pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "Liliia Sainchuk";
pres.title = "MapFolio - Demo Day";

const W = 13.33, H = 7.5;

// ---------- Slide 1: Title ----------
{
  let s = pres.addSlide();
  s.background = { color: NAVY };

  s.addShape(pres.shapes.OVAL, { x: 10.6, y: -1.8, w: 5, h: 5, fill: { color: TEAL, transparency: 70 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: 4.5, w: 4.5, h: 4.5, fill: { color: TEAL, transparency: 80 }, line: { type: "none" } });

  s.addText("📍", { x: 0.9, y: 1.5, w: 1.5, h: 1.5, fontSize: 60, align: "left", valign: "middle" });
  s.addText("MapFolio", { x: 0.9, y: 2.6, w: 8, h: 1.2, fontSize: 60, bold: true, color: "FFFFFF", fontFace: HEAD_FONT, margin: 0 });
  s.addText("Organize your favorite places on a personal map", { x: 0.9, y: 3.8, w: 9, h: 0.6, fontSize: 22, color: LEMON, fontFace: BODY_FONT, margin: 0 });

  s.addText("Demo Day  •  Built solo over 3 weeks  •  No backend, no account, your data stays on your device", {
    x: 0.9, y: 6.5, w: 11, h: 0.5, fontSize: 14, color: "AEB9C9", fontFace: BODY_FONT, margin: 0
  });
}

// ---------- Slide 2: Elevator pitch ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };

  s.addText("What is MapFolio?", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.6, w: 7.4, h: 5.2, fill: { color: CARD }, line: { type: "none" } });
  s.addText([
    { text: "MapFolio is a free web app for organizing your favorite places on a personal map.", options: { breakLine: true, fontSize: 20, bold: true, color: NAVY } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Import your existing Google Maps saved places, or start fresh and build your own collections from scratch.", options: { breakLine: true, fontSize: 16, color: INK } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Sort everything into folders, tag places with custom categories, and color-code them by status: Want to Go, Loved It, Skip It.", options: { breakLine: true, fontSize: 16, color: INK } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "There's even a trip planner that turns any collection into a day-by-day itinerary.", options: { breakLine: true, fontSize: 16, color: INK } },
  ], { x: 1, y: 1.95, w: 6.6, h: 4.5, fontFace: BODY_FONT, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });

  // side highlight cards
  const items = [
    ["🔒", "No account needed", "Your data stays on your device"],
    ["🆓", "Free to use", "Nothing to buy, nothing to sign up for"],
    ["🗺️", "Works with Google Maps exports", "Bring in your existing saved places"],
  ];
  let y = 1.6;
  for (const [icon, title, sub] of items) {
    s.addShape(pres.shapes.RECTANGLE, { x: 8.3, y, w: 4.4, h: 1.55, fill: { color: NAVY }, line: { type: "none" } });
    s.addText(icon, { x: 8.55, y: y + 0.18, w: 0.9, h: 1.2, fontSize: 32, valign: "top", margin: 0 });
    s.addText(title, { x: 9.4, y: y + 0.2, w: 3.15, h: 0.6, fontSize: 16, bold: true, color: LEMON, fontFace: HEAD_FONT, margin: 0 });
    s.addText(sub, { x: 9.4, y: y + 0.75, w: 3.2, h: 0.7, fontSize: 12.5, color: "D7DEE6", fontFace: BODY_FONT, margin: 0 });
    y += 1.85;
  }
}

// ---------- Slide 3: What I set out to build ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("What I set out to explore", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  s.addText([
    { text: "Google Maps lets you star and save places — but never lets you organize, search, color-code, or plan trips around them.", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: "Goal: build a tool that takes that pile of saved places and turns it into something useful — sortable, searchable, shareable, and tied to an actual trip plan.", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: "Constraint I set for myself: no backend, no account system, no framework — just HTML, CSS and JavaScript, so anyone can open it and their data never leaves their device.", options: {} },
  ], { x: 0.7, y: 1.7, w: 7.2, h: 4.8, fontSize: 18, color: INK, fontFace: BODY_FONT, valign: "top", margin: 0, lineSpacingMultiple: 1.2 });

  s.addImage({ path: "shots/desktop-main.png", x: 8.05, y: 1.5, w: 4.7, h: 2.94, sizing: { type: "cover", w: 4.7, h: 2.94 }, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.2 } });
  s.addText("Built with: vanilla JS, Leaflet maps, OpenStreetMap data", { x: 8.05, y: 4.6, w: 4.7, h: 0.4, fontSize: 12, italic: true, color: MUTED, fontFace: BODY_FONT, margin: 0 });
}

// ---------- Slide 4: What I achieved ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("What I achieved", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  const features = [
    ["📥", "Import from anywhere", "Google Takeout JSON, KML/KMZ, CSV — with auto-geocoding for places missing coordinates"],
    ["🗂️", "Folders & custom categories", "Auto-detected categories, bulk editing, your own emoji tags"],
    ["🎨", "Status color-coding", "Want to Go, Been There, Loved It, Skip It, Favourite — at a glance on the map"],
    ["🧭", "Trip planner", "Turn any folder into a day-by-day walking or driving itinerary"],
    ["📱", "Mobile-first redesign", "Bottom sheets, accordions, dark/light themes, installable as a home-screen app"],
    ["💾", "Backup, restore & sharing", "Export your whole collection or a single folder as a file — no account needed"],
  ];

  let col = 0, row = 0;
  const cw = 3.95, ch = 2.55, gx = 0.3, gy = 0.3, startX = 0.6, startY = 1.7;
  for (const [icon, title, desc] of features) {
    const x = startX + col * (cw + gx);
    const y = startY + row * (ch + gy);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: CARD }, line: { type: "none" } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.08, h: ch, fill: { color: TEAL }, line: { type: "none" } });
    s.addText(icon, { x: x + 0.25, y: y + 0.18, w: 0.8, h: 0.6, fontSize: 26, margin: 0 });
    s.addText(title, { x: x + 0.25, y: y + 0.8, w: cw - 0.5, h: 0.5, fontSize: 15, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });
    s.addText(desc, { x: x + 0.25, y: y + 1.3, w: cw - 0.5, h: 1.1, fontSize: 11.5, color: MUTED, fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.1 });
    col++;
    if (col === 3) { col = 0; row++; }
  }
}

// ---------- Slide 5: Live look ----------
{
  let s = pres.addSlide();
  s.background = { color: NAVY };
  s.addText("A quick look", { x: 0.6, y: 0.4, w: 12, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF", fontFace: HEAD_FONT, margin: 0 });

  s.addImage({ path: "shots/trip-planner.png", x: 0.6, y: 1.4, w: 6.0, h: 3.75, sizing: { type: "cover", w: 6.0, h: 3.75 }, shadow: { type: "outer", color: "000000", blur: 10, offset: 4, angle: 135, opacity: 0.35 } });
  s.addText("Trip planner: pick a folder, statuses & days → get a route", { x: 0.6, y: 5.25, w: 6.0, h: 0.5, fontSize: 13, color: LEMON, fontFace: BODY_FONT, margin: 0 });

  // mobile image is portrait 390x844
  const mh = 5.2, mw = mh * (390 / 844);
  s.addImage({ path: "shots/mobile-main.png", x: 7.1, y: 1.0, w: mw, h: mh, sizing: { type: "cover", w: mw, h: mh }, shadow: { type: "outer", color: "000000", blur: 10, offset: 4, angle: 135, opacity: 0.35 } });
  s.addText("Mobile-first layout, installable to your home screen", { x: 7.1, y: 6.3, w: mw + 0.5, h: 0.5, fontSize: 13, color: LEMON, fontFace: BODY_FONT, margin: 0 });

  s.addImage({ path: "shots/help-modal.png", x: 9.95, y: 1.0, w: 3.0, h: 1.875, sizing: { type: "cover", w: 3.0, h: 1.875 }, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.35 } });
  s.addText("Built-in step-by-step help guide", { x: 9.95, y: 3.0, w: 3.0, h: 0.4, fontSize: 13, color: LEMON, fontFace: BODY_FONT, margin: 0 });
}

// ---------- Slide 6: What surprised me ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("What surprised me", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  const items = [
    ["🌀", "Google's own export formats are a mess", "Saved places come out differently depending on whether you use Takeout JSON, CSV, or KML — I ended up supporting all of them."],
    ["🧩", "\"Small\" UI fixes are never small", "A folder menu took 5 separate commits to get right across mobile and desktop — clipping, z-index, overlap, one after another."],
    ["⚡", "How far plain HTML/CSS/JS gets you", "No framework, no build step — just a couple of CDN libraries (Leaflet, JSZip) — and it still feels like a real app."],
  ];

  let y = 1.7;
  for (const [icon, title, desc] of items) {
    s.addShape(pres.shapes.OVAL, { x: 0.7, y, w: 0.9, h: 0.9, fill: { color: TEAL }, line: { type: "none" } });
    s.addText(icon, { x: 0.7, y, w: 0.9, h: 0.9, fontSize: 28, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: 1.85, y: y - 0.05, w: 10.5, h: 0.5, fontSize: 18, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });
    s.addText(desc, { x: 1.85, y: y + 0.45, w: 10.5, h: 0.7, fontSize: 14.5, color: INK, fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.15 });
    y += 1.65;
  }
}

// ---------- Slide 7: Challenges ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("Challenges along the way", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  const left = [
    "Geocoding places that have no coordinates in the import file",
    "Mobile layout edge cases — accordions, clipped menus, z-index fights with map controls",
    "Designing a categorization system flexible enough for anyone's “saved places” chaos",
  ];
  const right = [
    "Cross-device sync without a server — solved with export/import + merge",
    "Handling 4+ different import formats reliably (JSON, CSV, KML/KMZ)",
    "Keeping a single 5,700-line app maintainable while iterating fast",
  ];

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.6, w: 6.0, h: 5.0, fill: { color: CARD }, line: { type: "none" } });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.6, w: 6.0, h: 5.0, fill: { color: CARD }, line: { type: "none" } });

  s.addText("UI / UX", { x: 0.9, y: 1.85, w: 5.4, h: 0.5, fontSize: 16, bold: true, color: TEAL, fontFace: HEAD_FONT, margin: 0 });
  s.addText(left.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 18 }, breakLine: true, paraSpaceAfter: 12 } })),
    { x: 0.9, y: 2.4, w: 5.4, h: 3.8, fontSize: 15, color: INK, fontFace: BODY_FONT, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });

  s.addText("Data & architecture", { x: 7.1, y: 1.85, w: 5.4, h: 0.5, fontSize: 16, bold: true, color: TEAL, fontFace: HEAD_FONT, margin: 0 });
  s.addText(right.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 18 }, breakLine: true, paraSpaceAfter: 12 } })),
    { x: 7.1, y: 2.4, w: 5.4, h: 3.8, fontSize: 15, color: INK, fontFace: BODY_FONT, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
}

// ---------- Slide 8: Lessons & insights ----------
{
  let s = pres.addSlide();
  s.background = { color: NAVY };
  s.addText("Key lessons & insights", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF", fontFace: HEAD_FONT, margin: 0 });

  const items = [
    ["Real data finds real bugs", "Testing with my own (messy) saved places surfaced UI issues a clean test dataset never would have."],
    ["Data ownership matters", "For a personal-data tool, investing early in import/export and “no account needed” paid off — it's also the easiest trust story to tell."],
    ["Mobile constraints improve design", "Solving for small screens first led to a cleaner UI overall, not just a compromise."],
    ["Done is a moving target — and that's OK", "There's always one more format, one more edge case. Shipping something useful beats shipping something complete."],
  ];

  let col = 0, row = 0;
  const cw = 5.95, ch = 2.4, gx = 0.4, gy = 0.4, startX = 0.6, startY = 1.7;
  for (const [title, desc] of items) {
    const x = startX + col * (cw + gx);
    const y = startY + row * (ch + gy);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: "1E3354" }, line: { type: "none" } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.06, fill: { color: LEMON }, line: { type: "none" } });
    s.addText(title, { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.6, fontSize: 17, bold: true, color: LEMON, fontFace: HEAD_FONT, margin: 0 });
    s.addText(desc, { x: x + 0.3, y: y + 0.85, w: cw - 0.6, h: 1.4, fontSize: 13.5, color: "E4E9EF", fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.15 });
    col++;
    if (col === 2) { col = 0; row++; }
  }
}

// ---------- Slide 9: FAQ ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("Questions people ask me", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 30, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  const qa = [
    ["“What's the value beyond just tracking been-to / want-to-go?”",
      "Your own categories + color-coded statuses across all saved places, a trip planner that builds itineraries from a folder, and full ownership/portability of your data — none of which Google Maps offers."],
    ["“Can I import these places back into Google Maps?”",
      "Not yet — exports are MapFolio's own format today, for backup and sharing between MapFolio users. Two-way sync with Google Maps (KML export) is on the wish list."],
    ["“Is this connected to Booking.com?”",
      "Not today — right now it's purely a personal map and trip-planning tool, no external services. But it's a natural future direction: affiliate links to Booking.com, TripAdvisor, etc. for the places in your collection."],
    ["“What if a shared folder has a place I've already visited?”",
      "Your existing status always wins — if MapFolio recognizes the place (same link or name), the imported copy is skipped so your status (e.g. \"Loved It\") isn't overwritten. It just won't show up in the new shared folder."],
  ];

  let y = 1.3;
  for (const [i, [q, a]] of qa.entries()) {
    const cardH = i === qa.length - 1 ? 1.5 : 1.3;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y, w: 12.1, h: cardH, fill: { color: CARD }, line: { type: "none" } });
    s.addText(q, { x: 0.9, y: y + 0.15, w: 11.5, h: 0.45, fontSize: 15, bold: true, color: TEAL, fontFace: HEAD_FONT, margin: 0 });
    s.addText(a, { x: 0.9, y: y + 0.6, w: 11.5, h: cardH - 0.65, fontSize: 13, color: INK, fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.05 });
    y += cardH + 0.15;
  }
}

// ---------- Slide 10: What's next - monetization idea ----------
{
  let s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addText("What's next: an idea worth exploring", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY, fontFace: HEAD_FONT, margin: 0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.5, w: 12.1, h: 1.35, fill: { color: CARD }, line: { type: "none" } });
  s.addText("💡  Sell curated trip collections", { x: 0.9, y: 1.65, w: 11.5, h: 0.5, fontSize: 18, bold: true, color: TEAL, fontFace: HEAD_FONT, margin: 0 });
  s.addText("A folder of places + a trip-planner itinerary is basically a ready-made travel guide. People already pay for “where to eat in Lisbon” PDFs and curated maps — MapFolio could let creators package and sell their own collections.",
    { x: 0.9, y: 2.1, w: 11.5, h: 0.7, fontSize: 14, color: INK, fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.1 });

  const items = [
    ["🗂️", "Premium folders", "Creators (locals, frequent travellers, influencers) publish a folder as a paid “trip pack” — e.g. “3 days in Lisbon, foodie edition”."],
    ["🧭", "Itinerary included", "Buyers get the places plus a ready-made day-by-day plan from the trip planner — not just a list of pins."],
    ["🔁", "Built on what exists", "The export/import and trip-planner features already do most of the work — this is mainly a packaging + marketplace layer on top."],
  ];

  let x = 0.6;
  const cw = 3.95, gx = 0.3;
  for (const [icon, title, desc] of items) {
    s.addShape(pres.shapes.RECTANGLE, { x, y: 3.15, w: cw, h: 3.55, fill: { color: NAVY }, line: { type: "none" } });
    s.addText(icon, { x: x + 0.25, y: 3.35, w: 0.9, h: 0.7, fontSize: 28, margin: 0 });
    s.addText(title, { x: x + 0.25, y: 4.05, w: cw - 0.5, h: 0.55, fontSize: 16, bold: true, color: LEMON, fontFace: HEAD_FONT, margin: 0 });
    s.addText(desc, { x: x + 0.25, y: 4.65, w: cw - 0.5, h: 1.9, fontSize: 13, color: "E4E9EF", fontFace: BODY_FONT, margin: 0, lineSpacingMultiple: 1.15 });
    x += cw + gx;
  }

  s.addText("Still an open question: how to keep “no account needed” for browsing while supporting payments and creator profiles for sellers.",
    { x: 0.6, y: 6.85, w: 12.1, h: 0.5, fontSize: 13, italic: true, color: MUTED, fontFace: BODY_FONT, margin: 0 });
}

// ---------- Slide 11: Try it / closing ----------
{
  let s = pres.addSlide();
  s.background = { color: NAVY };

  s.addShape(pres.shapes.OVAL, { x: -1.5, y: -1.8, w: 5, h: 5, fill: { color: TEAL, transparency: 75 }, line: { type: "none" } });

  s.addText("Try it yourself", { x: 0.9, y: 1.0, w: 8, h: 1.0, fontSize: 40, bold: true, color: "FFFFFF", fontFace: HEAD_FONT, margin: 0 });
  s.addText([
    { text: "🔗  Open the link on your phone or laptop — no install, no sign-up", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: "📲  Add it to your home screen for one-tap access", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: "📥  Try importing a few Google Maps saved places, or just add some manually", options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: "🔒  Everything stays on your device — nothing is uploaded anywhere", options: {} },
  ], { x: 0.9, y: 2.4, w: 8, h: 3.2, fontSize: 20, color: "E4E9EF", fontFace: BODY_FONT, valign: "top", margin: 0, lineSpacingMultiple: 1.2 });

  // QR code card
  s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 1.5, w: 3.0, h: 3.6, fill: { color: "FFFFFF" }, line: { type: "none" },
    shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.3 } });
  s.addImage({ path: "shots/qr-code.png", x: 9.85, y: 1.75, w: 2.5, h: 2.5 });
  s.addText("Scan to open MapFolio", { x: 9.6, y: 4.3, w: 3.0, h: 0.4, fontSize: 13, bold: true, color: NAVY, align: "center", fontFace: HEAD_FONT, margin: 0 });
  s.addText("my-mapfolio.netlify.app", { x: 9.6, y: 4.65, w: 3.0, h: 0.35, fontSize: 11, color: MUTED, align: "center", fontFace: BODY_FONT, margin: 0 });

  s.addText("Thank you! Feedback, bug reports, and “what about X” ideas all very welcome.", {
    x: 0.9, y: 6.3, w: 11, h: 0.6, fontSize: 16, italic: true, color: LEMON, fontFace: BODY_FONT, margin: 0
  });
}

pres.writeFile({ fileName: "MapFolio-DemoDay.pptx" }).then(() => console.log("done"));
