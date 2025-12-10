const STORAGE_KEYS = {
  BUDGET: 'sbp_budget',
  EXPENSES: 'sbp_expenses'
};

/* DOM Elements */
const budgetInput = document.getElementById('budgetInput');
const setBudgetBtn = document.getElementById('setBudgetBtn');
const totalBudgetEl = document.getElementById('totalBudget');
const totalSpentEl = document.getElementById('totalSpent');
const remainingEl = document.getElementById('remaining');
const topCategoryEl = document.getElementById('topCategory');
const usageBar = document.getElementById('usageBar');
const usagePercent = document.getElementById('usagePercent');
const budgetAlert = document.getElementById('budgetAlert');

const expenseForm = document.getElementById('expenseForm');
const expenseAmount = document.getElementById('expenseAmount');
const expenseCategory = document.getElementById('expenseCategory');
const expenseDesc = document.getElementById('expenseDesc');
const expenseTbody = document.getElementById('expenseTbody');
const barChart = document.getElementById('barChart');
const downloadBtn = document.getElementById('downloadReport');
const clearAllBtn = document.getElementById('clearAllBtn');

/* Load state from localStorage */
let budget = Number(localStorage.getItem(STORAGE_KEYS.BUDGET) || 0);
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES) || '[]');

/* Utility: format currency (Indian Rupee) */
function formatCurrency(num){
  const val = Number(num) || 0;
  // Simple formatting (₹x,xxx.xx)
  return '₹' + val.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 2});
}

/* Save current state to localStorage */
function saveState(){
  localStorage.setItem(STORAGE_KEYS.BUDGET, String(budget));
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
}

/* Calculate totals and category aggregation */
function computeStats(){
  const totalSpent = expenses.reduce((s,e)=> s + Number(e.amount), 0);
  const categoryMap = {};
  expenses.forEach(exp => {
    const cat = exp.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(exp.amount);
  });
  return { totalSpent, categoryMap };
}

/* Render summary cards & progress */
function renderSummary(){
  const { totalSpent, categoryMap } = computeStats();

  totalBudgetEl.textContent = formatCurrency(budget);
  totalSpentEl.textContent = formatCurrency(totalSpent);

  const remaining = budget - totalSpent;
  remainingEl.textContent = formatCurrency(remaining);

  // set color status for remaining
  remainingEl.classList.remove('remain-good','remain-warn','remain-bad');
  if (budget <= 0) {
    remainingEl.classList.add('remain-warn');
  } else {
    const pct = (remaining / budget) * 100;
    if (pct >= 30) remainingEl.classList.add('remain-good');
    else if (pct >= 0) remainingEl.classList.add('remain-warn');
    else remainingEl.classList.add('remain-bad');
  }

  // Usage percent and bar
  const usage = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const usageClamped = Math.max(0, Math.min(usage, 200)); // clamp to avoid crazy widths
  usageBar.style.width = usageClamped + '%';
  usagePercent.textContent = usage + '%';

  // Alert messages if near/exceeded
  budgetAlert.textContent = '';
  if (budget > 0) {
    if (usage >= 100) {
      budgetAlert.textContent = 'Budget Exceeded';
      usageBar.style.background = 'linear-gradient(90deg,#f43f5e,#dc2626)';
    } else if (usage >= 80) {
      budgetAlert.textContent = 'Approaching Limit';
      usageBar.style.background = 'linear-gradient(90deg,#f59e0b,#f97316)';
    } else {
      usageBar.style.background = 'linear-gradient(90deg,var(--accent), #7c3aed)';
    }
  } else {
    usageBar.style.background = 'linear-gradient(90deg,var(--accent), #7c3aed)';
  }

  // Top category
  const entries = Object.entries(categoryMap);
  if (entries.length === 0) {
    topCategoryEl.textContent = '—';
  } else {
    entries.sort((a,b)=> b[1]-a[1]);
    topCategoryEl.textContent = `${entries[0][0]} (${formatCurrency(entries[0][1])})`;
  }
}

