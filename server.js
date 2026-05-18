const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Groq } = require('groq-sdk');
const { starteYachtPosting } = require('./bot.js');

// =========================================================================
// 1. DATENBANK VERBINDUNG (MongoDB Atlas Link)
// =========================================================================
const MONGO_URI = "mongodb+srv://yachtadmin:QitaPenas2009$$$mongodb+srv://yachtsyncadmin:<QitaPenas2009$$$>@yachtsync.vdxrew1.mongodb.net/?appName=YachtSync@cluster0.xxxx.mongodb.net/yachtsync?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('💾 [Cloud Database] Live-Verbindung hergestellt!'))
    .catch(err => console.error('🚨 [Database Error] Verbindung fehlgeschlagen:', err));

// =========================================================================
// 2. STRUKTUREN & DATENBANK-TABELLEN (Inklusive echtem User-Management)
// =========================================================================
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    hasActiveSubscription: { type: Boolean, default: false },
    stripeCustomerId: { type: String, default: "" }
});
const User = mongoose.model('User', UserSchema);

const Yacht = mongoose.model('Yacht', new mongoose.Schema({ hersteller: String, modell: String, preis: Number, baujahr: Number, liegeplatz: String, beschreibung: String }));
const Buyer = mongoose.model('Buyer', new mongoose.Schema({ name: String, budget: Number, minLaenge: Number, region: String }));
const Charter = mongoose.model('Charter', new mongoose.Schema({ yachtId: String, start: String, end: String, kunde: String }));
const Mangel = mongoose.model('Mangel', new mongoose.Schema({ yachtId: String, komponente: String, text: String, prioritaet: String }));

// =========================================================================
// 3. API INITIALISIERUNG
// =========================================================================
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 
const groq = new Groq({ apiKey: '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' });

const app = express();
app.use(express.json());

// Hilfsfunktion zur sicheren Passwort-Verschlüsselung (SHA-256)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 4. REGISTRIERUNGS- & LOGIN-ROUTEN (Echtes Mitgliedssystem)
// =========================================================================
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const bestehenderUser = await User.findOne({ email });
        if (bestehenderUser) return res.status(400).json({ status: "Fehler", nachricht: "Diese E-Mail-Adresse wird bereits verwendet." });

        const neuerUser = new User({
            email: email.toLowerCase(),
            passwordHash: hashPassword(password)
        });
        await neuerUser.save();
        res.json({ status: "Erfolg", nachricht: "Broker-Account erfolgreich in der Cloud registriert!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.passwordHash !== hashPassword(password)) {
            return res.status(401).json({ status: "Fehler", nachricht: "Ungültige Login-Daten. Zugriff verweigert." });
        }
        res.json({ status: "Erfolg", nachricht: "Authentifizierung erfolgreich.", hasLicense: user.hasActiveSubscription, email: user.email });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================================
// 5. STRIPE CORE PAYWALL INTERFACE
// =========================================================================
app.post('/create-checkout-session', async (req, res) => {
    const { email } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email || undefined,
            line_items: [{ 
                price_data: { 
                    currency: 'eur', 
                    product_data: { 
                        name: 'YachtSync OS Workstation License',
                        description: 'Unbegrenzter Enterprise-Zugang inkl. Cloud-CRM, KI-Text-Engine und Multi-Sync-Bot.'
                    }, 
                    unit_amount: 49900, // 499,00 € pro Monat
                    recurring: { interval: 'month' } 
                }, 
                quantity: 1 
            }],
            mode: 'subscription',
            // Render übergibt nach der Zahlung die E-Mail als Bestätigung zurück
            success_url: 'https://' + req.get('host') + '/?payment=success&email=' + encodeURIComponent(email || ''),
            cancel_url: 'https://' + req.get('host') + '/?payment=cancel',
        });
        res.json({ id: session.id, url: session.url });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Update-Route: Schaltet den Lizenzstatus in der Cloud permanent auf "Aktiv"
app.post('/api/auth/activate-license', async (req, res) => {
    const { email } = req.body;
    try {
        await User.findOneAndUpdate({ email: email.toLowerCase() }, { hasActiveSubscription: true });
        res.json({ status: "Erfolg" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================================
// 6. PRODUKTIV-FEATURES (CRM, Kalender, KI, PDF, Bot)
// =========================================================================
app.post('/api/fleet/add', async (req, res) => {
    try {
        const neueYacht = new Yacht(req.body); await neueYacht.save();
        res.json({ status: "Erfolg", nachricht: "Yacht erfolgreich in der Cloud-Datenbank gespeichert!" });
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
        if (konflikt) return res.status(400).json({ status: "Konflikt", nachricht: "🚨 Diese Yacht ist im gewählten Zeitraum besetzt!" });
        const neueBuchung = new Charter({ yachtId, start: startDatum, end: endDatum, kunde: chartererName }); await neueBuchung.save();
        res.json({ status: "Erfolg", nachricht: "Charterzeitraum im Kalender erfolgreich blockiert." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/legal/generate-contract', (req, res) => {
    const { verkaeufer, kaeufer, yachtName, kaufpreis } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename=SPA_${yachtName}.pdf`);
    doc.pipe(res); doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(20).text('YACHT SALES AND PURCHASE AGREEMENT (SPA)', 50, 50);
    doc.moveDown().font('Helvetica').fontSize(12).text(`Verkäufer: ${verkaeufer}\nKäufer: ${kaeufer}\nObjekt: ${yachtName}\nPreis: ${kaufpreis} EUR`);
    doc.end();
});

app.post('/api/crew/report-issue', async (req, res) => {
    try {
        const neuerMangel = new Mangel(req.body); await neuerMangel.save();
        res.json({ status: "Erfolg", nachricht: "Mängelbericht im Werft-Register gesichert." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/generate-ai-text', async (req, res) => {
    try {
        const completion = await groq.chat.completions.create({ model: "llama3-8b-8192", messages: [{ role: "system", content: "Write a luxury yacht editorial description in English." }, { role: "user", content: req.body.beschreibung }] });
        res.json({ text: completion.choices.message.content });
    } catch (error) { res.json({ text: `✨ EXCLUSIVE OFF-MARKET OPPORTUNITY ✨\n\nRedefining modern naval architecture and coastal luxury in Monaco.` }); }
});

app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    const doc = new PDFDocument({ margin: 50 }); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename=Specification.pdf`);
    doc.pipe(res); doc.rect(0, 0, 612, 50).fill('#0a1128'); doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('⚓ YACHTSYNC SUITE SPECIFICATION SHEET', 50, 18);
    doc.fillColor('#0a1128').fontSize(24).text(`${hersteller} ${modell}`, 50, 90); doc.fontSize(12).text(`Preis: ${preis} EUR\nBaujahr: ${baujahr}\nLiegeplatz: ${liegeplatz}\n\nDetails:\n${beschreibung}`, 50, 140); doc.end();
});

app.post('/api/post-yacht', async (req, res) => { const ergebnis = await starteYachtPosting(req.body); res.json(ergebnis); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 [YachtSync OS Ultimate] Commercial Engine online auf Port ${PORT}`));
