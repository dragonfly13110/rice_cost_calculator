// Script to handle dynamic cost calculation for rice production

document.addEventListener('DOMContentLoaded', () => {
  // === Element References ===
  const costTableBody = document.getElementById('costTableBody');
  const addRowBtn = document.getElementById('addRowBtn');
  const calculateBtn = document.getElementById('calculateBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const resetBtn = document.getElementById('resetBtn');
  const printBtn = document.getElementById('printBtn');
  const resultsSection = document.getElementById('results');
  const summaryContainer = document.getElementById('summary');
  const costChartCtx = document.getElementById('costChart').getContext('2d');
  let costChart = null;

  const modeSelectionContainer = document.getElementById('modeSelectionContainer');
  const chooseBasicModeBtn = document.getElementById('chooseBasicMode');
  const chooseAdvancedModeBtn = document.getElementById('chooseAdvancedMode');
  const calculatorBody = document.getElementById('calculatorBody');

  const predefinedCategories = ['เมล็ดพันธุ์', 'ปุ๋ย', 'สารเคมี/ยาปราบศตรูพืช', 'ค่าแรงงาน', 'ค่าน้ำมัน/ค่าไฟฟ้า', 'ค่าเช่าเครื่องมือ', 'ค่าเช่าที่ดิน', 'ค่าเกี่ยวข้าว/ขนส่ง', 'ค่าดอกเบี้ย/เงินกู้', 'อื่นๆ'];
  let rowCount = 0;
  
  // === Auto-Save/Load Functionality ===
  function saveData() {
    if (!calculatorBody.style.display || calculatorBody.style.display === 'none') return;
    const rowsData = Array.from(costTableBody.querySelectorAll('tr')).map(tr => {
      const inputs = tr.querySelectorAll('input, select');
      return {
        category: inputs[0].value, costType: inputs[1]?.value || 'variable',
        simpleCost: inputs[2].value, qty: inputs[3].value,
        unit: inputs[4].value, price: inputs[5].value,
      };
    });
    const appState = {
      version: "2.0", // Add version to handle future changes
      mode: document.body.className, area: document.getElementById('area').value,
      yield: document.getElementById('yield').value, pricePerTon: document.getElementById('pricePerTon').value,
      calculationMode: getCalculationMode(), inputMethod: getInputMethod(), rows: rowsData,
    };
    localStorage.setItem('riceCostData', JSON.stringify(appState));
  }

  function loadData() {
    const savedData = localStorage.getItem('riceCostData');
    if (!savedData) return;
    try {
      const appState = JSON.parse(savedData);
      // Robustness check: if data is from an old version or corrupt, clear it.
      if (!appState.version || !appState.mode || !appState.rows) {
        throw new Error("Invalid data structure.");
      }
      
      document.body.className = appState.mode;
      modeSelectionContainer.style.display = 'none';
      calculatorBody.style.display = 'block';

      document.getElementById('area').value = appState.area || '';
      document.getElementById('yield').value = appState.yield || '';
      document.getElementById('pricePerTon').value = appState.pricePerTon || '';
      document.querySelector(`input[name="calculationMode"][value="${appState.calculationMode}"]`).checked = true;
      document.querySelector(`input[name="inputMethod"][value="${appState.inputMethod}"]`).checked = true;

      costTableBody.innerHTML = '';
      appState.rows.forEach(rowData => addRow(rowData.category, rowData));
      
      onMethodChange();
      onCalculationModeChange();
      Array.from(costTableBody.querySelectorAll('tr')).forEach(tr => updateRowTotal(tr));
    } catch (e) {
      console.error("Failed to load data, clearing storage.", e);
      localStorage.removeItem('riceCostData'); // Clear corrupted data automatically
    }
  }

  // === Helper Functions ===
  const getInputMethod = () => document.querySelector('input[name="inputMethod"]:checked')?.value || 'simple';
  const getCalculationMode = () => document.querySelector('input[name="calculationMode"]:checked')?.value || 'perRai';
  const formatNumber = (num) => Number(num).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  
  function addRow(name = '', data = {}) {
    const tr = document.createElement('tr');
    tr.dataset.id = rowCount;
    const createCell = (content) => { const td = document.createElement('td'); td.appendChild(content); return td; };
    const createInput = (type, placeholder, value, listener) => {
      const input = document.createElement('input');
      input.type = type; input.placeholder = placeholder; input.value = value;
      if (type === 'number') { input.min = '0'; input.step = 'any'; }
      input.addEventListener('input', listener);
      return input;
    };
    
    tr.appendChild(createCell(createInput('text', 'ระบุหมวดหมู่', name, saveData)));
    
    const costTypeSelect = document.createElement('select');
    costTypeSelect.innerHTML = `<option value="variable">ต้นทุนผันแปร</option><option value="fixed">ต้นทุนคงที่</option>`;
    costTypeSelect.value = data.costType || 'variable';
    costTypeSelect.addEventListener('change', saveData);
    const costTypeCell = createCell(costTypeSelect);
    costTypeCell.classList.add('advanced-col');
    tr.appendChild(costTypeCell);

    const simpleCostCell = createCell(createInput('number', '0', data.simpleCost || '', () => { updateRowTotal(tr); saveData(); }));
    simpleCostCell.classList.add('simple-col');
    tr.appendChild(simpleCostCell);

    const qtyCell = createCell(createInput('number', '0', data.qty || '', () => { updateRowTotal(tr); saveData(); }));
    qtyCell.classList.add('detailed-col');
    tr.appendChild(qtyCell);

    const unitCell = createCell(createInput('text', 'เช่น กก., กระสอบ', data.unit || '', saveData));
    unitCell.classList.add('detailed-col');
    tr.appendChild(unitCell);
    
    const priceCell = createCell(createInput('number', '0', data.price || '', () => { updateRowTotal(tr); saveData(); }));
    priceCell.classList.add('detailed-col');
    tr.appendChild(priceCell);
    
    const totalTd = document.createElement('td'); totalTd.classList.add('total-col');
    tr.appendChild(totalTd);

    const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'ลบ'; deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', () => { tr.remove(); saveData(); if (resultsSection.style.display !== 'none') calculate(); });
    tr.appendChild(createCell(deleteBtn));

    costTableBody.appendChild(tr);
    rowCount++;
    updateRowDisplay(tr, getInputMethod());
  }

  function updateRowDisplay(tr, method) {
    tr.querySelectorAll('.simple-col').forEach(cell => cell.style.display = method === 'simple' ? 'table-cell' : 'none');
    tr.querySelectorAll('.detailed-col').forEach(cell => cell.style.display = method === 'detailed' ? 'table-cell' : 'none');
  }

  function updateRowTotal(tr) {
    let total = 0;
    const inputs = tr.querySelectorAll('input');
    if (getInputMethod() === 'simple') {
      total = parseFloat(inputs[2]?.value) || 0;
    } else {
      total = (parseFloat(inputs[3]?.value) || 0) * (parseFloat(inputs[5]?.value) || 0);
    }
    tr.querySelector('.total-col').textContent = formatNumber(total);
  }

  function onMethodChange() {
    const method = getInputMethod();
    document.querySelectorAll('th.simple-col').forEach(th => th.style.display = method === 'simple' ? 'table-cell' : 'none');
    document.querySelectorAll('th.detailed-col').forEach(th => th.style.display = method === 'detailed' ? 'table-cell' : 'none');
    Array.from(costTableBody.querySelectorAll('tr')).forEach(row => updateRowDisplay(row, method));
    resultsSection.style.display = 'none';
  }

  function onCalculationModeChange() {
    const mode = getCalculationMode();
    document.querySelector('#costTable th.simple-col').textContent = (mode === 'perRai') ? 'ค่าใช้จ่ายต่อไร่ (บาท)' : 'ค่าใช้จ่าย (บาท)';
    document.querySelectorAll('.total-col').forEach(cell => cell.style.display = (mode === 'perRai') ? 'none' : 'table-cell');
    resultsSection.style.display = 'none';
  }

  function calculate() {
    const rows = Array.from(costTableBody.querySelectorAll('tr'));
    let totalCostFromTable = 0, labels = [], data = [], totalFixedCostFromTable = 0, totalVariableCostFromTable = 0;
    const isAdvanced = document.body.classList.contains('advanced-mode');

    rows.forEach(tr => {
      const categoryName = tr.querySelector('input[type="text"]')?.value || 'ไม่ระบุ';
      const totalVal = parseFloat(tr.querySelector('.total-col').textContent.replace(/,/g, '')) || 0;
      if (totalVal > 0) {
        labels.push(categoryName); data.push(totalVal); totalCostFromTable += totalVal;
        if (isAdvanced) {
          const costType = tr.querySelector('select')?.value;
          (costType === 'fixed' ? totalFixedCostFromTable += totalVal : totalVariableCostFromTable += totalVal);
        }
      }
    });

    const area = parseFloat(document.getElementById('area').value);
    let totalCost, totalFixedCost, totalVariableCost;
    if (getCalculationMode() === 'perRai') {
      if (isNaN(area) || area <= 0) { alert('กรุณาระบุพื้นที่เพาะปลูก (ไร่) ให้ถูกต้อง'); return; }
      totalCost = totalCostFromTable * area;
      totalFixedCost = totalFixedCostFromTable * area;
      totalVariableCost = totalVariableCostFromTable * area;
    } else {
      totalCost = totalCostFromTable;
      totalFixedCost = totalFixedCostFromTable;
      totalVariableCost = totalVariableCostFromTable;
    }

    const yieldTons = parseFloat(document.getElementById('yield').value);
    const yieldKg = (!isNaN(yieldTons) && yieldTons > 0) ? yieldTons * 1000 : null;
    const costPerRai = (!isNaN(area) && area > 0) ? totalCost / area : null;
    const costPerKg = (yieldKg != null) ? totalCost / yieldKg : null;
    const pricePerTon = parseFloat(document.getElementById('pricePerTon').value);

    summaryContainer.innerHTML = '';
    if (isAdvanced) {
      summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนคงที่รวม</h3><p>${formatNumber(totalFixedCost)} บาท</p></div>`;
      summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนผันแปรรวม</h3><p>${formatNumber(totalVariableCost)} บาท</p></div>`;
    }
    
    // Continue adding other summary cards...
    summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนรวมทั้งหมด</h3><p>${formatNumber(totalCost)} บาท</p></div>`;
    summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนต่อไร่</h3><p>${costPerRai != null ? formatNumber(costPerRai) : '—'} บาท/ไร่</p></div>`;
    
    const revenueTotal = (!isNaN(pricePerTon) && !isNaN(yieldTons)) ? pricePerTon * yieldTons : null;
    const profitTotal = (revenueTotal != null) ? (revenueTotal - totalCost) : null;
    let profitText = '—';
    if (profitTotal != null) {
      const absVal = Math.abs(profitTotal);
      profitText = (profitTotal >= 0) ? `กำไร ${formatNumber(absVal)} บาท` : `ขาดทุน ${formatNumber(absVal)} บาท`;
    }
    summaryContainer.innerHTML += `<div class="card"><h3>กำไร/ขาดทุนรวม</h3><p>${profitText}</p></div>`;

    updateChart(labels, data);
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initRows() { predefinedCategories.forEach(name => addRow(name)); }
  function initCalculator(mode) {
    document.body.className = mode === 'advanced' ? 'advanced-mode' : 'basic-mode';
    modeSelectionContainer.style.display = 'none';
    calculatorBody.style.display = 'block';
    costTableBody.innerHTML = '';
    initRows(); onMethodChange(); onCalculationModeChange(); saveData();
  }

  function updateChart(labels, data) {
    if (costChart) costChart.destroy();
    const colors = data.map((_, i) => `hsl(${(i * 47) % 360}, 65%, 70%)`);
    costChart = new Chart(costChartCtx, {
      type: 'doughnut', data: { labels: labels, datasets: [{ data, backgroundColor: colors }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'สัดส่วนต้นทุน', font: { size: 18 } } } }
    });
  }
  
  async function generatePDF() { alert("ฟังก์ชันสร้าง PDF ยังไม่ได้รวมอยู่ในโค้ดฉบับนี้"); }

  // === Event Listeners Setup ===
  chooseBasicModeBtn.addEventListener('click', () => initCalculator('basic'));
  chooseAdvancedModeBtn.addEventListener('click', () => initCalculator('advanced'));
  addRowBtn.addEventListener('click', () => { addRow(); saveData(); });
  calculateBtn.addEventListener('click', calculate);
  downloadPdfBtn.addEventListener('click', generatePDF);
  printBtn.addEventListener('click', () => window.print());
  resetBtn.addEventListener('click', () => {
    if (confirm('คุณต้องการล้างข้อมูลทั้งหมดและกลับไปหน้าเลือกโหมดใช่หรือไม่?')) {
      localStorage.removeItem('riceCostData');
      location.reload();
    }
  });
  document.querySelectorAll('input[name="calculationMode"]').forEach(radio => radio.addEventListener('change', () => { onCalculationModeChange(); saveData(); }));
  document.querySelectorAll('input[name="inputMethod"]').forEach(radio => radio.addEventListener('change', () => { onMethodChange(); saveData(); }));
  ['area', 'yield', 'pricePerTon'].forEach(id => document.getElementById(id).addEventListener('input', saveData));

  // --- Initial Load ---
  loadData();
});