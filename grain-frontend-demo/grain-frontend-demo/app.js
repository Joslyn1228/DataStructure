
const sampleCSVData = `批次号,粮食名称,数量(吨),入库日期,预警日期/交割截止日期,仓位,状态,业务类型
scmxs260212001S,小麦,4115,2026-02-12,2026-04-28,湖北荆门北郊国家粮食储备库-23号仓,待出库,销售/轮出
scmxs260212002S,小麦,4000,2026-02-12,2026-04-28,湖北荆门北郊国家粮食储备库-29号仓,待出库,销售/轮出
scmcg260212003B,小麦,4115,2026-02-12,2026-06-30,湖北荆门北郊国家粮食储备库-23号仓,待入库,采购/轮入
scmcg260212004B,小麦,4000,2026-02-12,2026-06-30,湖北荆门北郊国家粮食储备库-29号仓,待入库,采购/轮入
scdcg250512001B,中晚籼稻,2530,2025-05-12,2025-10-31,荆门公司-01号仓,待入库,采购/轮入
scdxs250512002S,中晚籼稻,2530,2025-05-12,,荆门公司-01号仓,待出库,销售/轮出
scdxs260514003S,中晚籼稻,3397,2026-05-14,,孝感公司-14号仓,待出库,销售/轮出
scdcg260514004B,中晚籼稻,3397,2026-05-14,2026-12-05,孝感公司-14号仓,待入库,采购/轮入`;

let state = {
  batches: [],
  nameIndex: {},
  warningHeap: [],
  operationStack: [],
  taskQueue: []
};

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',');
  const batches = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length >= headers.length) {
      const batch = {
        batchId: values[0],
        name: values[1],
        amount: parseInt(values[2]) || 0,
        inDate: values[3],
        warningDate: values[4] || '',
        position: values[5],
        status: values[6],
        businessType: values[7]
      };
      batches.push(batch);
    }
  }
  
  return batches;
}

function rebuildNameIndex() {
  state.nameIndex = {};
  state.batches.forEach((batch, index) => {
    if (batch && batch.status !== '已出库') {
      if (!state.nameIndex[batch.name]) {
        state.nameIndex[batch.name] = [];
      }
      state.nameIndex[batch.name].push(index);
    }
  });
}

function rebuildWarningHeap() {
  state.warningHeap = [];
  state.batches.forEach((batch, index) => {
    if (batch && batch.warningDate && batch.status !== '已出库') {
      state.warningHeap.push({
        warningDate: batch.warningDate,
        batchId: batch.batchId,
        index,
        name: batch.name
      });
    }
  });
  state.warningHeap.sort((a, b) => a.warningDate.localeCompare(b.warningDate));
}

function updateStatistics() {
  const validBatches = state.batches.filter(b => b);
  document.getElementById('totalBatches').textContent = validBatches.length;
  const totalAmount = validBatches.reduce((sum, b) => sum + b.amount, 0);
  document.getElementById('totalAmount').textContent = totalAmount + ' 吨';
  document.getElementById('warningCount').textContent = state.warningHeap.length;
}

