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
  comfortable: { label: 'Comfortable', single: 56166, couple: 78998 }
};
const people = ['subject', 'partner'];
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
});
const amountFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const byId = id => document.getElementById(id);
const checked = name => document.querySelector('input[name="' + name + '"]:checked').value;
const formatTarget = (annual, period) => annual === null ? '—' : money.format(annual / periods[period].divisor);
const targetButtons = [...document.querySelectorAll('[data-target]')];
const candidates = {};
let selectedSource = null;

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

function activePeople() {
  return checked('household') === 'couple' ? people : people.slice(0, 1);
}

function amountWithScope(amount) {
  return money.format(amount) + ' a year' + (activePeople().length === 2 ? ' combined' : '');
}

function renderSelection() {
  const selected = candidates[selectedSource];
  byId('selected-amount').textContent = selected ? amountWithScope(selected.amount) : '';
  byId('selected-description').textContent = selected?.description || 'Choose an amount from either option above.';
  byId('check').disabled = !selected;
  for (const button of targetButtons) {
    const source = button.dataset.target;
    button.disabled = !candidates[source];
    button.textContent = selected && source === selectedSource
      ? 'Target selected'
      : source === 'income' ? 'Use this income target' : 'Use this ASFA target';
    button.setAttribute('aria-pressed', String(Boolean(selected && source === selectedSource)));
  }
}

const incomeEntries = Object.fromEntries(people.map(person => [person, { gross: '', net: '' }]));
const incomeKinds = Object.fromEntries(people.map(person => [person, 'gross']));

function addIncomeFields(person) {
  const title = person === 'subject' ? 'Your pay' : 'Your partner’s pay';
  byId('income-fields').insertAdjacentHTML('beforeend', `
    <fieldset id="${person}-income-fields">
      <legend>${title}</legend>
      <div class="segmented">
        <label><input name="${person}-kind" type="radio" value="gross" checked><span>Before tax</span></label>
        <label><input name="${person}-kind" type="radio" value="net"><span>After tax</span></label>
      </div>
      <label for="${person}-income" class="label pay-label" id="${person}-income-label"></label>
      <div class="amount"><span aria-hidden="true">$</span><input id="${person}-income" type="text" inputmode="decimal" maxlength="14" aria-describedby="${person}-income-hint ${person}-income-error"><span class="suffix">per year</span></div>
      <p class="hint" id="${person}-income-hint"></p>
      <p class="error" id="${person}-income-error" role="status" hidden>Enter an amount from $0 to $10,000,000.</p>
    </fieldset>
  `);
  const input = byId(person + '-income');
  input.addEventListener('input', renderIncome);
  input.addEventListener('blur', () => {
    const amount = parseIncome(input.value);
    if (amount !== null) input.value = amountFormat.format(amount);
  });
  byId(person + '-income-fields').addEventListener('change', event => {
    if (event.target.name !== person + '-kind') return;
    incomeEntries[person][incomeKinds[person]] = input.value;
    incomeKinds[person] = checked(person + '-kind');
    input.value = incomeEntries[person][incomeKinds[person]];
  });
}

