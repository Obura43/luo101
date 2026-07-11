declare const require: (path: string) => number;

export type AudioManifestItem = {
  source: number;
  file: string;
  label: string;
};

export const audioManifest: Record<string, AudioManifestItem> = {
  "number-43": { source: require("../../assets/audio/piero ang'wen gadek.ogg"), file: "assets/audio/piero ang'wen gadek.ogg", label: "piero ang'wen ga adek" },
  "number-23": { source: require("../../assets/audio/piero ariyo gadek.ogg"), file: "assets/audio/piero ariyo gadek.ogg", label: "piero ariyo ga adek" },
  "number-13": { source: require("../../assets/audio/apar gadek.ogg"), file: "assets/audio/apar gadek.ogg", label: "apar ga adek" },
  "nyingi-nga": { source: require("../../assets/audio/nyingi ng'a.ogg"), file: "assets/audio/nyingi ng'a.ogg", label: "Nyingi ng'a?" },
  "nango": { source: require("../../assets/audio/nango.ogg"), file: "assets/audio/nango.ogg", label: "Nang'o?" },
  "adhi-maber": { source: require("../../assets/audio/adhi maber.ogg"), file: "assets/audio/adhi maber.ogg", label: "Adhi maber." },
  "an-bende-adhi-maber": { source: require("../../assets/audio/an bende adhi maber.ogg"), file: "assets/audio/an bende adhi maber.ogg", label: "An bende adhi maber." },
  "ber-ahinya": { source: require("../../assets/audio/ber ahinya.ogg"), file: "assets/audio/ber ahinya.ogg", label: "Ber ahinya." },
  "erokamano": { source: require("../../assets/audio/erokamano.ogg"), file: "assets/audio/erokamano.ogg", label: "Erokamano." },
  "in-to": { source: require("../../assets/audio/in to.ogg"), file: "assets/audio/in to.ogg", label: "In to?" },
  "number-1": { source: require("../../assets/audio/achiel.ogg"), file: "assets/audio/achiel.ogg", label: "achiel" },
  "number-10": { source: require("../../assets/audio/apar.ogg"), file: "assets/audio/apar.ogg", label: "apar" },
  "number-11": { source: require("../../assets/audio/apar gachiel.ogg"), file: "assets/audio/apar gachiel.ogg", label: "apar gachiel" },
  "number-12": { source: require("../../assets/audio/apar gariyo.ogg"), file: "assets/audio/apar gariyo.ogg", label: "apar gariyo" },
  "number-14": { source: require("../../assets/audio/apar ga ang'wen.ogg"), file: "assets/audio/apar ga ang'wen.ogg", label: "apar ga ang'wen" },
  "number-15": { source: require("../../assets/audio/apar ga abich.ogg"), file: "assets/audio/apar ga abich.ogg", label: "apar ga abich" },
  "number-16": { source: require("../../assets/audio/apar ga auchiel.ogg"), file: "assets/audio/apar ga auchiel.ogg", label: "apar ga auchiel" },
  "number-17": { source: require("../../assets/audio/apar ga abiriyo.ogg"), file: "assets/audio/apar ga abiriyo.ogg", label: "apar ga abiriyo" },
  "number-18": { source: require("../../assets/audio/apar ga aboro.ogg"), file: "assets/audio/apar ga aboro.ogg", label: "apar ga aboro" },
  "number-19": { source: require("../../assets/audio/apar ga ochiko.ogg"), file: "assets/audio/apar ga ochiko.ogg", label: "apar ga ochiko" },
  "number-2": { source: require("../../assets/audio/ariyo.ogg"), file: "assets/audio/ariyo.ogg", label: "ariyo" },
  "number-20": { source: require("../../assets/audio/piero ariyo.ogg"), file: "assets/audio/piero ariyo.ogg", label: "piero ariyo" },
  "number-21": { source: require("../../assets/audio/piero ariyo gachiel.ogg"), file: "assets/audio/piero ariyo gachiel.ogg", label: "piero ariyo gachiel" },
  "number-22": { source: require("../../assets/audio/piero ariyo gariyo.ogg"), file: "assets/audio/piero ariyo gariyo.ogg", label: "piero ariyo gariyo" },
  "number-24": { source: require("../../assets/audio/piero ariyo ga ang'wen.ogg"), file: "assets/audio/piero ariyo ga ang'wen.ogg", label: "piero ariyo ga ang'wen" },
  "number-25": { source: require("../../assets/audio/piero ariyo ga abich.ogg"), file: "assets/audio/piero ariyo ga abich.ogg", label: "piero ariyo ga abich" },
  "number-26": { source: require("../../assets/audio/piero ariyo ga auchiel.ogg"), file: "assets/audio/piero ariyo ga auchiel.ogg", label: "piero ariyo ga auchiel" },
  "number-27": { source: require("../../assets/audio/piero ariyo ga abiriyo.ogg"), file: "assets/audio/piero ariyo ga abiriyo.ogg", label: "piero ariyo ga abiriyo" },
  "number-28": { source: require("../../assets/audio/piero ariyo ga aboro.ogg"), file: "assets/audio/piero ariyo ga aboro.ogg", label: "piero ariyo ga aboro" },
  "number-29": { source: require("../../assets/audio/piero ariyo ga ochiko.ogg"), file: "assets/audio/piero ariyo ga ochiko.ogg", label: "piero ariyo ga ochiko" },
  "number-3": { source: require("../../assets/audio/adek.ogg"), file: "assets/audio/adek.ogg", label: "adek" },
  "number-30": { source: require("../../assets/audio/piero adek.ogg"), file: "assets/audio/piero adek.ogg", label: "piero adek" },
  "number-31": { source: require("../../assets/audio/piero adek gachiel.ogg"), file: "assets/audio/piero adek gachiel.ogg", label: "piero adek gachiel" },
  "number-32": { source: require("../../assets/audio/piero adek gariyo.ogg"), file: "assets/audio/piero adek gariyo.ogg", label: "piero adek gariyo" },
  "number-33": { source: require("../../assets/audio/piero adek ga adek.ogg"), file: "assets/audio/piero adek ga adek.ogg", label: "piero adek ga adek" },
  "number-34": { source: require("../../assets/audio/piero adek ga ang'wen.ogg"), file: "assets/audio/piero adek ga ang'wen.ogg", label: "piero adek ga ang'wen" },
  "number-35": { source: require("../../assets/audio/piero adek ga abich.ogg"), file: "assets/audio/piero adek ga abich.ogg", label: "piero adek ga abich" },
  "number-36": { source: require("../../assets/audio/piero adek ga auchiel.ogg"), file: "assets/audio/piero adek ga auchiel.ogg", label: "piero adek ga auchiel" },
  "number-37": { source: require("../../assets/audio/piero adek ga abiriyo.ogg"), file: "assets/audio/piero adek ga abiriyo.ogg", label: "piero adek ga abiriyo" },
  "number-38": { source: require("../../assets/audio/piero adek ga aboro.ogg"), file: "assets/audio/piero adek ga aboro.ogg", label: "piero adek ga aboro" },
  "number-39": { source: require("../../assets/audio/piero adek ga ochiko.ogg"), file: "assets/audio/piero adek ga ochiko.ogg", label: "piero adek ga ochiko" },
  "number-4": { source: require("../../assets/audio/ang'wen.ogg"), file: "assets/audio/ang'wen.ogg", label: "ang'wen" },
  "number-40": { source: require("../../assets/audio/piero ang'wen.ogg"), file: "assets/audio/piero ang'wen.ogg", label: "piero ang'wen" },
  "number-41": { source: require("../../assets/audio/piero ang'wen gachiel.ogg"), file: "assets/audio/piero ang'wen gachiel.ogg", label: "piero ang'wen gachiel" },
  "number-42": { source: require("../../assets/audio/piero ang'wen gariyo.ogg"), file: "assets/audio/piero ang'wen gariyo.ogg", label: "piero ang'wen gariyo" },
  "number-44": { source: require("../../assets/audio/piero ang'wen ga ang'wen.ogg"), file: "assets/audio/piero ang'wen ga ang'wen.ogg", label: "piero ang'wen ga ang'wen" },
  "number-45": { source: require("../../assets/audio/piero ang'wen ga abich.ogg"), file: "assets/audio/piero ang'wen ga abich.ogg", label: "piero ang'wen ga abich" },
  "number-46": { source: require("../../assets/audio/piero ang'wen ga auchiel.ogg"), file: "assets/audio/piero ang'wen ga auchiel.ogg", label: "piero ang'wen ga auchiel" },
  "number-47": { source: require("../../assets/audio/piero ang'wen ga abiriyo.ogg"), file: "assets/audio/piero ang'wen ga abiriyo.ogg", label: "piero ang'wen ga abiriyo" },
  "number-48": { source: require("../../assets/audio/piero ang'wen ga aboro.ogg"), file: "assets/audio/piero ang'wen ga aboro.ogg", label: "piero ang'wen ga aboro" },
  "number-49": { source: require("../../assets/audio/piero ang'wen ga ochiko.ogg"), file: "assets/audio/piero ang'wen ga ochiko.ogg", label: "piero ang'wen ga ochiko" },
  "number-5": { source: require("../../assets/audio/abich.ogg"), file: "assets/audio/abich.ogg", label: "abich" },
  "number-50": { source: require("../../assets/audio/piero abich.ogg"), file: "assets/audio/piero abich.ogg", label: "piero abich" },
  "number-51": { source: require("../../assets/audio/piero abich gachiel.ogg"), file: "assets/audio/piero abich gachiel.ogg", label: "piero abich gachiel" },
  "number-52": { source: require("../../assets/audio/piero abich gariyo.ogg"), file: "assets/audio/piero abich gariyo.ogg", label: "piero abich gariyo" },
  "number-53": { source: require("../../assets/audio/piero abich ga adek.ogg"), file: "assets/audio/piero abich ga adek.ogg", label: "piero abich ga adek" },
  "number-54": { source: require("../../assets/audio/piero abich ga ang'wen.ogg"), file: "assets/audio/piero abich ga ang'wen.ogg", label: "piero abich ga ang'wen" },
  "number-55": { source: require("../../assets/audio/piero abich ga abich.ogg"), file: "assets/audio/piero abich ga abich.ogg", label: "piero abich ga abich" },
  "number-56": { source: require("../../assets/audio/piero abich ga auchiel.ogg"), file: "assets/audio/piero abich ga auchiel.ogg", label: "piero abich ga auchiel" },
  "number-57": { source: require("../../assets/audio/piero abich ga abiriyo.ogg"), file: "assets/audio/piero abich ga abiriyo.ogg", label: "piero abich ga abiriyo" },
  "number-58": { source: require("../../assets/audio/piero abich ga aboro.ogg"), file: "assets/audio/piero abich ga aboro.ogg", label: "piero abich ga aboro" },
  "number-59": { source: require("../../assets/audio/piero abich ga ochiko.ogg"), file: "assets/audio/piero abich ga ochiko.ogg", label: "piero abich ga ochiko" },
  "number-6": { source: require("../../assets/audio/auchiel.ogg"), file: "assets/audio/auchiel.ogg", label: "auchiel" },
  "number-60": { source: require("../../assets/audio/piero auchiel.ogg"), file: "assets/audio/piero auchiel.ogg", label: "piero auchiel" },
  "number-7": { source: require("../../assets/audio/abiriyo.ogg"), file: "assets/audio/abiriyo.ogg", label: "abiriyo" },
  "number-8": { source: require("../../assets/audio/aboro.ogg"), file: "assets/audio/aboro.ogg", label: "aboro" },
  "number-9": { source: require("../../assets/audio/ochiko.ogg"), file: "assets/audio/ochiko.ogg", label: "ochiko" },
  "nyinga-achieng": { source: require("../../assets/audio/Nyinga Achieng'.ogg"), file: "assets/audio/Nyinga Achieng'.ogg", label: "Nyinga Achieng." },
  "oriti": { source: require("../../assets/audio/oriti.ogg"), file: "assets/audio/oriti.ogg", label: "Oriti." },
  "oyawore": { source: require("../../assets/audio/oyawore.ogg"), file: "assets/audio/oyawore.ogg", label: "Oyawore." },
  "quantity-seven": { source: require("../../assets/audio/abiriyo.ogg"), file: "assets/audio/abiriyo.ogg", label: "Abiriyo." },
  "quantity-three": { source: require("../../assets/audio/adek.ogg"), file: "assets/audio/adek.ogg", label: "Adek." },
  "unit11-in-to": { source: require("../../assets/audio/in to.ogg"), file: "assets/audio/in to.ogg", label: "In to?" },
  "unit8-adhi-maber": { source: require("../../assets/audio/adhi maber.ogg"), file: "assets/audio/adhi maber.ogg", label: "Adhi maber." },
};

export function getAudioForKey(audioKey: string) {
  return audioManifest[audioKey] ?? null;
}

export function hasAudioForKey(audioKey: string) {
  return getAudioForKey(audioKey) !== null;
}

