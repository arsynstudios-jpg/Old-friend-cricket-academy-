import { ArrowLeft, Cookie, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_SETTINGS } from "@shared/academy";

export default function PolicyPage({ kind }: { kind: "privacy" | "cookies" }) {
  const { data } = trpc.academy.settings.useQuery();
  const settings = data ?? DEFAULT_SETTINGS;
  const isPrivacy = kind === "privacy";
  return <div className="policy-page"><header className="policy-header"><a href="/" className="policy-back"><ArrowLeft size={16} /> Back to academy</a><span className="policy-mark">{isPrivacy ? <ShieldCheck size={18} /> : <Cookie size={18} />} {isPrivacy ? "Privacy policy" : "Cookie policy"}</span></header><main className="policy-main"><span className="policy-kicker">Old Friend Cricket Academy</span><h1>{isPrivacy ? "Privacy, kept practical." : "Cookies, explained clearly."}</h1><p className="policy-lead">{isPrivacy ? "A short explanation of how the academy handles information shared through this website." : "A clear view of what browser storage does here and what it does not do."}</p><article className="policy-copy"><p>{isPrivacy ? settings.privacyPolicy : settings.cookiePolicy}</p><h2>{isPrivacy ? "What happens when you register" : "Your choices"}</h2><p>{isPrivacy ? "The registration form creates a message for you to review and send to the academy on WhatsApp. This website does not claim a player is registered when WhatsApp opens, and it does not silently save the completed form to a public database." : "Essential storage may remember the theme you chose and your cookie decision. Optional analytics and marketing tools are not installed by default. You can change your choice using the cookie button in the footer of the main site."}</p><h2>Questions?</h2><p>Contact Old Friend Cricket Academy in Bishan Khedi, Bhopal through the WhatsApp link on the main website.</p></article></main></div>;
}
