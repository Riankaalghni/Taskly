(() => {
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'taskly-data-v1';

const DEFAULT_CATEGORIES = [
  'Personal',
  'Work',
  'Study',
  'Shopping',
  'Health',
  'Other'
];

const COLORS = [
  '#22449B',
  '#1CAD4F',
  '#D6A12A',
  '#A16BC1',
  '#D66B62',
  '#5C9CA5',
  '#8290A5'
];

const today = new Date();
today.setHours(0,0,0,0);

const dateKey = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
};

const parseDate = s => s ? new Date(`${s}T00:00:00`) : null;

const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,c=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

let state = loadState();

let currentPage = 'dashboard';
let currentFilter = 'all';
let searchTerm = '';
let calendarDate = new Date();
let selectedDate = dateKey(today);
let calendarMode = 'month';
let toastTimer;

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (d && Array.isArray(d.tasks)) {
      return {
        ...d,
        categories: d.categories || DEFAULT_CATEGORIES,
        settings: d.settings || {
          name:'Your Name',
          dark:false
        }
      };
    }
  } catch(e) {}

  return {
    tasks:[],
    categories:[...DEFAULT_CATEGORIES],
    settings:{
      name:'Your Name',
      dark:false
    }
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function notify(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => t.classList.remove('show'),
    2600
  );
}

function isOverdue(t) {
  return !t.completed &&
    t.dueDate &&
    t.dueDate < dateKey(today);
}

function formatDate(
  s,
  opts={day:'numeric',month:'short',year:'numeric'}
) {
  if (!s) return 'No due date';

  const d = parseDate(s);

  return d.toLocaleDateString('en-US',opts);
}

function taskMatchesSearch(t) {
  const hay = [
    t.title,
    t.description,
    t.category,
    t.priority
  ].join(' ').toLowerCase();

  return hay.includes(searchTerm.toLowerCase());
}

function priorityRank(p) {
  return ({
    high:0,
    medium:1,
    low:2
  })[p] ?? 3;
}

function categoryColor(cat) {
  const i = Math.max(0,state.categories.indexOf(cat));
  return COLORS[i % COLORS.length];
}

function setPage(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle(
      'active',
      p.id === `page-${page}`
    );
  });

  document.querySelectorAll('.nav-link[data-page]').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.page === page
    );
  });

  const labels = {
    dashboard:'Dashboard',
    tasks:'My Tasks',
    today:'Today',
    upcoming:'Upcoming',
    completed:'Completed',
    calendar:'Calendar',
    settings:'Settings'
  };

  $('breadcrumbTitle').textContent = labels[page] || page;
  $('sidebar').classList.remove('open');

  render();
}

function visibleTasks(list) {
  return list.filter(taskMatchesSearch);
}

function empty(
  message='Nothing here yet',
  sub='Tasks you add will appear here.'
) {
  return `
    <div class="empty-state">
      <div class="empty-icon">✦</div>
      <strong>${message}</strong>
      <p>${sub}</p>
    </div>
  `;
}

