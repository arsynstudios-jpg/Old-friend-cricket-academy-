import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Clipboard, CloudSun, Cookie, Crosshair, Menu, Moon, MoveUpRight, Phone, ShieldCheck, Sun, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { AcademySettings } from "@shared/academy";
import { formatINR, greetingMessage, registrationMessage, whatsappUrl, copyText, readConsent, saveConsent, type RegistrationValues } from "@/lib/academy";

export function BrandMark({ settings, compact = false }: { settings: AcademySettings; compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label={settings.academyName}>
      <span className="brand-mark" aria-hidden="true"><span>{settings.shortName.slice(0, 2)}</span></span>
      {!compact && <span className="brand-name">{settings.academyName}</span>}
    </div>
  );
}

export function SiteNav({ settings, onRegister }: { settings: AcademySettings; onRegister: () => void }) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const contactUrl = whatsappUrl(settings, greetingMessage(settings));
  const links = [{ href: "#about", label: "About" }, { href: "#training", label: "Training" }, { href: "#fees", label: "Fees" }, { href: "#contact", label: "Contact" }];
  return (
    <header className="site-nav">
      <a href="#top" className="brand-link"><BrandMark settings={settings} /></a>
      <nav className={`nav-links ${open ? "is-open" : ""}`} aria-label="Main navigation">
        <a href="#top" onClick={() => setOpen(false)}>Home</a>
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
        <a href={contactUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Chat with Us <ArrowUpRight size={14} /></a>
        <button className="nav-register" onClick={() => { onRegister(); setOpen(false); }}>Register Now <MoveUpRight size={15} /></button>
      </nav>
      <div className="nav-actions">
        <button className="theme-toggle" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} onClick={toggleTheme}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button className="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(prev => !prev)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </header>
  );
}

export function AcademyLogo() {
  return <img className="academy-logo-image" src="/academy-logo.jpg" alt="Old Friends OFCT Cricket Academy crest from Bisankhedi" />;
}

export function SectionLabel({ number, children }: { number: string; children: string }) {
  return <div className="section-label"><span>{number}</span><span>{children}</span></div>;
}

export function RegistrationModal({ settings, open, onClose }: { settings: AcademySettings; open: boolean; onClose: () => void }) {
  const [values, setValues] = useState<RegistrationValues>({ studentName: "", gender: "", age: "", guardianName: "", contact: "", address: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!open) { setReview(false); setErrors({}); setCopied(false); } }, [open]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose, open]);
  const message = useMemo(() => registrationMessage(settings, values), [settings, values]);
  const url = useMemo(() => whatsappUrl(settings, message), [settings, message]);
  if (!open) return null;
  const update = (key: keyof RegistrationValues, value: string) => setValues(prev => ({ ...prev, [key]: value }));
  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.studentName.trim()) next.studentName = "Please add the student's full name.";
    if (!values.gender) next.gender = "Please choose an option.";
    const age = Number(values.age);
    if (!values.age || age < settings.minAge || age > settings.maxAge) next.age = `Choose an age from ${settings.minAge} to ${settings.maxAge}.`;
    if (settings.requireContact && !values.contact.trim()) next.contact = "A contact number is required by the academy settings.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (validate()) setReview(true); };
  const openWhatsApp = () => {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) setErrors({ whatsapp: "Your browser blocked the new tab. Use the visible link below or copy the message." });
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title">
        <button className="modal-close" onClick={onClose} aria-label="Close registration"><X size={19} /></button>
        {!review ? <>
          <div className="modal-kicker"><span className="gold-dot" /> Registration enquiry</div>
          <h2 id="registration-title">Start the next innings.</h2>
          <p className="modal-intro">{settings.registrationIntro}</p>
          <form onSubmit={submit} className="registration-form">
            <label>Student full name <input value={values.studentName} onChange={e => update("studentName", e.target.value)} placeholder="Full name" autoFocus />{errors.studentName && <small>{errors.studentName}</small>}</label>
            <div className="form-grid">
              <label>Gender <select value={values.gender} onChange={e => update("gender", e.target.value)}><option value="">Select</option><option>Girl</option><option>Boy</option><option>Prefer not to say</option></select>{errors.gender && <small>{errors.gender}</small>}</label>
              <label>Age <select value={values.age} onChange={e => update("age", e.target.value)}><option value="">Choose age</option>{Array.from({ length: Math.max(0, settings.maxAge - settings.minAge + 1) }, (_, i) => settings.minAge + i).map(age => <option key={age}>{age}</option>)}</select>{errors.age && <small>{errors.age}</small>}</label>
            </div>
            <label>Parent / guardian name <span className="optional">recommended under 18</span><input value={values.guardianName} onChange={e => update("guardianName", e.target.value)} placeholder="Name" /></label>
            <label>Contact number {settings.requireContact ? <span className="required">required</span> : <span className="optional">optional</span>}<input value={values.contact} onChange={e => update("contact", e.target.value)} inputMode="tel" placeholder="+91" />{errors.contact && <small>{errors.contact}</small>}</label>
            {settings.showAddressField && <label>Address <span className="optional">optional</span><input value={values.address} onChange={e => update("address", e.target.value)} placeholder="Locality or area" /></label>}
            {settings.showMessageField && <label>Additional message <span className="optional">optional</span><textarea value={values.message} onChange={e => update("message", e.target.value)} placeholder="Anything the academy team should know?" rows={3} /></label>}
            <button className="button button-dark button-wide" type="submit">Review registration <MoveUpRight size={16} /></button>
          </form>
        </> : <>
          <div className="modal-kicker"><Check size={15} /> Ready to review</div>
          <h2 id="registration-title">Your enquiry is ready.</h2>
          <p className="modal-intro">Check the message below. WhatsApp will open with this text filled in; you still press Send yourself.</p>
          <div className="message-preview">{message}</div>
          {errors.whatsapp && <div className="form-error">{errors.whatsapp}</div>}
          <div className="review-actions"><button className="button button-dark" onClick={openWhatsApp}>Open WhatsApp <ArrowUpRight size={16} /></button><button className="button button-outline" onClick={() => { copyText(message); setCopied(true); }}>{copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "Copied" : "Copy message"}</button></div>
          <a className="fallback-link" href={url} target="_blank" rel="noopener noreferrer">Use the visible WhatsApp link instead <ArrowUpRight size={14} /></a>
          <button className="text-button" onClick={() => setReview(false)}>Edit details</button>
        </>}
      </section>
    </div>
  );
}

