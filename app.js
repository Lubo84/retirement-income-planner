'use strict';

const percentages = [50, 60, 70, 80, 90, 100];
const boostPresets = [0, 10, 20, 30, 50];
const periods = {
  year: { label: 'Yearly', divisor: 1 },
  month: { label: 'Monthly', divisor: 12 },
  week: { label: 'Weekly', divisor: 52 }
};
const standards = {
  modest: { label: 'Modest', single: 36548, couple: 52690 },
  renters: { label: 'Modest · renting', single: 51418, couple: 69376 },
  comfortable: { label: 'Comfortable', single: 56166, couple: 78998 }
};
const incomeEntries = { gross: '100,000', net: '' };
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
});
const amountFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const byId = (id) => document.getElementById(id);
const checked = (name) => document.querySelector('input[name="' + name + '"]:checked').value;
const formatTarget = (annual, period) => annual === null ? '—' : money.format(annual / periods[period].divisor);

let showingExample = true;
let incomeKind = 'gross';

function estimateTakeHome(salary) {
  const taxBrackets = [
    [18200, 45000, 0.15],
    [45000, 135000, 0.30],
    [135000, 190000, 0.37],
    [190000, Infinity, 0.45]
  ];
  const incomeTax = taxBrackets.reduce((tax, [from, to, rate]) => {
    return tax + Math.max(0, Math.min(salary, to) - from) * rate;
  }, 0);
  const lowIncomeOffset = Math.max(0, 700
    - Math.max(0, Math.min(salary, 45000) - 37500) * 0.05
    - Math.max(0, salary - 45000) * 0.015);
  const medicare = Math.min(salary * 0.02, Math.max(0, salary - 28011) * 0.10);
  return salary - Math.max(0, incomeTax - lowIncomeOffset) - medicare;
}

function parseIncome(text) {
  const cleaned = text.trim().replace(/^\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned.replaceAll(',', ''));
  return amount <= 10000000 ? amount : null;
}

function radioRow(name, value, label, selected) {
  return '<label><input type="radio" name="' + name + '" value="' + value + '"' + (selected ? ' checked' : '') + '>'
    + '<span class="row"><span class="row-main"><i class="indicator" aria-hidden="true"></i>'
    + label + '</span><strong></strong></span></label>';
}

function addPeriodSwitch(panel) {
  const group = byId(panel + '-period');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Display amounts');
  group.innerHTML = Object.entries(periods).map(([period, { label }]) =>
    '<label><input type="radio" name="' + panel + '-period" value="' + period + '"' + (period === 'year' ? ' checked' : '') + '><span>' + label + '</span></label>'
  ).join('');
}

function showTarget(id, annual, period) {
  const target = byId(id);
  target.replaceChildren(formatTarget(annual, period));
  if (annual !== null) {
    const unit = document.createElement('small');
    unit.textContent = 'per ' + period;
    target.append(unit);
  }
}

function renderIncome() {
  const field = byId('income');
  const amount = parseIncome(field.value);
  const gross = incomeKind === 'gross';
  const error = amount === null && field.value.trim() !== '';
  const period = checked('income-period');
  const percent = Number(checked('share'));
  const net = amount === null || !gross ? amount : estimateTakeHome(amount);
  const isExample = gross && showingExample;
  byId('amount-label').textContent = gross ? 'Annual salary' : 'Annual take-home pay';
  byId('income-hint').textContent = gross
    ? (isExample ? 'Example salary. Enter your own salary before tax, excluding employer super.' : 'Enter your salary before tax, excluding employer super.')
    : 'Enter annual pay after tax. For a household target, you can enter combined take-home pay.';
  byId('tax-details').hidden = !gross;
  byId('income-error').hidden = !error;
  byId('income-error').textContent = error ? 'Enter an amount from $0 to $10,000,000.' : '';
  field.setAttribute('aria-invalid', String(error));
  byId('net-box').hidden = net === null;
  byId('net-label').textContent = gross ? 'Estimated take-home pay' : 'Current take-home pay';
  byId('net-value').textContent = net === null ? '' : money.format(net) + ' a year';
  showTarget('income-target', net === null ? null : net * percent / 100, period);
  byId('income-description').textContent = net === null
    ? 'Enter your income to see your targets.'
    : percent + '% of ' + (isExample ? 'the example' : 'your current') + ' take-home pay';
  byId('income-rows').querySelectorAll('strong').forEach((cell, index) => {
    cell.textContent = formatTarget(net === null ? null : net * percentages[index] / 100, period);
  });
}

function renderAsfa() {
  const household = checked('household');
  const standard = standards[checked('standard')];
  const period = checked('asfa-period');
  const field = byId('boost');
  const boost = field.valueAsNumber;
  const invalid = !Number.isFinite(boost) || boost < 0 || boost > 500;
  const base = standard[household];
  const extra = invalid ? null : base * boost / 100;
  byId('standards-list').querySelectorAll('strong').forEach((cell, index) => {
    cell.textContent = formatTarget(Object.values(standards)[index][household], period);
  });
  byId('boost-error').hidden = !invalid;
  field.setAttribute('aria-invalid', String(invalid));
  byId('boost-presets').querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(!invalid && Number(button.dataset.boost) === boost));
  });
  byId('base-value').textContent = formatTarget(base, period);
  byId('extra-value').textContent = formatTarget(extra, period);
  showTarget('asfa-target', invalid ? null : base + extra, period);
  const description = standard.label + ' · ' + (household === 'single' ? 'Single' : 'Couple');
  byId('asfa-description').textContent = !invalid && boost > 0 ? description + ' · +' + boost + '%' : description;
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
function switchTab(active) {
  tabs.forEach((tab) => {
    const isActive = tab === active;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    byId(tab.getAttribute('aria-controls')).hidden = !isActive;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => switchTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + 1) % tabs.length];
    switchTab(next);
    next.focus();
  });
});

byId('income-rows').innerHTML = percentages.map((percent) => radioRow('share', percent, percent + '%', percent === 70)).join('');
byId('standards-list').innerHTML = Object.entries(standards).map(([key, standard]) =>
  radioRow('standard', key, standard.label, key === 'comfortable')
).join('');
byId('boost-presets').innerHTML = boostPresets.map((boost) =>
  '<button type="button" data-boost="' + boost + '">' + (boost ? '+' + boost + '%' : 'No boost') + '</button>'
).join('');

addPeriodSwitch('income');
addPeriodSwitch('asfa');
byId('income-panel').addEventListener('change', (event) => {
  if (event.target.name === 'income-kind') {
    incomeEntries[incomeKind] = byId('income').value;
    incomeKind = checked('income-kind');
    byId('income').value = incomeEntries[incomeKind];
  }
  renderIncome();
});
byId('income').addEventListener('input', () => {
  if (incomeKind === 'gross') showingExample = false;
  renderIncome();
});
byId('income').addEventListener('blur', ({ target }) => {
  const amount = parseIncome(target.value);
  if (amount !== null) target.value = amountFormat.format(amount);
});
byId('asfa-panel').addEventListener('change', renderAsfa);
byId('boost').addEventListener('input', renderAsfa);
byId('boost-presets').addEventListener('click', (event) => {
  if (event.target.dataset.boost === undefined) return;
  byId('boost').value = event.target.dataset.boost;
  renderAsfa();
});

renderIncome();
renderAsfa();