function taskHTML(t,compact=false) {
  const due = t.dueDate
    ? formatDate(t.dueDate,{day:'numeric',month:'short'})
    : 'No date';

  const overdue = isOverdue(t);

  return `
    <div class="task-row"
      data-task-id="${t.id}"
      ${compact?'':'draggable="true"'}>

      <input
        class="task-check"
        type="checkbox"
        aria-label="Mark ${escapeHTML(t.title)} complete"
        data-toggle="${t.id}"
        ${t.completed?'checked':''}
      >

      <div class="task-main"
        data-open="${t.id}"
        role="button"
        tabindex="0">

        <div class="task-title ${t.completed?'done':''}">
          ${escapeHTML(t.title)}
        </div>

        <div class="task-meta">

          <span
            class="category-pill"
            style="background:${categoryColor(t.category)}18;color:${categoryColor(t.category)}">
            ${escapeHTML(t.category)}
          </span>

          <span class="priority ${t.priority}">
            ${t.priority[0].toUpperCase()+t.priority.slice(1)}
          </span>

          <span class="${overdue?'status-pill overdue':'task-date'}">
            ${overdue?'Overdue':due}
            ${t.dueTime&&!overdue?' · '+escapeHTML(t.dueTime):''}
          </span>

        </div>
      </div>

      <div class="task-actions">
        <button class="mini-action" data-edit="${t.id}" title="Edit">✎</button>
        <button class="mini-action" data-delete="${t.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

function renderTaskContainer(id,list,compact=false) {
  $(id).innerHTML = list.length
    ? list.map(t=>taskHTML(t,compact)).join('')
    : empty();
}

function render() {
  const tasks = state.tasks;

  const done = tasks.filter(t=>t.completed);
  const pending = tasks.filter(t=>!t.completed);
  const overdue = pending.filter(isOverdue);

  $('statTotal').textContent = tasks.length;
  $('statCompleted').textContent = done.length;
  $('statPending').textContent = pending.length;
  $('statOverdue').textContent = overdue.length;

  $('allCount').textContent = pending.length;

  $('progressDone').textContent = `${done.length} completed`;
  $('progressLeft').textContent = `${pending.length} remaining`;

  const pct = tasks.length
    ? Math.round(done.length/tasks.length*100)
    : 0;

  $('progressPercent').textContent = pct+'%';

  $('progressRing').style.background =
    `conic-gradient(var(--green) ${pct*3.6}deg,#E9EDF1 0deg)`;

  const now = new Date();

  $('todayDate').textContent = now
    .toLocaleDateString('en-US',{
      weekday:'long',
      month:'long',
      day:'numeric'
    })
    .toUpperCase();

  const hour = now.getHours();

  $('greeting').innerHTML =
    (hour<12?'Good morning':hour<18?'Good afternoon':'Good evening')
    +'! <span>✦</span>';

  $('profileName').textContent =
    state.settings.name || 'Your Name';

  $('avatarInitial').textContent =
    ($('profileName').textContent[0]||'U').toUpperCase();

  $('topAvatar').textContent =
    $('avatarInitial').textContent;

  $('settingsName').value =
    state.settings.name || '';

  $('darkMode').checked =
    !!state.settings.dark;

  document.body.classList.toggle(
    'dark',
    !!state.settings.dark
  );

  const todayTasks = visibleTasks(
    tasks.filter(t=>
      t.dueDate===dateKey(today) && !t.completed
    )
  ).sort((a,b)=>
    priorityRank(a.priority)-priorityRank(b.priority)
  );

  const high = visibleTasks(
    pending.filter(t=>t.priority==='high')
  ).sort((a,b)=>
    (a.dueDate||'9999').localeCompare(b.dueDate||'9999')
  );

  renderTaskContainer(
    'todayPreview',
    todayTasks.slice(0,5),
    true
  );

  renderTaskContainer(
    'priorityPreview',
    high.slice(0,4),
    true
  );

  let all = visibleTasks(tasks);

  const sort = $('sortTasks')?.value || 'date';

  all.sort((a,b)=>
    sort==='priority'
      ? priorityRank(a.priority)-priorityRank(b.priority)
      : sort==='created'
        ? (b.createdAt||0)-(a.createdAt||0)
        : (a.dueDate||'9999').localeCompare(b.dueDate||'9999')
  );

  if(currentFilter==='active') {
    all=all.filter(t=>!t.completed);
  }

  if(currentFilter==='completed') {
    all=all.filter(t=>t.completed);
  }

  if(currentFilter==='overdue') {
    all=all.filter(isOverdue);
  }

  const cat = $('categoryFilter')?.value || 'all';

  if(cat!=='all') {
    all=all.filter(t=>t.category===cat);
  }

  renderTaskContainer('taskList',all);

  const todayAll = visibleTasks(
    tasks.filter(t=>t.dueDate===dateKey(today))
  ).sort((a,b)=>
    priorityRank(a.priority)-priorityRank(b.priority)
  );

  $('todaySubtitle').textContent = now.toLocaleDateString(
    'en-US',
    {
      weekday:'long',
      month:'long',
      day:'numeric',
      year:'numeric'
    }
  );

  $('todayTaskCount').textContent =
    `${todayAll.length} tasks`;

  renderTaskContainer('todayList',todayAll);

  const upcoming = visibleTasks(
    pending.filter(t=>
      t.dueDate &&
      t.dueDate>dateKey(today) &&
      t.dueDate<=dateKey(
        new Date(today.getTime()+30*86400000)
      )
    )
  ).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));

  renderTaskContainer('upcomingList',upcoming);

  const completed = visibleTasks(done).sort(
    (a,b)=>(b.completedAt||0)-(a.completedAt||0)
  );

  $('completedCount').textContent =
    `${completed.length} tasks`;

  renderTaskContainer('completedList',completed);

  renderCategories();
  renderCalendar();
}

