const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');
const { starteYachtPosting } = require('./bot.js');

// =========================================================================
// DATENBANK VERBINDUNG (Füge hier deinen Link aus Schritt 1 ein!)
// =========================================================================
const MONGO_URI = "mongodb+srv://yachtsyncadmin:<QitaPenas2009$$$>@yachtsync.vdxrew1.mongodb.net/?appName=YachtSync";
mongoose.connect(MONGO_URI)
    .then(() => console.log('💾 [Cloud Database] Live-Verbindung hergestellt!'))
    .catch(err => console.error('🚨 [Database Error] Verbindung fehlgeschlagen:', err));

// Datenbank Tabellen-Strukturen
const Yacht = mongoose.model('Yacht', new mongoose.Schema({ hersteller: String, modell: String, preis: Number, baujahr: Number, liegeplatz: String, beschreibung: String }));
const Buyer = mongoose.model('Buyer', new mongoose.Schema({ name: String, budget: Number, minLaenge: Number, region: String }));
const Charter = mongoose.model('Charter', new mongoose.Schema({ yachtId: String, start: String, end: String, kunde: String }));
const Mangel = mongoose.model('Mangel', new mongoose.Schema({ yachtId: String, komponente: String, text: String, prioritaet: String }));

const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const openai = new OpenAI({ apiKey: 'sk-proj-XXXXXXXXXXXXXX' });

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// APIs
app.post('/api/fleet/add', async (req, res) => {
    try {
        const neueYacht = new Yacht(req.body);
        await neueYacht.save();
        res.json({ status: "Erfolg", nachricht: "Yacht erfolgreich in der Cloud-Datenbank gespeichert!", daten: neueYacht });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm/add-buyer', async (req, res) => {
    try {
        const { kaeuferName, budget, mindestLaenge, liegeplatzWunsch } = req.body;
        const neuerKaeufer = new Buyer({ name: kaeuferName, budget: Number(budget), minLaenge: Number(mindestLaenge), region: liegeplatzWunsch });
        await neuerKaeufer.save();
        const passendesBoot = await Yacht.findOne({ preis: { $lte: Number(budget) } });
        res.json({ status: "Erfolg", neuerKaeufer, passendesBoot });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/charter/book', async (req, res) => {
    const { yachtId, startDatum, endDatum, chartererName } = req.body;
    try {
        const konflikt = await Charter.findOne({ yachtId, $or: [{ start: { $gte: startDatum, $lte: endDatum } }, { end: { $gte: startDatum, $lte: endDatum } }] });
        if (konflikt) return res.status(400).json({ status: "Konflikt", nachricht: "🚨 Diese Yacht ist im gewählten Zeitraum bereits besetzt!" });
        const neueBuchung = new Charter({ yachtId, start: startDatum, end: endDatum, kunde: chartererName });
        await neueBuchung.save();
        res.json({ status: "Erfolg", nachricht: "Charterzeitraum im Kalender erfolgreich blockiert." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/legal/generate-contract', (req, res) => {
    const { verkaeufer, kaeufer, yachtName, kaufpreis } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SPA_Vertrag_${yachtName}.pdf`);
    doc.pipe(res);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text('YACHT SALES AND PURCHASE AGREEMENT (SPA)', 50, 50);
    doc.moveDown().font('Helvetica').fontSize(12).text(`Verkäufer: ${verkaeufer}\nKäufer: ${kaeufer}\nObjekt: ${yachtName}\nPreis: ${kaufpreis} EUR`);
    doc.end();
});

app.post('/api/crew/report-issue', async (req, res) => {
    try {
        const neuerMangel = new Mangel(req.body);
        await neuerMangel.save();
        res.json({ status: "Erfolg", nachricht: "Mängelbericht im Werft-Register gesichert." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-ai-text', async (req, res) => {
    try {
        const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Schreibe ein britisches Yacht-Exposé." }, { role: "user", content: req.body.beschreibung }] });
        res.json({ text: response.choices.message.content });
    } catch (e) { res.json({ text: `✨ PRESTIGIOUS OFF-MARKET VESSEL ✨\n\nRedefining coastal luxury. Available for immediate viewings in Monaco.` }); }
});

app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Specification_${hersteller}.pdf`);
    doc.pipe(res);
    doc.rect(0, 0, 612, 50).fill('#0f172a');
    doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(18).text('⚓ YACHTSYNC SUITE SPECIFICATION SHEET', 50, 18);
    doc.fillColor('#0f172a').fontSize(24).text(`${hersteller} ${modell}`, 50, 90);
    doc.fontSize(12).text(`Preis: ${preis} EUR\nBaujahr: ${baujahr}\nLiegeplatz: ${liegeplatz}\n\nDetails:\n${beschreibung}`, 50, 140);
    doc.end();
});

app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft stabil auf Port ${PORT}`));
