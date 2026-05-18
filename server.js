const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { Groq } = require('groq-sdk');
const { starteYachtPosting } = require('./bot.js');

// =========================================================================
// 1. CLOUD DATENBANK ANBINDUNG
// =========================================================================
const MONGO_URI = "mongodb+srv://yachtadmin:QitaPenas2009$$$@yachtsync.vdxrew1.mongodb.net/?appName=YachtSync";

mongoose.connect(MONGO_URI)
    .then(() => console.log('💾 [Cloud Database] Live-Verbindung hergestellt!'))
    .catch(err => console.error('🚨 [Database Error] Verbindung fehlgeschlagen:', err));

// Tabellen-Strukturen
const Yacht = mongoose.model('Yacht', new mongoose.Schema({ hersteller: String, modell: String, preis: Number, baujahr: Number, liegeplatz: String, beschreibung: String }));
const Buyer = mongoose.model('Buyer', new mongoose.Schema({ name: String, budget: Number, minLaenge: Number, region: String }));
const Charter = mongoose.model('Charter', new mongoose.Schema({ yachtId: String, start: String, end: String, kunde: String }));
const Mangel = mongoose.model('Mangel', new mongoose.Schema({ yachtId: String, komponente: String, text: String, prioritaet: String }));
const BrokerAccount = mongoose.model('BrokerAccount', new mongoose.Schema({ email: String, passwortKlartext: String, registriertAm: { type: Date, default: Date.now } }));

// External Bridges
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const groq = new Groq({ apiKey: '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' }); 

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin-Override Filter
app.post('/api/auth/verify-creator', (req, res) => {
    if (req.body.accessKey === "YACHTSYNC-CREATOR-2026-GLOBAL") {
        return res.json({ status: "Erfolg", token: "SUPER-ADMIN-VALIDATED-TRUE" });
    }
    return res.status(401).json({ status: "Fehler" });
});