function renderCategories() {
  $('categoryList').innerHTML = state.categories
    .map((c,i)=>`
      <button class="category-link" data-category="${escapeHTML(c)}">
        <span
          class="category-dot"
          style="--dot:${COLORS[i%COLORS.length]}">
        </span>
        ${escapeHTML(c)}
      </button>
    `)
    .join('');

  const options = state.categories
    .map(c=>`
      <option value="${escapeHTML(c)}">
        ${escapeHTML(c)}
      </option>
    `)
    .join('');

  const cf = $('categoryFilter');
  const old = cf.value;

  cf.innerHTML =
    '<option value="all">All categories</option>'+options;

  cf.value = state.categories.includes(old)
    ? old
    : 'all';

  const tc = $('taskCategory');
  const oldCat = tc.value;

  tc.innerHTML = options;

  tc.value = state.categories.includes(oldCat)
    ? oldCat
    : state.categories[0] || 'Other';
}

function openTask(task=null) {
  $('taskForm').reset();

  $('taskId').value = task?.id || '';

  $('modalTitle').textContent =
    task ? 'Edit task' : 'Create a task';

  $('taskTitle').value =
    task?.title || '';

  $('taskDescription').value =
    task?.description || '';

  $('taskDate').value =
    task?.dueDate || dateKey(today);

  $('taskTime').value =
    task?.dueTime || '';

  $('taskCategory').value =
    task?.category || state.categories[0] || 'Other';

  $('taskPriority').value =
    task?.priority || 'medium';

  $('taskRepeat').value =
    task?.repeat || 'none';

  $('taskReminder').value =
    task?.reminder || 'none';

  $('taskModal').classList.add('open');
  $('taskModal').setAttribute('aria-hidden','false');

  setTimeout(()=>$('taskTitle').focus(),50);
}

function closeModal() {
  document.querySelectorAll('.modal-backdrop').forEach(m=>{
    m.classList.remove('open');
    m.setAttribute('aria-hidden','true');
  });
}

function addRecurring(t) {
  if(t.repeat==='none'||!t.dueDate) return;

  const d = parseDate(t.dueDate);

  if(t.repeat==='daily') {
    d.setDate(d.getDate()+1);
  }

  if(t.repeat==='weekly') {
    d.setDate(d.getDate()+7);
  }

  if(t.repeat==='monthly') {
    d.setMonth(d.getMonth()+1);
  }

  const copy = {
    ...t,
    id:crypto.randomUUID?.()||String(Date.now()+Math.random()),
    dueDate:dateKey(d),
    completed:false,
    createdAt:Date.now(),
    completedAt:null
  };

  state.tasks.push(copy);
}

function saveTask(e) {
  e.preventDefault();

  const id = $('taskId').value;

  const old = state.tasks.find(t=>t.id===id);

  const task = {
    id:id||crypto.randomUUID?.()||String(Date.now()),
    title:$('taskTitle').value.trim(),
    description:$('taskDescription').value.trim(),
    dueDate:$('taskDate').value,
    dueTime:$('taskTime').value,
    category:$('taskCategory').value,
    priority:$('taskPriority').value,
    repeat:$('taskRepeat').value,
    reminder:$('taskReminder').value,
    completed:old?.completed||false,
    createdAt:old?.createdAt||Date.now(),
    completedAt:old?.completedAt||null,
    order:old?.order??state.tasks.length
  };

  if(!task.title) return;

  if(old) {
    state.tasks=state.tasks.map(t=>
      t.id===id ? task : t
    );

    notify('Task updated successfully.');
  } else {
    state.tasks.push(task);
    notify('New task added.');
  }

  save();
  closeModal();
  render();
}

function toggleTask(id,checked) {
  const t = state.tasks.find(x=>x.id===id);

  if(!t) return;

  t.completed = checked;
  t.completedAt = checked ? Date.now() : null;

  if(checked) {
    addRecurring(t);
  }

  save();
  render();

  notify(
    checked
      ? 'Task completed. Great job!'
      : 'Task moved back to active.'
  );
}

function deleteTask(id) {
  const t = state.tasks.find(x=>x.id===id);

  if(!t) return;

  if(!confirm(`Delete "${t.title}"? This cannot be undone.`)) {
    return;
  }

  state.tasks = state.tasks.filter(x=>x.id!==id);

  save();
  render();

  notify('Task deleted.');
}