function renderIncome() {
  const netAmounts = activePeople().map(person => {
    const input = byId(person + '-income');
    const amount = parseIncome(input.value);
    const gross = incomeKinds[person] === 'gross';
    const invalid = amount === null && input.value.trim() !== '';
    input.setAttribute('aria-invalid', String(invalid));
    byId(person + '-income-error').hidden = !invalid;
    byId(person + '-income-label').textContent = gross ? 'Annual salary' : 'Annual take-home pay';
    byId(person + '-income-hint').textContent = gross
      ? 'Before tax, excluding employer super. Enter $0 if there’s no pay.'
      : 'Use a full year’s pay after tax. Enter $0 if there’s no pay.';
    return amount === null || !gross ? amount : estimateTakeHome(amount);
  });
  const net = netAmounts.includes(null) ? null : netAmounts.reduce((sum, amount) => sum + amount, 0);
  const takeHomeTotal = byId('take-home-total');
  const estimated = activePeople().some(person => incomeKinds[person] === 'gross');
  takeHomeTotal.hidden = net === null;
  takeHomeTotal.textContent = net === null ? '' :
    (estimated ? 'Estimated take-home pay · ' : 'Take-home pay · ') + amountWithScope(net);
  const period = checked('income-period');
  const percent = Number(checked('share'));
  const amount = Math.round(net * percent / 100);
  candidates.income = amount > 0 ? { amount, description: percent + '% of your take-home pay' } : null;
  byId('income-rows').querySelectorAll('strong').forEach((cell, index) => {
    cell.textContent = formatTarget(net === null ? null : net * percentages[index] / 100, period);
  });
  renderSelection();
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
  const amount = invalid ? null : Math.round(base + extra);

  Object.entries(standards).forEach(([key, values], index) => {
    byId(key + '-preview').textContent = money.format(values[household]);
    byId('standards-list').querySelectorAll('strong')[index].textContent = formatTarget(values[household], period);
  });
  byId('boost-error').hidden = !invalid;
  field.setAttribute('aria-invalid', String(invalid));
  byId('boost-presets').querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(!invalid && Number(button.dataset.boost) === boost));
  });
  byId('base-value').textContent = formatTarget(base, period);
  byId('extra-value').textContent = formatTarget(extra, period);
  byId('boosted-value').textContent = formatTarget(amount, period);
  candidates.asfa = invalid ? null : {
    amount,
    description: 'ASFA ' + standard.label.toLowerCase() + (boost ? ' + ' + boost + '%' : '')
  };
  renderSelection();
}

