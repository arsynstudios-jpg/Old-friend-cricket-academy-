export type ThemeMode = "light" | "dark";

export type FeatureCard = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: "bat" | "net" | "match";
  visible: boolean;
};

export type AcademySettings = {
  academyName: string;
  shortName: string;
  headline: string;
  heroText: string;
  aboutTitle: string;
  aboutText: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  registrationFee: number;
  monthlyFee: number;
  minAge: number;
  maxAge: number;
  footerText: string;
  registrationIntro: string;
  registrationInstructions: string;
  summerMode: boolean;
  summerHeadline: string;
  summerAnnouncement: string;
  defaultTheme: ThemeMode;
  accentColor: string;
  requireContact: boolean;
  showAddressField: boolean;
  showMessageField: boolean;
  privacyPolicy: string;
  cookiePolicy: string;
  featureCards: FeatureCard[];
};

export const DEFAULT_SETTINGS: AcademySettings = {
  academyName: "Old Friend Cricket Academy",
  shortName: "OFCA",
  headline: "Train with Passion. Play with Purpose.",
  heroText:
    "Professional cricket training for girls and boys aged 8–21. Build your technique, improve your game, and develop confidence through regular practice and competitive matches.",
  aboutTitle: "A place to build your game",
  aboutText:
    "Old Friend Cricket Academy is a welcoming training ground in Bishan Khedi, Bhopal for girls and boys aged 8–21. Players get regular opportunities to work on their technique through weekly net practice and apply their learning in monthly cricket matches.",
  address: "89FF+F7, Bhopal, Bishan Khedi, Madhya Pradesh 462038, India",
  phone: "+91 90091 91168",
  whatsappNumber: "919009191168",
  registrationFee: 500,
  monthlyFee: 2000,
  minAge: 8,
  maxAge: 21,
  footerText: "Professional cricket training for the next innings.",
  registrationIntro:
    "Tell us a little about the player. We’ll open WhatsApp with a ready-to-review message for the academy team.",
  registrationInstructions:
    "Registration starts on WhatsApp. Please review the prefilled message and press Send; the academy will confirm the next steps.",
  summerMode: false,
  summerHeadline: "Make the holidays count.",
  summerAnnouncement:
    "Summer mode is on: a brighter training atmosphere for players building their next innings.",
  defaultTheme: "light",
  accentColor: "#E5B84B",
  requireContact: false,
  showAddressField: true,
  showMessageField: true,
  privacyPolicy:
    "We use the information you choose to share in the registration form only to prepare your WhatsApp enquiry. We do not silently store completed student registration details in a public database. Essential browser storage may remember your theme and cookie choices.",
  cookiePolicy:
    "Essential storage supports basic preferences and website functionality. Optional analytics and marketing technologies are currently inactive. You can revisit cookie settings at any time from the footer.",
  featureCards: [
    {
      id: "training",
      eyebrow: "01 / Technique",
      title: "Professional Cricket Training",
      description:
        "Training opportunities for girls and boys aged 8–21, focused on developing cricket skills and confidence.",
      icon: "bat",
      visible: true,
    },
    {
      id: "nets",
      eyebrow: "02 / Repetition",
      title: "Weekly Net Practice",
      description:
        "Regular net practice to work on batting, bowling, technique, and consistency.",
      icon: "net",
      visible: true,
    },
    {
      id: "matches",
      eyebrow: "03 / Application",
      title: "Monthly Cricket Matches",
      description:
        "Monthly match opportunities that help players apply their skills in competitive playing situations.",
      icon: "match",
      visible: true,
    },
  ],
};

export function sanitizeSettings(value: Partial<AcademySettings> | null | undefined): AcademySettings {
  const merged = { ...DEFAULT_SETTINGS, ...(value ?? {}) } as AcademySettings;
  const cards = Array.isArray(merged.featureCards) ? merged.featureCards : DEFAULT_SETTINGS.featureCards;
  return {
    ...DEFAULT_SETTINGS,
    ...merged,
    academyName: String(merged.academyName || DEFAULT_SETTINGS.academyName).slice(0, 100),
    shortName: String(merged.shortName || DEFAULT_SETTINGS.shortName).slice(0, 10),
    registrationFee: Math.max(0, Math.round(Number(merged.registrationFee) || DEFAULT_SETTINGS.registrationFee)),
    monthlyFee: Math.max(0, Math.round(Number(merged.monthlyFee) || DEFAULT_SETTINGS.monthlyFee)),
    minAge: Math.min(21, Math.max(1, Math.round(Number(merged.minAge) || DEFAULT_SETTINGS.minAge))),
    maxAge: Math.min(99, Math.max(1, Math.round(Number(merged.maxAge) || DEFAULT_SETTINGS.maxAge))),
    featureCards: cards.map((card, index) => ({
      id: String(card.id || `card-${index}`),
      eyebrow: String(card.eyebrow || `${String(index + 1).padStart(2, "0")} / Practice`),
      title: String(card.title || "Cricket training"),
      description: String(card.description || "Build skills through focused practice."),
      icon: card.icon === "net" || card.icon === "match" ? card.icon : "bat",
      visible: card.visible !== false,
    })),
  };
}