function openCategoryModal(cat='') {
  $('categoryOriginal').value = cat;
  $('newCategoryName').value = cat;

  $('categoryModalTitle').textContent =
    cat ? 'Rename category' : 'Add category';

  $('categoryModal').classList.add('open');
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  $('calendarTitle').textContent =
    calendarDate.toLocaleDateString('en-US',{
      month:'long',
      year:'numeric'
    });

  const weekdays = [
    'SUN','MON','TUE','WED','THU','FRI','SAT'
  ];

  let cells = weekdays.map(d=>
    `<div class="calendar-cell calendar-weekday">${d}</div>`
  ).join('');

  let start = new Date(year,month,1);
  let end = new Date(year,month+1,0);

  let first = start.getDay();
  let days = end.getDate();

  if(calendarMode==='week') {
    const sel = parseDate(selectedDate) || today;
    const weekStart = new Date(sel);

    weekStart.setDate(sel.getDate()-sel.getDay());

    start = weekStart;
    days = 7;
    first = 0;

    $('calendarTitle').textContent =
      `${formatDate(dateKey(weekStart),{month:'short',day:'numeric'})} – ${formatDate(dateKey(new Date(weekStart.getTime()+6*86400000)),{month:'short',day:'numeric',year:'numeric'})}`;
  }

  const total = calendarMode==='week'
    ? 7
    : Math.ceil((first+days)/7)*7;

  for(let i=0;i<total;i++) {
    let d = new Date(start);

    d.setDate(start.getDate()+i-first);

    const key = dateKey(d);

    const inMonth =
      calendarMode==='week' || d.getMonth()===month;

    const dayTasks = state.tasks
      .filter(t=>t.dueDate===key)
      .slice(0,2);

    cells += `
      <div class="calendar-cell ${inMonth?'':'muted-day'} ${key===selectedDate?'selected-day':''}"
        data-day="${key}">

        <span class="day-number ${key===dateKey(today)?'today-number':''}">
          ${d.getDate()}
        </span>

        ${dayTasks.map(t=>`
          <span class="calendar-task ${t.completed?'done-event':''}"
            title="${escapeHTML(t.title)}">
            ${escapeHTML(t.title)}
          </span>
        `).join('')}

        ${state.tasks.filter(t=>t.dueDate===key).length>2
          ? `<span class="calendar-task">+${state.tasks.filter(t=>t.dueDate===key).length-2} more</span>`
          : ''
        }
      </div>
    `;
  }

  $('calendarGrid').innerHTML = cells;

  $('selectedDateTitle').textContent =
    `Tasks for ${formatDate(selectedDate,{
      weekday:'long',
      month:'long',
      day:'numeric'
    })}`;

  renderTaskContainer(
    'selectedDateTasks',
    state.tasks
      .filter(t=>t.dueDate===selectedDate)
      .sort((a,b)=>
        priorityRank(a.priority)-priorityRank(b.priority)
      )
  );

  $('monthViewBtn').classList.toggle(
    'selected',
    calendarMode==='month'
  );

  $('weekViewBtn').classList.toggle(
    'selected',
    calendarMode==='week'
  );
}

function handleTaskClick(e) {
  const toggle = e.target.closest('[data-toggle]');

  if(toggle) {
    toggleTask(toggle.dataset.toggle,toggle.checked);
    return;
  }

  const edit = e.target.closest('[data-edit]');

  if(edit) {
    const t = state.tasks.find(t=>t.id===edit.dataset.edit);

    if(t) openTask(t);

    return;
  }

  const del = e.target.closest('[data-delete]');

  if(del) {
    deleteTask(del.dataset.delete);
    return;
  }

  const open = e.target.closest('[data-open]');

  if(open) {
    const t = state.tasks.find(t=>t.id===open.dataset.open);

    if(t) openTask(t);
  }
}

