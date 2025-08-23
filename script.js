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
    totalTd.textContent = '0';
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
      // quantity and unit price are cells 1 and 2 when detailed
      const qtyInput = cells[1].querySelector('input');
      const priceInput = cells[2].querySelector('input');
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
    const method = getInputMethod();
    let totalCost = 0;
    const labels = [];
    const data = [];
    rows.forEach(tr => {
      const cells = tr.children;
      const categoryName = cells[0].querySelector('input').value || 'ไม่ระบุ';
      // Total cell is always the cell before the action cell (second last cell)
      const totalTdIndex = cells.length - 2;
      const totalVal = parseFloat(cells[totalTdIndex].textContent.replace(/,/g, ''));
      if (!isNaN(totalVal) && totalVal > 0) {
        labels.push(categoryName);
        data.push(totalVal);
        totalCost += totalVal;
      }
    });

    // Compute cost per rai and per kg based on inputs
    const areaInput = document.getElementById('area');
    const yieldInput = document.getElementById('yield');
    const area = parseFloat(areaInput.value);
    const yieldVal = parseFloat(yieldInput.value);

    const costPerRai = (!isNaN(area) && area > 0) ? totalCost / area : null;
    const costPerKg = (!isNaN(yieldVal) && yieldVal > 0) ? totalCost / yieldVal : null;

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

    // Update chart
    updateChart(labels, data);

    // Show results section
    resultsSection.style.display = 'block';
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
    const colors = labels.map(() => {
      const r = Math.floor(Math.random() * 156) + 100; // 100-255
      const g = Math.floor(Math.random() * 156) + 100;
      const b = Math.floor(Math.random() * 156) + 100;
      return `rgba(${r}, ${g}, ${b}, 0.7)`;
    });
    costChart = new Chart(costChartCtx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'สัดส่วนต้นทุนแต่ละหมวดหมู่',
            font: {
              size: 16
            }
          }
        }
      }
    });
  }

  /**
   * Generate a PDF of the results section using html2canvas and jsPDF.
   */
  async function generatePDF() {
    const element = document.getElementById('results');
    // Use html2canvas to capture the element as a canvas
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    // Calculate image dimensions to fit within A4 page while maintaining aspect ratio
    const imgProps = {
      width: canvas.width,
      height: canvas.height
    };
    const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
    const imgWidth = imgProps.width * ratio;
    const imgHeight = imgProps.height * ratio;
    const x = (pdfWidth - imgWidth) / 2;
    const y = 10; // top margin
    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    pdf.save('rice_cost_report.pdf');
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

  // Add initial rows using predefined categories
  function initRows() {
    predefinedCategories.forEach(name => addRow(name));
  }

  // Event listeners
  addRowBtn.addEventListener('click', () => addRow());
  calculateBtn.addEventListener('click', () => calculate());
  downloadPdfBtn.addEventListener('click', () => generatePDF());
  document.querySelectorAll('input[name="inputMethod"]').forEach(radio => {
    radio.addEventListener('change', onMethodChange);
  });

  // Initialize table with default rows
  initRows();
});