function showStep(step) {
  for (const id of ['welcome', 'explore', 'projection']) byId(id).hidden = id !== step;
  byId(step + '-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

byId('start').addEventListener('click', () => showStep('explore'));
byId('change').addEventListener('click', () => showStep('explore'));
document.querySelectorAll('[data-panel]').forEach(button => {
  button.addEventListener('click', () => {
    const panel = byId(button.dataset.panel);
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.querySelector('h2').focus();
  });
});
targetButtons.forEach(button => {
  button.addEventListener('click', () => {
    selectedSource = button.dataset.target;
    renderSelection();
    byId('selection-title').focus();
  });
});

byId('income-rows').innerHTML = percentages.map(percent => radioRow('share', percent, percent + '%', percent === 70)).join('');
byId('standards-list').innerHTML = Object.entries(standards).map(([key, standard]) =>
  radioRow('standard', key, standard.label, key === 'comfortable')
).join('');
byId('boost-presets').innerHTML = boostPresets.map(boost =>
  '<button type="button" data-boost="' + boost + '">' + (boost ? '+' + boost + '%' : 'No boost') + '</button>'
).join('');
for (const person of people) addIncomeFields(person);
addPeriodSwitch('income');
addPeriodSwitch('asfa');
byId('income-panel').addEventListener('change', renderIncome);
byId('asfa-panel').addEventListener('change', renderAsfa);
byId('boost').addEventListener('input', renderAsfa);
byId('boost-presets').addEventListener('click', event => {
  if (event.target.dataset.boost === undefined) return;
  byId('boost').value = event.target.dataset.boost;
  renderAsfa();
});

function addPersonFields(person) {
  const field = (key, label, attrs) =>
    '<label>' + label + '<input name="' + person + key + '" ' + attrs + ' required></label>';
  byId(person + '-fields').insertAdjacentHTML('beforeend', '<div class="field-grid">' +
    field('Age', 'Current age', 'type="number" inputmode="numeric" min="18" max="100"') +
    '<label>Gender<select name="' + person + 'Sex" required><option value="">Select</option><option>Male</option><option>Female</option></select></label>' +
    field('SuperannuationBalance', 'Super balance ($)', 'type="text" inputmode="decimal" maxlength="14"') +
    field('RetirementAge', 'Planned retirement age', 'type="number" inputmode="numeric" min="18" max="100"') +
    field('Salary', 'Annual income before tax and super ($)', 'type="text" inputmode="decimal" maxlength="14"') +
    '</div>');
}

for (const person of people) addPersonFields(person);
const projectionForm = byId('projection-form');
const control = name => projectionForm.elements.namedItem(name);
const salaryEdited = new Set();

function syncHousehold() {
  const couple = activePeople().length === 2;
  for (const id of ['partner-fields', 'partner-income-fields']) {
    byId(id).hidden = !couple;
    byId(id).disabled = !couple;
  }
  selectedSource = null;
  renderIncome();
  renderAsfa();
}

document.querySelectorAll('input[name="household"]').forEach(input => {
  input.addEventListener('change', syncHousehold);
});

byId('check').addEventListener('click', () => {
  const target = candidates[selectedSource];
  if (!target) return;
  for (const person of activePeople()) {
    if (salaryEdited.has(person)) continue;
    const gross = incomeKinds[person] === 'gross' ? byId(person + '-income').value : incomeEntries[person].gross;
    const amount = parseIncome(gross);
    const salary = control(person + 'Salary');
    salary.value = amount === null ? '' : amountFormat.format(amount);
    salary.setCustomValidity('');
  }
  byId('projection-summary').textContent = amountWithScope(target.amount);
  showStep('projection');
});

const sampleDetails = {
  subject: { Age: 45, Sex: 'Male', SuperannuationBalance: '70,000', RetirementAge: 67, Salary: '96,000' },
  partner: { Age: 43, Sex: 'Female', SuperannuationBalance: '60,000', RetirementAge: 67, Salary: '72,000' }
};

byId('sample').addEventListener('click', () => {
  for (const person of activePeople()) {
    for (const [key, value] of Object.entries(sampleDetails[person])) {
      const field = control(person + key);
      field.value = value;
      field.setCustomValidity('');
    }
    salaryEdited.add(person);
  }
  byId('sample-status').textContent = 'Sample details filled in.';
});

projectionForm.addEventListener('input', event => {
  event.target.setCustomValidity?.('');
  for (const person of people) {
    if (event.target === control(person + 'Salary')) salaryEdited.add(person);
  }
  byId('sample-status').textContent = '';
});

projectionForm.addEventListener('submit', event => {
  event.preventDefault();
  const target = candidates[selectedSource];
  if (!target) return;

  const url = new URL('https://hostplus.gbsau.com/supermodeller-v3/');
  const params = url.searchParams;
  params.set('enable', '1');
  params.set('lifeStage', '3');
  params.set('includePartner', String(activePeople().length === 2));
  params.set('homeOwner', 'true');

  for (const person of activePeople()) {
    const age = control(person + 'Age');
    const retirementAge = control(person + 'RetirementAge');
    if (retirementAge.valueAsNumber < age.valueAsNumber) {
      retirementAge.setCustomValidity('Enter the current age or a later retirement age.');
      retirementAge.reportValidity();
      retirementAge.setCustomValidity('');
      return;
    }
    for (const key of ['Salary', 'SuperannuationBalance']) {
      const field = control(person + key);
      const amount = parseIncome(field.value);
      if (amount === null) {
        field.setCustomValidity('Enter a dollar amount from $0 to $10,000,000.');
        field.reportValidity();
        return;
      }
      params.set(person + key, String(amount));
    }
    params.set(person + 'Age', age.value);
    params.set(person + 'Sex', control(person + 'Sex').value);
    params.set(person + 'Retired', 'false');
    params.set(person + 'RetirementAge', retirementAge.value);
    params.set(person + 'EmployerContribution', '12');
  }
  params.set('retirementIncome', String(target.amount));
  params.set('disclaimerAccepted', String(byId('rpc-acknowledged').checked));
  params.set('navigatePage', 'yourRetirement');
  url.hash = '/yourRetirement';
  window.location.assign(url.href);
});

syncHousehold();
