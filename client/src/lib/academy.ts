import type { AcademySettings } from "@shared/academy";

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits.replace(/^0+/, "")}`;
}

export function whatsappUrl(settings: AcademySettings, message: string) {
  return `https://wa.me/${normalizeWhatsAppNumber(settings.whatsappNumber)}?text=${encodeURIComponent(message)}`;
}

export function greetingMessage(settings: AcademySettings) {
  return `Hi, I would like to know more about ${settings.academyName}, its training sessions, fees, and registration procedure.`;
}

export type RegistrationValues = {
  studentName: string;
  gender: string;
  age: string;
  guardianName: string;
  contact: string;
  address: string;
  message: string;
};

export function registrationMessage(settings: AcademySettings, values: RegistrationValues) {
  const age = Number(values.age);
  const subject = age >= 18 ? "myself" : "my child/student";
  const optional = (value: string) => value.trim() || "Not provided";
  return `Hi, I would like to register ${subject} with the following details:\n\nAcademy: ${settings.academyName}\nStudent Name: ${values.studentName.trim()}\nGender: ${values.gender}\nAge: ${values.age}\nParent/Guardian Name: ${optional(values.guardianName)}\nContact Number: ${optional(values.contact)}\nAddress: ${optional(values.address)}\nAdditional Details: ${optional(values.message)}\n\nRegistration Fee: ${formatINR(settings.registrationFee)}\nMonthly Training Fee: ${formatINR(settings.monthlyFee)}\n\nPlease share the registration procedure and further details.\n\nThank you.`;
}

export function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

export type CookieConsent = { analytics: boolean; marketing: boolean };
const CONSENT_KEY = "oldfriend_cookie_consent";

export function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

export function saveConsent(consent: CookieConsent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}
