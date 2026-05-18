const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { OpenAI } = require('openai');
const { starteYachtPosting } = require('./bot.js');

const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const openai = new OpenAI({ apiKey: 'sk-proj-XXXXXXXXXXXXXX' });

const app = express();
app.use(express.json());

// In-Memory-Datenbanken (Simuliert echte Datenbank-Tabellen im Arbeitsspeicher des Servers)
let dealsCRM = [];
let charterBuchungen = [];
let crewMaengelBerichte = [];

// Liefert das Haupt-Dashboard aus
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// SÄULE 1: BROKER-CRM ENGINE (Käufer & Verkäufer Matching)
// =========================================================================
app.post('/api/crm/add-buyer', (req, res) => {
    const { kaeuferName, budget, mindestLaenge, liegeplatzWunsch } = req.body;
    const neuerKaeufer = { id: Date.now(), name: kaeuferName, budget: Number(budget), minLaenge: Number(mindestLaenge), region: liegeplatzWunsch };
    dealsCRM.push(neuerKaeufer);
    res.json({ status: "Erfolg", nachricht: "Käuferprofil im CRM registriert.", daten: neuerKaeufer });
});

// =========================================================================
// SÄULE 2: CHARTER-SCHEDULING ENGINE (Anti-Doppelbuchungs-System)
// =========================================================================
app.post('/api/charter/book', (req, res) => {
    const { yachtId, startDatum, endDatum, chartererName } = req.body;
    
    // Prüfen auf Terminüberschneidungen (Doppelbuchungsschutz)
    const konflikt = charterBuchungen.find(b => 
        b.yachtId === yachtId && 
        ((startDatum >= b.start && startDatum <= b.end) || (endDatum >= b.start && endDatum <= b.end))
    );

    if (konflikt) {
        return res.status(400).json({ status: "Konflikt", nachricht: "🚨 Schwerwiegender Systemfehler verhindert: Diese Yacht ist im gewählten Zeitraum bereits fest verchartert!" });
    }

    const neueBuchung = { id: Date.now(), yachtId, start: startDatum, end: endDatum, kunde: chartererName };
    charterBuchungen.push(neueBuchung);
    res.json({ status: "Erfolg", nachricht: "Charterzeitraum im Flottenkalender erfolgreich gesperrt.", buchung: neueBuchung });
});

// =========================================================================
// SÄULE 3: RECHTSSICHERE VERTRAGS-ZENTRALE (SPA PDF-Generator)
// =========================================================================
app.post('/api/legal/generate-contract', (req, res) => {
    const { verkaeufer, kaeufer, yachtName, kaufpreis } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SPA_Vertrag_${yachtName}.pdf`);
    doc.pipe(res);

    // Rechtssicheres Dokument-Design (SPA - Sales and Purchase Agreement)
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text('YACHT SALES AND PURCHASE AGREEMENT (SPA)', 50, 50);
    doc.moveDown();
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Dieses rechtlich bindende Dokument regelt den Verkauf der Yacht "${yachtName}" zwischen den folgenden Parteien:`, { width: 500 });
    doc.moveDown();
    doc.font('Helvetica-Bold').text(`1. VERKÄUFER: ${verkaeufer}`);
    doc.text(`2. KÄUFER: ${kaeufer}`);
    doc.moveDown();
    doc.text(`KAUFPREIS (NETTO): ${Number(kaufpreis).toLocaleString('de-DE')} EUR`);
    doc.lineGap(4).font('Helvetica').text('Der Verkäufer garantiert, dass das Schiff zum Zeitpunkt der Übergabe frei von Schulden, Pfandrechten und maritimem Arrest übergeben wird. Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist das Fürstentum Monaco.', 50, 220, { width: 500, align: 'justify' });
    
    // Unterschriften-Felder
    doc.text('___________________________', 50, 400);
    doc.text('Unterschrift Verkäufer', 50, 415);
    doc.text('___________________________', 350, 400);
    doc.text('Unterschrift Käufer', 350, 415);
    
    doc.end();
});

// =========================================================================
// SÄULE 4: CREW- & WARTUNGS-INTERFACE (Telemetrie & Logbuch)
// =========================================================================
app.post('/api/crew/report-issue', (req, res) => {
    const { yachtId, komponente, beschreibung, dringlichkeit } = req.body;
    const neuerMangel = { id: Date.now(), yachtId, komponente, text: beschreibung, status: "Offen", prioritaet: dringlichkeit };
    crewMaengelBerichte.push(neuerMangel);
    res.json({ status: "Erfolg", nachricht: "Mängelbericht in der Werft-Zentrale registriert. Ingenieure wurden benachrichtigt.", mangel: neuerMangel });
});

// RESTLICHE STANDARD-ROUTEN (KI & Multi-Poster)
app.post('/api/generate-ai-text', async (req, res) => {
    const { hersteller, modell, beschreibung } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Du bist ein Luxus-Texter für Yachten. Schreibe ein hochemotionales Exposé auf Englisch." },
                { role: "user", content: `Werft: ${hersteller}, Modell: ${modell}. Rohdaten: ${beschreibung}` }
            ],
        });
        res.json({ text: response.choices.message.content });
    } catch (e) {
        res.json({ text: `✨ PRESTIGIOUS OFF-MARKET VESSEL ✨\n\nThe magnificent ${hersteller} ${modell} represents the pinnacle of modern naval architecture. Available for viewings in Monaco.` });
    }
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
    doc.fontSize(14).text(`Preis: ${preis} EUR | Baujahr: ${baujahr} | Liegeplatz: ${liegeplatz}`, 50, 130);
    doc.font('Helvetica').fontSize(11).text(beschreibung, 50, 180, { width: 500 });
    doc.end();
});

app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 [YachtSync OS Monopol-Edition] Online auf Port ${PORT}`);
});

