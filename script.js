document.addEventListener('DOMContentLoaded', () => {
  // === Element References ===
  const costTableBody = document.getElementById('costTableBody');
  const addRowBtn = document.getElementById('addRowBtn');
  const calculateBtn = document.getElementById('calculateBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const resetBtn = document.getElementById('resetBtn');
  const printBtn = document.getElementById('printBtn');
  const toggleModeBtn = document.getElementById('toggleModeBtn');
  const managementHeader = document.getElementById('managementHeader');
  const resultsSection = document.getElementById('results');
  const summaryContainer = document.getElementById('summary');
  const costChartCtx = document.getElementById('costChart').getContext('2d');
  let costChart = null;

  const predefinedCategories = ['เมล็ดพันธุ์', 'ปุ๋ย', 'สารเคมี/ยาปราบศตรูพืช', 'ค่าแรงงาน', 'ค่าน้ำมัน/ค่าไฟฟ้า', 'ค่าเช่าเครื่องมือ', 'ค่าเช่าที่ดิน', 'ค่าเกี่ยวข้าว/ขนส่ง', 'ค่าดอกเบี้ย/เงินกู้', 'อื่นๆ'];
  let rowCount = 0;
  
  // === Helper Functions ===
  const getInputMethod = () => document.querySelector('input[name="inputMethod"]:checked')?.value || 'simple';
  const getCalculationMode = () => document.querySelector('input[name="calculationMode"]:checked')?.value || 'perRai';
  const formatNumber = (num) => Number(num).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // === Auto-Save / Auto-Load ===
  function saveData() {
    const rowsData = Array.from(costTableBody.querySelectorAll('tr')).map(tr => {
      const inputs = tr.querySelectorAll('input');
      return {
        category: inputs[0].value,
        simpleCost: inputs[1].value,
        qty: inputs[2].value,
        unit: inputs[3].value,
        price: inputs[4].value,
        costType: tr.querySelector('input[type="radio"]:checked')?.value || 'variable',
      };
    });
    const appState = {
      version: "4.0", // Update version for new UI flow
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
      if (appState.version !== "4.0" || !appState.mode || !appState.rows) {
        throw new Error("Old or invalid data structure. Starting fresh.");
      }
      
      document.body.className = appState.mode;
      document.getElementById('area').value = appState.area || '';
      document.getElementById('yield').value = appState.yield || '';
      document.getElementById('pricePerTon').value = appState.pricePerTon || '';
      document.querySelector(`input[name="calculationMode"][value="${appState.calculationMode}"]`).checked = true;
      document.querySelector(`input[name="inputMethod"][value="${appState.inputMethod}"]`).checked = true;

      costTableBody.innerHTML = '';
      appState.rows.forEach(rowData => addRow(rowData.category, rowData));
      
      Array.from(costTableBody.querySelectorAll('tr')).forEach(tr => updateRowTotal(tr));
    } catch (e) {
      console.warn(e.message);
      localStorage.removeItem('riceCostData'); // Clear outdated data
    }
  }

  // === Core Table and Calculation Logic ===
  function addRow(name = '', data = {}) {
    const tr = document.createElement('tr');
    
    // Category Cell
    const categoryTd = document.createElement('td');
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text'; categoryInput.value = name; categoryInput.placeholder = 'ระบุหมวดหมู่';
    categoryInput.addEventListener('input', saveData);
    categoryTd.appendChild(categoryInput);
    tr.appendChild(categoryTd);
    
    // Simple Input Cell (ค่าใช้จ่าย)
    const simpleCostTd = document.createElement('td'); simpleCostTd.classList.add('simple-col');
    const simpleCostInput = document.createElement('input');
    simpleCostInput.type = 'number'; simpleCostInput.min = '0'; simpleCostInput.step = 'any'; simpleCostInput.placeholder = '0';
    simpleCostInput.value = data.simpleCost || '';
    simpleCostInput.addEventListener('input', () => { updateRowTotal(tr); saveData(); });
    simpleCostTd.appendChild(simpleCostInput);
    tr.appendChild(simpleCostTd);

    // Detailed Input Cells
    const detailPlaceholders = [{p: '0', v: data.qty}, {p: 'เช่น กก.', v: data.unit}, {p: '0', v: data.price}];
    detailPlaceholders.forEach((item, index) => {
        const td = document.createElement('td'); td.classList.add('detailed-col');
        const input = document.createElement('input');
        input.type = index !== 1 ? 'number' : 'text'; input.placeholder = item.p; input.value = item.v || '';
        if (input.type === 'number') { input.min = '0'; input.step = 'any'; }
        input.addEventListener('input', () => { if(index !== 1) updateRowTotal(tr); saveData(); });
        td.appendChild(input);
        tr.appendChild(td);
    });

    // Total Cell
    const totalTd = document.createElement('td'); totalTd.classList.add('total-col'); tr.appendChild(totalTd);

    // Management Cell (Action Cell)
    const actionTd = document.createElement('td'); actionTd.classList.add('action-cell');
    const radioContainer = document.createElement('div');
    radioContainer.className = 'cost-type-selector';
    ['variable', 'fixed'].forEach(val => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = `costType-${rowCount}`; radio.value = val;
        radio.checked = (data.costType === val) || (!data.costType && val === 'variable');
        radio.addEventListener('change', saveData);
        label.append(radio, (val === 'variable' ? 'ผันแปร' : 'คงที่'));
        radioContainer.appendChild(label);
    });
    actionTd.appendChild(radioContainer);

    const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'ลบ'; deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', () => { tr.remove(); saveData(); if (resultsSection.style.display !== 'none') calculate(); });
    actionTd.appendChild(deleteBtn);

    tr.appendChild(actionTd);
    costTableBody.appendChild(tr);
    rowCount++;
    updateRowDisplay(tr, getInputMethod());
  }

  function updateRowTotal(tr) {
    let total = 0;
    const inputs = tr.querySelectorAll('input');
    if (getInputMethod() === 'simple') {
      total = parseFloat(inputs[1]?.value) || 0;
    } else {
      total = (parseFloat(inputs[2]?.value) || 0) * (parseFloat(inputs[4]?.value) || 0);
    }
    tr.querySelector('.total-col').textContent = formatNumber(total);
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
          const costType = tr.querySelector('input[type="radio"]:checked')?.value;
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
    
    summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนรวมทั้งหมด</h3><p>${formatNumber(totalCost)} บาท</p></div>`;
    summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนต่อไร่</h3><p>${costPerRai != null ? formatNumber(costPerRai) : '—'} บาท/ไร่</p></div>`;
    summaryContainer.innerHTML += `<div class="card"><h3>ต้นทุนต่อกิโลกรัม</h3><p>${costPerKg != null ? formatNumber(costPerKg) : '—'} บาท/กก.</p></div>`;
    
    const breakEvenPricePerKg = costPerKg;
    const breakEvenYieldTons = (pricePerTon > 0) ? totalCost / pricePerTon : null;
    summaryContainer.innerHTML += `<div class="card"><h3>ราคาคุ้มทุน</h3><p>${breakEvenPricePerKg != null ? formatNumber(breakEvenPricePerKg) : '—'} บาท/กก.</p><small>ราคาขายขั้นต่ำ</small></div>`;
    summaryContainer.innerHTML += `<div class="card"><h3>ผลผลิตคุ้มทุน</h3><p>${breakEvenYieldTons != null ? formatNumber(breakEvenYieldTons) : '—'} ตัน</p><small>ผลผลิตขั้นต่ำ</small></div>`;

    const revenueTotal = (!isNaN(pricePerTon) && !isNaN(yieldTons)) ? pricePerTon * yieldTons : null;
    const profitTotal = (revenueTotal != null) ? (revenueTotal - totalCost) : null;
    const profitPerRai = (profitTotal != null && !isNaN(area) && area > 0) ? profitTotal / area : null;
    summaryContainer.innerHTML += `<div class="card"><h3>รายได้รวม</h3><p>${revenueTotal != null ? formatNumber(revenueTotal) : '—'} บาท</p></div>`;
    
    let profitText = '—';
    if (profitTotal != null) {
      profitText = (profitTotal >= 0) ? `กำไร ${formatNumber(Math.abs(profitTotal))} บาท` : `ขาดทุน ${formatNumber(Math.abs(profitTotal))} บาท`;
    }
    summaryContainer.innerHTML += `<div class="card"><h3>กำไร/ขาดทุนรวม</h3><p>${profitText}</p></div>`;
    summaryContainer.innerHTML += `<div class="card"><h3>กำไร/ขาดทุนต่อไร่</h3><p>${profitPerRai != null ? formatNumber(profitPerRai) : '—'} บาท/ไร่</p></div>`;

    updateChart(labels, data);
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // === UI Update Functions ===
  function onMethodChange() {
    const method = getInputMethod();
    document.querySelectorAll('#costTable th.simple-col, #costTable th.detailed-col').forEach(th => {
        th.style.display = th.classList.contains(`simple-col`) ? (method === 'simple' ? 'table-cell' : 'none')
                         : (method === 'detailed' ? 'table-cell' : 'none');
    });
    Array.from(costTableBody.querySelectorAll('tr')).forEach(row => updateRowDisplay(row, method));
    resultsSection.style.display = 'none';
  }

  function onCalculationModeChange() {
    const mode = getCalculationMode();
    document.querySelector('#costTable th.simple-col').textContent = (mode === 'perRai') ? 'ค่าใช้จ่ายต่อไร่ (บาท)' : 'ค่าใช้จ่าย (บาท)';
    document.querySelectorAll('.total-col').forEach(cell => cell.style.display = (mode === 'perRai') ? 'none' : 'table-cell');
    resultsSection.style.display = 'none';
  }

  function updateRowDisplay(tr, method) {
    tr.querySelectorAll('.simple-col').forEach(cell => cell.style.display = method === 'simple' ? 'table-cell' : 'none');
    tr.querySelectorAll('.detailed-col').forEach(cell => cell.style.display = method === 'detailed' ? 'table-cell' : 'none');
  }

  function toggleAnalysisMode() {
    document.body.classList.toggle('basic-mode');
    document.body.classList.toggle('advanced-mode');
    updateToggleButtonText();
    resultsSection.style.display = 'none';
    saveData();
  }
  
  function updateToggleButtonText() {
    const isBasic = document.body.classList.contains('basic-mode');
    toggleModeBtn.textContent = isBasic ? 'สลับไปโหมดวิเคราะห์ขั้นสูง' : 'สลับกลับไปโหมดพื้นฐาน';
    managementHeader.textContent = isBasic ? 'จัดการ' : 'ประเภทต้นทุน / จัดการ';
  }

  function initRows() { predefinedCategories.forEach(name => addRow(name)); }
  
  // === Chart & PDF Functions ===
  function updateChart(labels, data) {
    if (costChart) costChart.destroy();
    const colors = data.map((_, i) => `hsl(${(i * 47) % 360}, 65%, 70%)`);
    costChart = new Chart(costChartCtx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'สัดส่วนต้นทุน', font: { size: 18 } },
          legend: {
            labels: {
              // เพิ่มขนาดและกำหนด font ของป้ายกำกับ
              font: { size: 16, family: "'Kanit', sans-serif" }
            }
          }
        }
      },
      plugins: [{
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart) => {
          const {ctx} = chart;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff'; // กำหนดพื้นหลังเป็นสีขาว
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      }]
    });
  }

  async function generatePDF() {
    const reportArea = document.getElementById('reportArea');
    const resultsEl = document.getElementById('results');
    if (!reportArea || resultsEl.style.display === 'none') {
      alert("กรุณากดคำนวณเพื่อให้มีข้อมูลสรุปก่อนสร้าง PDF"); return;
    }
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'absolute', left: '-9999px', top: '0',
      width: '900px', padding: '20px', background: '#fff',
      fontFamily: '"Kanit", sans-serif', fontSize: '16px'
    });
    // This function clones a node for the PDF, replacing interactive elements with static text.
    function cloneWithValues(node) {
      const clone = node.cloneNode(true);

      // For the PDF, remove the "Management" column (header and cells).
      clone.querySelector('#managementHeader')?.remove();
      clone.querySelectorAll('.action-cell').forEach(td => td.remove());

      // Replace remaining input/select fields with their values as plain text.
      clone.querySelectorAll('input, select').forEach(el => {
        const span = document.createElement('span');
        span.textContent = el.value || '';
        el.parentNode.replaceChild(span, el);
      });
      return clone;
    }
    
    container.innerHTML = `<h2>รายงานสรุปต้นทุนการผลิตข้าว</h2>
      <p style="margin: 2px 0;"><strong>พื้นที่เพาะปลูก:</strong> ${document.getElementById('area').value||'N/A'} ไร่</p>
      <p style="margin: 2px 0;"><strong>ผลผลิตที่คาดว่าจะได้:</strong> ${document.getElementById('yield').value||'N/A'} ตัน</p>
      <p style="margin: 2px 0;"><strong>ราคาจำหน่าย:</strong> ${document.getElementById('pricePerTon').value||'N/A'} บาท/ตัน</p><hr style="margin-top: 1rem; margin-bottom: 1rem;">`;
    
    container.appendChild(cloneWithValues(reportArea));
    const resultsClone = cloneWithValues(resultsEl);
    resultsClone.style.display = 'block';
    const liveCanvas = document.getElementById('costChart');
    if (liveCanvas) {
        const img = document.createElement('img');
        img.src = liveCanvas.toDataURL('image/jpeg', 0.9);
        img.style.cssText = 'width:100%; max-width:600px; margin:20px auto; display:block;';
        resultsClone.querySelector('.chart-container').innerHTML = '';
        resultsClone.querySelector('.chart-container').appendChild(img);
    }
    container.appendChild(resultsClone);
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const finalHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, finalHeight);
    pdf.save('rice_cost_report.pdf');
    document.body.removeChild(container);
  }

  // === Event Listeners Setup ===
  toggleModeBtn.addEventListener('click', toggleAnalysisMode);
  addRowBtn.addEventListener('click', () => { addRow(); saveData(); });
  calculateBtn.addEventListener('click', calculate);
  downloadPdfBtn.addEventListener('click', generatePDF);
  printBtn.addEventListener('click', () => window.print());
  resetBtn.addEventListener('click', () => {
    if (confirm('คุณต้องการล้างข้อมูลที่กรอกทั้งหมดหรือไม่?')) {
      ['area', 'yield', 'pricePerTon'].forEach(id => document.getElementById(id).value = '');
      costTableBody.innerHTML = '';
      initRows();
      document.body.className = 'basic-mode';
      updateToggleButtonText();
      onMethodChange(); onCalculationModeChange();
      resultsSection.style.display = 'none';
      saveData();
    }
  });
  document.querySelectorAll('input[name="calculationMode"], input[name="inputMethod"]').forEach(radio => {
    radio.addEventListener('change', () => { onMethodChange(); onCalculationModeChange(); saveData(); });
  });
  ['area', 'yield', 'pricePerTon'].forEach(id => document.getElementById(id).addEventListener('input', saveData));

  // --- Initial Page Load ---
  initRows();
  loadData();
  updateToggleButtonText();
  onMethodChange();
  onCalculationModeChange();
});