export const blocked = ['exe','bat','sh','msi','dmg','dll','so','zip','rar','tar','gz','7z','js','mjs','cjs','ts','tsx','py','php','pl','rb','rs','go','java','c','cpp','cs','html','htm','css','svg','png','jpg','jpeg','gif','webp','bmp','ico','tiff','psd','ai','sketch','ps1','cmd','com','scr','vbs','jar','apk','ipa'];
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const allowedSubjects = ["Booking / Performance", "Collaboration", "Brand / Commercial", "Press / Media", "General Enquiries"];
export const containsHarmful = (s) => {
  if (!s) return false;
  if (/<\s*(script|iframe|object|embed|form|img|svg|link|style|meta|base)\b/i.test(s)) return true;
  if (/javascript\s*:/i.test(s) || /data\s*:\s*text\/html/i.test(s) || /vbscript\s*:/i.test(s)) return true;
  if (/on\w+\s*=\s*["']?[^"'\s>]+/i.test(s)) return true;
  if (/```|<\s*code\b/i.test(s)) return true;
  const re = new RegExp(`(?:https?:\\/\\/|www\\.)[^\\s]+\\.(${blocked.join('|')})(?:[?#][^\\s]*)?\\b`, 'i');
  return re.test(s);
};
