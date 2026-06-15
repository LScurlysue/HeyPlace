const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, PageBreak
} = require("docx");

const COLOR_PRIMARY = "C99A00"; // darker lemon for readable headings
const GREY = "666666";

const heading = (text, level) => new Paragraph({
  heading: level,
  children: [new TextRun(text)]
});

const body = (text) => new Paragraph({
  children: [new TextRun(text)],
  spacing: { after: 120 }
});

const bullet = (text, bold) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text, bold: !!bold })]
});

const numbered = (text) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun(text)]
});

const colorRow = (emoji, label, meaning) => new TableRow({
  children: [
    new TableCell({
      width: { size: 1200, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      borders: noBorders(),
      children: [new Paragraph({ children: [new TextRun(emoji)] })]
    }),
    new TableCell({
      width: { size: 2400, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      borders: noBorders(),
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })]
    }),
    new TableCell({
      width: { size: 5760, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      borders: noBorders(),
      children: [new Paragraph({ children: [new TextRun(meaning)] })]
    }),
  ]
});

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 44, bold: true, font: "Calibri", color: COLOR_PRIMARY },
        paragraph: { spacing: { after: 120 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Calibri", color: COLOR_PRIMARY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "F0DDA0", space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1260, bottom: 1080, left: 1260 }
      }
    },
    children: [
      new Paragraph({ style: "Title", children: [new TextRun("📍 MapFolio — Quick Start Guide")] }),
      body("MapFolio is a free web app for organizing your favorite places on a personal map. No account, no sign-up — everything stays on your own device."),

      heading("1. Open the app", HeadingLevel.HEADING_1),
      body("Tap the link you were given. It opens straight in your phone or computer's browser — nothing to download or install from a store."),

      heading("Add it to your home screen (optional, recommended)", HeadingLevel.HEADING_2),
      bullet("iPhone (Safari): tap the Share icon (square with an arrow) → “Add to Home Screen”."),
      bullet("Android (Chrome): tap the ⋮ menu in the top right → “Add to Home screen” or “Install app”."),
      body("This adds a MapFolio icon to your phone so you can open it like any other app — no need to type the address or search for it each time."),

      heading("2. Add your first places", HeadingLevel.HEADING_1),
      body("You don't need to import anything to start — you can add places one by one:"),
      numbered("Tap Menu → Search."),
      numbered("Type a place name or address."),
      numbered("Tap “Add as new place” to pin it on your map."),
      body("If the search can't find it, you can still add it and type in the coordinates yourself."),

      heading("3. Or import your Google Maps saved places", HeadingLevel.HEADING_1),
      body("This takes about 5 minutes the first time:"),
      numbered("Go to takeout.google.com (Google Takeout)."),
      numbered("Click “Deselect all”, then tick only “Maps (your places)”."),
      numbered("Click Next step → Create export. Google will email you a download link."),
      numbered("Download the ZIP, open it, and find the files ending in .json, .csv, .kml or .kmz."),
      numbered("In MapFolio, tap Menu → Import Places and select those files. Done!"),
      body("MapFolio also accepts .csv spreadsheets and .kmz/.kml files exported from other map tools."),

      heading("4. Organize your places", HeadingLevel.HEADING_1),
      bullet("Folders — group places however you like (e.g. “Paris trip”, “Coffee shops”). Imported files automatically become folders."),
      bullet("Categories — tag each place with a type (Restaurant, Museum, etc.), or create your own custom category with its own emoji."),
      bullet("Status colors — every pin is color-coded by status:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1200, 2400, 5760],
        rows: [
          colorRow("🔵", "Want to Go", "Blue — places you'd like to visit"),
          colorRow("🟢", "Loved It", "Green — you went and loved it"),
          colorRow("🟠", "Been There", "Amber — you've visited"),
          colorRow("⭕", "Skip It", "Red — not worth going"),
          colorRow("⚫", "Meh", "Brown — visited, but unremarkable"),
          colorRow("⭐", "Favourite", "Gold — your top picks"),
          colorRow("⚪", "Unsorted", "Grey — not yet given a status"),
        ]
      }),

      new Paragraph({ spacing: { before: 160 }, children: [] }),

      heading("5. Plan a trip", HeadingLevel.HEADING_1),
      body("Tap Trip planner in the sidebar, choose a folder (or all places), pick which statuses to include, choose walking or driving, and set the number of days. MapFolio builds a day-by-day itinerary grouping nearby places together."),

      heading("6. Back up or share your places", HeadingLevel.HEADING_1),
      bullet("Settings (⚙️ icon) → Backup & Restore — saves all your data as a file you can keep safe or move to another device."),
      bullet("Each folder also has its own export option, so you can share just one collection (e.g. “Best cafes in Lisbon”) with a friend."),

      heading("Frequently asked questions", HeadingLevel.HEADING_1),

      heading("Is my data private?", HeadingLevel.HEADING_2),
      body("Yes. MapFolio runs entirely in your browser. Nothing is uploaded to any server. Your places only leave your device if you choose to export a backup file yourself."),

      heading("Can I send these places back into Google Maps?", HeadingLevel.HEADING_2),
      body("Not yet — MapFolio's export is its own file format, made for backing up or sharing with other MapFolio users. Sending places back into Google Maps is on the wish list for a future version."),

      heading("Is this connected to Booking.com or any travel booking site?", HeadingLevel.HEADING_2),
      body("No. MapFolio doesn't book anything and has no connection to any travel or accommodation service. It's just a personal map and trip-planning tool — no accounts, no bookings, no external services."),

      heading("What if I get stuck?", HeadingLevel.HEADING_2),
      body("Tap the ? icon at the top of the app any time for a full in-app guide covering every feature in more detail."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => fs.writeFileSync("MapFolio-Quick-Start-Guide.docx", buffer));
