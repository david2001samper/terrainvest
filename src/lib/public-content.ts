export type PublicContentPage = {
  slug: string;
  key: string;
  title: string;
  navLabel: string;
  summary: string;
  homeTitle: string;
  homeDescription: string;
};

export const PUBLIC_CONTENT_PAGES = [
  {
    slug: "about",
    key: "about_us",
    title: "About Terra Invest VIP",
    navLabel: "About",
    summary: "A private trading services platform built around market access, guidance, and client support.",
    homeTitle: "About the Platform",
    homeDescription: "Learn who Terra Invest VIP serves and how the platform supports private trading clients.",
  },
  {
    slug: "journey",
    key: "journey",
    title: "Our Journey",
    navLabel: "Our Journey",
    summary: "How Terra Invest VIP developed its private client model and trading support framework.",
    homeTitle: "Our Journey",
    homeDescription: "See the principles behind our private client approach and platform evolution.",
  },
  {
    slug: "history",
    key: "our_history",
    title: "Our History",
    navLabel: "Our History",
    summary: "The background, operating philosophy, and standards behind Terra Invest VIP.",
    homeTitle: "Our History",
    homeDescription: "Explore the standards and operating discipline that guide the company.",
  },
  {
    slug: "trading-approach",
    key: "trading_approach",
    title: "Trading Approach",
    navLabel: "Trading Approach",
    summary: "A structured look at how trade signals, market guidance, and risk parameters are delivered.",
    homeTitle: "Trading Approach",
    homeDescription: "Understand how trade ideas, risk levels, and execution guidance are communicated.",
  },
  {
    slug: "account-management",
    key: "account_management",
    title: "Account Management",
    navLabel: "Account Management",
    summary: "Dedicated account support for onboarding, platform guidance, trading updates, and service requests.",
    homeTitle: "Account Management",
    homeDescription: "Learn how dedicated account support helps clients navigate the platform.",
  },
  {
    slug: "contact",
    key: "contact_us",
    title: "Contact Us",
    navLabel: "Contact",
    summary: "Reach the Terra Invest VIP team for onboarding, account support, and platform enquiries.",
    homeTitle: "Contact & Support",
    homeDescription: "Find the right channel for onboarding questions, account requests, and support.",
  },
  {
    slug: "support",
    key: "support",
    title: "Support",
    navLabel: "Support",
    summary: "Client support for account access, deposits, withdrawals, trading tools, and service questions.",
    homeTitle: "Client Support",
    homeDescription: "Get help with account access, trading tools, deposits, withdrawals, and platform use.",
  },
  {
    slug: "terms",
    key: "terms_of_service",
    title: "Terms of Service",
    navLabel: "Terms",
    summary: "The standard terms that govern use of the Terra Invest VIP platform and services.",
    homeTitle: "Terms of Service",
    homeDescription: "Review the terms that govern use of the platform and client services.",
  },
  {
    slug: "privacy",
    key: "privacy_policy",
    title: "Privacy Policy",
    navLabel: "Privacy",
    summary: "How Terra Invest VIP handles client information and platform data.",
    homeTitle: "Privacy Policy",
    homeDescription: "Review how client information and platform data are handled.",
  },
] as const satisfies readonly PublicContentPage[];

export const DEFAULT_CONTACT_INFO = {
  contact_phone: "+16478007539",
  contact_email: "support@terrainvestvip.com",
};

export const CONTACT_INFO_KEYS = Object.keys(DEFAULT_CONTACT_INFO);

export const DEFAULT_PUBLIC_CONTENT: Record<string, string> = {
  about_us:
    "Terra Invest VIP is a private trading services and advisory platform designed for qualified clients who want structured access to global markets. The platform combines real-time market tools, portfolio visibility, trade history, and client support with a dedicated account management model.\n\nClients use Terra Invest VIP to monitor market opportunities, review trading guidance, and execute trades directly through the platform. The service focuses on clear communication, disciplined risk parameters, and a professional private client experience.",
  journey:
    "Terra Invest VIP was developed to bring a more structured and personal trading experience to private clients. The platform was built around a simple idea: clients should have access to market tools, timely guidance, and a dedicated support relationship in one secure environment.\n\nOur journey continues through investment in platform reliability, market visibility, account support, and clearer communication between clients and their assigned account manager.",
  our_history:
    "Terra Invest VIP was established with a focus on private client trading services, market access, and account support. Over time, the platform has expanded from core trading and portfolio tools into a broader client environment that includes market data, watchlists, analytics, deposits, withdrawals, and administrative oversight.\n\nThe company's operating philosophy is built on professionalism, communication, transparency, and disciplined trading processes.",
  trading_approach:
    "Terra Invest VIP provides trading guidance through a structured signal and account management framework. Trade ideas may include the proposed trade amount, entry area, stop-loss level, take-profit target, and relevant market context.\n\nClients retain discretion over trade execution. They can review, execute, modify, or decline trade signals directly through the Terra Invest VIP platform. This approach keeps the client in control while providing professional market guidance and clearly defined risk parameters.",
  account_management:
    "Each client relationship is supported through a dedicated account management model. Account managers assist with onboarding, platform navigation, trade signal communication, performance updates, and service-related questions.\n\nThis structure gives clients a clear point of contact and helps ensure that trading guidance, account updates, and support requests are handled in a professional and consistent way.",
  contact_us:
    "For client enquiries, onboarding questions, platform support, or account-related assistance, contact Terra Invest VIP through the official support channel below.\n\nEmail: support@terrainvestvip.com\nWebsite: terrainvest.vip\n\nFor security, clients should rely only on official Terra Invest VIP platform messages and authorised account manager communications.",
  support:
    "Terra Invest VIP support assists clients with account access, platform navigation, deposits, withdrawals, trading tools, account settings, and general service questions.\n\nFor assistance, contact support@terrainvestvip.com or reach your assigned account manager through the official communication channel provided during onboarding.",
  terms_of_service:
    "By using Terra Invest VIP, clients agree to use the platform and related services in accordance with applicable terms, account rules, trading procedures, and compliance requirements. Trading involves risk, and clients remain responsible for reviewing and authorising any activity in their own account.",
  privacy_policy:
    "Terra Invest VIP respects client privacy and handles platform information with care. Client data is used to support account access, platform functionality, communication, security, compliance, and service delivery. The company does not intend to sell client information to unauthorised third parties.",
};

export const PUBLIC_CONTENT_KEYS = PUBLIC_CONTENT_PAGES.map((page) => page.key);

export function getPublicContentPage(slug: string) {
  return PUBLIC_CONTENT_PAGES.find((page) => page.slug === slug);
}