/* Render expense table */
function renderExpenses(){
  expenseTbody.innerHTML = '';
  if (expenses.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.padding = '14px';
    td.textContent = 'No expenses added yet.';
    tr.appendChild(td);
    expenseTbody.appendChild(tr);
    return;
  }

  // Show newest first
  const list = [...expenses].reverse();
  list.forEach((exp, idx) => {
    const tr = document.createElement('tr');

    const iTd = document.createElement('td');
    iTd.textContent = expenses.length - idx;
    tr.appendChild(iTd);

    const amtTd = document.createElement('td');
    amtTd.textContent = formatCurrency(exp.amount);
    tr.appendChild(amtTd);

    const catTd = document.createElement('td');
    catTd.textContent = exp.category;
    tr.appendChild(catTd);

    const descTd = document.createElement('td');
    descTd.textContent = exp.description || '-';
    tr.appendChild(descTd);

    const actTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => {
      // Find index in original array (by id)
      removeExpense(exp.id);
    };
    actTd.appendChild(delBtn);
    tr.appendChild(actTd);

    expenseTbody.appendChild(tr);
  });
}

/* Build and animate bar chart using category aggregation */
function renderChart(){
  // Clear existing chart
  barChart.innerHTML = '';

  const { categoryMap } = computeStats();
  const categories = Object.keys(categoryMap);
  if (categories.length === 0) {
    barChart.innerHTML = '<div style="color:var(--muted-2)">No data to show. Add expenses to see category chart.</div>';
    return;
  }

  // Determine max for scaling
  const values = Object.values(categoryMap);
  const maxVal = Math.max(...values, 1);

  // Sort categories by value descending (nice visual)
  const sorted = Object.entries(categoryMap).sort((a,b)=> b[1]-a[1]);

  // Create bars
  sorted.forEach(([cat, val]) => {
    const percent = (val / maxVal) * 100; // 0-100
    const barWrap = document.createElement('div');
    barWrap.className = 'bar';
    // Amount label
    const amtLabel = document.createElement('small');
    amtLabel.textContent = formatCurrency(val);
    // Bar inner
    const barInner = document.createElement('div');
    barInner.className = 'bar-inner';
    // A filler element to control height
    const filler = document.createElement('div');
    filler.style.height = '6px';
    filler.style.width = '100%';
    filler.style.borderRadius = '6px';
    filler.style.transition = 'height 700ms cubic-bezier(.2,.8,.2,1), background-color 400ms';
    // Choose color gradient based on weight
    const color = pickColorForCategory(cat);
    filler.style.background = color;
    // set initial very small height (so animation works)
    filler.style.height = '6px';
    // append label
    const catLabel = document.createElement('small');
    catLabel.textContent = cat;
    // place amount label above
    barInner.appendChild(filler);
    barWrap.appendChild(barInner);
    barWrap.appendChild(amtLabel);
    barWrap.appendChild(catLabel);
    barChart.appendChild(barWrap);

    // Trigger animation after a tick
    requestAnimationFrame(() => {
      // Map percent to pixel height (max 120px)
      const maxPx = 120;
      const px = Math.max(6, (percent / 100) * maxPx);
      filler.style.height = `${px}px`;
    });
  });
}

/* Helper to pick color for a category (makes bars visually distinct) */
function pickColorForCategory(cat){
  const palette = [
    'linear-gradient(180deg,#60a5fa,#2563eb)',
    'linear-gradient(180deg,#34d399,#059669)',
    'linear-gradient(180deg,#f472b6,#be185d)',
    'linear-gradient(180deg,#f59e0b,#f97316)',
    'linear-gradient(180deg,#a78bfa,#7c3aed)',
    'linear-gradient(180deg,#60a5fa,#0891b2)',
    'linear-gradient(180deg,#f97316,#ea580c)',
    'linear-gradient(180deg,#06b6d4,#0891b2)',
  ];
  const idx = Math.abs(hashString(cat)) % palette.length;
  return palette[idx];
}
function hashString(s){
  let h = 0;
  for (let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i);
  return h;
}

