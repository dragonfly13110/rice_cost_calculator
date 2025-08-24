// Script to handle dynamic cost calculation for rice production

// Wait until DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  const costTableBody = document.getElementById('costTableBody');
  const addRowBtn = document.getElementById('addRowBtn');
  const calculateBtn = document.getElementById('calculateBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const resultsSection = document.getElementById('results');
  const summaryContainer = document.getElementById('summary');
  const costChartCtx = document.getElementById('costChart').getContext('2d');
  let costChart = null;

  // Predefined typical categories for rice farming costs in Thai
  const predefinedCategories = [
    'เมล็ดพันธุ์',
    'ปุ๋ย',
    'สารเคมี/ยาปราบศัตรูพืช',
    'ค่าแรงงาน',
    'ค่าน้ำ/ค่าไฟ',
    'ค่าเช่าเครื่องมือ',
    'ค่าเช่าที่ดิน',
    'ค่าเกี่ยวข้าว/ขนส่ง',
    'ค่าดอกเบี้ย/เงินกู้',
    'อื่นๆ'
  ];

  let rowCount = 0;

  /**
   * Determine currently selected input method: 'simple' or 'detailed'.
   */
  function getInputMethod() {
    const selected = document.querySelector('input[name="inputMethod"]:checked');
    return selected ? selected.value : 'simple';
  }

  /**
   * Determine currently selected calculation mode: 'perRai' or 'total'.
   */
  function getCalculationMode() {
    const selected = document.querySelector('input[name="calculationMode"]:checked');
    return selected ? selected.value : 'perRai';
  }

  /**
   * Create a table row with inputs appropriate for the current method.
   * @param {string} name - Optional category name to prefill.
   */
  function addRow(name = '') {
    const method = getInputMethod();
    const tr = document.createElement('tr');
    tr.dataset.id = rowCount;

    // Category name input
    const categoryTd = document.createElement('td');
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.value = name;
    categoryInput.placeholder = 'ระบุหมวดหมู่';
    categoryTd.appendChild(categoryInput);
    tr.appendChild(categoryTd);

    // Cost input (simple mode)
    const costTd = document.createElement('td');
    costTd.classList.add('simple-col');
    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.min = '0';
    costInput.step = 'any';
    costInput.placeholder = '0';
    costInput.addEventListener('input', () => updateRowTotal(tr));
    costTd.appendChild(costInput);
    tr.appendChild(costTd);

    // Quantity input (detailed mode)
    const qtyTd = document.createElement('td');
    qtyTd.classList.add('detailed-col');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = 'any';
    qtyInput.placeholder = '0';
    qtyInput.addEventListener('input', () => updateRowTotal(tr));
    qtyTd.appendChild(qtyInput);
    tr.appendChild(qtyTd);

    // Unit price input (detailed mode)
    const priceTd = document.createElement('td');
    priceTd.classList.add('detailed-col');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = 'any';
    priceInput.placeholder = '0';
    priceInput.addEventListener('input', () => updateRowTotal(tr));
    priceTd.appendChild(priceInput);
    tr.appendChild(priceTd);

    // Total cost cell (read-only)
    const totalTd = document.createElement('td');
    totalTd.classList.add('total-col');
    totalTd.textContent = '0';
    // Hide if in 'perRai' mode, which makes this column redundant
    if (getCalculationMode() === 'perRai') {
      totalTd.style.display = 'none';
    }
    tr.appendChild(totalTd);

    // Delete button cell
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'ลบ';
    deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', () => {
      tr.remove();
      // After removing a row, reindex rowCount? Not necessary but update chart if results visible
      if (resultsSection.style.display !== 'none') {
        calculate();
      }
    });
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    costTableBody.appendChild(tr);
    rowCount++;

    // Show/hide columns based on method at row creation
    updateRowDisplay(tr, method);
  }

  /**
   * Update display of row cells (simple vs detailed) according to method.
   * @param {HTMLElement} tr - Table row element
   * @param {string} method - 'simple' or 'detailed'
   */
  function updateRowDisplay(tr, method) {
    const simpleCells = tr.querySelectorAll('.simple-col');
    const detailedCells = tr.querySelectorAll('.detailed-col');
    if (method === 'simple') {
      simpleCells.forEach(cell => cell.style.display = 'table-cell');
      detailedCells.forEach(cell => cell.style.display = 'none');
      // Copy existing total from cost input if available
      updateRowTotal(tr);
    } else {
      simpleCells.forEach(cell => cell.style.display = 'none');
      detailedCells.forEach(cell => cell.style.display = 'table-cell');
      // Reset quantity and price to 0
      const [qtyInput, priceInput] = detailedCells;
      if (qtyInput) {
        const input = qtyInput.querySelector('input');
        if (input) input.value = '';
      }
      if (priceInput) {
        const input = priceInput.querySelector('input');
        if (input) input.value = '';
      }
      updateRowTotal(tr);
    }
  }

  /**
   * Update the total cost for a given row based on current input method.
   * @param {HTMLElement} tr - Table row element
   */
  function updateRowTotal(tr) {
    const method = getInputMethod();
    // Last cell before delete button contains the total
    const cells = tr.children;
    let total = 0;
    if (method === 'simple') {
      // cost input is second cell (index 1)
      const costInput = cells[1].querySelector('input');
      const costVal = parseFloat(costInput.value);
      total = isNaN(costVal) ? 0 : costVal;
    } else {
      // quantity is cell 2, unit price is cell 3
      const qtyInput = cells[2].querySelector('input');
      const priceInput = cells[3].querySelector('input');
      const qty = parseFloat(qtyInput.value);
      const price = parseFloat(priceInput.value);
      total = (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price);
    }
    // total cell is always the cell before the action cell (second last cell)
    const totalTdIndex = cells.length - 2;
    const totalTd = cells[totalTdIndex];
    // Format number as string with two decimal places but remove trailing zeros
    totalTd.textContent = formatNumber(total);
  }

  /**
   * Convert a number to a string with commas and up to two decimal places.
   * @param {number} num
   */
  function formatNumber(num) {
    return Number(num).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  /**
   * Calculate totals and update the summary and chart.
   */
  function calculate() {
    const rows = Array.from(costTableBody.querySelectorAll('tr'));
    const calculationMode = getCalculationMode();
    let totalCostFromTable = 0;
    const labels = [];
    const data = [];
    rows.forEach(tr => {
      const cells = tr.children;
      const categoryName = cells[0].querySelector('input').value || 'ไม่ระบุ';
      const totalTdIndex = cells.length - 2;
      const totalVal = parseFloat(cells[totalTdIndex].textContent.replace(/,/g, ''));
      if (!isNaN(totalVal) && totalVal > 0) {
        labels.push(categoryName);
        data.push(totalVal);
        totalCostFromTable += totalVal;
      }
    });

    const areaInput = document.getElementById('area');
    const area = parseFloat(areaInput.value);
    let totalCost;

    if (calculationMode === 'perRai') {
      if (isNaN(area) || area <= 0) {
        alert('กรุณาระบุพื้นที่เพาะปลูก (ไร่) ให้ถูกต้อง');
        return;
      }
      totalCost = totalCostFromTable * area;
    } else { // calculationMode is 'total'
      totalCost = totalCostFromTable;
    }

    const yieldInput = document.getElementById('yield');
    const yieldTons = parseFloat(yieldInput.value);
    const yieldKg = (!isNaN(yieldTons) && yieldTons > 0) ? yieldTons * 1000 : null;

    const costPerRai = (!isNaN(area) && area > 0) ? totalCost / area : null;
    const costPerKg = (yieldKg != null) ? totalCost / yieldKg : null;

    // Update summary
    summaryContainer.innerHTML = '';
    // Total cost card
    const totalCard = document.createElement('div');
    totalCard.classList.add('card');
    totalCard.innerHTML = `<h3>ต้นทุนรวมทั้งหมด</h3><p>${formatNumber(totalCost)} บาท</p>`;
    summaryContainer.appendChild(totalCard);
    // Cost per rai card
    const raiCard = document.createElement('div');
    raiCard.classList.add('card');
    const raiText = (costPerRai != null) ? `${formatNumber(costPerRai)} บาท/ไร่` : '—';
    raiCard.innerHTML = `<h3>ต้นทุนต่อไร่</h3><p>${raiText}</p>`;
    summaryContainer.appendChild(raiCard);
    // Cost per kg card
    const kgCard = document.createElement('div');
    kgCard.classList.add('card');
    const kgText = (costPerKg != null) ? `${formatNumber(costPerKg)} บาท/กก.` : '—';
    kgCard.innerHTML = `<h3>ต้นทุนต่อกิโลกรัม</h3><p>${kgText}</p>`;
    summaryContainer.appendChild(kgCard);

    // Show selling price per ton (and equivalent per-kg) if provided
    includePricePerTon();

    // Calculate revenue and profit
    const priceInput = document.getElementById('pricePerTon');
    const pricePerTon = parseFloat(priceInput.value);
    const revenueTotal = (!isNaN(pricePerTon) && !isNaN(yieldTons)) ? pricePerTon * yieldTons : null;

    // Profit (positive = กำไร, negative = ขาดทุน)
    const profitTotal = (revenueTotal != null) ? (revenueTotal - totalCost) : null;
    const profitPerRai = (profitTotal != null && !isNaN(area) && area > 0) ? profitTotal / area : null;

    // Revenue card
    const revenueCard = document.createElement('div');
    revenueCard.classList.add('card');
    const revenueText = (revenueTotal != null) ? `${formatNumber(revenueTotal)} บาท` : '—';
    revenueCard.innerHTML = `<h3>รายได้รวม</h3><p>${revenueText}</p>`;
    summaryContainer.appendChild(revenueCard);

    // Profit / Loss card
    const profitCard = document.createElement('div');
    profitCard.classList.add('card');
    let profitText = '—';
    if (profitTotal != null) {
      const absVal = Math.abs(profitTotal);
      if (profitTotal >= 0) {
        profitText = `กำไร ${formatNumber(absVal)} บาท`;
      } else {
        profitText = `ขาดทุน ${formatNumber(absVal)} บาท`;
      }
    }
    profitCard.innerHTML = `<h3>กำไร/ขาดทุนรวม</h3><p>${profitText}</p>`;
    summaryContainer.appendChild(profitCard);

    // Profit per rai card
    const profitRaiCard = document.createElement('div');
    profitRaiCard.classList.add('card');
    const profitRaiText = (profitPerRai != null) ? `${formatNumber(profitPerRai)} บาท/ไร่` : '—';
    profitRaiCard.innerHTML = `<h3>กำไร/ขาดทุนต่อไร่</h3><p>${profitRaiText}</p>`;
    summaryContainer.appendChild(profitRaiCard);

    // Update chart - The chart shows proportions, so the raw data from the table is correct.
    updateChart(labels, data);

    // Show results section
    resultsSection.style.display = 'block';
    // Scroll summary into view on small screens so user sees profit numbers
    const summaryEl = document.getElementById('summary');
    if (summaryEl) {
      summaryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Initialize or update the pie chart showing cost distribution.
   * @param {string[]} labels - Names of cost categories
   * @param {number[]} data - Corresponding cost totals
   */
  function updateChart(labels, data) {
    // If chart already exists, destroy it before creating a new one
    if (costChart) {
      costChart.destroy();
    }
    // Generate random pastel colors for chart segments
    // Generate a pleasant HSL pastel palette instead of random RGB
    const colors = labels.map((_, i) => {
      const hue = (i * 47) % 360; // spaced hues
      const sat = 65; // saturation
      const light = 70; // lightness for pastel
      return `hsl(${hue} ${sat}% ${light}%)`;
    });

    // Ensure canvas is high-DPI for crisp text
  const canvas = costChartCtx.canvas;
  const ratio = window.devicePixelRatio || 1;
  // Resize canvas backing store
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  costChartCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  costChart = new Chart(costChartCtx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 12
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              font: {
                size: 14
              }
            }
          },
          title: {
            display: true,
            text: 'สัดส่วนต้นทุนแต่ละหมวดหมู่',
            font: {
              size: 18,
              weight: '600'
            }
          },
          tooltip: {
            bodyFont: { size: 13 },
            titleFont: { size: 14 }
          }
        },
        elements: {
          arc: {
            borderWidth: 2
          }
        }
      }
    });
  }

  /**
   * Generate a PDF of the results section using html2canvas and jsPDF.
   */
  async function generatePDF() {
    // Build an off-screen container that will hold the table and results
    const report = document.getElementById('reportArea');
    const resultsEl = document.getElementById('results');
    if (!report) return;

    const container = document.createElement('div');
    // Make fonts larger so the rendered PDF is readable and fills A4
    container.style.boxSizing = 'border-box';
    container.style.background = '#ffffff';
    container.style.padding = '20px';
    container.style.width = '900px'; // wide rendering size for A4
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.fontFamily = '"Kanit", sans-serif'; // Ensure PDF uses the correct font
    container.style.color = '#000';
    container.style.fontSize = '18px'; // Larger base font for PDF
    container.style.lineHeight = '1.45';

    // Helper to clone a node and replace inputs with text so values appear
    function cloneWithValues(node) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('input').forEach((inp) => {
        const span = document.createElement('span');
        span.textContent = inp.value || '';
        // preserve some styling
        span.style.fontFamily = getComputedStyle(inp).fontFamily;
        span.style.fontSize = getComputedStyle(inp).fontSize;
        if (inp.parentNode) inp.parentNode.replaceChild(span, inp);
      });
      return clone;
    }

    // Append table clone
    const reportClone = cloneWithValues(report);
    // Slightly enlarge table fonts inside the clone
    reportClone.style.fontSize = '16px';
    reportClone.querySelectorAll('th').forEach(th => th.style.fontSize = '15px');
    reportClone.querySelectorAll('td').forEach(td => td.style.fontSize = '14px');
    container.appendChild(reportClone);

    // Append results clone (summary + chart)
    if (resultsEl) {
      const resultsClone = cloneWithValues(resultsEl);
      resultsClone.style.display = 'block';
      resultsClone.style.marginTop = '18px';

      // Replace cloned chart canvas with an image generated from live canvas
      const liveCanvas = document.getElementById('costChart');
      if (liveCanvas) {
        try {
          // Create a temporary canvas with white background to avoid black JPEG backgrounds
          const tmp = document.createElement('canvas');
          tmp.width = liveCanvas.width;
          tmp.height = liveCanvas.height;
          const tctx = tmp.getContext('2d');
          // fill white
          tctx.fillStyle = '#ffffff';
          tctx.fillRect(0, 0, tmp.width, tmp.height);
          // draw the chart onto the tmp canvas
          tctx.drawImage(liveCanvas, 0, 0);
          // export as JPEG with good quality
          const chartImgSrc = tmp.toDataURL('image/jpeg', 0.92);
          const img = document.createElement('img');
          img.src = chartImgSrc;
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.background = '#ffffff';
          // Replace any cloned canvas node
          const clonedCanvas = resultsClone.querySelector('#costChart');
          if (clonedCanvas && clonedCanvas.parentNode) clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
          else resultsClone.appendChild(img);
        } catch (err) {
          console.warn('Failed to convert chart for PDF export', err);
        }
      }

      // Slightly larger fonts for summary
      resultsClone.querySelectorAll('.card h3').forEach(h => h.style.fontSize = '17px');
      resultsClone.querySelectorAll('.card p').forEach(p => p.style.fontSize = '18px');

      container.appendChild(resultsClone);
    }

    document.body.appendChild(container);

    // Give browser a moment to render
    await new Promise(r => setTimeout(r, 140));

    // Render at higher scale for clarity on A4
    const scale = 2.2;
    const canvas = await html2canvas(container, { scale, useCORS: true, backgroundColor: '#ffffff' });

    // Clean up
    document.body.removeChild(container);

    // Convert to JPEG to reduce size but ensure background is white
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Convert canvas px to mm (approx) and fit to A4 with small margins
    const pxToMm = px => px * 0.264583;
    const imgWidthMm = pxToMm(canvas.width);
    const imgHeightMm = pxToMm(canvas.height);
    const margin = 10; // mm
    const maxWidth = pdfWidth - margin * 2;
    const maxHeight = pdfHeight - margin * 2;
    const ratio = Math.min(maxWidth / imgWidthMm, maxHeight / imgHeightMm);
    const finalW = imgWidthMm * ratio;
    const finalH = imgHeightMm * ratio;
    const x = (pdfWidth - finalW) / 2;
    const y = margin;

    pdf.addImage(imgData, 'JPEG', x, y, finalW, finalH);
    pdf.save('rice_cost_report.pdf');
  }

  /**
   * Include price per kg in the summary if provided
   */
  function includePricePerTon() {
    const priceInput = document.getElementById('pricePerTon');
    const priceVal = parseFloat(priceInput.value);
    if (!isNaN(priceVal) && priceVal > 0) {
      const priceCard = document.createElement('div');
      priceCard.classList.add('card');
      const perKg = priceVal / 1000;
      priceCard.innerHTML = `<h3>ราคาจำหน่าย</h3><p>${formatNumber(priceVal)} บาท/ตัน<br><small>${formatNumber(perKg)} บาท/กก.</small></p>`;
      summaryContainer.appendChild(priceCard);
    }
  }

  /**
   * Handle switching between input methods.
   */
  function onMethodChange() {
    const method = getInputMethod();
    // Update header display
    const simpleHeaders = document.querySelectorAll('th.simple-col');
    const detailedHeaders = document.querySelectorAll('th.detailed-col');
    if (method === 'simple') {
      simpleHeaders.forEach(th => th.style.display = 'table-cell');
      detailedHeaders.forEach(th => th.style.display = 'none');
    } else {
      simpleHeaders.forEach(th => th.style.display = 'none');
      detailedHeaders.forEach(th => th.style.display = 'table-cell');
    }
    // Update each row display
    const rows = Array.from(costTableBody.querySelectorAll('tr'));
    rows.forEach(row => updateRowDisplay(row, method));
    // Clear results because switching method invalidates previous totals
    resultsSection.style.display = 'none';
  }

  /**
   * Handle switching between calculation modes.
   */
  function onCalculationModeChange() {
    // Update headers based on selected mode
    const mode = getCalculationMode();
    // 1) Update the simple-cost column header (second column)
    const simpleHeader = document.querySelector('#costTable thead tr#tableHeader th.simple-col');
    if (simpleHeader) {
      simpleHeader.textContent = (mode === 'perRai') ? 'ค่าใช้จ่ายต่อไร่ (บาท)' : 'ค่าใช้จ่าย (บาท)';
    }
    // 2) In 'perRai' mode, the total column is redundant, so we hide it.
    //    In 'total' mode, we show it and set the correct header text.
    const totalHeader = document.querySelector('#costTable thead tr#tableHeader th.total-col');
    if (totalHeader) {
      totalHeader.style.display = (mode === 'perRai') ? 'none' : 'table-cell';
      totalHeader.textContent = 'รวม (บาท)'; // This text is for 'total' mode.
    }

    // Also hide/show the total column in all existing body rows
    document.querySelectorAll('#costTableBody .total-col').forEach(cell => {
      cell.style.display = (mode === 'perRai') ? 'none' : 'table-cell';
    });

    // Clear results because switching mode invalidates previous totals
    resultsSection.style.display = 'none';
  }

    // Add initial rows using predefined categories
    function initRows() {
    predefinedCategories.forEach(name => addRow(name));
  }

    // Modal wiring: show on first load unless user remembered a choice
    function initModeModal() {
      const modal = document.getElementById('modeModal');
      if (!modal) return;
      const rememberFlag = localStorage.getItem('calcModeRemember') === '1';
      const savedMode = localStorage.getItem('calcMode');

      // If a saved mode exists and user chose to remember, apply it and hide modal
      if (savedMode && rememberFlag) {
        const radio = document.querySelector(`input[name="calculationMode"][value="${savedMode}"]`);
        if (radio) {
          radio.checked = true;
          onCalculationModeChange();
        }
        modal.classList.add('hidden');
        return;
      }

      // Otherwise show modal so user selects a mode (unless they already saved a mode without remember)
      modal.classList.remove('hidden');
      const btnPerRai = document.getElementById('choosePerRai');
      const btnTotal = document.getElementById('chooseTotal');
      if (btnPerRai) btnPerRai.addEventListener('click', () => selectModalMode('perRai'));
      if (btnTotal) btnTotal.addEventListener('click', () => selectModalMode('total'));
    }

    function selectModalMode(mode) {
      const modal = document.getElementById('modeModal');
      const rememberCheckbox = document.getElementById('rememberMode');
      const radio = document.querySelector(`input[name="calculationMode"][value="${mode}"]`);
      if (radio) radio.checked = true;
      onCalculationModeChange();
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('calcModeRemember', '1');
        localStorage.setItem('calcMode', mode);
      }
      if (modal) modal.classList.add('hidden');
    }

  // Event listeners
  addRowBtn.addEventListener('click', () => addRow());
  calculateBtn.addEventListener('click', () => calculate());
  downloadPdfBtn.addEventListener('click', () => generatePDF());
  document.querySelectorAll('input[name="inputMethod"]').forEach(radio => {
    radio.addEventListener('change', onMethodChange);
  });
  document.querySelectorAll('input[name="calculationMode"]').forEach(radio => {
    radio.addEventListener('change', onCalculationModeChange);
  });

  // Initialize table with default rows
  initRows();
  // Ensure header matches current calculation mode on load
  onCalculationModeChange();
  // Initialize modal to prompt mode selection if needed
  initModeModal();
});
