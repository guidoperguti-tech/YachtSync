const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { OpenAI } = require('openai');
const { starteYachtPosting } = require('./bot.js');

const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const openai = new OpenAI({ apiKey: 'sk-proj-XXXXXXXXXXXXXX' });

const app = express();
app.use(express.json());

let dealsCRM = [];
let charterBuchungen = [];
let crewMaengelBerichte = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/crm/add-buyer', (req, res) => {
    const { kaeuferName, budget, mindestLaenge, liegeplatzWunsch } = req.body;
    const neuerKaeufer = { id: Date.now(), name: kaeuferName, budget: Number(budget), minLaenge: Number(mindestLaenge), region: liegeplatzWunsch };
    dealsCRM.push(neuerKaeufer);
    res.json({ status: "Erfolg", nachricht: "Käuferprofil registriert.", daten: neuerKaeufer });
});

app.post('/api/charter/book', (req, res) => {
    const { yachtId, startDatum, endDatum, chartererName } = req.body;
    const konflikt = charterBuchungen.find(b => 
        b.yachtId === yachtId && 
        ((startDatum >= b.start && startDatum <= b.end) || (endDatum >= b.start && endDatum <= b.end))
    );
    if (konflikt) {
        return res.status(400).json({ status: "Konflikt", nachricht: "Diese Yacht ist im gewählten Zeitraum bereits besetzt!" });
    }
    const neueBuchung = { id: Date.now(), yachtId, start: startDatum, end: endDatum, kunde: chartererName };
    charterBuchungen.push(neueBuchung);
    res.json({ status: "Erfolg", nachricht: "Charterzeitraum gesperrt.", buchung: neueBuchung });
});

app.post('/api/legal/generate-contract', (req, res) => {
    const { verkaeufer, kaeufer, yachtName, kaufpreis } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SPA_Vertrag_${yachtName}.pdf`);
    doc.pipe(res);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text('YACHT SALES AND PURCHASE AGREEMENT (SPA)', 50, 50);
    doc.end();
});

app.post('/api/crew/report-issue', (req, res) => {
    const { yachtId, komponente, beschreibung, dringlichkeit } = req.body;
    const neuerMangel = { id: Date.now(), yachtId, komponente, text: beschreibung, status: "Offen", prioritaet: dringlichkeit };
    crewMaengelBerichte.push(neuerMangel);
    res.json({ status: "Erfolg", nachricht: "Mängelbericht registriert.", mangel: neuerMangel });
});

app.post('/api/generate-ai-text', async (req, res) => {
    const { hersteller, modell, beschreibung } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Schreibe ein Exposé auf Englisch." },
                { role: "user", content: `Werft: ${hersteller}, Modell: ${modell}. Rohdaten: ${beschreibung}` }
            ],
        });
        res.json({ text: response.choices.message.content });
    } catch (e) {
        res.json({ text: `✨ PRESTIGIOUS VESSEL ✨\n\nThe magnificent ${hersteller} ${modell} represents the pinnacle of modern naval architecture.` });
    }
});

app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Specification_${hersteller}.pdf`);
    doc.pipe(res);
    doc.rect(0, 0, 612, 50).fill('#0f172a');
    doc.end();
});

app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});

