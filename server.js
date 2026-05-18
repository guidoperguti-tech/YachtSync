const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { Groq } = require('groq-sdk');
const { starteYachtPosting } = require('./bot.js');

// =========================================================================
// 1. DATENBANK VERBINDUNG (Füge hier deinen echten MongoDB-Link ein!)
// =========================================================================
const MONGO_URI = "mongodb+srv://yachtadmin:DEIN_PASSWORT@cluster0.xxxx.mongodb.net/yachtsync?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('💾 [Cloud Database] Live-Verbindung hergestellt!'))
    .catch(err => console.error('🚨 [Database Error] Verbindung fehlgeschlagen:', err));

// Datenbank Tabellen-Strukturen (Schemas)
const Yacht = mongoose.model('Yacht', new mongoose.Schema({ hersteller: String, modell: String, preis: Number, baujahr: Number, liegeplatz: String, beschreibung: String }));
const Buyer = mongoose.model('Buyer', new mongoose.Schema({ name: String, budget: Number, minLaenge: Number, region: String }));
const Charter = mongoose.model('Charter', new mongoose.Schema({ yachtId: String, start: String, end: String, kunde: String }));
const Mangel = mongoose.model('Mangel', new mongoose.Schema({ yachtId: String, komponente: String, text: String, prioritaet: String }));

// =========================================================================
// 2. EXTERNE INTERFACES (Stripe & KOSTENLOSE GROQ KI-ENGINE)
// =========================================================================
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 

// Gehe auf groq.com, erstelle in 10 Sekunden einen kostenlosen Account und trage hier deinen Key ein (Format: gsk_...)
const groq = new Groq({ apiKey: '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' });

const app = express();
app.use(express.json());

// Liefert das handgemachte Custom-Dashboard aus
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 3. CORE APIS (CRM, CHARTER, LEGAL, MAINTENANCE)
// =========================================================================

// SÄULE 1: FLEET REGISTRATION
app.post('/api/fleet/add', async (req, res) => {
    try {
        const neueYacht = new Yacht(req.body);
        await neueYacht.save();
        res.json({ status: "Erfolg", nachricht: "Yacht erfolgreich in der Cloud-Datenbank gespeichert!", daten: neueYacht });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SÄULE 2: BROKER CRM
app.post('/api/crm/add-buyer', async (req, res) => {
    try {
        const { kaeuferName, budget, mindestLaenge, liegeplatzWunsch } = req.body;
        const neuerKaeufer = new Buyer({ name: kaeuferName, budget: Number(budget), minLaenge: Number(mindestLaenge), region: liegeplatzWunsch });
        await neuerKaeufer.save();
        const passendesBoot = await Yacht.findOne({ preis: { $lte: Number(budget) } });
        res.json({ status: "Erfolg", neuerKaeufer, passendesBoot });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SÄULE 3: CHARTER SCHEDULING
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

// SÄULE 4: LEGAL OPERATIONS
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

// SÄULE 5: CREW REGISTRY
app.post('/api/crew/report-issue', async (req, res) => {
    try {
        const neuerMangel = new Mangel(req.body);
        await neuerMangel.save();
        res.json({ status: "Erfolg", nachricht: "Mängelbericht im Werft-Register gesichert." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================================
// 4. KI-ENGINE (Dauerhaft kostenloses Live Llama-3-Modell via Groq)
// =========================================================================
app.post('/api/generate-ai-text', async (req, res) => {
    const { hersteller, modell, beschreibung } = req.body;
    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192", // Brutal schnelles, dauerhaft kostenloses Meta-Modell
            messages: [
                { role: "system", content: "You are a world-class luxury yacht broker marketing writer. Write a compelling, emotional editorial listing narrative in English for high-net-worth individuals." },
                { role: "user", content: `Shipyard: ${hersteller}, Model: ${modell}. Technical logs/raw notes: ${beschreibung}` }
            ]
        });
        res.json({ text: completion.choices[0].message.content });
    } catch (error) {
        // Elegantes Fallback-System, falls der Groq Key gsk_... noch fehlt
        res.json({ text: `✨ EXCLUSIVE OFF-MARKET OPPORTUNITY ✨\n\nPresenting the magnificent ${hersteller} ${modell}. Redefining modern naval architecture and coastal luxury, this pristine vessel features an expansive open deck configuration and bespoke interior finishes. Available for immediate viewings and prompt delivery in Port Hercule, Monaco.` });
    }
});

// PDF SPECIFICATION SHEET GENERATOR
app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Specification_${hersteller}.pdf`);
    doc.pipe(res);
    doc.rect(0, 0, 612, 50).fill('#0a1128');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('⚓ YACHTSYNC SUITE SPECIFICATION SHEET', 50, 18);
    doc.fillColor('#0a1128').fontSize(24).text(`${hersteller} ${modell}`, 50, 90);
    doc.fontSize(12).text(`Preis: ${preis} EUR\nBaujahr: ${baujahr}\nLiegeplatz: ${liegeplatz}\n\nDetails:\n${beschreibung}`, 50, 140);
    doc.end();
});

// MULTI-POSTER PLAYWRIGHT BOT ROUTE
app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

// STRIPE BILLING INTERFACE
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price_data: { currency: 'eur', product_data: { name: 'YachtSync OS Workstation License' }, unit_amount: 49900, recurring: { interval: 'month' } }, quantity: 1 }],
            mode: 'subscription',
            success_url: 'https://' + req.get('host') + '/?payment=success',
            cancel_url: 'https://' + req.get('host') + '/?payment=cancel',
        });
        res.json({ id: session.id, url: session.url });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 [YachtSync OS] Monopoly Engine online mit kostenloser Live-KI auf Port ${PORT}`));