function renderBatches(filter = '') {
  const panel = document.getElementById('batchesPanel');
  
  let batches = state.batches.filter(b => b);
  if (filter) {
    batches = batches.filter(b => 
      b.batchId.toLowerCase().includes(filter.toLowerCase()) ||
      b.name.toLowerCase().includes(filter.toLowerCase())
    );
  }
  
  if (!batches.length) {
    panel.innerHTML = '<div class="empty-state">暂无批次数据</div>';
    return;
  }
  
  const rows = batches.map((batch, displayIndex) => {
    const originalIndex = state.batches.indexOf(batch);
    return `
      <tr data-index="${originalIndex}">
        <td>${originalIndex}</td>
        <td><code>${batch.batchId}</code></td>
        <td>${batch.name}</td>
        <td>${batch.amount}</td>
        <td>${batch.inDate}</td>
        <td>${batch.warningDate || '无'}</td>
        <td>${batch.position}</td>
        <td><span class="status-badge ${statusClassName(batch.status)}">${batch.status}</span></td>
        <td><span class="business-badge">${batch.businessType}</span></td>
        <td>
          <button class="mini-btn" onclick="changeBatchStatus(${originalIndex})">出库</button>
        </td>
      </tr>
    `;
  }).join('');
  
  panel.innerHTML = `
    <div class="table-scroll">
      <table class="batch-table">
        <thead>
          <tr>
            <th>下标</th>
            <th>批次号</th>
            <th>名称</th>
            <th>数量(吨)</th>
            <th>入库日期</th>
            <th>预警日期</th>
            <th>仓位</th>
            <th>状态</th>
            <th>业务类型</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderNameIndex() {
  const panel = document.getElementById('nameIndexPanel');
  const names = Object.keys(state.nameIndex);
  
  if (!names.length) {
    panel.innerHTML = '<div class="empty-state">名称索引为空</div>';
    return;
  }
  
  panel.innerHTML = names.map(name => {
    const indices = state.nameIndex[name];
    const tags = indices.map(i => `<span class="index-tag">主表下标 ${i}</span>`).join('');
    return `
      <article class="index-card">
        <div class="index-title">
          <strong>${name}</strong>
          <span>${indices.length} 条</span>
        </div>
        <div class="index-tags">${tags}</div>
      </article>
    `;
  }).join('');
}

function renderStack() {
  const panel = document.getElementById('stackPanel');
  
  if (!state.operationStack.length) {
    panel.innerHTML = '<div class="empty-state">操作栈为空，暂无操作记录</div>';
    return;
  }
  
  panel.innerHTML = state.operationStack.map((op, i) => {
    const isTop = i === state.operationStack.length - 1;
    return `
      <article class="stack-card ${isTop ? 'is-top' : ''}">
        <header>
          <h4>${op.type === 'in' ? '入库记录' : '出库记录'}</h4>
          <span class="stack-tag">${isTop ? '栈顶' : `第 ${i + 1} 条`}</span>
        </header>
        <div class="stack-meta">
          <div>批次号：<code>${op.batchId}</code></div>
        </div>
      </article>
    `;
  }).join('');
}

function renderQueue() {
  const panel = document.getElementById('queuePanel');
  
  if (!state.taskQueue.length) {
    panel.innerHTML = '<div class="empty-state">队列为空，暂无待处理任务</div>';
    return;
  }
  
  panel.innerHTML = state.taskQueue.map((task, i) => {
    const label = task.type === 'in' ? '入库' : task.type === 'out' ? '出库' : '预警';
    return `
      <article class="queue-card ${i === 0 ? 'is-focus' : ''}">
        <header>
          <h4>${task.label}</h4>
          <span class="queue-tag ${queueClassName(task.type)}">${i === 0 ? '队头' : `队位 ${i + 1}`}</span>
        </header>
        <div class="queue-meta">
          <div>任务类型：${label}</div>
          <div>批次号：${task.batchId ? `<code>${task.batchId}</code>` : '无'}</div>
        </div>
      </article>
    `;
  }).join('');
}

function updateNameSelects() {
  const grainSelect = document.getElementById('grainNameSelect');
  const outboundSelect = document.getElementById('outboundGrainSelect');
  const names = Object.keys(state.nameIndex);
  
  grainSelect.innerHTML = '<option value="">选择粮食名称</option>';
  outboundSelect.innerHTML = '<option value="">选择粮食品种</option>';
  
  names.forEach(name => {
    grainSelect.innerHTML += `<option value="${name}">${name}</option>`;
    outboundSelect.innerHTML += `<option value="${name}">${name}</option>`;
  });
}

function getNearExpiryBatches(days = 30) {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(today.getDate() + days);
  const thresholdStr = threshold.toISOString().split('T')[0];
  
  return state.warningHeap.filter(item => {
    return item.warningDate && item.warningDate <= thresholdStr;
  });
}

function getOutboundSequence(grainName) {
  return state.batches
    .map((batch, index) => ({ batch, index }))
    .filter(({ batch }) => 
      batch && 
      batch.name === grainName && 
      batch.status === '待出库'
    )
    .sort((a, b) => {
      const dateA = a.batch.warningDate || '9999-12-31';
      const dateB = b.batch.warningDate || '9999-12-31';
      return dateA.localeCompare(dateB);
    })
    .map(({ batch, index }) => ({
      index,
      batchId: batch.batchId,
      warningDate: batch.warningDate || '无',
      name: batch.name
    }));
}

function renderWarningInfo(days = 30) {
  const earliestEl = document.getElementById('earliestWarning');
  const nearExpiryEl = document.getElementById('nearExpiryPanel');
  
  if (!state.warningHeap.length) {
    earliestEl.innerHTML = '<div class="empty-state">暂无预警批次</div>';
    nearExpiryEl.innerHTML = '<div class="empty-state">暂无临期批次</div>';
    return;
  }
  
  const earliest = state.warningHeap[0];
  earliestEl.innerHTML = `
    <div class="heap-card is-top">
      <header>
        <h4><code>${earliest.batchId}</code></h4>
        <span class="heap-tag">堆顶</span>
      </header>
      <div class="heap-meta">
        <div>粮食名称：${earliest.name}</div>
        <div>预警日期：${earliest.warningDate}</div>
        <div>主表下标：${earliest.index}</div>
      </div>
    </div>
  `;
  
  const nearExpiry = getNearExpiryBatches(days);
  if (!nearExpiry.length) {
    nearExpiryEl.innerHTML = '<div class="empty-state">未来 ' + days + ' 天内无临期批次</div>';
  } else {
    nearExpiryEl.innerHTML = nearExpiry.map((item, i) => `
      <article class="heap-card is-focus">
        <header>
          <h4><code>${item.batchId}</code></h4>
          <span class="heap-tag">临期</span>
        </header>
        <div class="heap-meta">
          <div>粮食名称：${item.name}</div>
          <div>预警日期：${item.warningDate}</div>
          <div>主表下标：${item.index}</div>
        </div>
      </article>
    `).join('');
  }
}

function renderOutboundSequence(grainName) {
  const panel = document.getElementById('outboundSequencePanel');
  
  if (!grainName) {
    panel.innerHTML = '<div class="empty-state">请选择粮食品种</div>';
    return;
  }
  
  const sequence = getOutboundSequence(grainName);
  if (!sequence.length) {
    panel.innerHTML = '<div class="empty-state">该品种暂无待出库批次</div>';
    return;
  }
  
  panel.innerHTML = sequence.map((item, i) => `
    <article class="heap-card">
      <header>
        <h4><code>${item.batchId}</code></h4>
        <span class="heap-tag">第 ${i + 1} 出库</span>
      </header>
      <div class="heap-meta">
        <div>粮食名称：${item.name}</div>
        <div>预警日期：${item.warningDate}</div>
        <div>主表下标：${item.index}</div>
      </div>
    </article>
  `).join('');
}

function sortByAmount(descending = true) {
  const valid = state.batches.filter(b => b);
  return valid.sort((a, b) => descending ? b.amount - a.amount : a.amount - b.amount);
}

function sortByWarningDate(descending = false) {
  const valid = state.batches.filter(b => b);
  return valid.sort((a, b) => {
    const dateA = a.warningDate || '9999-12-31';
    const dateB = b.warningDate || '9999-12-31';
    return descending ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
  });
}

function renderSortedBatches(sortedList, title) {
  const panel = document.getElementById('sortedBatchesPanel');
  
  if (!sortedList.length) {
    panel.innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  
  const rows = sortedList.map((batch) => {
    const originalIndex = state.batches.indexOf(batch);
    return `
      <tr>
        <td>${originalIndex}</td>
        <td><code>${batch.batchId}</code></td>
        <td>${batch.name}</td>
        <td>${batch.amount}</td>
        <td>${batch.warningDate || '无'}</td>
        <td>${batch.position}</td>
        <td><span class="status-badge ${statusClassName(batch.status)}">${batch.status}</span></td>
      </tr>
    `;
  }).join('');
  
  panel.innerHTML = `
    <h4 style="margin-bottom: 10px;">${title}</h4>
    <div class="table-scroll">
      <table class="batch-table">
        <thead>
          <tr>
            <th>下标</th>
            <th>批次号</th>
            <th>名称</th>
            <th>数量(吨)</th>
            <th>预警日期</th>
            <th>仓位</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderSearchResults(grainName) {
  const panel = document.getElementById('searchResults');
  
  if (!grainName || !state.nameIndex[grainName]) {
    panel.innerHTML = '<div class="empty-state">请选择粮食名称</div>';
    return;
  }
  
  const indices = state.nameIndex[grainName];
  const batches = indices.map(i => state.batches[i]).filter(b => b);
  
  if (!batches.length) {
    panel.innerHTML = '<div class="empty-state">该品种暂无有效批次</div>';
    return;
  }
  
  const rows = batches.map((batch) => {
    const originalIndex = state.batches.indexOf(batch);
    return `
      <tr>
        <td>${originalIndex}</td>
        <td><code>${batch.batchId}</code></td>
        <td>${batch.name}</td>
        <td>${batch.amount}</td>
        <td>${batch.inDate}</td>
        <td>${batch.warningDate || '无'}</td>
        <td>${batch.position}</td>
        <td><span class="status-badge ${statusClassName(batch.status)}">${batch.status}</span></td>
      </tr>
    `;
  }).join('');
  
  panel.innerHTML = `
    <div class="table-scroll">
      <table class="batch-table">
        <thead>
          <tr>
            <th>下标</th>
            <th>批次号</th>
            <th>名称</th>
            <th>数量(吨)</th>
            <th>入库日期</th>
            <th>预警日期</th>
            <th>仓位</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function statusClassName(status) {
  if (status === '待入库') return 'status-pending-in';
  if (status === '待出库') return 'status-pending-out';
  return 'status-finished';
}

function queueClassName(type) {
  if (type === 'in') return 'queue-in';
  if (type === 'out') return 'queue-out';
  return 'queue-warn';
}

function addBatch(batch) {
  const index = state.batches.length;
  state.batches.push(batch);
  
  state.operationStack.push({
    type: 'in',
    index,
    batchId: batch.batchId,
    batch: { ...batch }
  });
  
  rebuildNameIndex();
  rebuildWarningHeap();
  updateAll();
}

function changeBatchStatus(index) {
  const batch = state.batches[index];
  if (!batch || batch.status === '已出库') return;
  
  const oldAmount = batch.amount;
  const oldStatus = batch.status;
  
  state.operationStack.push({
    type: 'out',
    changes: [{
      index,
      batchId: batch.batchId,
      oldAmount,
      oldStatus,
      name: batch.name
    }]
  });
  
  batch.amount = 0;
  batch.status = '已出库';
  
  rebuildNameIndex();
  rebuildWarningHeap();
  updateAll();
}

function undo() {
  if (!state.operationStack.length) {
    alert('无可撤销的操作');
    return;
  }
  
  const op = state.operationStack.pop();
  
  if (op.type === 'in') {
    state.batches[op.index] = null;
  } else if (op.type === 'out') {
    op.changes.forEach(change => {
      const batch = state.batches[change.index];
      if (batch) {
        batch.amount = change.oldAmount;
        batch.status = change.oldStatus;
      }
    });
  }
  
  rebuildNameIndex();
  rebuildWarningHeap();
  updateAll();
}

function addTask(type, batchId = null) {
  const labels = {
    'in': '执行入库',
    'out': '执行出库',
    'warn': '扫描临期批次'
  };
  
  state.taskQueue.push({
    type,
    batchId,
    label: labels[type]
  });
  
  renderQueue();
}

function processTask() {
  if (!state.taskQueue.length) {
    alert('任务队列为空');
    return;
  }
  
  const task = state.taskQueue.shift();
  
  if (task.type === 'out' && task.batchId) {
    const index = state.batches.findIndex(b => b && b.batchId === task.batchId);
    if (index !== -1) {
      changeBatchStatus(index);
      return;
    }
  }
  
  alert('处理任务：' + task.label);
  renderQueue();
}

function exportToCSV() {
  const headers = ['批次号', '粮食名称', '数量(吨)', '入库日期', '预警日期/交割截止日期', '仓位', '状态', '业务类型'];
  const rows = state.batches.filter(b => b).map(batch => [
    batch.batchId,
    batch.name,
    batch.amount,
    batch.inDate,
    batch.warningDate,
    batch.position,
    batch.status,
    batch.businessType
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '粮食数据_导出.csv';
  link.click();
}

function updateAll() {
  updateStatistics();
  renderBatches();
  renderNameIndex();
  renderStack();
  renderQueue();
  updateNameSelects();
  renderWarningInfo(parseInt(document.getElementById('warningDaysInput').value) || 30);
}

function initEventListeners() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('is-active');
      document.getElementById(btn.dataset.tab + '-tab').style.display = 'block';
    });
  });
  
  document.getElementById('loadCsvBtn').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
  });
  
  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.batches = parseCSV(event.target.result);
        rebuildNameIndex();
        rebuildWarningHeap();
        updateAll();
        alert('数据加载成功！');
      };
      reader.readAsText(file);
    }
  });
  
  document.getElementById('addBatchBtn').addEventListener('click', () => {
    document.getElementById('addBatchModal').style.display = 'flex';
  });
  
  document.getElementById('cancelAddBatch').addEventListener('click', () => {
    document.getElementById('addBatchModal').style.display = 'none';
  });
  
  document.getElementById('confirmAddBatch').addEventListener('click', () => {
    const batch = {
      batchId: document.getElementById('newBatchId').value,
      name: document.getElementById('newGrainName').value,
      amount: parseInt(document.getElementById('newAmount').value) || 0,
      inDate: document.getElementById('newInDate').value,
      warningDate: document.getElementById('newWarningDate').value,
      position: document.getElementById('newPosition').value,
      status: document.getElementById('newStatus').value,
      businessType: document.getElementById('newBusinessType').value
    };
    
    if (!batch.batchId || !batch.name) {
      alert('批次号和粮食名称为必填项');
      return;
    }
    
    addBatch(batch);
    document.getElementById('addBatchModal').style.display = 'none';
    document.querySelectorAll('#addBatchModal .form-input').forEach(input => input.value = '');
  });
  
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('saveBtn').addEventListener('click', exportToCSV);
  
  document.getElementById('batchSearchInput').addEventListener('input', (e) => {
    renderBatches(e.target.value);
  });
  
  document.getElementById('grainNameSelect').addEventListener('change', (e) => {
    renderSearchResults(e.target.value);
  });
  
  document.getElementById('warningDaysInput').addEventListener('change', (e) => {
    renderWarningInfo(parseInt(e.target.value) || 30);
  });
  
  document.getElementById('outboundGrainSelect').addEventListener('change', (e) => {
    renderOutboundSequence(e.target.value);
  });
  
  document.getElementById('sortByAmountBtn').addEventListener('click', () => {
    const sorted = sortByAmount(true);
    renderSortedBatches(sorted, '按数量从大到小排序');
  });
  
  document.getElementById('sortByDateBtn').addEventListener('click', () => {
    const sorted = sortByWarningDate(false);
    renderSortedBatches(sorted, '按预警日期从早到晚排序');
  });
  
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    document.getElementById('addTaskModal').style.display = 'flex';
  });
  
  document.getElementById('cancelAddTask').addEventListener('click', () => {
    document.getElementById('addTaskModal').style.display = 'none';
  });
  
  document.getElementById('confirmAddTask').addEventListener('click', () => {
    const type = document.getElementById('newTaskType').value;
    const batchId = document.getElementById('newTaskBatchId').value;
    addTask(type, type !== 'warn' ? batchId : null);
    document.getElementById('addTaskModal').style.display = 'none';
    document.getElementById('newTaskBatchId').value = '';
  });
  
  document.getElementById('processTaskBtn').addEventListener('click', processTask);
  
  document.getElementById('newTaskType').addEventListener('change', (e) => {
    document.getElementById('taskBatchIdGroup').style.display = e.target.value === 'warn' ? 'none' : 'block';
  });
  
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').style.display = 'none';
    });
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

function loadSampleData() {
  state.batches = parseCSV(sampleCSVData);
  rebuildNameIndex();
  rebuildWarningHeap();
  updateAll();
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadSampleData();
});