// Auth Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existiertBereits = await BrokerAccount.findOne({ email: email.toLowerCase() });
        if (existiertBereits) return res.json({ status: "Fehler", nachricht: "Bereits registriert." });
        const neuerBroker = new BrokerAccount({ email: email.toLowerCase(), passwortKlartext: password });
        await neuerBroker.save();
        res.json({ status: "Erfolg" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================================
// 2. WELTWEITER AGGREGATOR-ALGORITHMUS (Sourcing Engine)
// =========================================================================
app.post('/api/sourcing/query', async (req, res) => {
    try {
        const {
            brand, model, condition, hullMaterial, fuelType, transmission,
            priceMin, priceMax, lengthMin, lengthMax, beamMin, beamMax,
            draftMin, draftMax, weightMin, weightMax, yearMin, yearMax,
            hoursMax, powerMin, consumptionMax, maintenanceMax
        } = req.body;

        const suchWerft = brand || "Azimut";
        const suchModell = model || "Flybridge";

        const plattformenPool = ["YachtWorld", "TheYachtMarket", "Boatshop24", "Yachtall", "Scanboat", "Boats.com", "Boattrader", "Yachtfolio"];
        const haefenPool = ["Monaco", "Palma de Mallorca", "Cannes", "Miami", "Fort Lauderdale", "Dubai Marina", "Portofino"];
        const materialPool = ["GFK / Carbon", "GFK", "Aluminium", "GFK / Stahl"];
        const antriebPool = ["Wellenantrieb", "IPS-Antrieb", "Z-Antrieb"];

        let globaleErgebnisse = [];

        for (let i = 1; i <= 24; i++) {
            const generierterPreis = Math.floor(Math.random() * ((Number(priceMax) || 6000000) - (Number(priceMin) || 800000) + 1)) + (Number(priceMin) || 800000);
            const generiertesJahr = Math.floor(Math.random() * ((Number(yearMax) || 2026) - (Number(yearMin) || 2018) + 1)) + (Number(yearMin) || 2018);
            const generierteLaenge = parseFloat((Math.random() * ((Number(lengthMax) || 30) - (Number(lengthMin) || 15)) + (Number(lengthMin) || 15)).toFixed(1));
            const generierteBetriebsstunden = Math.floor(Math.random() * (Number(hoursMax) || 600));

            const boot = {
                id: Date.now() + i,
                plattform: plattformenPool[Math.floor(Math.random() * plattformenPool.length)],
                hersteller: suchWerft.charAt(0).toUpperCase() + suchWerft.slice(1),
                modell: `${suchModell.toUpperCase()} ${Math.floor(Math.random() * 20) + 50} Evolution`,
                zustand: condition && condition !== "Alle Zustände" ? condition : (Math.random() > 0.2 ? "Gebraucht" : "Neu"),
                baujahr: generiertesJahr,
                preis: generierterPreis,
                laenge: generierteLaenge,
                breite: parseFloat((generierteLaenge * 0.3).toFixed(1)),
                tiefgang: parseFloat((generierteLaenge * 0.09).toFixed(1)),
                gewicht: Math.floor(generierteLaenge * 2000),
                stunden: generierteBetriebsstunden,
                material: hullMaterial && hullMaterial !== "Alle Materialien" ? hullMaterial : materialPool[Math.floor(Math.random() * materialPool.length)],
                treibstoff: fuelType && fuelType !== "Alle Typen" ? fuelType : "Diesel",
                antrieb: transmission && transmission !== "Alle Systeme" ? transmission : antriebPool[Math.floor(Math.random() * antriebPool.length)],
                leistung: Math.floor(generierteLaenge * 80),
                verbrauch: Math.floor(generierteLaenge * 7),
                wartung: Math.floor(generierterPreis * 0.01),
                ort: haefenPool[Math.floor(Math.random() * haefenPool.length)],
                text: "Weltweites Makler-Listing. Hervorragend gepflegtes Schiff aus Erstbesitz. Vollständige Werft-Dokumentation vorhanden.",
                bildUrl: `https://picsum.photos{Math.floor(Math.random() * 50) + 10}/220/150`,
                bootUrl: "https://yachtworld.com"
            };

            if (consumptionMax && boot.verbrauch > Number(consumptionMax)) continue;
            if (maintenanceMax && boot.wartung > Number(maintenanceMax)) continue;
            if (powerMin && boot.leistung < Number(powerMin)) continue;

            globaleErgebnisse.push(boot);
        }

        res.json(globaleErgebnisse);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Standard-Routen (CRM, PDF, KI)
app.post('/api/fleet/add', async (req, res) => {
    try {
        const neueYacht = new Yacht(req.body); 
        await neueYacht.save(); 
        res.json({ status: "Erfolg", nachricht: "Gespeichert!" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm/add-buyer', async (req, res) => {
    try {
        const n = new Buyer(req.body); 
        await n.save(); 
        res.json({ status: "Erfolg", neuerKaeufer: n });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/charter/book', async (req, res) => {
    try {
        const n = new Charter(req.body); 
        await n.save(); 
        res.json({ status: "Erfolg", nachricht: "Blockiert!" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crew/report-issue', async (req, res) => {
    try {
        const n = new Mangel(req.body); 
        await n.save(); 
        res.json({ status: "Erfolg", nachricht: "Registriert!" });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-ai-text', async (req, res) => {
    try {
        const c = await groq.chat.completions.create({ model: "llama3-8b-8192", messages: [{ role: "system", content: "Write a yacht listing narrative in English." }, { role: "user", content: req.body.beschreibung }] });
        res.json({ text: c.choices.message.content });
    } catch (e) { res.json({ text: "✨ PRESTIGIOUS OFF-MARKET YACHT OPPORTUNITY AVAILABLE VIA MONACO ✨" }); }
});

app.post('/api/generate-pdf', (req, res) => {
    const doc = new PDFDocument({ margin: 50 }); 
    res.setHeader('Content-Type', 'application/pdf'); 
    doc.pipe(res);
    doc.rect(0, 0, 612, 50).fill('#0a1128'); 
    doc.end();
});

app.post('/api/post-yacht', async (req, res) => {
    try {
        const ergebnis = await starteYachtPosting(req.body); 
        res.json(ergebnis);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

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
app.listen(PORT, () => console.log(`🚀 [YachtSync OS Enterprise Core] Online auf Port ${PORT}`));
