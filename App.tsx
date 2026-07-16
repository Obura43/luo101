import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  learningUnits,
  type LessonExercise,
  type LearningUnit,
  type Phrase,
} from './src/data/lessons';
import { getAudioForKey, hasAudioForKey } from './src/data/audioManifest';
import { dictionaryEntries, type DictionaryEntry } from './src/data/dictionary';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';

const brandLogo = require('./assets/luo101-logo-transparent.png');

type Tab = 'learn' | 'lesson' | 'practice' | 'review' | 'phrases' | 'profile';
type PublicPageId = 'vision' | 'mission' | 'privacy' | 'terms' | 'refunds' | 'contact' | 'payments';
type PublicPage = {
  id: PublicPageId;
  title: string;
  eyebrow: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
};
type EntitlementTier = 'none' | 'basic' | 'full' | 'consultation';
type CoursePackage = {
  id: 'basic' | 'full' | 'consultation';
  title: string;
  priceKes: number;
  tier: EntitlementTier;
  summary: string;
  unlocks: string[];
};
type UnitProgress = {
  correctExerciseIds: string[];
  mistakes: number;
  completedRounds: number;
  reviewCompleted: boolean;
};

type SavedProgress = {
  selectedUnitId: string;
  xp: number;
  streak: number;
  units: Record<string, UnitProgress>;
};

type ProfileRecord = {
  display_name: string;
  avatar_url: string | null;
};

type ProgressRecord = {
  xp: number;
  streak_days: number;
  selected_unit_id: string;
  unit_progress: Record<string, UnitProgress>;
};

type ReferralStats = {
  code: string;
  link: string;
  totalReferrals: number;
  pendingKes: number;
  paidKes: number;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};
type DocumentLike = {
  title: string;
  head?: { appendChild: (node: unknown) => void };
  createElement?: (tagName: string) => { id?: string; textContent?: string };
  getElementById?: (id: string) => unknown;
};
type LocationLike = {
  href?: string;
  origin?: string;
  search?: string;
};
type NavigatorLike = {
  clipboard?: { writeText: (value: string) => Promise<void> };
};

const STORAGE_KEY = 'luo101-progress-v1';
const REFERRAL_STORAGE_KEY = 'luo101-referral-code';
const REFERRAL_COMMISSION_KES = 200;
const defaultUnitProgress: UnitProgress = {
  correctExerciseIds: [],
  mistakes: 0,
  completedRounds: 0,
  reviewCompleted: false,
};

const PAYMENT_PACKAGES: CoursePackage[] = [
  {
    id: 'basic',
    title: 'Foundation Course',
    priceKes: 799,
    tier: 'basic',
    summary: 'Begin with the everyday Dholuo that helps you greet, count, ask, move, read, and speak with confidence.',
    unlocks: ['Units 1-9 included', 'Practice drills and phrase audio', 'Stories, poems, and culture notes'],
  },
  {
    id: 'full',
    title: 'Complete Course',
    priceKes: 1500,
    tier: 'full',
    summary: 'Go beyond the foundation with romance, core sentence words, the A-Z dictionary, and every self-paced lesson.',
    unlocks: ['All current and upcoming self-paced units', 'All practice and phrase audio', 'Dictionary, readings, and future course refinements'],
  },
  {
    id: 'consultation',
    title: 'Complete Course + Live Guidance',
    priceKes: 6000,
    tier: 'consultation',
    summary: 'Pair the full Luo101 course with personal guidance for pronunciation, confidence, and cultural context.',
    unlocks: ['Everything in Complete Course', 'Live consultation support', 'Priority help via support@luo101.org'],
  },
];

const BASIC_UNLOCKED_UNIT_IDS = new Set([
  'greetings',
  'counting',
  'counting-use',
  'food-market',
  'people-family',
  'extended-family',
  'places-movement',
  'directions-travel',
  'time-routines',
  'weather-plans',
  'body-health',
  'stories-poems',
]);
const FREE_UNIT_IDS = new Set(['greetings']);
const DICTIONARY_UNIT_ID = 'dictionary-az';
const PUBLIC_PAGES: Record<PublicPageId, PublicPage> = {
  vision: {
    id: 'vision',
    eyebrow: 'Vision',
    title: 'A living Dholuo for the next generation',
    intro: 'Luo101 exists so learners can meet Dholuo as a living language: useful, warm, spoken, and connected to culture.',
    sections: [
      { heading: 'Our vision', body: 'We imagine a world where Luo children, families, friends, and curious learners can confidently learn Dholuo wherever they live, and carry the language into daily speech, family memory, music, stories, humor, and belonging.' },
      { heading: 'Culture first', body: 'Luo101 is not only a vocabulary app. It is a preservation project built around greetings, family language, food, places, stories, romance, conversation, and the small phrases that keep a community close.' },
      { heading: 'Designed to grow', body: 'The course will keep expanding with native-speaker review, recorded audio, richer readings, and more everyday situations so the language remains accurate, useful, and alive.' },
    ],
  },
  mission: {
    id: 'mission',
    eyebrow: 'Mission',
    title: 'Learn Dholuo. Speak it. Pass it on.',
    intro: 'Our mission is to make Dholuo learning simple enough to begin today and deep enough to keep using for life.',
    sections: [
      { heading: 'Teach before testing', body: 'Each unit introduces meaning, context, and patterns before asking learners to practice. Luo101 should feel like being guided into speech, not dropped into a quiz.' },
      { heading: 'Honor real speech', body: 'We prioritize phrases a learner can actually say to parents, grandparents, relatives, friends, sellers, teachers, and loved ones. Audio from fluent speakers is central to the learning experience.' },
      { heading: 'Preserve with dignity', body: 'The app presents Dholuo as premium, beautiful, and worth protecting. Every lesson should help a learner speak with confidence while respecting the culture behind the words.' },
    ],
  },
  privacy: {
    id: 'privacy',
    eyebrow: 'Privacy Policy',
    title: 'How Luo101 handles learner information',
    intro: 'This first version explains the data Luo101 expects to use as we prepare accounts, progress sync, and payments.',
    sections: [
      { heading: 'Information we collect', body: 'We may collect your email address, display name, password-managed account details through Supabase, lesson progress, XP, streaks, selected units, phrase activity, payment status, and support messages you send us.' },
      { heading: 'How we use it', body: 'We use this information to create your account, save progress, unlock purchased course access, improve learning content, respond to support requests, and protect the service from misuse.' },
      { heading: 'Payments', body: 'Payments are processed by third-party providers such as M-Pesa or card processors. Luo101 should store payment status and references, but not full card numbers or sensitive card security details.' },
      { heading: 'Your choices', body: 'You can contact Luo101 support to ask about your account data, request help with access, or request deletion where legally and technically possible.' },
    ],
  },
  terms: {
    id: 'terms',
    eyebrow: 'Terms of Service',
    title: 'The basic rules for using Luo101',
    intro: 'These terms keep expectations clear before we add paid course access.',
    sections: [
      { heading: 'Accounts', body: 'You are responsible for keeping your login details secure and for using Luo101 in a lawful, respectful way. Course progress and access are tied to your account.' },
      { heading: 'Course access', body: 'Free visitors may explore parts of Luo101. Paid access, when enabled, will unlock the full course features described at purchase, subject to availability and fair use.' },
      { heading: 'Content ownership', body: 'Lessons, phrase collections, text, audio, branding, and course structure belong to Luo101 or its contributors unless otherwise stated. Learners may use the content for personal learning, not resale or copying into another product.' },
      { heading: 'Service changes', body: 'We may improve, correct, add, or remove features as Luo101 grows, especially as the curriculum is reviewed by fluent speakers and more audio is added.' },
    ],
  },
  refunds: {
    id: 'refunds',
    eyebrow: 'Refund Policy',
    title: 'Fair refunds for paid access',
    intro: 'This policy should be simple, visible, and learner-friendly before purchases go live.',
    sections: [
      { heading: 'Suggested refund window', body: 'For the first paid version, Luo101 can offer refunds within 7 days of purchase when a learner cannot access the course, paid by mistake, or is not satisfied after trying it lightly.' },
      { heading: 'When refunds may be limited', body: 'Refunds may be declined where there is heavy course usage, repeated refund abuse, or where a payment provider or app store policy controls the refund process.' },
      { heading: 'How to request help', body: 'Learners should contact support with the account email, payment reference, payment method, and a short explanation so the purchase can be found quickly.' },
    ],
  },
  contact: {
    id: 'contact',
    eyebrow: 'Contact',
    title: 'Support for learners and families',
    intro: 'A clear contact page gives learners confidence before creating an account or paying for the course.',
    sections: [
      { heading: 'Support email', body: 'Use a dedicated support address such as support@luo101.org for account access, payment issues, refunds, corrections, and audio/content feedback.' },
      { heading: 'What to include', body: 'For faster help, include your account email, the unit or phrase involved, your payment reference if relevant, your device/browser, and a short description of the issue.' },
      { heading: 'Language feedback', body: 'Fluent speakers are invited to help improve wording, dialect notes, and audio quality. Luo101 should keep correction pathways open as the course grows.' },
    ],
  },
  payments: {
    id: 'payments',
    eyebrow: 'Payments & Billing',
    title: 'Clear payments for preserving Dholuo',
    intro: 'Luo101 uses one-time course payments to support the work of building, reviewing, recording, and preserving a beautiful living language.',
    sections: [
      { heading: 'One-time course access', body: 'Luo101 course packages are one-time purchases, not recurring subscriptions. The package shown at checkout is the package connected to your Luo101 account after payment is confirmed.' },
      { heading: 'Foundation Course', body: 'The Foundation Course opens Units 1-9, giving learners a strong path through greetings, counting, food, family, places, directions, time, weather, health, stories, poems, phrase audio, and culture notes.' },
      { heading: 'Complete Course', body: 'The Complete Course unlocks every current self-paced unit, including romance, core sentence words, the A-Z dictionary, readings, phrase audio, and future self-paced course refinements.' },
      { heading: 'Complete Course + Live Guidance', body: 'The guidance package includes Complete Course access plus personal support for pronunciation, confidence, and cultural context.' },
      { heading: 'Payment methods', body: 'M-Pesa payments are processed through PayHero. Card payments such as Visa or Mastercard may be added through secure third-party processors as Luo101 grows.' },
      { heading: 'Access after payment', body: 'After a successful payment, Luo101 saves a course entitlement to your signed-in profile. That entitlement unlocks the lessons, practice, phrase audio, readings, and course areas included in the package you selected.' },
      { heading: 'Keep your account email correct', body: 'Course access is tied to the account used at the time of purchase. Before paying, sign in with the email you want to keep using for Luo101.' },
      { heading: 'What Luo101 stores', body: 'Luo101 stores payment status, amount, package, provider name, transaction references, and the account connected to the purchase. Sensitive payment details such as card numbers, card security codes, and mobile-money PINs are handled by the payment provider, not by Luo101.' },
      { heading: 'Payment delays and provider issues', body: 'Some payments may take time to confirm because of mobile-network, bank, processor, or provider delays. If money leaves your account but access does not unlock, contact support@luo101.org with your Luo101 email, phone number used for payment, amount, date, and transaction reference.' },
      { heading: 'Corrections and course changes', body: 'Luo101 may improve lessons, correct wording, update audio, add units, remove mistakes, and refine access rules over time. These changes are part of maintaining a careful language-learning product.' },
      { heading: 'Limited liability', body: 'To the fullest extent allowed by law, Luo101 is not liable for indirect, incidental, special, or consequential losses, including lost profit, lost data, network failures, payment-provider downtime, device issues, or inability to access the service for reasons outside Luo101 control. Where Luo101 is legally responsible for a proven direct loss, our total liability is limited to the amount you paid for the affected Luo101 package.' },
      { heading: 'Need help?', body: 'For billing, access, refunds, duplicate payments, or payment corrections, email support@luo101.org. Include enough details for us to trace the transaction quickly and treat the issue with care.' },
    ],
  },
};

function getStorage() {
  const candidate = globalThis as typeof globalThis & { localStorage?: StorageLike };
  return candidate.localStorage ?? null;
}

function readProgress(): SavedProgress | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawProgress = storage.getItem(STORAGE_KEY);
    return rawProgress ? (JSON.parse(rawProgress) as SavedProgress) : null;
  } catch {
    return null;
  }
}

function writeProgress(progress: SavedProgress) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function normalizeReferralCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 24);
}

function getLocation() {
  const candidate = globalThis as typeof globalThis & { location?: LocationLike };
  return candidate.location ?? null;
}

function getReferralBaseUrl() {
  const location = getLocation();
  return location?.origin || 'https://luo101.org';
}

function getStoredReferralCode() {
  const storage = getStorage();

  if (!storage) {
    return '';
  }

  return normalizeReferralCode(storage.getItem(REFERRAL_STORAGE_KEY) ?? '');
}

function storeReferralCode(code: string) {
  const normalizedCode = normalizeReferralCode(code);
  const storage = getStorage();

  if (!storage || !normalizedCode) {
    return '';
  }

  storage.setItem(REFERRAL_STORAGE_KEY, normalizedCode);
  return normalizedCode;
}

function clearStoredReferralCode() {
  const storage = getStorage();
  storage?.removeItem?.(REFERRAL_STORAGE_KEY);
}

function captureReferralCodeFromUrl() {
  const location = getLocation();
  const search = location?.search ?? '';

  if (!search) {
    return '';
  }

  try {
    const referralCode = new URLSearchParams(search).get('ref') ?? '';
    return referralCode ? storeReferralCode(referralCode) : '';
  } catch {
    return '';
  }
}