document.addEventListener('click',e=>{
  const nav = e.target.closest('[data-page]');

  if(nav) {
    e.preventDefault();
    setPage(nav.dataset.page);
    return;
  }

  if(
    e.target.closest('[data-add]') ||
    e.target.closest('#sidebarAdd') ||
    e.target.closest('#dashboardAdd')
  ) {
    openTask();
    return;
  }

  const goto = e.target.closest('[data-goto]');

  if(goto) {
    setPage(goto.dataset.goto);
    return;
  }

  if(e.target.closest('[data-close]')) {
    closeModal();
    return;
  }

  if(e.target.closest('[data-close-category]')) {
    $('categoryModal').classList.remove('open');
    return;
  }

  const cat = e.target.closest('[data-category]');

  if(cat) {
    setPage('tasks');
    $('categoryFilter').value = cat.dataset.category;
    render();
    return;
  }

  const day = e.target.closest('[data-day]');

  if(day) {
    selectedDate = day.dataset.day;
    renderCalendar();
    return;
  }

  handleTaskClick(e);
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape') {
    closeModal();
  }

  if(
    (e.metaKey||e.ctrlKey) &&
    e.key.toLowerCase()==='k'
  ) {
    e.preventDefault();
    $('globalSearch').focus();
  }

  if(
    e.target.matches('[data-open]') &&
    (e.key==='Enter'||e.key===' ')
  ) {
    e.preventDefault();
    e.target.click();
  }
});

$('taskForm').addEventListener('submit',saveTask);

$('categoryForm').addEventListener('submit',e=>{
  e.preventDefault();

  const name = $('newCategoryName').value.trim();
  const old = $('categoryOriginal').value;

  if(!name) return;

  if(state.categories.some(c=>
    c.toLowerCase()===name.toLowerCase() && c!==old
  )) {
    notify('That category already exists.');
    return;
  }

  if(old) {
    state.categories=state.categories.map(c=>
      c===old ? name : c
    );

    state.tasks.forEach(t=>{
      if(t.category===old) t.category=name;
    });
  } else {
    state.categories.push(name);
  }

  save();

  $('categoryModal').classList.remove('open');

  render();

  notify('Category saved.');
});

$('addCategoryBtn').addEventListener(
  'click',
  ()=>openCategoryModal()
);

$('taskFilters').addEventListener('click',e=>{
  const b = e.target.closest('[data-filter]');

  if(!b) return;

  currentFilter = b.dataset.filter;

  document.querySelectorAll('.filter-tab').forEach(x=>{
    x.classList.toggle('selected',x===b);
  });

  render();
});

$('categoryFilter').addEventListener('change',render);
$('sortTasks').addEventListener('change',render);

$('globalSearch').addEventListener('input',e=>{
  searchTerm = e.target.value;

  render();

  if(currentPage!=='tasks' && searchTerm) {
    setPage('tasks');
  }
});

$('mobileMenu').addEventListener('click',()=>
  $('sidebar').classList.toggle('open')
);

$('prevMonth').addEventListener('click',()=>{
  if(calendarMode==='month') {
    calendarDate.setMonth(calendarDate.getMonth()-1);
  } else {
    const d = parseDate(selectedDate);

    d.setDate(d.getDate()-7);

    selectedDate = dateKey(d);
    calendarDate = new Date(d);
  }

  renderCalendar();
});

$('nextMonth').addEventListener('click',()=>{
  if(calendarMode==='month') {
    calendarDate.setMonth(calendarDate.getMonth()+1);
  } else {
    const d = parseDate(selectedDate);

    d.setDate(d.getDate()+7);

    selectedDate = dateKey(d);
    calendarDate = new Date(d);
  }

  renderCalendar();
});

$('monthViewBtn').addEventListener('click',()=>{
  calendarMode = 'month';
  calendarDate = parseDate(selectedDate) || new Date();

  renderCalendar();
});

$('weekViewBtn').addEventListener('click',()=>{
  calendarMode = 'week';
  renderCalendar();
});

$('darkMode').addEventListener('change',e=>{
  state.settings.dark = e.target.checked;

  save();
  render();
});

$('saveProfile').addEventListener('click',()=>{
  state.settings.name =
    $('settingsName').value.trim() || 'Your Name';

  save();
  render();

  notify('Profile updated.');
});

$('profileSettings').addEventListener(
  'click',
  ()=>setPage('settings')
);

$('topAvatar').addEventListener(
  'click',
  ()=>setPage('settings')
);

async function enableNotifications() {
  if(!('Notification' in window)) {
    notify('This browser does not support notifications.');
    return;
  }

  const permission = await Notification.requestPermission();

  notify(
    permission==='granted'
      ? 'Notifications enabled.'
      : 'Notification permission was not granted.'
  );
}