export function CookieConsent() {
  const [consent, setConsent] = useState(readConsent());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  if (consent && !settingsOpen) return <button className="cookie-reopen" onClick={() => { setDraft(consent); setSettingsOpen(true); }} aria-label="Open cookie settings"><Cookie size={16} /></button>;
  const save = (next: { analytics: boolean; marketing: boolean }) => { saveConsent(next); setConsent(next); setSettingsOpen(false); };
  return <>
    <div className={`cookie-panel ${settingsOpen ? "cookie-panel-settings" : ""}`} role="dialog" aria-label="Cookie preferences">
      <div className="cookie-icon"><Cookie size={21} /></div><div className="cookie-copy"><strong>{settingsOpen ? "Cookie settings" : "A clear choice for cookies"}</strong><p>Essential storage keeps the site working. Optional analytics and marketing technologies are currently inactive.</p>{settingsOpen && <div className="cookie-options"><label><span><ShieldCheck size={16} /> Essential storage</span><em>Always active</em></label><label><span><input type="checkbox" checked={draft.analytics} onChange={e => setDraft(prev => ({ ...prev, analytics: e.target.checked }))} /> Analytics</span><em>Optional, currently inactive</em></label><label><span><input type="checkbox" checked={draft.marketing} onChange={e => setDraft(prev => ({ ...prev, marketing: e.target.checked }))} /> Marketing</span><em>Optional, currently inactive</em></label></div>}</div><div className="cookie-actions">{settingsOpen ? <><button className="button button-dark" onClick={() => save(draft)}>Save preferences</button><button className="text-button" onClick={() => setSettingsOpen(false)}>Cancel</button></> : <><button className="button button-dark" onClick={() => save({ analytics: true, marketing: true })}>Accept All</button><button className="button button-outline" onClick={() => save({ analytics: false, marketing: false })}>Decline Optional</button><button className="text-button" onClick={() => setSettingsOpen(true)}>Cookie Settings</button></>}</div>
    </div>
  </>;
}

export function FeatureIcon({ icon }: { icon: "bat" | "net" | "match" }) {
  return icon === "match" ? <Crosshair size={22} /> : icon === "net" ? <CloudSun size={22} /> : <MoveUpRight size={22} />;
}
