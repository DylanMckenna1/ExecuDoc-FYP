import { Client, Databases } from "node-appwrite"; // appwrtie node sdk 

//appwrite function handler it recieves the below
export default async ({ req, res, log, error }) => {
  try {// reads request body
    const body = req.bodyJson || {};
    const docId = body.docId; // which document to tag
    const inputText = (body.text || "").toString();
// if no docid fail early 
    if (!docId) {
      return res.json({ ok: false, error: "docId is required" }, 400);
    }
// read env vars
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const databaseId = process.env.DATABASE_ID;
    const collectionId = process.env.DOCUMENTS_COLLECTION_ID;
// validate env vars
    if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
      return res.json(
        {
          ok: false, // if not configured fail early 
          error: "Missing env vars. Check APPWRITE_* and DATABASE_ID / DOCUMENTS_COLLECTION_ID."
        },
        500
      );
    }
// create appwrite client 
    const client = new Client() // sets up appwrite node sdk to give database access
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const db = new Databases(client);

    // load document record from document collection
    const doc = await db.getDocument(databaseId, collectionId, docId);
// builds the text the function will scan for keywords
    const haystack = (
      inputText ||
      doc.summary ||
      doc.textContent ||
      ""
    )
      .toString()
      .toLowerCase();
// defining category rules
    const categories = [// each category has a name and keywords
      { name: "finance", keywords: ["stock", "invest", "investment", "bank", "loan", "trading", "finance", "revenue"] },
      { name: "legal", keywords: ["law", "contract", "court", "legal", "terms", "policy", "gdpr"] },
      { name: "study", keywords: ["exam", "lecture", "module", "assignment", "study", "notes", "university"] },
      { name: "work", keywords: ["meeting", "project", "client", "deliverable", "deadline", "work"] },
      { name: "history", keywords: ["history", "war", "century", "ancient", "medieval"] },
      { name: "personal", keywords: ["personal", "diary", "journal", "health", "family"] }
    ];
// scores categories
    let bestCategory = "";
    let bestScore = 0;

    for (const c of categories) { //for each category loop through keywords
      let score = 0;
      for (const k of c.keywords) {
        if (haystack.includes(k)) score += 1; // if keyword exists add 1 to score
      }
      if (score > bestScore) { // highest score wins 
        bestScore = score;
        bestCategory = c.name;
      }
    }

    // extract keywords to collect matching keywords and avoid duplicates
    const detectedKeywords = [];
    for (const c of categories) {
      for (const k of c.keywords) {
        if (haystack.includes(k) && !detectedKeywords.includes(k)) {
          detectedKeywords.push(k);
        }
      }
    }
// respect existing category 
const existingCategory = (doc.category || "").toString().trim();
// if category exixts 
return res.json({
  ok: true,
  docId,
  category: !existingCategory ? (bestCategory || "") : null, // backend returns null for category
  keywords: detectedKeywords.slice(0, 10).join(", "),
});
// error handling
  } catch (e) {
    error(String(e?.message || e));
    return res.json({ ok: false, error: e?.message || "Unknown error" }, 500);
  }
};