/* Add expense: create an id and push to array, then save & re-render */
function addExpense(amount, category, description){
  const id = 'e_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  const obj = {
    id,
    amount: Number(amount),
    category: category || 'Other',
    description: description || '',
    createdAt: new Date().toISOString()
  };
  expenses.push(obj);
  saveState();
  refreshUI();
}

/* Remove an expense by id */
function removeExpense(id){
  const idx = expenses.findIndex(e => e.id === id);
  if (idx !== -1) {
    // remove item
    expenses.splice(idx, 1);
    saveState();
    refreshUI();
  }
}

/* Set new budget */
function setBudget(newBudget){
  budget = Number(newBudget) || 0;
  saveState();
  refreshUI();
}

/* Delete all data */
function clearAllData(){
  if (!confirm('Clear all expenses and budget? This action cannot be undone.')) return;
  budget = 0;
  expenses = [];
  saveState();
  refreshUI();
}

/* Render everything */
function refreshUI(){
  renderSummary();
  renderExpenses();
  renderChart();
}

/* Download a simple report as PDF */
async function downloadReport(){
  // Build a printable HTML string
  const { totalSpent, categoryMap } = computeStats();
  const remaining = budget - totalSpent;
  const rowsHtml = expenses.map((e,i)=> {
    return `<tr>
      <td>${i+1}</td>
      <td>${formatCurrency(e.amount)}</td>
      <td>${e.category}</td>
      <td>${escapeHtml(e.description || '-')}</td>
    </tr>`;
  }).join('');

  const catRows = Object.entries(categoryMap).map(([c,v]) => {
    return `<tr><td>${escapeHtml(c)}</td><td>${formatCurrency(v)}</td></tr>`;
  }).join('');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; padding:20px;">
      <h2>Budget Report</h2>
      <p><strong>Total Budget:</strong> ${formatCurrency(budget)}</p>
      <p><strong>Total Spent:</strong> ${formatCurrency(totalSpent)}</p>
      <p><strong>Remaining:</strong> ${formatCurrency(remaining)}</p>
      <h3>Spending by Category</h3>
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr><th style="text-align:left">Category</th><th style="text-align:left">Amount</th></tr></thead>
        <tbody>${catRows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
      </table>
      <h3 style="margin-top:18px">Expenses</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <thead><tr><th>#</th><th>Amount</th><th>Category</th><th>Description</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="4">No expenses</td></tr>'}</tbody>
      </table>
      <p style="font-size:12px; color:#666; margin-top:14px">Generated: ${new Date().toLocaleString()}</p>
    </div>
  `;

  // Use a simple approach without external libs:
  // create a hidden iframe to print to PDF — but since we must provide a downloadable PDF file,
  // we'll use the browser's print dialog. Alternatively, create a blob and open in new tab.
  const w = window.open('', '_blank', 'noopener');
  w.document.write(html);
  w.document.close();
  w.focus();
  // Let user print/save as PDF manually
}

/* Simple escape for HTML in report */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}

/* ----- Event Listeners ----- */
setBudgetBtn.addEventListener('click', () => {
  const val = Number(budgetInput.value);
  if (isNaN(val) || val < 0) {
    alert('Enter a valid budget (non-negative).');
    return;
  }
  setBudget(val);
  budgetInput.value = '';
});

expenseForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const amt = Number(expenseAmount.value);
  const cat = expenseCategory.value;
  const desc = expenseDesc.value;
  if (!cat) {
    alert('Choose a category for the expense.');
    return;
  }
  if (isNaN(amt) || amt <= 0) {
    alert('Enter a valid amount (> 0).');
    return;
  }
  addExpense(amt, cat, desc);
  // Reset form
  expenseAmount.value = '';
  expenseCategory.value = '';
  expenseDesc.value = '';
});

downloadBtn.addEventListener('click', downloadReport);
clearAllBtn.addEventListener('click', clearAllData);

/* Initialize on page load */
(function init(){
  // ensure proper types
  budget = Number(budget) || 0;
  expenses = Array.isArray(expenses) ? expenses : [];
  refreshUI();
})();