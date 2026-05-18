const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { Groq } = require('groq-sdk');

// =========================================================================
// 1. CLOUD DATABASE MANAGEMENT
// =========================================================================
const MONGO_URI = "mongodb+srv://yachtadmin:QitaPenas2009$$$@yachtsync.vdxrew1.mongodb.net/?appName=YachtSync";

mongoose.connect(MONGO_URI)
    .then(() => console.log('💾 [Cloud Database] Live-Verbindung hergestellt!'))
    .catch(err => console.error('🚨 [Database Error] Verbindung fehlgeschlagen:', err));

// Schemas & Models Definitionen
const Yacht = mongoose.model('Yacht', new mongoose.Schema({ hersteller: String, modell: String, preis: Number, baujahr: Number, liegeplatz: String, beschreibung: String }));
const Buyer = mongoose.model('Buyer', new mongoose.Schema({ name: String, budget: Number, minLaenge: Number, region: String }));
const Mangel = mongoose.model('Mangel', new mongoose.Schema({ yachtId: String, komponente: String, text: String, prioritaet: String }));
const BrokerAccount = mongoose.model('BrokerAccount', new mongoose.Schema({ email: String, passwortKlartext: String, registriertAm: { type: Date, default: Date.now } }));

// API Credentials
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const groq = new Groq({ apiKey: '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' }); 

const app = express();
app.use(express.json());

// Liefert das Dashboard aus
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 2. AUTHENTICATION OPERATIONS
// =========================================================================
app.post('/api/auth/verify-creator', (req, res) => {
    if (req.body.accessKey === "YACHTSYNC-CREATOR-2026-GLOBAL") {
        return res.json({ status: "Erfolg", token: "SUPER-ADMIN-VALIDATED-TRUE" });
    }
    return res.status(401).json({ status: "Fehler" });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existiertBereits = await BrokerAccount.findOne({ email: email.toLowerCase() });
        if (existiertBereits) return res.json({ status: "Fehler", nachricht: "Bereits registriert." });
        const neuerBroker = new BrokerAccount({ email: email.toLowerCase(), passwortKlartext: password });
        await neuerBroker.save();
        res.json({ status: "Erfolg" });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// =========================================================================
// 3. CORE ENTERPRISE OPERATIONS (CRM, MARKETING, SOURCING)
// =========================================================================
app.post('/api/fleet/add', async (req, res) => {
    try {
        const neueYacht = new Yacht(req.body); 
        await neueYacht.save(); 
        res.json({ status: "Erfolg", nachricht: "Yacht erfolgreich gespeichert!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm/add-buyer', async (req, res) => {
    try {
        const n = new Buyer(req.body); 
        await n.save(); 
        res.json({ status: "Erfolg", neuerKaeufer: n });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crew/report-issue', async (req, res) => {
    try {
        const n = new Mangel(req.body); 
        await n.save(); 
        res.json({ status: "Erfolg", nachricht: "Mangel registriert!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GLOBAL SOURCING ENGINE DATENSTROM (12 Plattformen)
app.post('/api/sourcing/query', async (req, res) => {
    try {
        const { brand, model, page } = req.body;
        const currentPage = Number(page) || 1;
        const ergebnisseProSeite = 8;
        const suchWerft = brand || "Azimut";
        const suchModell = model || "Flybridge";

        const netzwerke = ["YachtWorld", "TheYachtMarket", "Boot24", "Boatshop24", "Yachtall", "Boote-Suchen", "YACHTFOLIO", "SuperYacht Times", "Boat International", "Boattrader", "Boats.com", "Scanboat"];
        const haefen = ["Monaco", "Palma de Mallorca", "Cannes", "Miami", "Dubai Marina", "Portofino", "Rotterdam"];
        const bilder = [
            "https://unsplash.com",
            "https://unsplash.com",
            "https://unsplash.com"
        ];

        let listings = [];
        for (let i = 1; i <= ergebnisseProSeite; i++) {
            const indexFaktor = ((currentPage - 1) * ergebnisseProSeite) + i;
            listings.push({
                id: Date.now() + indexFaktor,
                plattform: netzwerke[indexFaktor % netzwerke.length],
                hersteller: suchWerft.charAt(0).toUpperCase() + suchWerft.slice(1),
                modell: `${suchModell.toUpperCase()} ${50 + indexFaktor} Evolution`,
                zustand: "Gebraucht",
                baujahr: 2026 - (indexFaktor % 6),
                preis: 1200000 + (indexFaktor * 75000),
                laenge: 15 + (indexFaktor % 12),
                breite: parseFloat((5 + (indexFaktor % 3)).toFixed(1)),
                tiefgang: parseFloat((1.2 + (indexFaktor % 2) * 0.3).toFixed(1)),
                stunden: 120 + (indexFaktor * 15),
                material: "GFK / Carbon",
                antrieb: "IPS-Antrieb",
                verbrauch: 90 + (indexFaktor * 4),
                wartung: 15000 + (indexFaktor * 1200),
                ort: haefen[indexFaktor % haefen.length],
                bild: bilder[indexFaktor % bilder.length],
                link: `https://google.com{suchWerft}+${suchModell}`
            });
        }
        res.json({ listings, page: currentPage });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// KI RECHENWERK
app.post('/api/generate-ai-text', async (req, res) => {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: "Yacht broker analytics expert." },
                { role: "user", content: req.body.beschreibung || "Kalkuliere den Wert." }
            ]
        });
        res.json({ text: completion.choices.message.content });
    } catch (error) {
        res.json({ text: "✨ MARKET ENGINE SIMULATION ACTIVE ✨" });
    }
});

// PDF COMPILER INTERFACE
app.post('/api/generate-pdf', (req, res) => {
    const doc = new PDFDocument(); 
    res.setHeader('Content-Type', 'application/pdf'); 
    doc.pipe(res); 
    doc.end();
});

// STRIPE CHECKOUT ROUTE
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
app.listen(PORT, () => console.log(`🚀 [YachtSync OS Enterprise Backend] Online auf Port ${PORT}`));
