const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { OpenAI } = require('openai');
const { starteYachtPosting } = require('./bot.js');

const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const openai = new OpenAI({ apiKey: 'sk-proj-XXXXXXXXXXXXXX' });

const app = express();
app.use(express.json());

// In-Memory-Datenbank-Tabellen (Zentrales ERP-Datenregister)
let fleetInventory = [];
let crmLeads = [];
let charterCalendar = [];
let financeLedger = [];
let telemetryLog = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// MODULE 1: INVENTORY & GLOBAL DISTRIBUTION SYSTEM
// =========================================================================
app.post('/api/fleet/register', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const neueYacht = { id: Date.now(), hersteller, modell, preis: Number(preis), baujahr: Number(baujahr), liegeplatz, beschreibung, status: "Verfügbar" };
    fleetInventory.push(neueYacht);
    res.json({ status: "Erfolg", nachricht: "Yacht im globalen ERP-Register erfasst.", daten: neueYacht });
});

// =========================================================================
// MODULE 2: HIGH-NET-WORTH CRM (AI Matching Core)
// =========================================================================
app.post('/api/crm/add-lead', (req, res) => {
    const { clientName, targetBudget, minLength, clientType } = req.body;
    const neuerLead = { id: Date.now(), clientName, targetBudget: Number(targetBudget), minLength: Number(minLength), clientType, timestamp: new Date() };
    crmLeads.push(neuerLead);

    // AI Matching-Algorithmus sucht im Live-Bootsbestand
    const match = fleetInventory.find(y => y.preis <= neuerLead.targetBudget && y.status === "Verfügbar");
    res.json({ status: "Erfolg", nachricht: "HNI-Client erfolgreich registriert.", daten: neuerLead, match: match || null });
});

// =========================================================================
// MODULE 3: CHARTER OPERATIONS & COLLISION GUARD
// =========================================================================
app.post('/api/charter/schedule', (req, res) => {
    const { vesselId, client, startDate, endDate, weeklyRate } = req.body;
    
    // Mathematische Kollisionsprüfung (Doppelbuchungsschutz)
    const overlap = charterCalendar.find(c => 
        c.vesselId === vesselId && 
        ((startDate >= c.start && startDate <= c.end) || (endDate >= c.start && endDate <= c.end))
    );
    if (overlap) {
        return res.status(400).json({ status: "Konflikt", nachricht: "🚨 Belegungs-Konflikt: Das Schiff ist im Zeitraum bereits gebucht." });
    }

    const buchung = { id: Date.now(), vesselId, client, start: startDate, end: endDate, rate: Number(weeklyRate) };
    charterCalendar.push(buchung);
    res.json({ status: "Erfolg", nachricht: "Zeitraum im Flottenkalender erfolgreich gesperrt.", daten: buchung });
});

// =========================================================================
// MODULE 4: LEGAL CONTRACT ENGINE (SPA & MYBA Standards)
// =========================================================================
app.post('/api/legal/build-agreement', (req, res) => {
    const { sellerName, buyerName, assetName, purchasePrice } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SPA_Agreement_${assetName}.pdf`);
    doc.pipe(res);

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(18).text('MEMORANDUM OF AGREEMENT (MOA) / SPA', 50, 50);
    doc.moveDown();
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Offizieller Kaufvertrag für maritime Vermögenswerte.`, { width: 500 });
    doc.moveDown();
    doc.text(`VERKÄUFER (EIGNER): ${sellerName}`);
    doc.text(`KÄUFER (INVESTOR): ${buyerName}`);
    doc.text(`SCHIFFS-ASSET: ${assetName}`);
    doc.text(`KAUFPREIS: ${Number(purchasePrice).toLocaleString('de-DE')} EUR`);
    doc.moveDown();
    doc.text('Dieses Dokument unterliegt dem Seerecht des Fürstentums Monaco. Die Übergabe erfolgt frei von maritimem Arrest.', { align: 'justify' });
    doc.end();
});

// =========================================================================
// MODULE 5: FINANCIAL LEDGER & TRANSACTION TRACKING
// =========================================================================
app.post('/api/finance/post-invoice', (req, res) => {
    const { debtor, invoiceAmount, serviceType } = req.body;
    const rechnung = { id: Date.now(), debtor, amount: Number(invoiceAmount), serviceType, paymentStatus: "Offen (Treuhandkonto)" };
    financeLedger.push(rechnung);
    res.json({ status: "Erfolg", nachricht: "Transaktion im Hauptbuch gebucht.", daten: rechnung });
});

// =========================================================================
// MODULE 6: VESSEL TELEMETRY & MAINTENANCE SYSTEMS
// =========================================================================
app.post('/api/crew/log-telemetry', (req, res) => {
    const { vesselName, engineHours, activeIssues, fuelLevel } = req.body;
    const log = { id: Date.now(), vesselName, hours: Number(engineHours), issues: activeIssues, fuel: Number(fuelLevel), reportTime: new Date() };
    telemetryLog.push(log);
    res.json({ status: "Erfolg", nachricht: "Telemetriedaten von Bord erfolgreich synchronisiert.", daten: log });
});

// CORE WRAPPERS (AI & WEB SCRAPING)
app.post('/api/generate-ai-text', async (req, res) => {
    const { hersteller, modell, beschreibung } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an elite superyacht copywriter. Write a highly emotional, prestigious sales description in English." },
                { role: "user", content: `Shipyard: ${hersteller}, Model: ${modell}. Raw Data: ${beschreibung}` }
            ],
        });
        res.json({ text: response.choices.message.content });
    } catch (e) {
        res.json({ text: `✨ PRESTIGIOUS MARITIME ASSET ✨\n\nThe magnificent ${hersteller} ${modell} represents the zenith of naval luxury. Engineered to perfection, she stands ready for immediate delivery.` });
    }
});

app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Specification_${hersteller}.pdf`);
    doc.pipe(res);
    doc.rect(0, 0, 612, 50).fill('#0f172a');
    doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(16).text('⚓ YACHTSYNC SUITE COMMERCIAL SPEC SHEET', 50, 18);
    doc.fillColor('#0f172a').fontSize(22).text(`${hersteller} ${modell}`, 50, 90);
    doc.fontSize(12).text(`Price: ${preis} EUR | Year: ${baujahr} | Port: ${liegeplatz}`, 50, 125);
    doc.font('Helvetica').fontSize(10).text(beschreibung, 50, 160, { width: 500 });
    doc.end();
});

app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

// START PROTOKOLL
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[YachtSync OS Enterprise Monopol Engine Active on Port ${PORT}]`);
});

