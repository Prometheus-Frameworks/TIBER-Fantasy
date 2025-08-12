import fs from "fs";
import path from "path";

type Entry = { who: string; role: string; what: string; ref: string; ts: string };

const FILE = path.join(process.cwd(), "docs/internal/credits.json");

export function addCredit(e: Entry) {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, "utf8"));
    j.entries.push(e);
    fs.writeFileSync(FILE, JSON.stringify(j, null, 2));
  } catch (err) {
    console.error("[credits] failed to write", err);
  }
}

export function getCredits() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return j;
  } catch (err) {
    console.error("[credits] failed to read", err);
    return null;
  }
}

export function initCredits() {
  try {
    // Ensure directory exists
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create file if it doesn't exist
    if (!fs.existsSync(FILE)) {
      const initial = {
        "project": "OTC",
        "motto": "Serve Not Take", 
        "entries": []
      };
      fs.writeFileSync(FILE, JSON.stringify(initial, null, 2));
    }
  } catch (err) {
    console.error("[credits] failed to initialize", err);
  }
}