function createReferralCode(userId: string) {
  return `LUO${userId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function createReferralLink(code: string) {
  return `${getReferralBaseUrl()}/?ref=${encodeURIComponent(code)}&signup=1`;
}

async function copyTextToClipboard(value: string) {
  const candidate = globalThis as typeof globalThis & { navigator?: NavigatorLike };

  if (!candidate.navigator?.clipboard) {
    return false;
  }

  try {
    await candidate.navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function setDocumentTitle(title: string) {
  const candidate = globalThis as typeof globalThis & { document?: DocumentLike };

  if (candidate.document) {
    candidate.document.title = title;
  }
}

function installWebFontStack() {
  const candidate = globalThis as typeof globalThis & { document?: DocumentLike };
  const documentRef = candidate.document;

  if (!documentRef?.head || !documentRef.createElement || documentRef.getElementById?.('luo101-font-stack')) {
    return;
  }

  const style = documentRef.createElement('style');
  style.id = 'luo101-font-stack';
  style.textContent = `
    html, body, input, textarea, button, select, [class*="css-text"] {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-synthesis-weight: none;
      text-rendering: optimizeLegibility;
    }
  `;
  documentRef.head.appendChild(style);
}

function getStableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getMixedChoiceOptions(options: string[], answer: string, seedText: string) {
  const mixed = [...options]
    .map((option, index) => ({
      index,
      option,
      weight: getStableHash(`${seedText}:${option}:${index}`),
    }))
    .sort((first, second) => first.weight - second.weight || first.index - second.index)
    .map(({ option }) => option);

  if (mixed.length > 1 && mixed[0] === answer) {
    const swapIndex = (getStableHash(`${seedText}:answer-offset`) % (mixed.length - 1)) + 1;
    [mixed[0], mixed[swapIndex]] = [mixed[swapIndex], mixed[0]];
  }

  return mixed;
}

export default function App() {
  const { width } = useWindowDimensions();
  const isCompactShell = width < 720;
  const savedProgress = useMemo(() => readProgress(), []);
  const [tab, setTab] = useState<Tab>('learn');
  const [publicPageId, setPublicPageId] = useState<PublicPageId | null>(null);
  const [isPublicMenuOpen, setIsPublicMenuOpen] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [xp, setXp] = useState(savedProgress?.xp ?? 120);
  const [streak, setStreak] = useState(savedProgress?.streak ?? 4);
  const [selectedUnitId, setSelectedUnitId] = useState(savedProgress?.selectedUnitId ?? learningUnits[0].id);
  const [unitProgressById, setUnitProgressById] = useState<Record<string, UnitProgress>>(savedProgress?.units ?? {});
  const [session, setSession] = useState<Session | null>(null);
  const [profileName, setProfileName] = useState('Luo101 Learner');
  const [authEmail, setAuthEmail] = useState('');
  const [authEmailConfirm, setAuthEmailConfirm] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [authMessage, setAuthMessage] = useState('');
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);
  const [entitlementTier, setEntitlementTier] = useState<EntitlementTier>('none');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [selectedPaymentPackageId, setSelectedPaymentPackageId] = useState<CoursePackage['id']>('full');
  const [paymentMessage, setPaymentMessage] = useState('Choose the Luo101 path that fits your learning, then pay securely with M-Pesa.');
  const [isPaymentStarting, setIsPaymentStarting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'Cloud profile ready.' : 'Supabase env missing.');
  const [isSignupPromptVisible, setIsSignupPromptVisible] = useState(false);
  const [hasSignupPromptShown, setHasSignupPromptShown] = useState(false);
  const [shouldOpenAuthPanel, setShouldOpenAuthPanel] = useState(false);
  const [capturedReferralCode, setCapturedReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralMessage, setReferralMessage] = useState('');
  const [isReferralLoading, setIsReferralLoading] = useState(false);

  const unitIndex = Math.max(
    learningUnits.findIndex((unit) => unit.id === selectedUnitId),
    0,
  );
  const unit = learningUnits[unitIndex];
  const nextUnit = learningUnits[unitIndex + 1];
  const unitLabel = unit.unitLabel ?? `Unit ${unitIndex + 1}`;
  const nextUnitLabel = nextUnit?.unitLabel ?? (nextUnit ? `Unit ${unitIndex + 2}` : undefined);
  const unitProgress = unitProgressById[unit.id] ?? defaultUnitProgress;
  const { correctExerciseIds, mistakes, completedRounds, reviewCompleted } = unitProgress;

  const exercise = unit.exercises[exerciseIndex] ?? unit.exercises[0];
  const builtAnswer = built.join(' ');
  const submittedAnswer = exercise.type === 'build' ? builtAnswer : selected;
  const isCorrect = submittedAnswer === exercise.answer;
  const hasAnswered = submittedAnswer !== null && submittedAnswer.length > 0;
  const lessonProgress = correctExerciseIds.length / unit.exercises.length;
  const isPracticeComplete = correctExerciseIds.length === unit.exercises.length;
  const isUnitComplete = isPracticeComplete && reviewCompleted;
  const activeLessonIndex = isPracticeComplete
    ? unit.lessons.length - 1
    : Math.min(
        Math.floor((correctExerciseIds.length / unit.exercises.length) * unit.lessons.length),
        unit.lessons.length - 1,
      );

  const pathStatus = useMemo(
    () =>
      unit.lessons.map((lesson, index) => ({
        ...lesson,
        status:
          isUnitComplete || index < activeLessonIndex
            ? 'complete'
            : index === activeLessonIndex
              ? 'active'
              : 'locked',
        isCurrent: !isUnitComplete && index === activeLessonIndex,
      })),
    [activeLessonIndex, isUnitComplete, unit.lessons],
  );

  useEffect(() => {
    installWebFontStack();
    setDocumentTitle('Luo101');
    const referralCode = captureReferralCodeFromUrl() || getStoredReferralCode();
    setCapturedReferralCode(referralCode);

    if (referralCode) {
      setAuthMode('sign-up');
      setShouldOpenAuthPanel(true);
      setHasSignupPromptShown(true);
      openTab('profile');
    }

    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    writeProgress({
      selectedUnitId,
      xp,
      streak,
      units: unitProgressById,
    });
  }, [selectedUnitId, xp, streak, unitProgressById]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadCloudProfile(session);
    void loadReferralProgram(session);
  }, [session?.user.id]);

  useEffect(() => {
    if (!session) {
      setEntitlementTier('none');
      return;
    }

    void loadEntitlement(session);
  }, [session?.user.id]);

  useEffect(() => {
    if (!session || !pendingAuthAction) {
      return;
    }

    const action = pendingAuthAction;
    setPendingAuthAction(null);
    setAuthMessage('You are signed in. Continuing where you left off.');
    action();
  }, [pendingAuthAction, session?.user.id]);

  useEffect(() => {
    if (session) {
      setIsSignupPromptVisible(false);
      return;
    }

    if (publicPageId || hasSignupPromptShown) {
      return;
    }

    const promptTimer = setTimeout(() => {
      setAuthMode('sign-up');
      setAuthMessage('');
      setIsSignupPromptVisible(true);
      setHasSignupPromptShown(true);
    }, 10000);

    return () => clearTimeout(promptTimer);
  }, [hasSignupPromptShown, publicPageId, session?.user.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const syncTimer = setTimeout(() => {
      void syncProgressToCloud();
    }, 900);

    return () => clearTimeout(syncTimer);
  }, [session?.user.id, selectedUnitId, xp, streak, unitProgressById]);

  useEffect(() => {
    resetExercise(0);
  }, [selectedUnitId]);

  function getCurrentProgress(): SavedProgress {
    return {
      selectedUnitId,
      xp,
      streak,
      units: unitProgressById,
    };
  }

  function applyProgress(progress: SavedProgress) {
    setXp(progress.xp);
    setStreak(progress.streak);
    setSelectedUnitId(progress.selectedUnitId || learningUnits[0].id);
    setUnitProgressById(progress.units ?? {});
    writeProgress(progress);
  }

  function canAccessUnit(unitId: string, tier = entitlementTier) {
    if (FREE_UNIT_IDS.has(unitId)) {
      return true;
    }

    if (unitId === DICTIONARY_UNIT_ID) {
      return Boolean(session);
    }

    if (tier === 'full' || tier === 'consultation') {
      return true;
    }

    if (tier === 'basic') {
      return BASIC_UNLOCKED_UNIT_IDS.has(unitId);
    }

    return false;
  }

  async function loadEntitlement(activeSession = session) {
    if (!activeSession) {
      setEntitlementTier('none');
      return;
    }

    const { data, error } = await supabase
      .from('user_entitlements')
      .select('tier, live_consultation_included, updated_at')
      .eq('user_id', activeSession.user.id)
      .maybeSingle<{ tier: EntitlementTier; live_consultation_included: boolean; updated_at: string }>();

    if (error) {
      setPaymentMessage('Payment access will appear here after setup: ' + error.message);
      return;
    }

    setEntitlementTier(data?.tier ?? 'none');
    if (data?.tier && data.tier !== 'none') {
      setPaymentMessage('Your Luo101 access is active.');
    }
  }

  async function loadCloudProfile(activeSession: Session) {
    setSyncStatus('Loading cloud profile...');

    const user = activeSession.user;
    const fallbackName = user.email?.split('@')[0] || 'Luo101 Learner';
    const requestedName = authDisplayName.trim() || fallbackName;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle<ProfileRecord>();

    if (profileError) {
      setSyncStatus(`Profile setup needed: ${profileError.message}`);
    }

    if (profile) {
      setProfileName(profile.display_name || fallbackName);
      setAuthDisplayName(profile.display_name || fallbackName);
    } else {
      const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: requestedName });

      if (!error) {
        setProfileName(requestedName);
        setAuthDisplayName(requestedName);
      }
    }

    const { data: cloudProgress, error: progressError } = await supabase
      .from('user_progress')
      .select('xp, streak_days, selected_unit_id, unit_progress')
      .eq('user_id', user.id)
      .maybeSingle<ProgressRecord>();

    if (progressError) {
      setSyncStatus(`Progress setup needed: ${progressError.message}`);
      return;
    }

    if (cloudProgress) {
      applyProgress({
        selectedUnitId: cloudProgress.selected_unit_id || learningUnits[0].id,
        xp: cloudProgress.xp ?? 120,
        streak: cloudProgress.streak_days ?? 4,
        units: cloudProgress.unit_progress ?? {},
      });
      setSyncStatus('Cloud progress loaded.');
      return;
    }

    await syncProgressToCloud(activeSession);
  }

  async function loadReferralProgram(activeSession = session) {
    if (!activeSession) {
      setReferralStats(null);
      return;
    }

    setIsReferralLoading(true);

    const { data: codeRecord, error: codeError } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', activeSession.user.id)
      .maybeSingle<{ code: string }>();

    if (codeError) {
      setReferralMessage(`Referral setup needed: ${codeError.message}`);
      setIsReferralLoading(false);
      return;
    }

    if (!codeRecord?.code) {
      setReferralStats(null);
      setIsReferralLoading(false);
      return;
    }

    const [{ data: referrals }, { data: commissions }] = await Promise.all([
      supabase.from('referrals').select('id').eq('referrer_user_id', activeSession.user.id),
      supabase.from('referral_commissions').select('amount_kes, status').eq('referrer_user_id', activeSession.user.id),
    ]);

    const commissionRows = (commissions ?? []) as Array<{ amount_kes: number; status: string }>;
    const pendingKes = commissionRows
      .filter((item) => item.status === 'pending' || item.status === 'approved')
      .reduce((sum, item) => sum + (item.amount_kes ?? 0), 0);
    const paidKes = commissionRows
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + (item.amount_kes ?? 0), 0);

    setReferralStats({
      code: codeRecord.code,
      link: createReferralLink(codeRecord.code),
      totalReferrals: referrals?.length ?? 0,
      pendingKes,
      paidKes,
    });
    setReferralMessage('Referral program ready.');
    setIsReferralLoading(false);
  }

  async function attachPendingReferral(activeSession = session) {
    const referralCode = capturedReferralCode || getStoredReferralCode();

    if (!activeSession || !referralCode) {
      return;
    }

    const { data: codeRecord, error: codeError } = await supabase
      .from('referral_codes')
      .select('user_id, code')
      .eq('code', referralCode)
      .maybeSingle<{ user_id: string; code: string }>();

    if (codeError || !codeRecord) {
      return;
    }

    if (codeRecord.user_id === activeSession.user.id) {
      clearStoredReferralCode();
      setCapturedReferralCode('');
      return;
    }

    const { error } = await supabase.from('referrals').insert({
      referrer_user_id: codeRecord.user_id,
      referred_user_id: activeSession.user.id,
      referral_code: codeRecord.code,
    });

    if (!error || error.code === '23505') {
      clearStoredReferralCode();
      setCapturedReferralCode('');
    }
  }

  async function joinReferralProgram() {
    if (!session) {
      requireProfile(() => openTab('profile'), 'Create your Luo101 profile to join the referral program.');
      return;
    }

    setIsReferralLoading(true);
    setReferralMessage('Creating your referral link...');

    const code = createReferralCode(session.user.id);
    const { error } = await supabase.from('referral_codes').upsert({
      user_id: session.user.id,
      code,
    });

    if (error) {
      setReferralMessage(error.message);
      setIsReferralLoading(false);
      return;
    }

    setReferralMessage('Referral link created. Share it with learners who want to start Dholuo.');
    await loadReferralProgram(session);
  }

  async function copyReferralLink() {
    if (!referralStats?.link) {
      return;
    }

    const didCopy = await copyTextToClipboard(referralStats.link);
    setReferralMessage(didCopy ? 'Referral link copied.' : 'Copy is not available here. Select and copy the link manually.');
  }

  async function syncProgressToCloud(activeSession = session) {
    if (!activeSession) {
      return;
    }

    const progress = getCurrentProgress();
    const { error } = await supabase.from('user_progress').upsert({
      user_id: activeSession.user.id,
      xp: progress.xp,
      streak_days: progress.streak,
      selected_unit_id: progress.selectedUnitId,
      unit_progress: progress.units,
    });

    setSyncStatus(error ? `Cloud sync failed: ${error.message}` : 'Cloud progress saved.');
  }

  async function handleAuthSubmit() {
    if (!isSupabaseConfigured) {
      setAuthMessage('Supabase is not configured yet.');
      return false;
    }

    const email = authEmail.trim().toLowerCase();
    const emailConfirm = authEmailConfirm.trim().toLowerCase();
    const password = authPassword.trim();
    const passwordConfirm = authPasswordConfirm.trim();

    if (!email || !password) {
      setAuthMessage('Add an email and password first.');
      return false;
    }

    if (authMode === 'sign-up' && email !== emailConfirm) {
      setAuthMessage('The two email addresses must match.');
      return false;
    }

    if (authMode === 'sign-up' && password !== passwordConfirm) {
      setAuthMessage('The two passwords must match.');
      return false;
    }

    setAuthMessage(authMode === 'sign-up' ? 'Creating your profile...' : 'Signing you in...');

    if (authMode === 'sign-up') {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: authDisplayName.trim() || 'Luo101 Learner' } },
      });

      if (result.error) {
        setAuthMessage(result.error.message);
        return false;
      }

      const activeSession = result.data.session;

      if (activeSession) {
        setSession(activeSession);
        await attachPendingReferral(activeSession);
        setAuthPassword('');
        setAuthPasswordConfirm('');
        setAuthMessage('Profile created. You are signed in.');
        return true;
      }

      const signInResult = await supabase.auth.signInWithPassword({ email, password });

      if (signInResult.error) {
        setAuthMessage('Profile created, but Supabase email confirmation is still enabled. Turn off Confirm email, then sign in.');
        return false;
      }

      setSession(signInResult.data.session);
      if (signInResult.data.session) {
        await attachPendingReferral(signInResult.data.session);
      }
      setAuthPassword('');
      setAuthPasswordConfirm('');
      setAuthMessage('Profile created. You are signed in.');
      return true;
    }

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setAuthMessage(result.error.message);
      return false;
    }

    setSession(result.data.session);
    clearStoredReferralCode();
    setCapturedReferralCode('');
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setAuthMessage('Signed in.');
    return true;
  }

  async function handleSignupPromptSubmit() {
    const didAuthenticate = await handleAuthSubmit();

    if (!didAuthenticate) {
      return;
    }

    setIsSignupPromptVisible(false);
    openTab('profile');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setEntitlementTier('none');
    setAuthMessage('Signed out. Progress is still saved on this device.');
    setSyncStatus('Signed out.');
  }

  async function handleSaveProfileName() {
    if (!session) {
      setAuthMessage('Sign in first to save a profile name.');
      return;
    }

    const nextName = authDisplayName.trim() || 'Luo101 Learner';
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, display_name: nextName });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setProfileName(nextName);
    setAuthMessage('Profile name saved.');
  }
  async function startMpesaPayment() {
    if (!session) {
      requireProfile(() => openTab('profile'), 'Create your Luo101 profile before buying course access.');
      return;
    }

    const selectedPackage = PAYMENT_PACKAGES.find((item) => item.id === selectedPaymentPackageId) ?? PAYMENT_PACKAGES[1];
    setIsPaymentStarting(true);
    setPaymentMessage('Sending M-Pesa prompt...');

    const { data, error } = await supabase.functions.invoke('initiate-payhero-payment', {
      body: {
        package_id: selectedPackage.id,
        phone_number: paymentPhone,
        customer_name: profileName || authDisplayName || 'Luo101 Learner',
      },
    });

    setIsPaymentStarting(false);

    if (error) {
      setPaymentMessage(error.message || 'Could not start M-Pesa payment.');
      return;
    }

    const result = data as { message?: string; error?: string; external_reference?: string };
    setPaymentMessage(result.error ?? result.message ?? 'M-Pesa prompt sent. Complete payment on your phone, then refresh access.');
  }

  function requireCourseAccess(action: () => void, unitId = unit.id) {
    if (canAccessUnit(unitId)) {
      action();
      return;
    }

    if (!session) {
      const lockedUnit = learningUnits.find((item) => item.id === unitId);
      const lockedLabel = lockedUnit?.unitLabel ?? lockedUnit?.title ?? 'This unit';
      requireProfile(
        () => requireCourseAccess(action, unitId),
        `${lockedLabel} is part of the paid Luo101 course. Create your profile to upgrade and keep learning.`,
      );
      return;
    }

    const lockedUnit = learningUnits.find((item) => item.id === unitId);
    const lockedLabel = lockedUnit?.unitLabel ?? lockedUnit?.title ?? 'This unit';

    if (entitlementTier === 'basic') {
      setSelectedPaymentPackageId('full');
      setPaymentMessage(`${lockedLabel} is beyond the Foundation Course. Upgrade to the Complete Course to unlock Units 10-12, including romance, the A-Z dictionary, and every future self-paced course update.`);
    } else {
      setPaymentMessage('Choose a Luo101 course package to unlock lessons, practice, phrase audio, readings, and culture notes.');
    }

    openTab('profile');
  }

  function requireProfile(action: () => void, message = 'Create your Luo101 profile to start lessons, play audio, and save your progress as you learn Dholuo.') {
    if (session) {
      action();
      return;
    }

    setAuthMode('sign-up');
    setAuthMessage(message);
    setPendingAuthAction(() => action);
    openTab('profile');
  }

  function updateUnitProgress(updater: (current: UnitProgress) => UnitProgress) {
    setUnitProgressById((current) => ({
      ...current,
      [unit.id]: updater(current[unit.id] ?? defaultUnitProgress),
    }));
  }

  function resetExercise(nextIndex = exerciseIndex) {
    setExerciseIndex(nextIndex);
    setSelected(null);
    setBuilt([]);
  }

  function openTab(nextTab: Tab) {
    setPublicPageId(null);
    setTab(nextTab);
  }

  function openPublicPage(pageId: PublicPageId) {
    setPublicPageId(pageId);
    setIsPublicMenuOpen(false);
  }

  function restartUnit(startTab: Tab) {
    updateUnitProgress((current) => ({
      ...current,
      correctExerciseIds: [],
      mistakes: 0,
      reviewCompleted: false,
    }));
    resetExercise(0);
    openTab(startTab);
  }

  function goToNextUnit() {
    if (!nextUnit) {
      return;
    }

    selectUnit(nextUnit.id, 'learn');
  }

  function selectUnit(unitId: string, nextTab: Tab = 'learn') {
    setSelectedUnitId(unitId);
    openTab(nextTab);
  }

  function openDictionary() {
    requireProfile(
      () => selectUnit(DICTIONARY_UNIT_ID, 'lesson'),
      'Create or sign in to your Luo101 profile to use the searchable A-Z dictionary.',
    );
  }

  function continueLesson() {
    if (!hasAnswered) {
      return;
    }

    if (!isCorrect) {
      updateUnitProgress((current) => ({ ...current, mistakes: current.mistakes + 1 }));
      resetExercise(exerciseIndex);
      return;
    }

    const nextCorrectIds = correctExerciseIds.includes(exercise.id)
      ? correctExerciseIds
      : [...correctExerciseIds, exercise.id];

    updateUnitProgress((current) => ({ ...current, correctExerciseIds: nextCorrectIds }));
    setXp((current) => current + 5);

    if (nextCorrectIds.length === unit.exercises.length) {
      resetExercise(0);
      openTab('review');
      return;
    }

    const nextIndex = (exerciseIndex + 1) % unit.exercises.length;
    resetExercise(nextIndex);
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={[styles.topBarInner, isCompactShell && styles.topBarInnerCompact]}>
          <View style={[styles.brandLockup, isCompactShell && styles.brandLockupCompact]}>
            <Image
              source={brandLogo}
              style={[styles.brandLogo, isCompactShell && styles.brandLogoCompact]}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.topBarActions, isCompactShell && styles.topBarActionsCompact]}>
            <View style={[styles.headerProgress, isCompactShell && styles.headerProgressCompact]}>
              <Text style={styles.headerProgressText}>{xp} XP</Text>
              <Text style={styles.headerProgressDot}>.</Text>
              <Text style={styles.headerProgressText}>{streak} day streak</Text>
            </View>
            <Pressable
              accessibilityLabel="Open searchable Luo dictionary"
              accessibilityRole="button"
              onPress={openDictionary}
              style={styles.dictionaryShortcutButton}
            >
              <Text style={styles.dictionaryShortcutIcon}>⌕</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {publicPageId ? (
          <PublicPageScreen page={PUBLIC_PAGES[publicPageId]} onBack={() => openTab(tab)} />
        ) : (
          <>
        {tab === 'learn' ? (
          <LearnScreen
            completedRounds={completedRounds}
            lessonProgress={lessonProgress}
            mistakes={mistakes}
            nextPhrase={unit.phrases[Math.min(correctExerciseIds.length, unit.phrases.length - 1)]}
            nextUnit={nextUnit}
            pathStatus={pathStatus}
            unit={unit}
            unitLabel={unitLabel}
            nextUnitLabel={nextUnitLabel}
            selectedUnitId={selectedUnitId}
            unitProgressById={unitProgressById}
            onContinueUnit={() => requireCourseAccess(goToNextUnit, nextUnit?.id ?? unit.id)}
            onRestart={() => requireCourseAccess(() => restartUnit('lesson'))}
            onSelectUnit={selectUnit}
            onStart={() => requireCourseAccess(() => openTab('lesson'))}
          />
        ) : null}
        {tab === 'review' ? (
          <ReviewScreen
            mistakes={mistakes}
            unit={unit}
            unitLabel={unitLabel}
            onComplete={() => {
              updateUnitProgress((current) => ({
                ...current,
                completedRounds: current.completedRounds + 1,
                reviewCompleted: true,
              }));
              setStreak((current) => current + 1);
              openTab('learn');
            }}
            onPracticeAgain={() => requireCourseAccess(() => restartUnit('practice'))}
          />
        ) : null}
        {tab === 'lesson' ? <LessonScreen unit={unit} onBeginPractice={() => requireCourseAccess(() => openTab('practice'))} /> : null}
        {tab === 'practice' ? (
          <PracticeScreen
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            selected={selected}
            built={built}
            hasAnswered={hasAnswered}
            isCorrect={isCorrect}
            unit={unit}
            onSelect={(value) => requireCourseAccess(() => setSelected(value))}
            onBuild={(tile) => requireCourseAccess(() => setBuilt((current) => [...current, tile]))}
            onClear={() => setBuilt([])}
            onContinue={() => requireCourseAccess(continueLesson)}
          />
        ) : null}
        {tab === 'phrases' ? (
          <PhrasebookScreen
            units={learningUnits}
            session={session}
            canAccessUnit={(unitId) => canAccessUnit(unitId)}
            onRequireUpgrade={(unitId) => requireCourseAccess(() => openTab('phrases'), unitId)}
            onRequireProfile={() => requireProfile(() => openTab('phrases'), 'Create your Luo101 profile to play phrase audio and keep practicing Dholuo.')}
          />
        ) : null}
        {tab === 'profile' ? (
          <ProfileScreen
            authDisplayName={authDisplayName}
            authEmail={authEmail}
            authEmailConfirm={authEmailConfirm}
            authMessage={authMessage}
            authMode={authMode}
            authPassword={authPassword}
            authPasswordConfirm={authPasswordConfirm}
            completedRounds={completedRounds}
            isCloudConfigured={isSupabaseConfigured}
            lessonProgress={lessonProgress}
            mistakes={mistakes}
            profileName={profileName}
            session={session}
            syncStatus={syncStatus}
            unit={unit}
            unitProgressById={unitProgressById}
            xp={xp}
            streak={streak}
            selectedUnitId={selectedUnitId}
            onAuthDisplayNameChange={setAuthDisplayName}
            onAuthEmailChange={setAuthEmail}
            onAuthEmailConfirmChange={setAuthEmailConfirm}
            onAuthModeChange={setAuthMode}
            onAuthPasswordChange={setAuthPassword}
            onAuthPasswordConfirmChange={setAuthPasswordConfirm}
            onAuthSubmit={handleAuthSubmit}
            onSaveProfileName={handleSaveProfileName}
            onSelectUnit={selectUnit}
            onSignOut={handleSignOut}
            onSyncNow={() => syncProgressToCloud()}
            onOpenPublicPage={openPublicPage}
            entitlementTier={entitlementTier}
            paymentPackages={PAYMENT_PACKAGES}
            paymentPhone={paymentPhone}
            selectedPaymentPackageId={selectedPaymentPackageId}
            paymentMessage={paymentMessage}
            isPaymentStarting={isPaymentStarting}
            initialAuthOpen={shouldOpenAuthPanel}
            capturedReferralCode={capturedReferralCode}
            isReferralLoading={isReferralLoading}
            referralMessage={referralMessage}
            referralStats={referralStats}
            onPaymentPhoneChange={setPaymentPhone}
            onSelectedPaymentPackageChange={setSelectedPaymentPackageId}
            onStartMpesaPayment={startMpesaPayment}
            onRefreshEntitlement={() => loadEntitlement()}
            onJoinReferralProgram={joinReferralProgram}
            onCopyReferralLink={copyReferralLink}
            onRefreshReferralProgram={() => loadReferralProgram()}
          />
        ) : null}
          </>
        )}
        <PublicLinksMenu
          activePageId={publicPageId}
          isOpen={isPublicMenuOpen}
          onOpenPage={openPublicPage}
          onToggle={() => setIsPublicMenuOpen((current) => !current)}
        />
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsSignupPromptVisible(false)}
        transparent
        visible={!session && !publicPageId && isSignupPromptVisible}
      >
        <View style={styles.signupPromptOverlay}>
          <View style={[styles.signupPromptPanel, isCompactShell && styles.signupPromptPanelCompact]}>
            <View style={styles.signupPromptHeader}>
              <View style={styles.signupPromptCopy}>
                <Text style={styles.kicker}>Free Start</Text>
                <Text style={styles.signupPromptTitle}>Get started for free</Text>
              </View>
              <Pressable
                accessibilityLabel="Close signup prompt"
                accessibilityRole="button"
                onPress={() => setIsSignupPromptVisible(false)}
                style={styles.signupPromptClose}
              >
                <Text style={styles.signupPromptCloseText}>x</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.signupPromptScroll}>
              <SignupAuthCard
                authDisplayName={authDisplayName}
                authEmail={authEmail}
                authEmailConfirm={authEmailConfirm}
                authMessage={authMessage}
                authMode={authMode}
                authPassword={authPassword}
                authPasswordConfirm={authPasswordConfirm}
                isCloudConfigured={isSupabaseConfigured}
                isOpen
                label="Start your Luo101 profile"
                syncStatus={syncStatus}
                title="Get started for free"
                body="Create your Luo101 profile to save progress, keep your Unit work, and continue learning Dholuo. Unit 1 is free for all users."
                onAuthDisplayNameChange={setAuthDisplayName}
                onAuthEmailChange={setAuthEmail}
                onAuthEmailConfirmChange={setAuthEmailConfirm}
                onAuthModeChange={setAuthMode}
                onAuthPasswordChange={setAuthPassword}
                onAuthPasswordConfirmChange={setAuthPasswordConfirm}
                onAuthSubmit={handleSignupPromptSubmit}
                onOpenChange={() => undefined}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.nav}>
        <NavButton label="Learn" active={!publicPageId && tab === 'learn'} onPress={() => openTab('learn')} />
        <NavButton label="Practice" active={!publicPageId && (tab === 'practice' || tab === 'lesson' || tab === 'review')} onPress={() => openTab('lesson')} />
        <NavButton label="Phrases" active={!publicPageId && tab === 'phrases'} onPress={() => openTab('phrases')} />
        <NavButton label="Profile" active={!publicPageId && tab === 'profile'} onPress={() => openTab('profile')} />
      </View>
    </SafeAreaView>
  );
}

function LearnScreen({
  completedRounds,
  lessonProgress,
  mistakes,
  nextUnit,
  nextPhrase,
  pathStatus,
  unit,
  unitLabel,
  nextUnitLabel,
  selectedUnitId,
  unitProgressById,
  onContinueUnit,
  onRestart,
  onSelectUnit,
  onStart,
}: {
  completedRounds: number;
  lessonProgress: number;
  mistakes: number;
  nextUnit: LearningUnit | undefined;
  nextPhrase: Phrase;
  pathStatus: Array<{ title: string; status: string; detail: string; isCurrent: boolean }>;
  unit: LearningUnit;
  unitLabel: string;
  nextUnitLabel: string | undefined;
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onContinueUnit: () => void;
  onRestart: () => void;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
  onStart: () => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 620;
  const isComplete = lessonProgress === 1;
  const drillsDone = Math.round(lessonProgress * unit.exercises.length);
  const statusLabel = isComplete ? 'Mastered' : drillsDone > 0 ? 'In progress' : 'Not started';
  const nextLesson = pathStatus.find((lesson) => lesson.isCurrent);

  return (
    <View style={styles.learnPage}>
      <View style={[styles.hero, isCompact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <View style={[styles.heroTopline, isCompact && styles.heroToplineCompact]}>
            <Text style={styles.kickerOnDark}>{unitLabel}</Text>
            <Text style={styles.heroPill}>{statusLabel}</Text>
          </View>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>{unit.title}</Text>
          <Text style={[styles.heroText, isCompact && styles.heroTextCompact]}>{unit.subtitle}</Text>
          <Text style={[styles.heroMission, isCompact && styles.heroMissionCompact]}>A living language carries memory, family, humor, song, and belonging. Luo101 helps learners preserve and pass on the beauty of Luo culture one useful phrase at a time.</Text>
          <Text style={[styles.heroGoal, isCompact && styles.heroGoalCompact]}>{unit.goal}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(lessonProgress, 0.08) * 100}%` }]} />
          </View>
          <Text style={styles.heroProgressText}>
            {drillsDone} of {unit.exercises.length} drills complete
          </Text>
        </View>
        <View style={[styles.mascotMark, isCompact && styles.mascotMarkCompact]}>
          <Text style={styles.mascotTop}>LUO</Text>
          <Text style={styles.mascotBottom}>01</Text>
        </View>
      </View>

      <View style={[styles.learnGrid, isCompact && styles.learnGridCompact]}>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{unit.xp}</Text>
          <Text style={styles.learnMetricLabel}>XP available</Text>
        </View>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{mistakes}</Text>
          <Text style={styles.learnMetricLabel}>misses</Text>
        </View>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{completedRounds}</Text>
          <Text style={styles.learnMetricLabel}>rounds</Text>
        </View>
      </View>



      {!isCompact ? (
        <UnitSelector
          compact={false}
          selectedUnitId={selectedUnitId}
          unitProgressById={unitProgressById}
          onSelectUnit={(unitId) => onSelectUnit(unitId, 'learn')}
        />
      ) : null}
      <View style={[styles.nextCard, isCompact && styles.nextCardCompact]}>
        <View style={styles.nextCopy}>
          <Text style={styles.cardLabel}>{isComplete ? 'Review Phrase' : 'Next Up'}</Text>
          <Text style={styles.nextTitle}>{isComplete ? `${unit.title} mastered` : nextLesson?.title}</Text>
          <Text style={styles.nextText}>
            {isComplete
              ? nextUnit
                ? `Practice again, or continue to ${nextUnitLabel}: ${nextUnit.title}.`
                : 'Practice again to make the basics feel quick, natural, and spoken.'
              : `Start with "${nextPhrase.dholuo}" and learn when it sounds natural.`}
          </Text>
        </View>
        <View style={[styles.phraseChip, isCompact && styles.phraseChipCompact]}>
          <Text style={styles.phraseChipText}>{nextPhrase.dholuo}</Text>
          <Text style={styles.phraseChipSub}>{nextPhrase.english}</Text>
        </View>
      </View>

      {isComplete && nextUnit ? (
        <>
          <Pressable style={styles.primaryButton} onPress={onContinueUnit}>
            <Text style={styles.primaryButtonText}>Continue to {nextUnitLabel}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onRestart}>
            <Text style={styles.secondaryButtonText}>Practice Again</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.primaryButton} onPress={isComplete ? onRestart : onStart}>
          <Text style={styles.primaryButtonText}>{isComplete ? 'Practice Again' : 'Start Lesson'}</Text>
        </Pressable>
      )}


      {isCompact ? (
        <UnitSelector
          compact
          selectedUnitId={selectedUnitId}
          unitProgressById={unitProgressById}
          onSelectUnit={(unitId) => onSelectUnit(unitId, 'learn')}
        />
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Today&apos;s Path</Text>
        <Text style={styles.sectionMeta}>{Math.round(lessonProgress * 100)}%</Text>
      </View>

      <View style={styles.path}>
        {pathStatus.map((lesson, index) => (
          <View
            key={lesson.title}
            style={[
              styles.pathItem,
              isCompact && styles.pathItemCompact,
              lesson.isCurrent && styles.pathItemActive,
              lesson.status === 'complete' && styles.pathItemComplete,
            ]}
          >
            <View
              style={[
                styles.pathDot,
                isCompact && styles.pathDotCompact,
                lesson.status === 'complete' && styles.pathDotComplete,
                lesson.isCurrent && styles.pathDotActive,
              ]}
            >
              <Text style={styles.pathDotText}>{index + 1}</Text>
            </View>
            <View style={styles.pathCopy}>
              <View style={[styles.pathTitleRow, isCompact && styles.pathTitleRowCompact]}>
                <Text style={[styles.pathTitle, isCompact && styles.pathTitleCompact]}>{lesson.title}</Text>
                <Text
                  style={[
                    styles.pathState,
                    lesson.status === 'active' && styles.pathStateActive,
                    lesson.status === 'complete' && styles.pathStateComplete,
                  ]}
                >
                  {lesson.status}
                </Text>
              </View>
              <Text style={styles.pathDetail}>{lesson.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {isComplete ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>{unit.title}</Text>
          <Text style={styles.completeText}>
            Unit complete. You earned {unit.xp} XP and your progress is saved on this device.
          </Text>
          <View style={styles.completeStats}>
            <Stat label="Rounds" value={completedRounds.toString()} />
            <Stat label="Misses" value={mistakes.toString()} />
          </View>
        </View>
      ) : null}

      <View style={[styles.learnBottomGrid, isCompact && styles.learnBottomGridCompact]}>
        <View style={styles.cultureCard}>
          <Text style={styles.cardLabel}>Culture & Usage Note</Text>
          <Text style={styles.cultureText}>{unit.cultureNote}</Text>
        </View>
        <View style={styles.cultureCard}>
          <Text style={styles.cardLabel}>Mini Dialogue</Text>
          {unit.conversation.slice(0, 6).map((line, index) => {
            const isFirstSpeaker = index % 2 === 0;

            return (
              <View
                key={`preview-${line.speaker}-${line.line}`}
                style={[
                  styles.dialoguePreviewLine,
                  isFirstSpeaker ? styles.dialoguePreviewLinePrimary : styles.dialoguePreviewLineSecondary,
                ]}
              >
                <Text
                  style={[
                    styles.dialoguePreviewSpeaker,
                    isFirstSpeaker ? styles.dialoguePreviewSpeakerPrimary : styles.dialoguePreviewSpeakerSecondary,
                  ]}
                >
                  {line.speaker}
                </Text>
                <Text style={styles.dialoguePreviewText}>{line.line}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function LessonScreen({ unit, onBeginPractice }: { unit: LearningUnit; onBeginPractice: () => void }) {
  if (unit.id === 'dictionary-az') {
    return <DictionaryScreen unit={unit} />;
  }

  return (
    <View>
      <View style={styles.lessonHero}>
        <Text style={styles.kickerOnDark}>Teach First</Text>
        <Text style={styles.lessonHeroTitle}>Meet {unit.title}</Text>
        <Text style={styles.lessonHeroText}>
          Read the phrases out loud, notice the pattern, then practice once the language feels familiar.
        </Text>
      </View>

      <View style={styles.teachSteps}>
        {unit.teachingPoints.map((point, index) => (
          <View key={point.focus} style={styles.teachCard}>
            <View style={styles.teachNumber}>
              <Text style={styles.teachNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.teachCopy}>
              <Text style={styles.cardLabel}>{point.title}</Text>
              <Text style={styles.teachFocus}>{point.focus}</Text>
              <Text style={styles.teachTranslation}>{point.translation}</Text>
              <Text style={styles.teachDetail}>{point.detail}</Text>
              <View style={styles.exampleStrip}>
                <Text style={styles.exampleText}>{point.example}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.patternCard}>
        <Text style={styles.cardLabel}>Pattern</Text>
        <View style={styles.patternRow}>
          {unit.patternLabels.map((label, index) => (
            <View key={label} style={styles.patternRow}>
              <Text style={styles.patternStep}>{label}</Text>
              {index < unit.patternLabels.length - 1 ? <Text style={styles.patternArrow}>+</Text> : null}
            </View>
          ))}
        </View>
        <Text style={styles.patternLine}>{unit.patternLine}</Text>
      </View>

      {unit.readings?.length ? <ReadingLibrary readings={unit.readings} /> : null}

      <View style={styles.guidedDialogueCard}>
        <Text style={styles.cardLabel}>Guided Conversation</Text>
        {unit.conversation.map((line) => (
          <View key={`teach-${line.speaker}-${line.line}`} style={styles.guidedDialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onBeginPractice}>
        <Text style={styles.primaryButtonText}>Begin Practice</Text>
      </Pressable>
    </View>
  );
}

function normalizeDictionaryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDictionaryPhrase(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildCurriculumDictionaryEntries(units: LearningUnit[]): DictionaryEntry[] {
  const entries: DictionaryEntry[] = [];

  function addEntry(dholuo: string | undefined, english: string | undefined, category: string, note: string) {
    const cleanDholuo = cleanDictionaryPhrase(dholuo ?? '');
    const cleanEnglish = cleanDictionaryPhrase(english ?? '');

    if (!cleanDholuo || !cleanEnglish) {
      return;
    }

    entries.push({
      dholuo: cleanDholuo.replace(/[.!?]+$/g, ''),
      english: cleanEnglish.replace(/[.!?]+$/g, ''),
      category,
      note,
    });
  }

  units
    .filter((unit) => unit.id !== 'dictionary-az')
    .forEach((unit, index) => {
      const unitName = `${unit.unitLabel ?? `Unit ${index + 1}`}: ${unit.title}`;

      addEntry(unit.patternLine, unit.goal, 'Unit pattern', unitName);

      unit.phrases.forEach((phrase) => {
        addEntry(phrase.dholuo, phrase.english, phrase.category || 'Curriculum phrase', `${unitName}. ${phrase.usage}`);
      });

      unit.teachingPoints.forEach((point) => {
        addEntry(point.focus, point.translation, 'Teaching focus', `${unitName}. ${point.title}`);
        addEntry(point.example, point.translation, 'Teaching example', `${unitName}. ${point.detail}`);
      });

      unit.conversation.forEach((line) => {
        addEntry(line.line, line.translation, 'Dialogue', `${unitName}. Speaker: ${line.speaker}`);
      });

      unit.readings?.forEach((reading) => {
        reading.lines.forEach((line) => {
          addEntry(line.dholuo, line.english, 'Reading line', `${unitName}. ${reading.title}`);
        });
        reading.vocabulary.forEach((word) => {
          addEntry(word.dholuo, word.english, 'Reading vocabulary', `${unitName}. ${reading.title}`);
        });
      });

      unit.review.forEach((item) => {
        addEntry(item.dholuo, item.english, 'Review item', `${unitName}. ${item.cue}`);
      });
    });

  return entries;
}

function mergeDictionaryEntries(primaryEntries: DictionaryEntry[], curriculumEntries: DictionaryEntry[]) {
  const byWord = new Map<string, DictionaryEntry>();

  [...primaryEntries, ...curriculumEntries].forEach((entry) => {
    const key = normalizeDictionaryKey(entry.dholuo);
    const existing = byWord.get(key);

    if (!existing) {
      byWord.set(key, entry);
      return;
    }

    const hasDifferentMeaning = !existing.english.toLowerCase().includes(entry.english.toLowerCase());
    const mergedNote = [existing.note, entry.note].filter(Boolean).join(' | ');

    byWord.set(key, {
      ...existing,
      english: hasDifferentMeaning ? `${existing.english} / ${entry.english}` : existing.english,
      category: existing.category === entry.category ? existing.category : `${existing.category} + ${entry.category}`,
      note: mergedNote || undefined,
    });
  });

  return Array.from(byWord.values()).sort((first, second) => first.dholuo.localeCompare(second.dholuo));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[.!?,;:]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDictionaryCategories(entry: DictionaryEntry) {
  return entry.category.split(' + ').map((category) => category.trim()).filter(Boolean);
}

function DictionaryScreen({ unit }: { unit: LearningUnit }) {
  const [query, setQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const curriculumDictionaryEntries = useMemo(() => buildCurriculumDictionaryEntries(learningUnits), []);
  const allDictionaryEntries = useMemo(
    () => mergeDictionaryEntries(dictionaryEntries, curriculumDictionaryEntries),
    [curriculumDictionaryEntries],
  );
  const letters = useMemo(
    () => ['All', ...Array.from(new Set(allDictionaryEntries.map((entry) => entry.dholuo.charAt(0).toUpperCase()))).sort()],
    [allDictionaryEntries],
  );
  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(allDictionaryEntries.flatMap((entry) => getDictionaryCategories(entry)))).sort(),
    ],
    [allDictionaryEntries],
  );
  const normalizedQuery = normalizeSearchText(query);
  const hasActiveFilters = Boolean(normalizedQuery) || selectedLetter !== 'All' || selectedCategory !== 'All';
  const filteredEntries = useMemo(
    () =>
      allDictionaryEntries.filter((entry) => {
        const matchesLetter = selectedLetter === 'All' || entry.dholuo.charAt(0).toUpperCase() === selectedLetter;
        const matchesCategory = selectedCategory === 'All' || getDictionaryCategories(entry).includes(selectedCategory);
        const searchable = normalizeSearchText(`${entry.dholuo} ${entry.english} ${entry.category} ${entry.note ?? ''}`);
        return matchesLetter && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
      }),
    [allDictionaryEntries, normalizedQuery, selectedCategory, selectedLetter],
  );

  function clearDictionaryFilters() {
    setQuery('');
    setSelectedLetter('All');
    setSelectedCategory('All');
  }

  return (
    <View>
      <View style={styles.lessonHero}>
        <Text style={styles.kickerOnDark}>{unit.unitLabel}</Text>
        <Text style={styles.lessonHeroTitle}>{unit.title}</Text>
        <Text style={styles.lessonHeroText}>{unit.subtitle}</Text>
      </View>

      <View style={styles.dictionarySearchCard}>
        <Text style={styles.cardLabel}>Search Dictionary</Text>
        <TextInput
          accessibilityLabel="Search Luo dictionary"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search Luo or English, e.g. pi, water, because"
          placeholderTextColor="#7A8A82"
          style={styles.dictionaryInput}
          value={query}
        />

        <View style={styles.dictionaryStats}>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{dictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>Curated</Text>
          </View>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{curriculumDictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>From lessons</Text>
          </View>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{allDictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>A-Z total</Text>
          </View>
        </View>

        <Text style={styles.dictionaryFilterLabel}>Letters</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.dictionaryLetters}>
          {letters.map((letter) => (
            <Pressable
              key={letter}
              accessibilityRole="button"
              onPress={() => setSelectedLetter(letter)}
              style={[styles.dictionaryLetter, selectedLetter === letter && styles.dictionaryLetterActive]}
            >
              <Text style={[styles.dictionaryLetterText, selectedLetter === letter && styles.dictionaryLetterTextActive]}>
                {letter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.dictionaryFilterLabel}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.dictionaryCategories}>
          {categories.map((category) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              onPress={() => setSelectedCategory(category)}
              style={[styles.dictionaryCategoryChip, selectedCategory === category && styles.dictionaryCategoryChipActive]}
            >
              <Text
                style={[
                  styles.dictionaryCategoryText,
                  selectedCategory === category && styles.dictionaryCategoryTextActive,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.dictionaryActions}>
          <Text style={styles.dictionaryMeta}>
            {filteredEntries.length} of {allDictionaryEntries.length} entries shown
          </Text>
          {hasActiveFilters ? (
            <Pressable accessibilityRole="button" onPress={clearDictionaryFilters} style={styles.dictionaryClearButton}>
              <Text style={styles.dictionaryClearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.dictionaryNotice}>
        <Text style={styles.dictionaryNoticeTitle}>Speaker-reviewed word bank</Text>
        <Text style={styles.dictionaryNoticeText}>
          This A-Z dictionary now includes the curated word bank plus phrases, readings, dialogue, review items, and vocabulary used across Units 1-11. Keep expanding it with speaker-reviewed words.
        </Text>
      </View>

      <View style={styles.dictionaryResults}>
        {filteredEntries.length ? (
          filteredEntries.map((entry) => (
            <View key={`${entry.dholuo}-${entry.english}`} style={styles.dictionaryCard}>
              <View style={styles.dictionaryCardTop}>
                <Text style={styles.dictionaryWord}>{entry.dholuo}</Text>
                <Text style={styles.dictionaryCategory}>{entry.category}</Text>
              </View>
              <Text style={styles.dictionaryMeaning}>{entry.english}</Text>
              {entry.note ? (
                <View style={styles.dictionaryNoteBlock}>
                  <Text style={styles.dictionaryNoteLabel}>Source / usage</Text>
                  <Text style={styles.dictionaryNote}>{entry.note}</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <View style={styles.dictionaryEmpty}>
            <Text style={styles.dictionaryEmptyTitle}>No match yet</Text>
            <Text style={styles.dictionaryEmptyText}>
              Try a broader search, clear the filters, or add this word to the next speaker-reviewed batch.
            </Text>
            <Pressable accessibilityRole="button" onPress={clearDictionaryFilters} style={styles.dictionaryClearButton}>
              <Text style={styles.dictionaryClearText}>Clear filters</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
function ReadingLibrary({ readings }: { readings: NonNullable<LearningUnit['readings']> }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <View style={styles.readingSection}>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Read In Context</Text>
        <Text style={styles.sectionMeta}>{readings.length} readings</Text>
      </View>
      {readings.map((reading) => {
        const isRevealed = Boolean(revealed[reading.id]);
        return (
          <View key={reading.id} style={styles.readingCard}>
            <View style={styles.readingTopline}>
              <Text style={styles.cardLabel}>{reading.kind}</Text>
              <Text style={styles.readingCount}>{reading.lines.length} lines</Text>
            </View>
            <Text style={styles.readingTitle}>{reading.title}</Text>
            <Text style={styles.readingEnglishTitle}>{reading.englishTitle}</Text>
            <Text style={styles.readingIntroduction}>{reading.introduction}</Text>
            <View style={styles.readingLines}>
              {reading.lines.map((line, index) => (
                <View key={`${reading.id}-${index}`} style={styles.readingLine}>
                  <Text style={styles.readingLineNumber}>{index + 1}</Text>
                  <View style={styles.readingLineCopy}>
                    <Text style={styles.readingDholuo}>{line.dholuo}</Text>
                    {isRevealed ? <Text style={styles.readingEnglish}>{line.english}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.readingRevealButton}
              onPress={() => setRevealed((current) => ({ ...current, [reading.id]: !isRevealed }))}
            >
              <Text style={styles.readingRevealText}>{isRevealed ? 'Hide English' : 'Reveal English'}</Text>
            </Pressable>
            <View style={styles.readingVocabulary}>
              {reading.vocabulary.map((word) => (
                <View key={`${reading.id}-${word.dholuo}`} style={styles.readingWord}>
                  <Text style={styles.readingWordDholuo}>{word.dholuo}</Text>
                  <Text style={styles.readingWordEnglish}>{word.english}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ReviewScreen({
  mistakes,
  unit,
  unitLabel,
  onComplete,
  onPracticeAgain,
}: {
  mistakes: number;
  unit: LearningUnit;
  unitLabel: string;
  onComplete: () => void;
  onPracticeAgain: () => void;
}) {
  return (
    <View>
      <View style={styles.reviewHero}>
        <Text style={styles.kickerOnDark}>Final Review</Text>
        <Text style={styles.lessonHeroTitle}>Can you follow {unit.title}?</Text>
        <Text style={styles.lessonHeroText}>
          Review the phrases, scan the recap, then mark {unitLabel} complete when it feels familiar.
        </Text>
      </View>

      <View style={styles.reviewGrid}>
        {unit.review.map((item) => (
          <View key={item.dholuo} style={styles.reviewCard}>
            <Text style={styles.cardLabel}>{item.cue}</Text>
            <Text style={styles.reviewPhrase}>{item.dholuo}</Text>
            <Text style={styles.reviewTranslation}>{item.english}</Text>
          </View>
        ))}
      </View>

      {unit.readings?.length ? <ReadingLibrary readings={unit.readings} /> : null}

      <View style={styles.guidedDialogueCard}>
        <Text style={styles.cardLabel}>Slow Conversation Recap</Text>
        {unit.conversation.map((line) => (
          <View key={`review-${line.speaker}-${line.line}`} style={styles.guidedDialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>

      <View style={styles.reviewFooterCard}>
        <Text style={styles.reviewFooterTitle}>Ready check</Text>
        <Text style={styles.reviewFooterText}>
          You finished {unit.exercises.length} drills with {mistakes} misses. A real unit should end with recognition,
          not just a score.
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={onComplete}>
        <Text style={styles.primaryButtonText}>Complete {unitLabel}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onPracticeAgain}>
        <Text style={styles.secondaryButtonText}>Practice Again</Text>
      </Pressable>
    </View>
  );
}

function PracticeScreen({
  exercise,
  exerciseIndex,
  selected,
  built,
  hasAnswered,
  isCorrect,
  unit,
  onSelect,
  onBuild,
  onClear,
  onContinue,
}: {
  exercise: LessonExercise;
  exerciseIndex: number;
  selected: string | null;
  built: string[];
  hasAnswered: boolean;
  isCorrect: boolean;
  unit: LearningUnit;
  onSelect: (value: string) => void;
  onBuild: (value: string) => void;
  onClear: () => void;
  onContinue: () => void;
}) {
  const mixedOptions = exercise.type === 'choice'
    ? getMixedChoiceOptions(exercise.options, exercise.answer, `${unit.id}:${exercise.id}`)
    : [];
  const remainingTiles = exercise.type === 'build'
    ? exercise.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ index, tile }) => {
          const usedCount = built.filter((builtTile) => builtTile === tile).length;
          const tilePosition = exercise.tiles.slice(0, index + 1).filter((item) => item === tile).length;
          return tilePosition > usedCount;
        })
    : [];

  return (
    <View>
      <View style={styles.practiceHeader}>
        <Text style={styles.kicker}>Practice</Text>
        <Text style={styles.exerciseCount}>Drill {exerciseIndex + 1} of {unit.exercises.length}</Text>
      </View>
      <Text style={styles.prompt}>{exercise.prompt}</Text>

      {exercise.type === 'choice' ? (
        <View style={styles.optionGrid}>
          {mixedOptions.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.option,
                selected === option && styles.optionSelected,
                selected === option && option === exercise.answer && styles.optionCorrect,
                selected === option && option !== exercise.answer && styles.optionWrong,
              ]}
              disabled={hasAnswered}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <View style={styles.answerTray}>
            <Text style={styles.answerText}>{built.length ? built.join(' ') : 'Tap words below'}</Text>
          </View>
          <View style={styles.tileRow}>
            {remainingTiles.map(({ index, tile }) => (
              <Pressable key={`${tile}-${index}`} style={styles.tile} onPress={() => onBuild(tile)}>
                <Text style={styles.tileText}>{tile}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} onPress={onClear}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </Pressable>
        </View>
      )}

      {hasAnswered ? (
        <View style={[styles.feedback, isCorrect ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={styles.feedbackTitle}>{isCorrect ? 'Correct' : 'Try this again'}</Text>
          <Text style={styles.feedbackText}>{exercise.note}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !hasAnswered && styles.primaryButtonDisabled]}
        disabled={!hasAnswered}
        onPress={onContinue}
      >
        <Text style={styles.primaryButtonText}>{!hasAnswered ? 'Check' : isCorrect ? 'Continue' : 'Retry'}</Text>
      </Pressable>

      <View style={styles.dialogue}>
        {unit.conversation.map((line) => (
          <View key={`${line.speaker}-${line.line}`} style={styles.dialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PhrasebookScreen({
  units,
  session,
  canAccessUnit,
  onRequireUpgrade,
  onRequireProfile,
}: {
  units: LearningUnit[];
  session: Session | null;
  canAccessUnit: (unitId: string) => boolean;
  onRequireUpgrade: (unitId: string) => void;
  onRequireProfile: () => void;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [audioErrorKey, setAudioErrorKey] = useState<string | null>(null);
  const [phraseQuery, setPhraseQuery] = useState('');
  const activeAudioRef = useRef<{ key: string; player: ReturnType<typeof createAudioPlayer> } | null>(null);
  const phrases = useMemo(
    () =>
      units.flatMap((unit, index) =>
        unit.phrases.map((phrase) => ({
          ...phrase,
          unitId: unit.id,
          unitLabel: `${unit.unitLabel ?? `Unit ${index + 1}`}: ${unit.title}`,
        })),
      ),
    [units],
  );
  const normalizedPhraseQuery = normalizeSearchText(phraseQuery);
  const filteredPhrases = useMemo(
    () =>
      phrases.filter((phrase) => {
        if (!normalizedPhraseQuery) {
          return true;
        }

        const searchable = normalizeSearchText(
          `${phrase.dholuo} ${phrase.english} ${phrase.category} ${phrase.usage} ${phrase.unitLabel}`,
        );
        return searchable.includes(normalizedPhraseQuery);
      }),
    [normalizedPhraseQuery, phrases],
  );
  const recordedCount = phrases.filter((phrase) => hasAudioForKey(phrase.audioKey)).length;
  const filteredRecordedCount = filteredPhrases.filter((phrase) => hasAudioForKey(phrase.audioKey)).length;

  useEffect(
    () => () => {
      activeAudioRef.current?.player.release();
      activeAudioRef.current = null;
    },
    [],
  );

  function playPhraseAudio(audioKey: string, unitId: string) {
    if (!canAccessUnit(unitId)) {
      if (!session) {
        onRequireProfile();
      } else {
        onRequireUpgrade(unitId);
      }
      return;
    }

    const audio = getAudioForKey(audioKey);

    if (!audio) {
      return;
    }

    try {
      activeAudioRef.current?.player.pause();
      activeAudioRef.current?.player.release();

      const player = createAudioPlayer(audio.source);
      activeAudioRef.current = { key: audioKey, player };
      setAudioErrorKey(null);
      setPlayingAudioKey(audioKey);
      player.seekTo(0);
      player.play();

      setTimeout(() => {
        if (activeAudioRef.current?.key === audioKey) {
          setPlayingAudioKey(null);
        }
      }, 4200);
    } catch {
      setPlayingAudioKey(null);
      setAudioErrorKey(audioKey);
    }
  }

  return (
    <View style={styles.phrasebookPage}>
      <View style={[styles.phrasebookHero, !isWide && styles.phrasebookHeroCompact]}>
        <View style={styles.phrasebookHeroCopy}>
          <Text style={styles.kickerOnDark}>Phrasebook</Text>
          <Text style={styles.phrasebookTitle}>Hear Dholuo. Keep it close.</Text>
          <Text style={styles.phrasebookIntro}>
            A growing bank of useful phrases, greetings, family language, stories, and everyday words for practicing sound and preserving speech.
          </Text>
        </View>
        <View style={[styles.phrasebookStats, !isWide && styles.phrasebookStatsCompact]}>
          <View style={styles.phrasebookStat}>
            <Text style={styles.phrasebookStatValue}>{phrases.length}</Text>
            <Text style={styles.phrasebookStatLabel}>phrases</Text>
          </View>
          <View style={styles.phrasebookStat}>
            <Text style={styles.phrasebookStatValue}>{recordedCount}</Text>
            <Text style={styles.phrasebookStatLabel}>with audio</Text>
          </View>
        </View>
      </View>

      <View style={styles.phrasebookSearchCard}>
        <View style={[styles.phrasebookSearchHeader, !isWide && styles.phrasebookSearchHeaderCompact]}>
          <View style={styles.phrasebookSearchCopy}>
            <Text style={styles.cardLabel}>Search Phrases</Text>
            <Text style={styles.phrasebookSearchHint}>
              Find Luo phrases by word, English meaning, unit, or category.
            </Text>
          </View>
          <Text style={styles.phrasebookSearchCount}>
            {filteredPhrases.length} match{filteredPhrases.length === 1 ? '' : 'es'} · {filteredRecordedCount} playable
          </Text>
        </View>
        <View style={styles.phrasebookSearchRow}>
          <TextInput
            accessibilityLabel="Search Luo101 phrases"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPhraseQuery}
            placeholder="Search phrases, e.g. omena, arrived, mama"
            placeholderTextColor="#7A8A82"
            style={styles.phrasebookInput}
            value={phraseQuery}
          />
          {phraseQuery ? (
            <Pressable accessibilityRole="button" onPress={() => setPhraseQuery('')} style={styles.phrasebookClearButton}>
              <Text style={styles.phrasebookClearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {filteredPhrases.length === 0 ? (
        <View style={styles.phrasebookEmptyState}>
          <Text style={styles.phrasebookEmptyTitle}>No phrase found</Text>
          <Text style={styles.phrasebookEmptyText}>Try a Luo word, an English meaning, a category, or a unit title.</Text>
        </View>
      ) : null}

      <View style={[styles.phraseGrid, isWide && styles.phraseGridWide]}>
        {filteredPhrases.map((phrase) => {
          const audio = getAudioForKey(phrase.audioKey);
          const isPlaying = playingAudioKey === phrase.audioKey;
          const hasError = audioErrorKey === phrase.audioKey;
          const audioLabel = audio ? (isPlaying ? 'Playing' : 'Play') : 'Audio Soon';

          return (
            <View key={`${phrase.unitLabel}-${phrase.audioKey}`} style={[styles.phraseCard, isWide && styles.phraseCardWide]}>
              <View style={styles.phraseCardHeader}>
                <Text style={styles.phraseCategory}>{phrase.category}</Text>
                <Text style={styles.phraseUnitPill}>{phrase.unitLabel}</Text>
              </View>
              <View style={styles.phraseTop}>
                <View style={styles.phraseCopy}>
                  <Text style={styles.phrase}>{phrase.dholuo}</Text>
                  <Text style={styles.translation}>{phrase.english}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    audio ? `Play recording for ${phrase.dholuo}` : `Audio not recorded yet for ${phrase.dholuo}`
                  }
                  disabled={!audio}
                  onPress={() => playPhraseAudio(phrase.audioKey, phrase.unitId)}
                  style={[
                    styles.audioButton,
                    audio && styles.audioButtonReady,
                    isPlaying && styles.audioButtonPlaying,
                    hasError && styles.audioButtonError,
                  ]}
                >
                  <Text
                    style={[
                      styles.audioText,
                      audio && styles.audioTextReady,
                      isPlaying && styles.audioTextPlaying,
                      hasError && styles.audioTextError,
                    ]}
                  >
                    {hasError ? 'Try Again' : audioLabel}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.usage}>{phrase.usage}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SignupAuthCard({
  authDisplayName,
  authEmail,
  authEmailConfirm,
  authMessage,
  authMode,
  authPassword,
  authPasswordConfirm,
  body,
  isCloudConfigured,
  isOpen,
  label,
  syncStatus,
  title,
  onAuthDisplayNameChange,
  onAuthEmailChange,
  onAuthEmailConfirmChange,
  onAuthModeChange,
  onAuthPasswordChange,
  onAuthPasswordConfirmChange,
  onAuthSubmit,
  onOpenChange,
}: {
  authDisplayName: string;
  authEmail: string;
  authEmailConfirm: string;
  authMessage: string;
  authMode: 'sign-in' | 'sign-up';
  authPassword: string;
  authPasswordConfirm: string;
  body: string;
  isCloudConfigured: boolean;
  isOpen: boolean;
  label: string;
  syncStatus: string;
  title: string;
  onAuthDisplayNameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthEmailConfirmChange: (value: string) => void;
  onAuthModeChange: (value: 'sign-in' | 'sign-up') => void;
  onAuthPasswordChange: (value: string) => void;
  onAuthPasswordConfirmChange: (value: string) => void;
  onAuthSubmit: () => void;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.profileSignupCard}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.profileSignupTitle}>{title}</Text>
      <Text style={styles.profileSignupText}>{body}</Text>
      <View style={styles.profileAuthChoices}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen && authMode === 'sign-up' }}
          onPress={() => {
            onAuthModeChange('sign-up');
            onOpenChange(true);
          }}
          style={[styles.profileFoldButton, authMode === 'sign-up' && isOpen && styles.profileFoldButtonActive]}
        >
          <Text style={[styles.profileFoldButtonText, authMode === 'sign-up' && isOpen && styles.profileFoldButtonTextActive]}>Sign Up</Text>
          <Text style={[styles.profileFoldButtonIcon, authMode === 'sign-up' && isOpen && styles.profileFoldButtonTextActive]}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen && authMode === 'sign-in' }}
          onPress={() => {
            onAuthModeChange('sign-in');
            onOpenChange(true);
          }}
          style={[styles.profileFoldButton, authMode === 'sign-in' && isOpen && styles.profileFoldButtonActive]}
        >
          <Text style={[styles.profileFoldButtonText, authMode === 'sign-in' && isOpen && styles.profileFoldButtonTextActive]}>Sign In</Text>
          <Text style={[styles.profileFoldButtonIcon, authMode === 'sign-in' && isOpen && styles.profileFoldButtonTextActive]}>+</Text>
        </Pressable>
      </View>

      {isOpen ? (
        <View style={styles.profileAuthPanel}>
          {authMode === 'sign-up' ? (
            <TextInput
              accessibilityLabel="Display name"
              autoCapitalize="words"
              onChangeText={onAuthDisplayNameChange}
              placeholder="Display name"
              placeholderTextColor="#7A8A82"
              style={styles.profileInput}
              value={authDisplayName}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={onAuthEmailChange}
            placeholder="Email address"
            placeholderTextColor="#7A8A82"
            style={styles.profileInput}
            value={authEmail}
          />
          {authMode === 'sign-up' ? (
            <TextInput
              accessibilityLabel="Confirm email address"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={onAuthEmailConfirmChange}
              placeholder="Type email again"
              placeholderTextColor="#7A8A82"
              style={styles.profileInput}
              value={authEmailConfirm}
            />
          ) : null}
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            onChangeText={onAuthPasswordChange}
            placeholder="Password"
            placeholderTextColor="#7A8A82"
            secureTextEntry
            style={styles.profileInput}
            value={authPassword}
          />
          {authMode === 'sign-up' ? (
            <TextInput
              accessibilityLabel="Confirm password"
              autoCapitalize="none"
              onChangeText={onAuthPasswordConfirmChange}
              placeholder="Type password again"
              placeholderTextColor="#7A8A82"
              secureTextEntry
              style={styles.profileInput}
              value={authPasswordConfirm}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!isCloudConfigured}
            onPress={onAuthSubmit}
            style={[styles.profilePrimaryButton, !isCloudConfigured && styles.profileButtonDisabled]}
          >
            <Text style={styles.profilePrimaryButtonText}>{authMode === 'sign-up' ? 'Create Profile' : 'Sign In'}</Text>
          </Pressable>
          <Text style={styles.profileSyncText}>{authMessage || syncStatus}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ProfileScreen({
  authDisplayName,
  authEmail,
  authEmailConfirm,
  authMessage,
  authMode,
  authPassword,
  authPasswordConfirm,
  completedRounds,
  isCloudConfigured,
  lessonProgress,
  mistakes,
  profileName,
  session,
  syncStatus,
  unit,
  unitProgressById,
  xp,
  streak,
  selectedUnitId,
  onAuthDisplayNameChange,
  onAuthEmailChange,
  onAuthEmailConfirmChange,
  onAuthModeChange,
  onAuthPasswordChange,
  onAuthPasswordConfirmChange,
  onAuthSubmit,
  onSaveProfileName,
  onSelectUnit,
  onSignOut,
  onSyncNow,
  onOpenPublicPage,
  entitlementTier,
  paymentPackages,
  paymentPhone,
  selectedPaymentPackageId,
  paymentMessage,
  isPaymentStarting,
  initialAuthOpen,
  capturedReferralCode,
  isReferralLoading,
  referralMessage,
  referralStats,
  onPaymentPhoneChange,
  onSelectedPaymentPackageChange,
  onStartMpesaPayment,
  onRefreshEntitlement,
  onJoinReferralProgram,
  onCopyReferralLink,
  onRefreshReferralProgram,
}: {
  authDisplayName: string;
  authEmail: string;
  authEmailConfirm: string;
  authMessage: string;
  authMode: 'sign-in' | 'sign-up';
  authPassword: string;
  authPasswordConfirm: string;
  completedRounds: number;
  isCloudConfigured: boolean;
  lessonProgress: number;
  mistakes: number;
  profileName: string;
  session: Session | null;
  syncStatus: string;
  unit: LearningUnit;
  unitProgressById: Record<string, UnitProgress>;
  xp: number;
  streak: number;
  selectedUnitId: string;
  onAuthDisplayNameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthEmailConfirmChange: (value: string) => void;
  onAuthModeChange: (value: 'sign-in' | 'sign-up') => void;
  onAuthPasswordChange: (value: string) => void;
  onAuthPasswordConfirmChange: (value: string) => void;
  onAuthSubmit: () => void;
  onSaveProfileName: () => void;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
  onSignOut: () => void;
  onSyncNow: () => void;
  onOpenPublicPage: (pageId: PublicPageId) => void;
  entitlementTier: EntitlementTier;
  paymentPackages: CoursePackage[];
  paymentPhone: string;
  selectedPaymentPackageId: CoursePackage['id'];
  paymentMessage: string;
  isPaymentStarting: boolean;
  initialAuthOpen: boolean;
  capturedReferralCode: string;
  isReferralLoading: boolean;
  referralMessage: string;
  referralStats: ReferralStats | null;
  onPaymentPhoneChange: (value: string) => void;
  onSelectedPaymentPackageChange: (packageId: CoursePackage['id']) => void;
  onStartMpesaPayment: () => void;
  onRefreshEntitlement: () => void;
  onJoinReferralProgram: () => void;
  onCopyReferralLink: () => void;
  onRefreshReferralProgram: () => void;
}) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  useEffect(() => {
    if (!session && initialAuthOpen) {
      setIsAuthOpen(true);
    }
  }, [initialAuthOpen, session]);

  const completedUnits = learningUnits.filter((item) => {
    const progress = unitProgressById[item.id];
    return progress?.reviewCompleted && progress.correctExerciseIds.length === item.exercises.length;
  }).length;
  const displayName = profileName.trim() || authDisplayName.trim() || 'Learner';
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12
    ? `Oyawore ${displayName}!`
    : hour >= 12 && hour < 18
      ? `Iriyo nade ${displayName}!`
      : `Oimore ${displayName}!`;
  const progressPercent = Math.round(lessonProgress * 100);

  if (!session) {
    return (
      <View>
        <Text style={styles.kicker}>Profile</Text>
        <Text style={styles.screenTitle}>Your Luo101 profile</Text>
        <SignupAuthCard
          authDisplayName={authDisplayName}
          authEmail={authEmail}
          authEmailConfirm={authEmailConfirm}
          authMessage={authMessage}
          authMode={authMode}
          authPassword={authPassword}
          authPasswordConfirm={authPasswordConfirm}
          isCloudConfigured={isCloudConfigured}
          isOpen={isAuthOpen}
          label="Keep your learning with you"
          syncStatus={syncStatus}
          title="Join thousands of learners preserving the beautiful Luo language."
          body="Create an account to save XP, streaks, completed units, and course access across devices."
          onAuthDisplayNameChange={onAuthDisplayNameChange}
          onAuthEmailChange={onAuthEmailChange}
          onAuthEmailConfirmChange={onAuthEmailConfirmChange}
          onAuthModeChange={onAuthModeChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onAuthPasswordConfirmChange={onAuthPasswordConfirmChange}
          onAuthSubmit={onAuthSubmit}
          onOpenChange={setIsAuthOpen}
        />
        <PaymentUpgradeCard
          entitlementTier={entitlementTier}
          isPaymentStarting={isPaymentStarting}
          packages={paymentPackages}
          paymentMessage={paymentMessage}
          paymentPhone={paymentPhone}
          selectedPackageId={selectedPaymentPackageId}
          session={session}
          onPaymentPhoneChange={onPaymentPhoneChange}
          onRefreshEntitlement={onRefreshEntitlement}
          onSelectedPackageChange={onSelectedPaymentPackageChange}
          onStartMpesaPayment={onStartMpesaPayment}
        />
        {capturedReferralCode ? (
          <View style={styles.referralCard}>
            <Text style={styles.cardLabel}>Referral Link Detected</Text>
            <Text style={styles.referralTitle}>You are joining through a Luo101 referral.</Text>
            <Text style={styles.referralText}>Create your profile and we will connect this signup to referral code {capturedReferralCode}.</Text>
          </View>
        ) : null}
        <ProfileTrustLinks onOpenPage={onOpenPublicPage} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.profileHeroCard}>
        <View style={styles.profileAccountHeader}>
          <View style={styles.profileAvatarLarge}>
            <Text style={styles.profileAvatarTextLarge}>{displayName.charAt(0).toUpperCase() || 'L'}</Text>
          </View>
          <View style={styles.profileAccountCopy}>
            <Text style={styles.kickerOnDark}>Profile</Text>
            <Text style={styles.profileGreeting}>{greeting}</Text>
            <Text style={styles.profileHeroText}>Your learning is part of keeping Dholuo alive, spoken, and passed on.</Text>
          </View>
        </View>
      </View>

      <PaymentUpgradeCard
        entitlementTier={entitlementTier}
        isPaymentStarting={isPaymentStarting}
        packages={paymentPackages}
        paymentMessage={paymentMessage}
        paymentPhone={paymentPhone}
        selectedPackageId={selectedPaymentPackageId}
        session={session}
        onPaymentPhoneChange={onPaymentPhoneChange}
        onRefreshEntitlement={onRefreshEntitlement}
        onSelectedPackageChange={onSelectedPaymentPackageChange}
        onStartMpesaPayment={onStartMpesaPayment}
      />

      <ReferralProgramCard
        isLoading={isReferralLoading}
        referralMessage={referralMessage}
        referralStats={referralStats}
        onCopyReferralLink={onCopyReferralLink}
        onJoinReferralProgram={onJoinReferralProgram}
        onRefreshReferralProgram={onRefreshReferralProgram}
      />

      <View style={styles.profileGrid}>
        <MetricCard label="Total XP" value={xp.toString()} />
        <MetricCard label="Streak" value={`${streak} days`} />
        <MetricCard label="Level" value="Beginner 1" />
        <MetricCard label="Current Progress" value={`${progressPercent}%`} />
      </View>

      <View style={styles.profileProgressCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isProgressOpen }}
          onPress={() => setIsProgressOpen((current) => !current)}
          style={styles.profileProgressToggle}
        >
          <View>
            <Text style={styles.cardLabel}>Learning Progress</Text>
            <Text style={styles.profileProgressTitle}>{completedUnits}/{learningUnits.length} parts complete</Text>
          </View>
          <Text style={styles.profileProgressToggleText}>{isProgressOpen ? 'Hide' : 'Show'}</Text>
        </Pressable>
        {isProgressOpen ? (
          <UnitProgressList
            selectedUnitId={selectedUnitId}
            unitProgressById={unitProgressById}
            onSelectUnit={onSelectUnit}
          />
        ) : null}
      </View>

      <View style={styles.profileAccountCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isAccountOpen }}
          onPress={() => setIsAccountOpen((current) => !current)}
          style={styles.profileAccountSummary}
        >
          <View style={styles.profileCompactAvatar}>
            <Text style={styles.profileAvatarText}>{displayName.charAt(0).toUpperCase() || 'L'}</Text>
          </View>
          <View style={styles.profileAccountCopy}>
            <Text style={styles.cardLabel}>Account details</Text>
            <Text style={styles.profileAccountTitle}>{displayName}</Text>
            <Text style={styles.profileAccountSubtext}>{session.user.email}</Text>
          </View>
          <Text style={styles.profileAccountToggle}>{isAccountOpen ? 'Hide' : 'Edit'}</Text>
        </Pressable>
        {isAccountOpen ? (
          <View style={styles.profileAccountForm}>
            <TextInput
              accessibilityLabel="Display name"
              autoCapitalize="words"
              onChangeText={onAuthDisplayNameChange}
              placeholder="Display name"
              placeholderTextColor="#7A8A82"
              style={styles.profileInput}
              value={authDisplayName}
            />
            <View style={styles.profileActionRow}>
              <Pressable accessibilityRole="button" onPress={onSaveProfileName} style={styles.profilePrimaryButton}>
                <Text style={styles.profilePrimaryButtonText}>Save Name</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onSyncNow} style={styles.profileSecondaryButton}>
                <Text style={styles.profileSecondaryButtonText}>Sync Now</Text>
              </Pressable>
            </View>
            <Text style={styles.profileSyncText}>{authMessage || syncStatus}</Text>
          </View>
        ) : null}
      </View>

      <ProfileTrustLinks onOpenPage={onOpenPublicPage} />

      <View style={styles.profileSignOutRow}>
        <Text style={styles.profileSignOutText}>Signed in as {session.user.email}</Text>
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.profileGhostButton}>
          <Text style={styles.profileGhostButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReferralProgramCard({
  isLoading,
  referralMessage,
  referralStats,
  onCopyReferralLink,
  onJoinReferralProgram,
  onRefreshReferralProgram,
}: {
  isLoading: boolean;
  referralMessage: string;
  referralStats: ReferralStats | null;
  onCopyReferralLink: () => void;
  onJoinReferralProgram: () => void;
  onRefreshReferralProgram: () => void;
}) {
  const [isOpen, setIsOpen] = useState(!referralStats);
  const hasJoined = Boolean(referralStats);

  return (
    <View style={styles.referralCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
        style={styles.referralHeader}
      >
        <View style={styles.paymentHeaderCopy}>
          <Text style={styles.cardLabel}>Referral Program</Text>
          <Text style={styles.referralTitle}>{hasJoined ? 'Earn from your Luo101 referrals' : 'Join and earn KES 200 per course sale'}</Text>
          <Text style={styles.referralText}>Every registered learner can share Luo101. We pay referral earnings manually via M-Pesa every Tuesday and Friday.</Text>
        </View>
        <Text style={styles.paymentToggle}>{isOpen ? 'Hide' : 'View'}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.referralBody}>
          {hasJoined && referralStats ? (
            <>
              <View style={styles.referralLinkBox}>
                <Text style={styles.referralLinkLabel}>Your referral link</Text>
                <Text selectable style={styles.referralLinkText}>{referralStats.link}</Text>
              </View>
              <View style={styles.profileActionRow}>
                <Pressable accessibilityRole="button" onPress={onCopyReferralLink} style={styles.profilePrimaryButton}>
                  <Text style={styles.profilePrimaryButtonText}>Copy Link</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={onRefreshReferralProgram} style={styles.profileSecondaryButton}>
                  <Text style={styles.profileSecondaryButtonText}>Refresh</Text>
                </Pressable>
              </View>
              <View style={styles.profileGrid}>
                <MetricCard label="Referrals" value={referralStats.totalReferrals.toString()} />
                <MetricCard label="Pending" value={`KES ${referralStats.pendingKes.toLocaleString()}`} />
                <MetricCard label="Paid" value={`KES ${referralStats.paidKes.toLocaleString()}`} />
                <MetricCard label="Per sale" value={`KES ${REFERRAL_COMMISSION_KES}`} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.referralText}>Create your unique referral link and share it with friends, family, and learners who want to preserve Dholuo.</Text>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={onJoinReferralProgram}
                style={[styles.profilePrimaryButton, isLoading && styles.profileButtonDisabled]}
              >
                <Text style={styles.profilePrimaryButtonText}>{isLoading ? 'Creating...' : 'Join Referral Program'}</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.profileSyncText}>{referralMessage || 'Commission is created only after a referred learner completes a paid course purchase.'}</Text>
        </View>
      ) : null}
    </View>
  );
}



function PaymentUpgradeCard({
  entitlementTier,
  isPaymentStarting,
  packages,
  paymentMessage,
  paymentPhone,
  selectedPackageId,
  session,
  onPaymentPhoneChange,
  onRefreshEntitlement,
  onSelectedPackageChange,
  onStartMpesaPayment,
}: {
  entitlementTier: EntitlementTier;
  isPaymentStarting: boolean;
  packages: CoursePackage[];
  paymentMessage: string;
  paymentPhone: string;
  selectedPackageId: CoursePackage['id'];
  session: Session | null;
  onPaymentPhoneChange: (value: string) => void;
  onRefreshEntitlement: () => void;
  onSelectedPackageChange: (packageId: CoursePackage['id']) => void;
  onStartMpesaPayment: () => void;
}) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(entitlementTier === 'none');
  const selectedPackage = packages.find((item) => item.id === selectedPackageId) ?? packages[1];
  const hasActiveAccess = entitlementTier !== 'none';
  const hasUpgradePrompt = paymentMessage.toLowerCase().includes('upgrade');
  useEffect(() => {
    if (hasUpgradePrompt) {
      setIsPaymentOpen(true);
      return;
    }

    if (hasActiveAccess) {
      setIsPaymentOpen(false);
    }
  }, [hasActiveAccess, hasUpgradePrompt]);
  const tierLabel = entitlementTier === 'consultation'
    ? 'Complete Course + Live Guidance'
    : entitlementTier === 'full'
      ? 'Complete Course'
      : entitlementTier === 'basic'
        ? 'Foundation Course'
        : 'No paid course yet';

  return (
    <View style={styles.paymentCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isPaymentOpen }}
        onPress={() => setIsPaymentOpen((current) => !current)}
        style={styles.paymentHeader}
      >
        <View style={styles.paymentHeaderCopy}>
          <Text style={styles.cardLabel}>Course Access</Text>
          <Text style={styles.paymentTitle}>{hasActiveAccess ? `${tierLabel} active` : 'Upgrade with M-Pesa'}</Text>
          <Text style={styles.paymentText}>{hasActiveAccess ? 'Your one-time purchase is saved to this profile.' : 'One-time payments. No subscription. Secure STK push powered by PayHero.'}</Text>
        </View>
        <View style={styles.paymentHeaderActions}>
          <View style={[styles.paymentStatusPill, hasActiveAccess && styles.paymentStatusPillActive]}>
            <Text style={[styles.paymentStatusText, hasActiveAccess && styles.paymentStatusTextActive]}>
              {hasActiveAccess ? 'Active' : 'Locked'}
            </Text>
          </View>
          <Text style={styles.paymentToggle}>{isPaymentOpen ? 'Hide' : 'View'}</Text>
        </View>
      </Pressable>

      {isPaymentOpen ? <View style={styles.packageGrid}>
        {packages.map((item) => {
          const isSelected = item.id === selectedPackage.id;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => onSelectedPackageChange(item.id)}
              style={[styles.packageCard, isSelected && styles.packageCardActive]}
            >
              <Text style={[styles.packageTitle, isSelected && styles.packageTitleActive]}>{item.title}</Text>
              <Text style={[styles.packagePrice, isSelected && styles.packagePriceActive]}>KES {item.priceKes.toLocaleString()}</Text>
              <Text style={[styles.packageSummary, isSelected && styles.packageSummaryActive]}>{item.summary}</Text>
              {item.unlocks.map((unlock) => (
                <Text key={`${item.id}-${unlock}`} style={[styles.packageUnlock, isSelected && styles.packageUnlockActive]}>{unlock}</Text>
              ))}
            </Pressable>
          );
        })}
      </View> : null}

      {isPaymentOpen ? <View style={styles.paymentForm}>
        <TextInput
          accessibilityLabel="M-Pesa phone number"
          autoCapitalize="none"
          keyboardType="phone-pad"
          onChangeText={onPaymentPhoneChange}
          placeholder="M-Pesa phone e.g. 0712 345 678"
          placeholderTextColor="#7A8A82"
          style={styles.profileInput}
          value={paymentPhone}
        />
        <View style={styles.profileActionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!session || isPaymentStarting}
            onPress={onStartMpesaPayment}
            style={[styles.profilePrimaryButton, (!session || isPaymentStarting) && styles.profileButtonDisabled]}
          >
            <Text style={styles.profilePrimaryButtonText}>{isPaymentStarting ? 'Sending...' : `Pay KES ${selectedPackage.priceKes.toLocaleString()}`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onRefreshEntitlement} style={styles.profileSecondaryButton}>
            <Text style={styles.profileSecondaryButtonText}>Refresh Access</Text>
          </Pressable>
        </View>
        <Text style={[styles.profileSyncText, (!session || hasUpgradePrompt) && styles.paymentErrorText]}>
          {session ? paymentMessage : 'Create or sign in to your profile before buying course access.'}
        </Text>
      </View> : null}
      {!isPaymentOpen ? <Text style={styles.paymentCollapsedText}>Tap to view plans and payment details.</Text> : null}
    </View>
  );
}
function ProfileTrustLinks({ onOpenPage }: { onOpenPage: (pageId: PublicPageId) => void }) {
  const pages: PublicPageId[] = ['vision', 'mission', 'payments', 'privacy', 'terms', 'refunds', 'contact'];

  return (
    <View style={styles.profileTrustCard}>
      <View style={styles.profileTrustHeader}>
        <Text style={styles.cardLabel}>Account & Trust</Text>
        <Text style={styles.profileTrustTitle}>Helpful Luo101 links</Text>
        <Text style={styles.profileTrustText}>Read our vision, mission, payment notes, policies, and support details.</Text>
      </View>
      <View style={styles.profileTrustGrid}>
        {pages.map((pageId) => {
          const page = PUBLIC_PAGES[pageId];
          return (
            <Pressable
              accessibilityRole="button"
              key={`profile-link-${page.id}`}
              onPress={() => onOpenPage(page.id)}
              style={styles.profileTrustLink}
            >
              <Text style={styles.profileTrustLinkText}>{page.eyebrow}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function getUnitProgressMeta(unit: LearningUnit, progress?: UnitProgress) {
  const drillsDone = progress?.correctExerciseIds.length ?? 0;
  const percent = unit.exercises.length ? Math.round((drillsDone / unit.exercises.length) * 100) : 0;
  const isPracticeComplete = drillsDone === unit.exercises.length;
  const isComplete = Boolean(progress?.reviewCompleted && isPracticeComplete);
  const status = isComplete ? 'Complete' : drillsDone > 0 || progress?.completedRounds ? 'In progress' : 'Not started';

  return {
    drillsDone,
    isComplete,
    percent,
    status,
  };
}

function UnitSelector({
  compact = false,
  selectedUnitId,
  unitProgressById,
  onSelectUnit,
}: {
  compact?: boolean;
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onSelectUnit: (unitId: string) => void;
}) {
  return (
    <View style={styles.unitPicker}>
      <View style={styles.sectionHeaderTight}>
        <Text style={styles.sectionTitleSmall}>Choose a Unit</Text>
        <Text style={styles.sectionMeta}>skip anytime</Text>
      </View>
      <ScrollView
        horizontal={compact}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={compact}
        showsVerticalScrollIndicator={!compact}
        style={[styles.unitPickerScroll, compact && styles.unitPickerScrollCompact]}
        contentContainerStyle={[styles.unitPickerGrid, compact && styles.unitPickerRail]}
      >
        {learningUnits.map((item, index) => {
          const progress = unitProgressById[item.id];
          const meta = getUnitProgressMeta(item, progress);
          const isSelected = item.id === selectedUnitId;
          const label = item.unitLabel ?? `Unit ${index + 1}`;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              style={[styles.unitPickerItem, compact && styles.unitPickerItemCompact, isSelected && styles.unitPickerItemActive]}
              onPress={() => onSelectUnit(item.id)}
            >
              <View style={styles.unitPickerTop}>
                <Text style={[styles.unitPickerLabel, isSelected && styles.unitPickerLabelActive]}>{label}</Text>
                <Text style={[styles.unitPickerStatus, meta.isComplete && styles.unitPickerStatusComplete]}>
                  {meta.status}
                </Text>
              </View>
              <Text style={styles.unitPickerTitle}>{item.title}</Text>
              <View style={styles.unitPickerTrack}>
                <View style={[styles.unitPickerFill, { width: `${Math.max(meta.percent, meta.percent > 0 ? 6 : 0)}%` }]} />
              </View>
              <Text style={styles.unitPickerMeta}>
                {meta.drillsDone}/{item.exercises.length} drills
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function UnitProgressList({
  selectedUnitId,
  unitProgressById,
  onSelectUnit,
}: {
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
}) {
  return (
    <View style={styles.progressList}>
      {learningUnits.map((item, index) => {
        const progress = unitProgressById[item.id];
        const meta = getUnitProgressMeta(item, progress);
        const isSelected = item.id === selectedUnitId;
        const label = item.unitLabel ?? `Unit ${index + 1}`;

        return (
          <View key={`progress-${item.id}`} style={[styles.progressUnitCard, isSelected && styles.progressUnitCardActive]}>
            <View style={styles.progressUnitHeader}>
              <View style={styles.progressUnitCopy}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.progressUnitTitle}>{item.title}</Text>
                <Text style={styles.progressUnitSubtitle}>{item.subtitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.jumpButton, isSelected && styles.jumpButtonActive]}
                onPress={() => onSelectUnit(item.id, 'learn')}
              >
                <Text style={[styles.jumpButtonText, isSelected && styles.jumpButtonTextActive]}>
                  {isSelected ? 'Current' : 'Jump'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.progressUnitTrack}>
              <View style={[styles.progressUnitFill, { width: `${meta.percent}%` }]} />
            </View>
            <View style={styles.progressUnitStats}>
              <Text style={styles.progressUnitStat}>{meta.percent}%</Text>
              <Text style={styles.progressUnitStat}>{meta.drillsDone}/{item.exercises.length} drills</Text>
              <Text style={styles.progressUnitStat}>{progress?.completedRounds ?? 0} rounds</Text>
              <Text style={styles.progressUnitStat}>{progress?.mistakes ?? 0} misses</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}


function PublicPageScreen({ page, onBack }: { page: PublicPage; onBack: () => void }) {
  return (
    <View style={styles.publicPage}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.publicBackButton}>
        <Text style={styles.publicBackText}>Back to Luo101</Text>
      </Pressable>
      <View style={styles.publicHero}>
        <Text style={styles.kickerOnDark}>{page.eyebrow}</Text>
        <Text style={styles.publicTitle}>{page.title}</Text>
        <Text style={styles.publicIntro}>{page.intro}</Text>
      </View>
      <View style={styles.publicSectionList}>
        {page.sections.map((section) => (
          <View key={section.heading} style={styles.publicSectionCard}>
            <Text style={styles.publicSectionTitle}>{section.heading}</Text>
            <Text style={styles.publicSectionText}>{section.body}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.publicFinePrint}>Last updated: July 14, 2026. These pages are practical learner-facing policies and should continue to be reviewed as Luo101 grows.</Text>
    </View>
  );
}

function PublicLinksMenu({
  activePageId,
  isOpen,
  onOpenPage,
  onToggle,
}: {
  activePageId: PublicPageId | null;
  isOpen: boolean;
  onOpenPage: (pageId: PublicPageId) => void;
  onToggle: () => void;
}) {
  const pages = Object.values(PUBLIC_PAGES);

  return (
    <View style={styles.publicMenuCard}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.publicMenuHeader}>
        <View>
          <Text style={styles.cardLabel}>About & Legal</Text>
          <Text style={styles.publicMenuTitle}>Trust pages for Luo101</Text>
        </View>
        <Text style={styles.publicMenuToggle}>{isOpen ? 'Close' : 'Open'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.publicMenuGrid}>
          {pages.map((page) => (
            <Pressable
              accessibilityRole="button"
              key={page.id}
              onPress={() => onOpenPage(page.id)}
              style={[styles.publicMenuLink, activePageId === page.id && styles.publicMenuLinkActive]}
            >
              <Text style={[styles.publicMenuLinkText, activePageId === page.id && styles.publicMenuLinkTextActive]}>{page.eyebrow}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.navButton, active && styles.navButtonActive]} onPress={onPress}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#F7FAF6',
  },
  topBar: {
    backgroundColor: '#F7FAF6',
    borderBottomColor: '#DDE8D8',
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  topBarInner: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    maxWidth: 1180,
    paddingHorizontal: 24,
    width: '100%',
  },
  topBarInnerCompact: {
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 20,
    position: 'relative',
  },
  brandLockup: {
    flexShrink: 1,
    justifyContent: 'center',
    marginLeft: -22,
    minHeight: 62,
    overflow: 'hidden',
    width: 410,
  },
  brandLockupCompact: {
    marginLeft: -24,
    minHeight: 54,
    width: 240,
  },
  brandLogo: {
    height: 66,
    marginLeft: -140,
    maxWidth: 560,
    width: 460,
  },
  brandLogoCompact: {
    height: 54,
    marginLeft: -48,
    maxWidth: 300,
    width: 300,
  },
  brand: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '600',
  },
  brandSub: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  topBarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 10,
    zIndex: 3,
  },
  topBarActionsCompact: {
    position: 'absolute',
    right: 20,
    top: 6,
    zIndex: 3,
  },
  headerProgress: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerProgressCompact: {
    display: 'none',
  },
  headerProgressText: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerProgressDot: {
    color: '#C39A2E',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 14,
  },
  dictionaryShortcutButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'relative',
    width: 42,
    zIndex: 4,
  },
  dictionaryShortcutIcon: {
    color: '#0E6B4F',
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 28,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statValue: {
    color: '#0E6B4F',
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    color: '#6E7C75',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    alignSelf: 'center',
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 116,
    width: '100%',
  },
  learnPage: {
    gap: 12,
  },
  hero: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 20,
  },
  heroCompact: {
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
  },
  heroCopy: {
    flex: 1,
  },
  heroTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroToplineCompact: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  kicker: {
    color: '#C1562E',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  kickerOnDark: {
    color: '#F1C84B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroPill: {
    backgroundColor: '#F7FAF6',
    borderRadius: 8,
    color: '#0E6B4F',
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 40,
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },
  heroText: {
    color: '#D9F5E9',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 4,
  },
  heroTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroMission: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(241, 200, 75, 0.38)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#FFF6D3',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroMissionCompact: {
    fontSize: 13,
    lineHeight: 21,
    paddingHorizontal: 10,
  },
  heroGoal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 12,
    opacity: 0.9,
  },
  heroGoalCompact: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  progressTrack: {
    backgroundColor: '#0A503C',
    borderRadius: 8,
    height: 12,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#F1C84B',
    height: '100%',
  },
  heroProgressText: {
    color: '#D9F5E9',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  mascotMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F1C84B',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  mascotMarkCompact: {
    borderWidth: 2,
    height: 58,
    width: 58,
  },
  mascotTop: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  mascotBottom: {
    color: '#C1562E',
    fontSize: 28,
    fontWeight: '600',
  },
  learnGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  learnGridCompact: {
    gap: 8,
  },
  learnMetric: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 70,
    padding: 10,
  },
  learnMetricValue: {
    color: '#0E6B4F',
    fontSize: 24,
    fontWeight: '600',
  },
  learnMetricLabel: {
    color: '#6E7C75',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  unitPicker: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionHeaderTight: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleSmall: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  unitPickerScroll: {
    maxHeight: 356,
    paddingBottom: 4,
  },
  unitPickerScrollCompact: {
    maxHeight: 148,
    paddingBottom: 8,
  },
  unitPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unitPickerRail: {
    flexWrap: 'nowrap',
    paddingRight: 8,
  },
  unitPickerItem: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 156,
    padding: 12,
    width: '48%',
  },
  unitPickerItemCompact: {
    minHeight: 128,
    width: 172,
  },
  unitPickerItemActive: {
    backgroundColor: '#E4F2EE',
    borderColor: '#0E6B4F',
    borderWidth: 2,
  },
  unitPickerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  unitPickerLabel: {
    color: '#C1562E',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unitPickerLabelActive: {
    color: '#0E6B4F',
  },
  unitPickerStatus: {
    color: '#6E7C75',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unitPickerStatusComplete: {
    color: '#0E6B4F',
  },
  unitPickerTitle: {
    color: '#10251B',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
  unitPickerTrack: {
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  unitPickerFill: {
    backgroundColor: '#F1C84B',
    height: '100%',
  },
  unitPickerMeta: {
    color: '#5D6D65',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 7,
    textTransform: 'uppercase',
  },
  nextCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  nextCardCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    padding: 14,
  },
  nextCopy: {
    flex: 1,
  },
  nextTitle: {
    color: '#10251B',
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 24,
  },
  nextText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  phraseChip: {
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    maxWidth: 156,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  phraseChipCompact: {
    maxWidth: '100%',
    minHeight: 62,
  },
  phraseChipText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  phraseChipSub: {
    color: '#5F4320',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 3,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionHeaderCompact: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '600',
  },
  sectionTitleCompact: {
    fontSize: 19,
  },
  sectionMeta: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
  },
  path: {
    marginTop: 14,
  },
  pathItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: 12,
  },
  pathItemActive: {
    borderColor: '#C1562E',
    borderWidth: 2,
  },
  pathItemComplete: {
    backgroundColor: '#F4FBF7',
  },
  pathItemCompact: {
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
  },
  pathDot: {
    alignItems: 'center',
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pathDotCompact: {
    height: 42,
    width: 42,
  },
  pathDotComplete: {
    backgroundColor: '#0E6B4F',
  },
  pathDotActive: {
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderWidth: 2,
  },
  pathDotText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  pathCopy: {
    flex: 1,
  },
  pathTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  pathTitleRowCompact: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  pathTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  pathTitleCompact: {
    flexBasis: '100%',
  },
  pathState: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  pathStateActive: {
    color: '#C1562E',
  },
  pathStateComplete: {
    color: '#0E6B4F',
  },
  pathDetail: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 5,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#C1562E',
    borderRadius: 8,
    marginTop: 18,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: '#AEBAB3',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 12,
    minHeight: 46,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#C1562E',
    fontSize: 15,
    fontWeight: '600',
  },
  cultureCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  learnBottomGrid: {
    gap: 12,
  },
  learnBottomGridCompact: {
    gap: 8,
  },
  cardLabel: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cultureText: {
    color: '#40514A',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  dialoguePreviewLine: {
    borderLeftWidth: 4,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  dialoguePreviewLinePrimary: {
    backgroundColor: '#EFF8F2',
    borderLeftColor: '#0E6B4F',
  },
  dialoguePreviewLineSecondary: {
    backgroundColor: '#FFF7DF',
    borderLeftColor: '#C39A2E',
  },
  dialoguePreviewSpeaker: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dialoguePreviewSpeakerPrimary: {
    color: '#0E6B4F',
  },
  dialoguePreviewSpeakerSecondary: {
    color: '#9A6A12',
  },
  dialoguePreviewText: {
    color: '#10251B',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 2,
  },
  lessonHero: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    padding: 20,
  },
  lessonHeroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
  },
  lessonHeroText: {
    color: '#D9F5E9',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 8,
  },
  teachSteps: {
    gap: 12,
    marginTop: 14,
  },
  teachCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  teachNumber: {
    alignItems: 'center',
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  teachNumberText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  teachCopy: {
    flex: 1,
  },
  teachFocus: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
  },
  teachTranslation: {
    color: '#0E6B4F',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  teachDetail: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 8,
  },
  exampleStrip: {
    backgroundColor: '#F7FAF6',
    borderLeftColor: '#0E6B4F',
    borderLeftWidth: 4,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exampleText: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  patternCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  patternRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  patternStep: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  patternArrow: {
    color: '#C1562E',
    fontSize: 18,
    fontWeight: '600',
    paddingTop: 4,
  },
  patternLine: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 14,
  },
  dictionarySearchCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  dictionaryInput: {
    backgroundColor: '#F7FAF6',
    borderColor: '#C9D8D0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#10251B',
    fontSize: 15,
    fontWeight: '400',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  dictionaryStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dictionaryStat: {
    backgroundColor: '#F7FAF6',
    borderColor: '#E4ECE7',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  dictionaryStatValue: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  dictionaryStatLabel: {
    color: '#5D6D65',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dictionaryFilterLabel: {
    color: '#10251B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  dictionaryLetters: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dictionaryLetter: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dictionaryLetterActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  dictionaryLetterText: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '600',
  },
  dictionaryLetterTextActive: {
    color: '#FFFFFF',
  },
  dictionaryCategories: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dictionaryCategoryChip: {
    alignItems: 'center',
    backgroundColor: '#FFF8E2',
    borderColor: '#EADCA8',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  dictionaryCategoryChipActive: {
    backgroundColor: '#C1562E',
    borderColor: '#C1562E',
  },
  dictionaryCategoryText: {
    color: '#6B4E16',
    fontSize: 12,
    fontWeight: '600',
  },
  dictionaryCategoryTextActive: {
    color: '#FFFFFF',
  },
  dictionaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dictionaryMeta: {
    color: '#5D6D65',
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  dictionaryClearButton: {
    alignItems: 'center',
    backgroundColor: '#10251B',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  dictionaryClearText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dictionaryNotice: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 12,
    padding: 14,
  },
  dictionaryNoticeTitle: {
    color: '#F1C84B',
    fontSize: 16,
    fontWeight: '600',
  },
  dictionaryNoticeText: {
    color: '#F7FAF6',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 5,
  },
  dictionaryResults: {
    gap: 10,
    marginTop: 12,
  },
  dictionaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  dictionaryCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dictionaryWord: {
    color: '#10251B',
    flex: 1,
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 27,
  },
  dictionaryCategory: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 160,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  dictionaryMeaning: {
    color: '#C1562E',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 5,
  },
  dictionaryNoteBlock: {
    borderTopColor: '#EEF3EF',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  dictionaryNoteLabel: {
    color: '#7A8A82',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dictionaryNote: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
  },
  dictionaryEmpty: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  dictionaryEmptyTitle: {
    color: '#10251B',
    fontSize: 20,
    fontWeight: '600',
  },
  dictionaryEmptyText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 5,
  },
  readingSection: {
    marginTop: 8,
  },
  readingCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E1DB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  readingTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readingCount: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  readingTitle: {
    color: '#10251B',
    fontSize: 25,
    fontWeight: '600',
    lineHeight: 31,
  },
  readingEnglishTitle: {
    color: '#C1562E',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  readingIntroduction: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 10,
  },
  readingLines: {
    borderTopColor: '#E4ECE7',
    borderTopWidth: 1,
    marginTop: 14,
  },
  readingLine: {
    alignItems: 'flex-start',
    borderBottomColor: '#E4ECE7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  readingLineNumber: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '600',
    paddingTop: 3,
    width: 18,
  },
  readingLineCopy: {
    flex: 1,
  },
  readingDholuo: {
    color: '#10251B',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  readingEnglish: {
    color: '#5D6D65',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 3,
  },
  readingRevealButton: {
    alignItems: 'center',
    borderColor: '#0E6B4F',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  readingRevealText: {
    color: '#0E6B4F',
    fontSize: 14,
    fontWeight: '600',
  },
  readingVocabulary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  readingWord: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  readingWordDholuo: {
    color: '#10251B',
    fontSize: 13,
    fontWeight: '600',
  },
  readingWordEnglish: {
    color: '#6E7C75',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  guidedDialogueCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  guidedDialogueLine: {
    borderTopColor: '#E8EFEA',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  reviewHero: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    padding: 20,
  },
  reviewGrid: {
    gap: 10,
    marginTop: 14,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  reviewPhrase: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  reviewTranslation: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 4,
  },
  reviewFooterCard: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 14,
    padding: 16,
  },
  reviewFooterTitle: {
    color: '#F1C84B',
    fontSize: 20,
    fontWeight: '600',
  },
  reviewFooterText: {
    color: '#F7FAF6',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 6,
  },
  completeCard: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 18,
    padding: 16,
  },
  completeTitle: {
    color: '#F1C84B',
    fontSize: 22,
    fontWeight: '600',
  },
  completeText: {
    color: '#F7FAF6',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 6,
  },
  completeStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  practiceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exerciseCount: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  prompt: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    marginBottom: 18,
  },
  optionGrid: {
    gap: 10,
  },
  option: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionSelected: {
    borderColor: '#0E6B4F',
  },
  optionCorrect: {
    backgroundColor: '#DFF6EA',
  },
  optionWrong: {
    backgroundColor: '#FBE4DA',
    borderColor: '#C1562E',
  },
  optionText: {
    color: '#10251B',
    fontSize: 17,
    fontWeight: '500',
  },
  answerTray: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  answerText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  tile: {
    backgroundColor: '#F1C84B',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  tileText: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  feedback: {
    borderRadius: 8,
    marginTop: 18,
    padding: 14,
  },
  feedbackGood: {
    backgroundColor: '#DFF6EA',
  },
  feedbackBad: {
    backgroundColor: '#FBE4DA',
  },
  feedbackTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  dialogue: {
    marginTop: 22,
  },
  dialogueLine: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  dialogueSpeaker: {
    color: '#C1562E',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dialogueText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  dialogueTranslation: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 2,
  },
  screenTitle: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    marginBottom: 16,
  },
  phrasebookPage: {
    gap: 16,
  },
  phrasebookHero: {
    alignItems: 'stretch',
    backgroundColor: '#10251B',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    padding: 22,
  },
  phrasebookHeroCompact: {
    flexDirection: 'column',
    padding: 18,
  },
  phrasebookHeroCopy: {
    flex: 1,
  },
  phrasebookTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 40,
    marginTop: 6,
  },
  phrasebookIntro: {
    color: '#D9F5E9',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 720,
  },
  phrasebookStats: {
    flexDirection: 'row',
    gap: 10,
  },
  phrasebookStatsCompact: {
    flexWrap: 'wrap',
  },
  phrasebookStat: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phrasebookStatValue: {
    color: '#0E6B4F',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  phrasebookStatLabel: {
    color: '#40514A',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  phrasebookSearchCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  phrasebookSearchHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  phrasebookSearchHeaderCompact: {
    flexDirection: 'column',
  },
  phrasebookSearchCopy: {
    flex: 1,
  },
  phrasebookSearchHint: {
    color: '#6E7C75',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 3,
  },
  phrasebookSearchCount: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  phrasebookSearchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  phrasebookInput: {
    backgroundColor: '#F7FAF6',
    borderColor: '#CFE0C9',
    borderRadius: 8,
    borderWidth: 1,
    color: '#10251B',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  phrasebookClearButton: {
    alignItems: 'center',
    backgroundColor: '#C1562E',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  phrasebookClearText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  phrasebookEmptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  phrasebookEmptyTitle: {
    color: '#10251B',
    fontSize: 20,
    fontWeight: '600',
  },
  phrasebookEmptyText: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'center',
  },
  phraseGrid: {
    gap: 14,
  },
  phraseGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },  phraseCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 194,
    padding: 18,
  },
  phraseCardWide: {
    flexBasis: '48.7%',
    flexGrow: 1,
  },
  phraseCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  phraseCategory: {
    color: '#C1562E',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  phraseUnitPill: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  phraseTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  phraseCopy: {
    flex: 1,
  },
  phrase: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '600',
  },
  translation: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 2,
  },
  audioButton: {
    alignItems: 'center',
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    minWidth: 92,
    paddingHorizontal: 12,
  },
  audioButtonReady: {
    backgroundColor: '#0E6B4F',
  },
  audioButtonPlaying: {
    backgroundColor: '#F1C84B',
  },
  audioButtonError: {
    backgroundColor: '#FBE4DA',
    borderColor: '#C1562E',
    borderWidth: 1,
  },
  audioText: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
  },
  audioTextReady: {
    color: '#FFFFFF',
  },
  audioTextPlaying: {
    color: '#10251B',
  },
  audioTextError: {
    color: '#C1562E',
  },
  usage: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 10,
  },
  signupPromptOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 37, 27, 0.54)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  signupPromptPanel: {
    backgroundColor: '#F7FAF6',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '92%',
    maxWidth: 560,
    padding: 14,
    width: '100%',
  },
  signupPromptPanelCompact: {
    maxHeight: '96%',
    padding: 10,
  },
  signupPromptHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 4,
  },
  signupPromptScroll: {
    maxHeight: '86%',
  },
  signupPromptCopy: {
    flex: 1,
  },
  signupPromptTitle: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
  },
  signupPromptClose: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  signupPromptCloseText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  profileSignupBackdrop: {
    alignItems: 'center',
    backgroundColor: '#E4F2EE',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 520,
    padding: 18,
  },
  profileSignupCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  profileSignupModal: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    maxWidth: 520,
    padding: 22,
    width: '100%',
  },
  profileSignupTitle: {
    color: '#10251B',
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 32,
  },
  profileSignupText: {
    color: '#40514A',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  profileAuthChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  profileFoldButton: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#CFE0C9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 15,
    width: 148,
  },
  profileFoldButtonActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  profileFoldButtonText: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileFoldButtonTextActive: {
    color: '#FFFFFF',
  },
  profileFoldButtonIcon: {
    color: '#C1562E',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  profileAuthPanel: {
    borderColor: '#DDE8D8',
    borderTopWidth: 1,
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
  },
  profileHeroCard: {
    backgroundColor: '#0E6B4F',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 20,
  },
  profileGreeting: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
  },
  profileHeroText: {
    color: '#D9F5E9',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 4,
  },
  profileAvatarLarge: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 2,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  profileAvatarTextLarge: {
    color: '#0E6B4F',
    fontSize: 32,
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  paymentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    width: '100%',
  },
  paymentHeaderCopy: {
    flex: 1,
  },
  paymentTitle: {
    color: '#10251B',
    fontSize: 20,
    fontWeight: '600',
  },
  paymentText: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
  },
  paymentStatusPill: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  paymentStatusPillActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  paymentStatusText: {
    color: '#6E7C75',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  paymentStatusTextActive: {
    color: '#FFFFFF',
  },
  paymentHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  paymentToggle: {
    color: '#0E6B4F',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  paymentCollapsedText: {
    color: '#6E7C75',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 12,
  },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  packageCard: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 220,
    padding: 14,
    width: '31%',
  },
  packageCardActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  packageTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  packageTitleActive: {
    color: '#FFFFFF',
  },
  packagePrice: {
    color: '#C1562E',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 6,
  },
  packagePriceActive: {
    color: '#F1C84B',
  },
  packageSummary: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 5,
  },
  packageSummaryActive: {
    color: '#D9F5E9',
  },
  packageUnlock: {
    color: '#5D6D65',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  packageUnlockActive: {
    color: '#FFFFFF',
  },
  paymentForm: {
    gap: 10,
    marginTop: 14,
  },
  paymentErrorText: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FDA29B',
    borderRadius: 8,
    borderWidth: 1,
    color: '#B42318',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  referralHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    width: '100%',
  },
  referralTitle: {
    color: '#10251B',
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 24,
  },
  referralText: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
  },
  referralBody: {
    gap: 12,
    marginTop: 14,
  },
  referralLinkBox: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  referralLinkLabel: {
    color: '#0E6B4F',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  referralLinkText: {
    color: '#10251B',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 4,
  },
  profileTrustCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  profileTrustHeader: {
    marginBottom: 12,
  },
  profileTrustTitle: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
  },
  profileTrustText: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 4,
  },
  profileTrustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileTrustLink: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileTrustLinkText: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '600',
  },  profileProgressCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    padding: 16,
  },
  profileProgressToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 54,
  },
  profileProgressTitle: {
    color: '#10251B',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
  },
  profileProgressToggleText: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  profileAccountCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    marginTop: 14,
    padding: 14,
  },
  profileAccountSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
  },
  profileCompactAvatar: {
    alignItems: 'center',
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profileAccountToggle: {
    color: '#0E6B4F',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileAccountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: '#0E6B4F',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  profileAccountCopy: {
    flex: 1,
  },
  profileAccountTitle: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  profileAccountSubtext: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 2,
  },
  profileAccountForm: {
    gap: 10,
  },
  profileModeSwitch: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    padding: 5,
  },
  profileModeButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  profileModeButtonActive: {
    backgroundColor: '#0E6B4F',
  },
  profileModeText: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileModeTextActive: {
    color: '#FFFFFF',
  },
  profileInput: {
    backgroundColor: '#F7FAF6',
    borderColor: '#CFE0C9',
    borderRadius: 8,
    borderWidth: 1,
    color: '#10251B',
    fontSize: 15,
    fontWeight: '500',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  profileActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profilePrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  profileButtonDisabled: {
    backgroundColor: '#AEBAB3',
  },
  profilePrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F1C84B',
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  profileSecondaryButtonText: {
    color: '#10251B',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileGhostButton: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  profileGhostButtonText: {
    color: '#C1562E',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileSyncText: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  profileSignOutRow: {
    alignItems: 'center',
    borderTopColor: '#DDE8D8',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 20,
    paddingBottom: 18,
    paddingTop: 18,
  },
  profileSignOutText: {
    color: '#6E7C75',
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 92,
    padding: 14,
    width: '47%',
  },
  metricValue: {
    color: '#0E6B4F',
    fontSize: 22,
    fontWeight: '600',
  },
  metricLabel: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  progressList: {
    gap: 12,
    marginTop: 14,
  },
  progressUnitCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  progressUnitCardActive: {
    borderColor: '#0E6B4F',
    borderWidth: 2,
  },
  progressUnitHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressUnitCopy: {
    flex: 1,
  },
  progressUnitTitle: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  progressUnitSubtitle: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 3,
  },
  jumpButton: {
    alignItems: 'center',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  jumpButtonActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  jumpButtonText: {
    color: '#C1562E',
    fontSize: 13,
    fontWeight: '600',
  },
  jumpButtonTextActive: {
    color: '#FFFFFF',
  },
  progressUnitTrack: {
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 10,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressUnitFill: {
    backgroundColor: '#0E6B4F',
    height: '100%',
  },
  progressUnitStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  progressUnitStat: {
    backgroundColor: '#F7FAF6',
    borderRadius: 8,
    color: '#40514A',
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  publicPage: {
    gap: 14,
  },
  publicBackButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  publicBackText: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '600',
  },
  publicHero: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    padding: 22,
  },
  publicTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
    marginTop: 8,
  },
  publicIntro: {
    color: '#D9F5E9',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 23,
    marginTop: 8,
  },
  publicSectionList: {
    gap: 10,
  },
  publicSectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  publicSectionTitle: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  publicSectionText: {
    color: '#40514A',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  publicFinePrint: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  publicMenuCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  publicMenuHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  publicMenuTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '600',
  },
  publicMenuToggle: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  publicMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  publicMenuLink: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  publicMenuLinkActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  publicMenuLinkText: {
    color: '#40514A',
    fontSize: 12,
    fontWeight: '600',
  },
  publicMenuLinkTextActive: {
    color: '#FFFFFF',
  },  nav: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopColor: '#DDE8D8',
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
  },
  navButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexBasis: 0,
    flexGrow: 1,
    maxWidth: 220,
    minHeight: 48,
    justifyContent: 'center',
  },
  navButtonActive: {
    backgroundColor: '#0E6B4F',
  },
  navText: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '600',
  },
  navTextActive: {
    color: '#FFFFFF',
  },
});
