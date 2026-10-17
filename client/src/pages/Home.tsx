import { useState } from "react";
import { ArrowDown, ArrowUpRight, Check, MapPin, MessageCircle, Phone, Play, Quote, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_SETTINGS, type AcademySettings } from "@shared/academy";
import { formatINR, greetingMessage, whatsappUrl } from "@/lib/academy";
import { AcademyLogo, BrandMark, CookieConsent, FeatureIcon, ParticleField, RegistrationModal, SectionLabel, SiteNav } from "@/components/academy";

function Pill({ children }: { children: React.ReactNode }) { return <span className="pill"><span className="pill-dot" />{children}</span>; }

export default function Home() {
  const query = trpc.academy.settings.useQuery();
  const settings: AcademySettings = query.data ?? DEFAULT_SETTINGS;
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const contactUrl = whatsappUrl(settings, greetingMessage(settings));
  const visibleCards = settings.featureCards.filter(card => card.visible);
  return (
    <div className={`academy-site ${settings.summerMode ? "summer-mode" : ""}`} id="top">
      <SiteNav settings={settings} onRegister={() => setRegistrationOpen(true)} />
      <main>
        <section className="hero-section">
          <ParticleField settings={settings} />
          <div className="hero-noise" aria-hidden="true" />
          <div className="hero-content page-shell">
            <div className="hero-copy">
              <Pill>{settings.summerMode ? "Summer training atmosphere" : "Bishan Khedi · Bhopal"}</Pill>
              <h1>{settings.summerMode ? settings.summerHeadline : settings.headline}</h1>
              <p>{settings.heroText}</p>
              <div className="hero-actions"><button className="button button-gold" onClick={() => setRegistrationOpen(true)}>Register Now <ArrowUpRight size={17} /></button><a className="button button-ghost" href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Chat on WhatsApp</a></div>
              <div className="hero-meta"><span><Check size={15} /> Girls & boys</span><span><Check size={15} /> Ages {settings.minAge}–{settings.maxAge}</span><span><Check size={15} /> Weekly practice</span></div>
            </div>
            <div className="hero-art-wrap"><div className="hero-art-ring" /><div className="art-caption"><span className="caption-line" /><span>Play with purpose</span></div><div className="hero-art-circle"><AcademyLogo /></div><div className="art-stamp"><span>OFCA</span><span>BHOPAL / INDIA</span></div></div>
          </div>
          <a className="scroll-cue" href="#about"><span>Scroll to explore</span><ArrowDown size={16} /></a>
        </section>

        <section className="signal-bar"><div className="page-shell signal-grid"><div><span className="signal-kicker">The academy</span><strong>Practice that stays with you.</strong></div><div><span className="signal-kicker">Format</span><strong>Weekly nets + monthly matches</strong></div><div><span className="signal-kicker">Open to</span><strong>Players aged {settings.minAge}–{settings.maxAge}</strong></div></div></section>

        <section className="section section-about" id="about"><div className="page-shell two-column"><div><SectionLabel number="01" children="The academy" /><h2>{settings.aboutTitle}</h2></div><div className="about-body"><p className="lead-text">{settings.aboutText}</p><div className="about-note"><span className="note-mark">/</span><p>Come for the practice. Leave with a clearer idea of your game.</p></div><a className="inline-link" href="#training">See how we train <ArrowUpRight size={15} /></a></div></div></section>

        <section className="section section-training" id="training"><div className="page-shell"><div className="section-heading-row"><div><SectionLabel number="02" children="The work" /><h2>Build Your Game<span className="gold-period">.</span></h2></div><p>Good cricket is built in layers: repetition, reflection, then the courage to play the shot.</p></div><div className="feature-list">{visibleCards.map((card, index) => <article className="feature-row" key={card.id}><div className="feature-index">0{index + 1}</div><div className="feature-icon"><FeatureIcon icon={card.icon} /></div><div className="feature-copy"><span>{card.eyebrow}</span><h3>{card.title}</h3><p>{card.description}</p></div><ArrowUpRight className="feature-arrow" size={21} /></article>)}</div></div></section>

        <section className="section section-rhythm"><div className="page-shell rhythm-grid"><div className="rhythm-card rhythm-card-dark"><SectionLabel number="03" children="The rhythm" /><h2>Train the detail.<br /><em>Trust the instinct.</em></h2><p>From the first net to the last ball of the month, each session is a chance to understand your game a little better.</p><div className="rhythm-line"><span />Practice is a habit.</div></div><div className="rhythm-side"><div className="rhythm-stat"><strong>08—21</strong><span>Age range</span></div><div className="rhythm-stat"><strong>WEEKLY</strong><span>Net practice rhythm</span></div><div className="rhythm-stat"><strong>MONTHLY</strong><span>Match experience</span></div><div className="rhythm-side-note"><Quote size={18} /><p>“Build your technique, improve your game, and develop confidence through regular practice.”</p></div></div></div></section>

        <section className="section section-fees" id="fees"><div className="page-shell fees-layout"><div><SectionLabel number="04" children="Membership" /><h2>Simple fees.<br /><span>Serious intent.</span></h2><p className="section-intro">Registration begins as an enquiry on WhatsApp. The academy team will confirm the procedure and further details.</p><button className="button button-dark" onClick={() => setRegistrationOpen(true)}>Register your interest <ArrowUpRight size={16} /></button></div><div className="fee-board"><div className="fee-line"><span>One-time registration</span><strong>{formatINR(settings.registrationFee)}</strong></div><div className="fee-line"><span>Monthly training</span><strong>{formatINR(settings.monthlyFee)}</strong></div><div className="fee-foot"><ShieldCheck size={17} /><span>No payment is collected on this website. Your enquiry is reviewed by the academy.</span></div></div></div></section>

        {settings.summerMode && <section className="summer-banner"><div className="page-shell"><div><span className="signal-kicker"><Play size={12} fill="currentColor" /> Summer mode</span><h2>{settings.summerAnnouncement}</h2></div><CloudSunMark /></div></section>}

        <section className="section section-contact" id="contact"><div className="page-shell contact-grid"><div><SectionLabel number="05" children="Contact" /><h2>Make the first move.</h2><p className="section-intro">Questions about sessions, fees, or registration? Start a conversation with the academy.</p><div className="contact-actions"><a className="button button-gold" href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Chat on WhatsApp</a><a className="text-link" href={`tel:${settings.phone.replace(/\s/g, "")}`}><Phone size={16} /> {settings.phone}</a></div></div><div className="contact-details"><div className="detail-line"><MapPin size={19} /><div><span>Find us</span><p>{settings.address}</p></div></div><div className="detail-line"><MessageCircle size={19} /><div><span>WhatsApp</span><p>Quick replies from the academy team</p></div></div><button className="contact-register" onClick={() => setRegistrationOpen(true)}>Open registration form <ArrowUpRight size={16} /></button></div></div></section>
      </main>
      <footer className="site-footer"><div className="page-shell footer-top"><BrandMark settings={settings} /><p>{settings.footerText}</p><div className="footer-links"><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/o">Owner login</a></div></div><div className="page-shell footer-bottom"><span>© {new Date().getFullYear()} {settings.academyName}</span><span>Bishan Khedi · Bhopal · India</span></div></footer>
      <a className="floating-whatsapp" href={contactUrl} target="_blank" rel="noopener noreferrer" aria-label="Chat with Old Friend Cricket Academy on WhatsApp"><MessageCircle size={21} /><span>Chat with us</span></a>
      <RegistrationModal settings={settings} open={registrationOpen} onClose={() => setRegistrationOpen(false)} />
      <CookieConsent />
    </div>
  );
}

function CloudSunMark() { return <div className="summer-orbit" aria-hidden="true"><div className="sun-disc" /><div className="orbit-line" /><div className="orbit-dot" /></div>; }
