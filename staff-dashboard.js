const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function csvCell(value) {
  let text = String(value ?? '');
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvDocument(columns, rows) {
  const header = columns.map(column => csvCell(column.label)).join(',');
  const body = rows.map(row => columns.map(column => csvCell(row[column.key])).join(',')).join('\r\n');
  return `\uFEFF${header}${body ? `\r\n${body}` : ''}\r\n`;
}

export function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(cents || 0) / 100);
}

function initStaffDashboard() {
  const root = document.getElementById('rb-staff-output');
  if (!root || root.dataset.liveInitialized === 'true') return;
  root.dataset.liveInitialized = 'true';

  const navButtons = [...root.querySelectorAll('.rb-nav button')];
  const billingView = root.querySelector('#rb-billing-view');
  const scheduleView = root.querySelector('#rb-schedule-view');
  const reportButtons = [...root.querySelectorAll('.rb-view-toggle button')];
  const chargesTable = root.querySelector('#rb-charges-table');
  const familiesTable = root.querySelector('#rb-families-table');
  const reportHeading = root.querySelector('#rb-report-heading');
  const reportCaption = root.querySelector('#rb-report-caption');
  const rowCount = root.querySelector('#rb-row-count');
  const feedback = root.querySelector('#rb-feedback');
  const scheduleCalendar = root.querySelector('#rb-schedule-calendar');
  const dayTitle = root.querySelector('#rb-day-title');
  const dayTime = root.querySelector('#rb-day-title + span');
  const bookedCount = root.querySelector('#rb-booked-count');
  const capacityDots = root.querySelector('#rb-capacity-dots');
  const rosterList = root.querySelector('#rb-roster-list');
  const rosterNote = root.querySelector('#rb-roster-note');
  const previousMonth = root.querySelector('#rb-staff-previous-month');
  const nextMonth = root.querySelector('#rb-staff-next-month');
  const monthLabel = root.querySelector('#rb-staff-month-label');
  const toggleDay = root.querySelector('#rb-toggle-day');
  const periodStart = root.querySelector('#rb-period-start');
  const periodEnd = root.querySelector('#rb-period-end');
  const statusFilter = root.querySelector('#rb-status-filter');
  const chargesBody = root.querySelector('#rb-charges-body');
  const familiesBody = root.querySelector('#rb-families-body');

  const state = {
    currentMonth: new Date(Date.UTC(2026, 8, 1, 12)),
    firstMonth: new Date(Date.UTC(2026, 8, 1, 12)),
    lastMonth: new Date(Date.UTC(2027, 5, 1, 12)),
    schedule: [],
    selectedDay: null,
    report: 'families',
    billing: { lines: [], families: [] },
    staffRole: document.documentElement.dataset.staffRole || 'staff'
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace('/staff-login.html');
      throw new Error('Staff access expired.');
    }
    if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
    return result;
  };

  const isoDate = date => date.toISOString().slice(0, 10);
  const monthStart = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
  const monthEnd = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
  const dateLabel = value => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const shortDate = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const timeLabel = value => {
    const [hour, minute] = String(value || '12:00').split(':').map(Number);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, hour, minute));
  };
  const element = (tag, text, className = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  };

  function weekdayGrid(month, dayMap) {
    const result = [];
    const first = monthStart(month);
    const rawOffset = (first.getUTCDay() + 6) % 7;
    const offset = rawOffset > 4 ? 0 : rawOffset;
    for (let index = 0; index < offset; index += 1) result.push(null);
    const final = monthEnd(month).getUTCDate();
    for (let number = 1; number <= final; number += 1) {
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), number, 12));
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
      result.push(dayMap.get(isoDate(date)) || { serviceDate: isoDate(date), notOpen: true });
    }
    while (result.length % 5) result.push(null);
    return result;
  }

  async function loadSchedule(preferredDate = '') {
    const start = isoDate(monthStart(state.currentMonth));
    const end = isoDate(monthEnd(state.currentMonth));
    monthLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(state.currentMonth);
    previousMonth.disabled = state.currentMonth <= state.firstMonth;
    nextMonth.disabled = state.currentMonth >= state.lastMonth;
    scheduleCalendar.setAttribute('aria-busy', 'true');
    scheduleCalendar.innerHTML = '<p class="rb-feedback">Loading schedule…</p>';
    try {
      const result = await requestJson(`/api/staff/schedule?start=${start}&end=${end}`);
      state.schedule = result.days || [];
      renderSchedule();
      const selected = state.schedule.find(day => day.serviceDate === preferredDate)
        || state.schedule.find(day => day.bookingEnabled && !day.closureNote)
        || state.schedule[0];
      if (selected) await showDay(selected);
      else showEmptyDay();
    } catch (error) {
      scheduleCalendar.innerHTML = '';
      scheduleCalendar.append(element('p', error.message, 'rb-feedback'));
      showEmptyDay();
    } finally {
      scheduleCalendar.removeAttribute('aria-busy');
    }
  }

  function renderSchedule() {
    scheduleCalendar.innerHTML = '';
    const dayMap = new Map(state.schedule.map(day => [day.serviceDate, day]));
    weekdayGrid(state.currentMonth, dayMap).forEach(day => {
      if (!day) {
        const blank = element('span', '', 'rb-day rb-blank');
        blank.setAttribute('aria-hidden', 'true');
        scheduleCalendar.append(blank);
        return;
      }
      const button = element('button', '', 'rb-day');
      button.type = 'button';
      button.dataset.date = day.serviceDate;
      const number = Number(day.serviceDate.slice(-2));
      const closed = day.notOpen || !day.bookingEnabled || Boolean(day.closureNote);
      const label = day.notOpen ? 'Not open' : closed ? (day.closureNote || 'School closed') : Number(day.openCount) === 0 ? 'Full' : `${day.openCount} open`;
      button.innerHTML = `<span class="rb-day-top"><strong class="rb-day-number">${number}</strong>${day.notOpen ? '' : `<span class="rb-day-count">${day.bookedCount}/${day.capacity}</span>`}</span><span class="rb-day-label"></span>`;
      button.querySelector('.rb-day-label').textContent = label;
      button.disabled = Boolean(day.notOpen);
      button.classList.toggle('is-full', !day.notOpen && Number(day.openCount) === 0);
      button.setAttribute('aria-label', `${dateLabel(day.serviceDate)}, ${label}`);
      button.setAttribute('aria-pressed', String(state.selectedDay?.serviceDate === day.serviceDate));
      if (!day.notOpen) button.addEventListener('click', () => showDay(day));
      scheduleCalendar.append(button);
    });
  }

  function showEmptyDay() {
    state.selectedDay = null;
    dayTitle.textContent = 'No program days this month';
    dayTime.textContent = '';
    bookedCount.textContent = '0 of 14';
    capacityDots.innerHTML = '';
    rosterList.innerHTML = '';
    rosterList.append(element('div', 'No children signed up.', 'rb-roster-row'));
    rosterNote.textContent = '0 children signed up.';
    toggleDay.hidden = true;
  }

  async function showDay(day) {
    state.selectedDay = day;
    renderSchedule();
    dayTitle.textContent = dateLabel(day.serviceDate);
    dayTime.textContent = `${timeLabel(day.startTime)}–${timeLabel(day.endTime)}`;
    bookedCount.textContent = `${day.bookedCount} of ${day.capacity}`;
    const open = Number(day.capacity) - Number(day.bookedCount);
    capacityDots.setAttribute('aria-label', `${day.bookedCount} booked and ${open} open spots`);
    capacityDots.innerHTML = Array.from({ length: Number(day.capacity) }, (_, index) => `<i class="${index >= Number(day.bookedCount) ? 'is-open' : ''}" aria-hidden="true"></i>`).join('');
    toggleDay.hidden = state.staffRole !== 'admin';
    toggleDay.textContent = day.bookingEnabled && !day.closureNote ? 'Mark school closed' : 'Reopen this day';
    rosterList.innerHTML = '';
    rosterList.append(element('div', 'Loading roster…', 'rb-roster-row'));
    try {
      const result = await requestJson(`/api/staff/roster?date=${day.serviceDate}`);
      const roster = result.roster || [];
      rosterList.innerHTML = '';
      roster.forEach(item => {
        const row = element('div', '', 'rb-roster-row');
        row.append(
          element('strong', item.childName),
          element('b', item.confirmationCode),
          element('span', `${item.parentName} · ${item.email}`)
        );
        rosterList.append(row);
      });
      if (!roster.length) rosterList.append(element('div', 'No children signed up yet.', 'rb-roster-row'));
      rosterNote.textContent = `${roster.length} ${roster.length === 1 ? 'child' : 'children'} signed up.`;
    } catch (error) {
      rosterList.innerHTML = '';
      rosterList.append(element('div', error.message, 'rb-roster-row'));
      rosterNote.textContent = 'Roster unavailable.';
    }
  }

  function filteredBilling() {
    const status = statusFilter.value;
    const families = (state.billing.families || []).filter(row => status === 'all' || row.status === status);
    const allowed = new Set(families.map(row => Number(row.familyId)));
    const lines = (state.billing.lines || []).filter(row => allowed.has(Number(row.familyId)));
    return { families, lines };
  }

  function statusBadge(status) {
    const labels = { ready: 'Ready', sent: 'Sent', paid: 'Paid', waived: 'Waived' };
    const classes = { sent: 'rb-sent', paid: 'rb-paid', waived: 'rb-late' };
    return { label: labels[status] || 'Ready', className: `rb-status ${classes[status] || ''}`.trim() };
  }

  function renderBilling() {
    const { families, lines } = filteredBilling();
    const total = families.reduce((sum, row) => sum + Number(row.totalCents || 0), 0);
    const spots = families.reduce((sum, row) => sum + Number(row.childSpots || 0), 0);
    root.querySelector('#rb-period-total').textContent = money(total);
    root.querySelector('#rb-family-count').textContent = String(families.length);
    root.querySelector('#rb-child-spots').textContent = String(spots);
    root.querySelector('#rb-charges-spots').textContent = String(spots);
    root.querySelector('#rb-charges-total').textContent = money(total);
    root.querySelector('#rb-families-count').textContent = `${families.length} ${families.length === 1 ? 'family' : 'families'}`;
    root.querySelector('#rb-families-spots').textContent = String(spots);
    root.querySelector('#rb-families-total').textContent = money(total);
    rowCount.textContent = state.report === 'charges'
      ? `${lines.length} ${lines.length === 1 ? 'charge' : 'charges'}`
      : `${families.length} ${families.length === 1 ? 'family' : 'families'}`;

    chargesBody.innerHTML = '';
    lines.forEach(line => {
      const row = document.createElement('tr');
      const badge = statusBadge(line.status);
      [shortDate(line.serviceDate), line.parentName, line.children, line.childCount, line.rateNumber, money(line.rateCents)].forEach((value, index) => {
        const cell = element('td', value, index === 3 || index === 4 ? 'rb-number' : index === 5 ? 'rb-money' : '');
        row.append(cell);
      });
      const statusCell = document.createElement('td');
      statusCell.append(element('span', badge.label, badge.className));
      row.append(statusCell);
      chargesBody.append(row);
    });
    if (!lines.length) {
      const row = document.createElement('tr');
      const cell = element('td', 'No billable reservations in this period.');
      cell.colSpan = 7;
      row.append(cell);
      chargesBody.append(row);
    }

    familiesBody.innerHTML = '';
    families.forEach(family => {
      const row = document.createElement('tr');
      const mix = [
        Number(family.singleRateDays) ? `${family.singleRateDays} × #1` : '',
        Number(family.siblingRateDays) ? `${family.siblingRateDays} × #2` : ''
      ].filter(Boolean).join(' · ');
      [family.parentName, family.email, family.billableDays, family.childSpots, mix, money(family.totalCents)].forEach((value, index) => {
        row.append(element('td', value, index === 2 || index === 3 ? 'rb-number' : index === 5 ? 'rb-money' : ''));
      });
      const statusCell = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'rb-billing-status';
      select.setAttribute('aria-label', `${family.parentName} billing status`);
      for (const [value, label] of Object.entries({ ready: 'Ready', sent: 'Sent', paid: 'Paid', waived: 'Waived' })) {
        const option = element('option', label);
        option.value = value;
        option.selected = family.status === value;
        select.append(option);
      }
      select.addEventListener('change', () => saveBillingStatus(family, select));
      statusCell.append(select);
      row.append(statusCell);
      familiesBody.append(row);
    });
    if (!families.length) {
      const row = document.createElement('tr');
      const cell = element('td', 'No families to bill in this period.');
      cell.colSpan = 7;
      row.append(cell);
      familiesBody.append(row);
    }
  }

  async function loadBilling() {
    if (!periodStart.value || !periodEnd.value || periodEnd.value < periodStart.value) {
      feedback.textContent = 'Choose a valid billing period.';
      return;
    }
    feedback.textContent = 'Loading billing report…';
    try {
      state.billing = await requestJson(`/api/staff/billing?start=${periodStart.value}&end=${periodEnd.value}`);
      feedback.textContent = 'Billing report is up to date.';
      renderBilling();
    } catch (error) {
      feedback.textContent = error.message;
    }
  }

  async function saveBillingStatus(family, select) {
    const previous = family.status;
    select.disabled = true;
    feedback.textContent = `Saving ${family.parentName}…`;
    try {
      await requestJson('/api/staff/billing-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          periodStart: periodStart.value,
          periodEnd: periodEnd.value,
          familyId: family.familyId,
          status: select.value
        })
      });
      family.status = select.value;
      state.billing.lines.filter(line => Number(line.familyId) === Number(family.familyId)).forEach(line => { line.status = select.value; });
      feedback.textContent = `${family.parentName} marked ${select.options[select.selectedIndex].text}.`;
      renderBilling();
    } catch (error) {
      family.status = previous;
      select.value = previous;
      feedback.textContent = error.message;
    } finally {
      select.disabled = false;
    }
  }

  function downloadCsv() {
    const { families, lines } = filteredBilling();
    const charges = [
      { key: 'serviceDate', label: 'Service date' }, { key: 'parentName', label: 'Family' },
      { key: 'email', label: 'Email' }, { key: 'children', label: 'Children' },
      { key: 'childCount', label: 'Child-spots' }, { key: 'rateNumber', label: 'Rate number' },
      { key: 'rate', label: 'Rate' }, { key: 'status', label: 'Status' }
    ];
    const familyColumns = [
      { key: 'parentName', label: 'Family' }, { key: 'email', label: 'Email' },
      { key: 'billableDays', label: 'Billable dates' }, { key: 'childSpots', label: 'Child-spots' },
      { key: 'rateMix', label: 'Rate mix' }, { key: 'total', label: 'Total' }, { key: 'status', label: 'Status' }
    ];
    const rows = state.report === 'charges'
      ? lines.map(line => ({ ...line, rate: money(line.rateCents) }))
      : families.map(family => ({
          ...family,
          rateMix: [Number(family.singleRateDays) ? `${family.singleRateDays} × #1` : '', Number(family.siblingRateDays) ? `${family.siblingRateDays} × #2` : ''].filter(Boolean).join(' · '),
          total: money(family.totalCents)
        }));
    const csv = csvDocument(state.report === 'charges' ? charges : familyColumns, rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `stay-and-play-${state.report}-${periodStart.value}-to-${periodEnd.value}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    feedback.textContent = `Downloaded ${rows.length} ${state.report === 'charges' ? 'charges' : 'families'}.`;
  }

  navButtons.forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.view;
    navButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    billingView.hidden = view !== 'billing';
    scheduleView.hidden = view !== 'schedule';
    if (view === 'billing') loadBilling();
  }));

  reportButtons.forEach(button => button.addEventListener('click', () => {
    state.report = button.dataset.report;
    reportButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    chargesTable.hidden = state.report !== 'charges';
    familiesTable.hidden = state.report !== 'families';
    reportHeading.textContent = state.report === 'charges' ? 'Charges by date' : 'Family totals';
    reportCaption.textContent = state.report === 'charges' ? 'One family charge for each service date' : 'One row per family for the selected period';
    renderBilling();
  }));

  previousMonth.addEventListener('click', () => {
    state.currentMonth = new Date(Date.UTC(state.currentMonth.getUTCFullYear(), state.currentMonth.getUTCMonth() - 1, 1, 12));
    loadSchedule();
  });
  nextMonth.addEventListener('click', () => {
    state.currentMonth = new Date(Date.UTC(state.currentMonth.getUTCFullYear(), state.currentMonth.getUTCMonth() + 1, 1, 12));
    loadSchedule();
  });
  root.querySelector('#rb-print-roster').addEventListener('click', () => window.print());
  toggleDay.addEventListener('click', async () => {
    const day = state.selectedDay;
    if (!day) return;
    const reopening = !day.bookingEnabled || Boolean(day.closureNote);
    const closureNote = reopening ? '' : window.prompt('Closure note shown to parents', 'School closed');
    if (!reopening && closureNote === null) return;
    if (reopening && !window.confirm(`Reopen ${dateLabel(day.serviceDate)} for booking?`)) return;
    toggleDay.disabled = true;
    try {
      await requestJson('/api/staff/day-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceDate: day.serviceDate, bookingEnabled: reopening, closureNote })
      });
      await loadSchedule(day.serviceDate);
    } catch (error) {
      window.alert(error.message);
    } finally {
      toggleDay.disabled = false;
    }
  });
  root.querySelector('#rb-export').addEventListener('click', downloadCsv);
  statusFilter.addEventListener('change', renderBilling);
  periodStart.addEventListener('change', loadBilling);
  periodEnd.addEventListener('change', loadBilling);

  loadSchedule();
}

if (typeof document !== 'undefined') {
  document.addEventListener('staff-authenticated', event => {
    document.documentElement.dataset.staffRole = event.detail?.staff?.role || 'staff';
    initStaffDashboard();
  });
  if (document.documentElement.dataset.staffRole) initStaffDashboard();
}
