import './style.css';
import { createI18n } from './i18n.js';
import { createLayout } from './layout.js';
import { createQuoteEngine } from './quote-engine.js';
import { createChallengerForm } from './challenger-form.js';

let storage;
try { storage = window.localStorage; } catch { /* Language switching works without storage. */ }
const i18n = createI18n(storage);
document.querySelector('#app').innerHTML = createLayout(i18n);
const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
let rotationIndex = 0;
let challengerForm;
const quotes = createQuoteEngine(i18n, () => motionPaused);

function motionLabel() {
  const button = $('#motion-toggle');
  const label = i18n.t(motionPaused ? 'a11y.resume' : 'a11y.pause');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(motionPaused));
  button.firstElementChild.textContent = motionPaused ? '▷' : 'Ⅱ';
}
function refreshLanguage() {
  document.documentElement.lang = i18n.language === 'sr' ? 'sr-Latn' : 'en';
  document.title = i18n.t('meta.title');
  $('meta[name="description"]').content = i18n.t('meta.description');
  $('meta[property="og:title"]').content = i18n.t('meta.title');
  $('meta[property="og:description"]').content = i18n.t('meta.description');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = i18n.t(element.dataset.i18n); });
  for (const attribute of ['placeholder', 'aria-label']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => element.setAttribute(attribute, i18n.t(element.getAttribute(`data-i18n-${attribute}`))));
  }
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === i18n.language)));
  document.querySelectorAll('[data-count]').forEach(element => { element.textContent = i18n.format(Number(element.dataset.current || 0), Number(element.dataset.decimals)); });
  document.querySelectorAll('[data-number]').forEach(element => { element.textContent = i18n.format(Number(element.dataset.number)); });
  $('#rotating-subtitle').textContent = i18n.t(`hero.rotations.${rotationIndex}`);
  motionLabel();
  quotes.refresh();
  challengerForm?.refresh();
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { i18n.setLanguage(button.dataset.language); refreshLanguage(); }));
function setMotion(paused) {
  motionPaused = paused;
  document.documentElement.classList.toggle('motion-paused', paused);
  motionLabel();
}
$('#motion-toggle').addEventListener('click', () => setMotion(!motionPaused));
reducedMotion.addEventListener('change', event => setMotion(event.matches));
setMotion(motionPaused);
refreshLanguage();

challengerForm = createChallengerForm({ i18n, storage, isMotionPaused: () => motionPaused, onAnnounce: () => quotes.show('signup') });
document.querySelectorAll('.challenge-cta').forEach(link => link.addEventListener('click', challengerForm.announce));
document.querySelectorAll('[data-quote-trigger]').forEach(element => element.addEventListener('click', () => quotes.show(element.dataset.quoteTrigger)));
document.querySelectorAll('[data-faq-id]').forEach(details => details.addEventListener('toggle', () => { if (details.open) quotes.show('faq'); }));

function countUp(element) {
  const end = Number(element.dataset.count);
  const decimals = Number(element.dataset.decimals);
  const start = performance.now();
  function frame(now) {
    const progress = motionPaused ? 1 : Math.min((now - start) / 1600, 1);
    const current = end * (1 - (1 - progress) ** 3);
    element.dataset.current = String(current);
    element.textContent = i18n.format(current, decimals);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { countUp(entry.target); observer.unobserve(entry.target); }
}, { threshold: .3 });
document.querySelectorAll('[data-count]').forEach(element => observer.observe(element));
for (let i = 0; i < 24; i++) {
  const dot = document.createElement('i');
  dot.className = 'particle';
  dot.style.left = `${Math.random() * 100}%`;
  dot.style.top = `${Math.random() * 100}%`;
  dot.style.animationDelay = `${-Math.random() * 12}s`;
  $('#particles').append(dot);
}
setInterval(() => {
  if (document.hidden || motionPaused) return;
  rotationIndex = (rotationIndex + 1) % i18n.t('hero.rotations').length;
  $('#rotating-subtitle').textContent = i18n.t(`hero.rotations.${rotationIndex}`);
}, 6000);
document.querySelectorAll('a[href="#terms"], a[href="#privacy"], a[href="#contact"]').forEach(link => link.addEventListener('click', () => { $(link.getAttribute('href')).open = true; }));
if (['#privacy', '#terms', '#contact'].includes(location.hash)) $(location.hash).open = true;