$('notificationBtn').addEventListener(
  'click',
  enableNotifications
);

$('enableNotifications').addEventListener(
  'click',
  enableNotifications
);

const remindedThisSession = new Set();

function checkReminders() {
  if(
    !('Notification' in window) ||
    Notification.permission!=='granted'
  ) {
    return;
  }

  const now = Date.now();

  state.tasks.forEach(t=>{
    if(
      t.completed ||
      !t.dueDate ||
      !t.dueTime ||
      t.reminder==='none' ||
      remindedThisSession.has(t.id)
    ) {
      return;
    }

    const due = new Date(
      `${t.dueDate}T${t.dueTime}`
    ).getTime();

    const offset = t.reminder==='at-time'
      ? 0
      : Number(t.reminder)*60000;

    const notifyAt = due-offset;

    if(now>=notifyAt && now<=notifyAt+60000) {
      new Notification('Taskly reminder',{
        body:`${t.title} is ${t.reminder==='at-time'?'due now':'coming up soon'}.`
      });

      remindedThisSession.add(t.id);
    }
  });
}

setInterval(checkReminders,30000);

$('exportData').addEventListener('click',()=>{
  const blob = new Blob(
    [JSON.stringify(state,null,2)],
    {type:'application/json'}
  );

  const a = document.createElement('a');

  a.href = URL.createObjectURL(blob);
  a.download = 'taskly-backup.json';

  a.click();

  URL.revokeObjectURL(a.href);

  notify('Backup exported.');
});

$('importData').addEventListener('change',e=>{
  const file = e.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = ()=>{
    try {
      const data = JSON.parse(reader.result);

      if(
        !Array.isArray(data.tasks) ||
        !Array.isArray(data.categories)
      ) {
        throw new Error();
      }

      if(confirm('Replace your current tasks with this backup?')) {
        state = {...state,...data};

        save();
        render();

        notify('Backup imported.');
      }
    } catch(err) {
      notify('This file is not a valid Taskly backup.');
    }
  };

  reader.readAsText(file);

  e.target.value = '';
});

// DRAG AND DROP TASK ORDERING

let dragId = null;

$('taskList').addEventListener('dragstart',e=>{
  const row = e.target.closest('[data-task-id]');

  if(!row) return;

  dragId = row.dataset.taskId;

  row.classList.add('dragging');

  e.dataTransfer.effectAllowed = 'move';
});

$('taskList').addEventListener('dragend',e=>{
  e.target.closest('[data-task-id]')
    ?.classList.remove('dragging');

  document.querySelectorAll('.drag-over').forEach(x=>
    x.classList.remove('drag-over')
  );
});

$('taskList').addEventListener('dragover',e=>{
  e.preventDefault();

  const row = e.target.closest('[data-task-id]');

  if(row && row.dataset.taskId!==dragId) {
    row.classList.add('drag-over');
  }
});

$('taskList').addEventListener('dragleave',e=>{
  e.target.closest('[data-task-id]')
    ?.classList.remove('drag-over');
});

$('taskList').addEventListener('drop',e=>{
  e.preventDefault();

  const target = e.target.closest('[data-task-id]');

  if(
    !target ||
    !dragId ||
    target.dataset.taskId===dragId
  ) {
    return;
  }

  const from = state.tasks.findIndex(t=>t.id===dragId);
  const to = state.tasks.findIndex(t=>t.id===target.dataset.taskId);

  const [moved] = state.tasks.splice(from,1);

  state.tasks.splice(to,0,moved);

  state.tasks.forEach((t,i)=>{
    t.order=i;
  });

  save();
  render();

  dragId=null;

  notify('Task order updated.');
});

$('taskModal').addEventListener('click',e=>{
  if(e.target===$('taskModal')) {
    closeModal();
  }
});

$('categoryModal').addEventListener('click',e=>{
  if(e.target===$('categoryModal')) {
    $('categoryModal').classList.remove('open');
  }
});

render();

})();

// ========================================
// PROGRESSIVE WEB APP (PWA)
// SERVICE WORKER REGISTRATION
// ========================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {

    navigator.serviceWorker.register('./service-worker.js')

      .then(registration => {
        console.log(
          'Taskly Service Worker berhasil:',
          registration.scope
        );
      })

      .catch(error => {
        console.error(
          'Service Worker gagal:',
          error
        );
      });

  });
}