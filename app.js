/* ========================================================================
   💊 ASP 업무 공유 — 지수 · 윤다경 공동 업무 공간
   Firestore로 실시간 동기화됩니다. 모든 입력은 Notion처럼 즉시 저장됩니다
   (별도의 "추가" 팝업 없이, 새 줄을 만들고 바로 타이핑하면 자동 저장).
   ======================================================================== */
(function(){
  'use strict';

  var MAJOR_CATS = ['교육','행정','시스템','중재'];
  var MINOR_CATS = ['일간','주간','격주','월별','분기','반기','년별','필수','비정기'];
  var STATUSES = ['시작 전','진행 중','완료'];
  var STATUS_ORDER = { '진행 중':0, '시작 전':1, '완료':2 };
  var PEOPLE = ['지수','윤다경'];
  var COMM_WORK_CATS = ['처방검토','중재(Intervention)','상담/교육','회의','데이터/통계','서류/행정','기타'];
  var COMM_DIRECTIONS = ['발신','수신','양방향'];
  var IDEA_STATUSES = ['검토중','채택','보류'];
  var PERSONAL_STATUSES = ['대기','진행중','완료'];
  var MANUAL_CATS = ['중재','TDM','행정','교육','시스템','개인 공부','기타'];

  var CAT_COLORS = {
    '교육':  { fg:'#7d7d7d', bg:'#efefef' },
    '행정':  { fg:'#3b7dd8', bg:'#e8f0fd' },
    '시스템':{ fg:'#d98a3d', bg:'#fdf1e4' },
    '중재':  { fg:'#8f5fd6', bg:'#f2ecfb' }
  };
  var STATUS_COLORS = {
    '시작 전': { fg:'#9a9a9a', bg:'#f0f0f0' },
    '진행 중': { fg:'#3b7dd8', bg:'#e8f0fd' },
    '완료':   { fg:'#3fa15e', bg:'#e9f7ee' },
    '대기':   { fg:'#9a9a9a', bg:'#f0f0f0' },
    '진행중': { fg:'#3b7dd8', bg:'#e8f0fd' },
    '검토중': { fg:'#9a9a9a', bg:'#f0f0f0' },
    '채택':   { fg:'#3fa15e', bg:'#e9f7ee' },
    '보류':   { fg:'#c65c5c', bg:'#fbeaea' }
  };
  var PERSON_COLORS = {
    '지수':   { fg:'#d6608a', bg:'#fbe9ef' },
    '윤다경': { fg:'#4aa3a2', bg:'#e6f4f3' }
  };
  var SHARED_COLOR = { fg:'#5b8def', bg:'#e8eefd' };
  var DDAY_COLOR = { fg:'#c98a2f', bg:'#fdf1e0' };
  var DIRECTION_COLORS = {
    '발신': { fg:'#3b7dd8', bg:'#e8f0fd' },
    '수신': { fg:'#3fa15e', bg:'#e9f7ee' },
    '양방향':{ fg:'#8f5fd6', bg:'#f2ecfb' }
  };
  var MANUAL_CAT_COLORS = {
    '중재':   { fg:'#8f5fd6', bg:'#f2ecfb' },
    'TDM':    { fg:'#3fa15e', bg:'#e9f7ee' },
    '행정':   { fg:'#3b7dd8', bg:'#e8f0fd' },
    '교육':   { fg:'#7d7d7d', bg:'#efefef' },
    '시스템': { fg:'#d98a3d', bg:'#fdf1e4' },
    '개인 공부': { fg:'#d6608a', bg:'#fbe9ef' },
    '기타':   { fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  var BOARD_TO_TAB = {
    '공지사항':'announcements', '업무 리스트':'tasks', '각자 업무리스트':'personal',
    '회의':'meetings', '아이디어':'ideas', '소통일지':'comms', '자료실':'files'
  };
  // 자유 입력 텍스트(예: 소통일지 분류)에 고정 색상 팔레트가 없을 때, 글자 기반으로 일관된 파스텔 색을 만들어줍니다.
  function hashColor(str){
    str = str || '';
    var hash = 0;
    for(var i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); hash = hash & hash; }
    var hue = Math.abs(hash) % 360;
    return { fg:'hsl('+hue+',55%,38%)', bg:'hsl('+hue+',70%,94%)' };
  }

  /* ---------------- Utilities ---------------- */
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function escapeHtml(str){
    if(str===undefined || str===null) return '';
    return String(str).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function pad2(n){ return n<10 ? '0'+n : ''+n; }
  function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function badge(label, colorMap, extraStyle){
    var c = (colorMap && colorMap[label]) || { fg:'#888', bg:'#eee' };
    return '<span class="badge" style="color:'+c.fg+';background:'+c.bg+(extraStyle||'')+'">'+escapeHtml(label)+'</span>';
  }
  var toastTimer=null;
  function showToast(msg){
    var t=document.getElementById('toast');
    t.textContent=msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }
  function autoGrow(el){ el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }
  function autoGrowAll(){ document.querySelectorAll('textarea[data-field]').forEach(autoGrow); }
  function deadlineBadge(deadline, status){
    if(!deadline) return '';
    if(status==='완료') return '<span class="badge" style="color:#707070;background:#f0f0f0;">완료</span>';
    var today = todayStr();
    var cls = deadline < today ? { fg:'#c65c5c', bg:'#fbeaea', label:'⚠ 기한 지남' } :
      (deadline <= addDaysStr(today,3) ? { fg:'#c98a2f', bg:'#fdf1e0', label:'곧 마감' } : { fg:'#8a8d98', bg:'#eee', label:deadline });
    return '<span class="badge" style="color:'+cls.fg+';background:'+cls.bg+'">'+cls.label+'</span>';
  }
  function addDaysStr(dateStr, n){
    var d = new Date(dateStr+'T00:00:00');
    d.setDate(d.getDate()+n);
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }

  /* ---------------- Firebase ---------------- */
  var db=null, auth=null, firebaseReady=false, listenersAttached=false;
  function setSyncStatus(on, label){
    document.getElementById('syncDot').classList.toggle('on', on);
    document.getElementById('syncLabel').textContent = label;
  }
  function initFirebase(){
    if(!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey==='YOUR_API_KEY'){
      setSyncStatus(false, 'Firebase 설정 필요 (firebase-config.js를 채워주세요)');
      document.getElementById('authHint').textContent = 'firebase-config.js에 설정값을 먼저 채워야 로그인할 수 있어요.';
      renderActiveTab();
      return;
    }
    try{
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
      auth = firebase.auth();
      firebaseReady = true;
      setSyncStatus(false, '로그인 필요');
      auth.onAuthStateChanged(handleAuthStateChanged);
    }catch(err){
      console.error(err);
      setSyncStatus(false, '연결 실패: '+err.message);
    }
  }

  /* ---------------- 로그인 (Firebase Authentication) ---------------- */
  function handleAuthStateChanged(user){
    if(user){
      document.getElementById('authGate').classList.add('hidden');
      document.getElementById('appShell').style.display = '';
      setSyncStatus(true, '실시간 동기화 중 · '+user.email);
      if(!listenersAttached){ listenersAttached = true; attachListeners(); }
    } else {
      document.getElementById('authGate').classList.remove('hidden');
      document.getElementById('appShell').style.display = 'none';
      setSyncStatus(false, '로그인 필요');
    }
  }
  function doLogin(){
    var errEl = document.getElementById('authError');
    errEl.textContent = '';
    if(!auth){ errEl.textContent = 'Firebase 설정이 아직 안 되어 있어요 (firebase-config.js 확인).'; return; }
    var email = document.getElementById('authEmail').value.trim();
    var pw = document.getElementById('authPassword').value;
    if(!email || !pw){ errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
    auth.signInWithEmailAndPassword(email, pw).catch(function(err){
      errEl.textContent = '로그인 실패: 이메일 또는 비밀번호를 확인해주세요.';
      console.error(err);
    });
  }
  document.getElementById('authLoginBtn').addEventListener('click', doLogin);
  document.getElementById('authPassword').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('authEmail').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('logoutBtn').addEventListener('click', function(){
    if(auth) auth.signOut();
  });
  function handleSnapError(err){
    console.error(err);
    setSyncStatus(false, '동기화 오류 (Firestore 보안 규칙을 확인하세요)');
  }

  var COLLECTIONS = ['tasks','announcements','personal','meetings','ideas','comms','manuals','files','dday'];
  var STATE_KEY = { tasks:'tasks', announcements:'announcements', personal:'personal', meetings:'meetings', ideas:'ideas', comms:'comms', manuals:'manuals', files:'files', dday:'dday' };
  // 캘린더 탭은 모든 컬렉션의 날짜를 모아 보여주므로, dday를 포함한 모든 컬렉션 변경이 캘린더도 함께 갱신시켜야 합니다.
  var TAB_FOR_COLLECTION = { tasks:'tasks', announcements:'announcements', personal:'personal', meetings:'meetings', ideas:'ideas', comms:'comms', manuals:'manuals', files:'files', dday:'calendar' };

  function attachListeners(){
    COLLECTIONS.forEach(function(col){
      db.collection(col).onSnapshot(function(snap){
        state[STATE_KEY[col]] = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        onDataChanged(TAB_FOR_COLLECTION[col]);
      }, handleSnapError);
    });
  }

  // 사용자가 지금 어떤 입력칸에 타이핑 중이면, 서버에서 새 데이터가 와도 화면을 다시 그리지 않고
  // (커서 위치가 날아가는 것을 방지) 입력을 끝내면(focusout) 그때 반영합니다.
  // 캘린더 탭은 모든 게시판의 날짜를 모아 보여주므로 어떤 컬렉션이 바뀌어도 갱신 대상입니다.
  var pendingRerender = false;
  function onDataChanged(tab){
    var affectsActive = (tab === state.activeTab) || state.activeTab==='calendar';
    if(!affectsActive) return;
    var active = document.activeElement;
    var container = document.getElementById('tabContent');
    var isEditing = active && container.contains(active) && (active.tagName==='INPUT' || active.tagName==='TEXTAREA');
    if(isEditing){ pendingRerender = true; return; }
    renderActiveTab();
  }

  function requireFirebase(){
    if(!firebaseReady){ showToast('Firebase 설정이 필요해요 (README 참고)'); return false; }
    return true;
  }
  function requireWho(){
    if(!state.who){ showToast('상단에서 본인 이름을 먼저 선택해주세요'); return false; }
    return true;
  }

  /* ---------------- Save helpers (Notion식 즉시 저장) ---------------- */
  var saveTimers = {};
  function scheduleSave(col, id, field, value){
    var key = col+'|'+id+'|'+field;
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(function(){ flushSaveNow(col, id, field, value); }, 500);
  }
  function flushSaveNow(col, id, field, value){
    var key = col+'|'+id+'|'+field;
    clearTimeout(saveTimers[key]);
    if(!db) return;
    var payload = {}; payload[field] = value; payload.updatedAt = Date.now();
    db.collection(col).doc(id).update(payload).catch(function(err){ console.error(err); showToast('저장 실패: '+err.message); });
  }
  function addRow(col, data){
    if(!requireFirebase() || !requireWho()) return;
    data.clientTs = Date.now();
    data.createdAt = Date.now();
    data.createdBy = state.who;
    db.collection(col).add(data).catch(function(err){ showToast('추가 실패: '+err.message); });
  }
  function delRow(col, id, label){
    if(!requireFirebase()) return;
    if(!confirm((label||'이 항목을')+' 삭제할까요?')) return;
    db.collection(col).doc(id).delete().catch(function(err){ showToast('삭제 실패: '+err.message); });
  }

  /* ---------------- 중첩 배열 필드 (파일 링크 목록) 저장 헬퍼 ---------------- */
  // 업무매뉴얼 / 소통일지의 "첨부 파일 링크" 목록처럼 문서 안에 배열로 들어있는 항목을 다룹니다.
  function getNestedArray(col, docId, arrField){
    var doc = (state[col]||[]).find(function(x){ return x.id===docId; });
    return doc ? (doc[arrField]||[]).slice() : [];
  }
  function saveNestedArray(col, docId, arrField, arr){
    if(!db) return;
    var payload = {}; payload[arrField] = arr; payload.updatedAt = Date.now();
    db.collection(col).doc(docId).update(payload).catch(function(err){ console.error(err); showToast('저장 실패: '+err.message); });
  }
  var nestedSaveTimers = {};
  function scheduleSaveNested(col, docId, arrField, itemId, itemField, value){
    var key = col+'|'+docId+'|'+arrField+'|'+itemId+'|'+itemField;
    clearTimeout(nestedSaveTimers[key]);
    nestedSaveTimers[key] = setTimeout(function(){ flushSaveNestedNow(col, docId, arrField, itemId, itemField, value); }, 500);
  }
  function flushSaveNestedNow(col, docId, arrField, itemId, itemField, value){
    var key = col+'|'+docId+'|'+arrField+'|'+itemId+'|'+itemField;
    clearTimeout(nestedSaveTimers[key]);
    var arr = getNestedArray(col, docId, arrField);
    var item = arr.find(function(x){ return x.id===itemId; });
    if(!item) return;
    item[itemField] = value;
    saveNestedArray(col, docId, arrField, arr);
  }
  function addFileLink(col, docId){
    if(!requireFirebase()) return;
    var arr = getNestedArray(col, docId, 'files');
    arr.push({ id:uid(), name:'', url:'' });
    saveNestedArray(col, docId, 'files', arr);
  }
  function delFileLink(col, docId, itemId){
    if(!requireFirebase()) return;
    var arr = getNestedArray(col, docId, 'files').filter(function(x){ return x.id!==itemId; });
    saveNestedArray(col, docId, 'files', arr);
  }
  function renderFileLinks(col, doc){
    var files = doc.files || [];
    var rows = files.map(function(f){
      return '<div class="filelink-row">'+
        '<input type="text" class="filelink-name" placeholder="이름" value="'+escapeHtml(f.name||'')+'" data-nested="files" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+f.id+'" data-field="name">'+
        '<input type="text" class="filelink-url" placeholder="URL (구글드라이브 등)" value="'+escapeHtml(f.url||'')+'" data-nested="files" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+f.id+'" data-field="url">'+
        (f.url ? '<a class="filelink-open" href="'+escapeHtml(f.url)+'" target="_blank" rel="noopener">열기↗</a>' : '')+
        '<button class="icon-btn danger" data-action="del-filelink" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+f.id+'" title="삭제">✕</button>'+
      '</div>';
    }).join('');
    return '<div class="filelinks">'+
      '<div class="filelinks-label">📎 첨부 파일 링크</div>'+
      (rows || '')+
      '<button class="btn ghost sm" data-action="add-filelink" data-collection="'+col+'" data-id="'+doc.id+'">+ 파일 링크 추가</button>'+
    '</div>';
  }

  /* ---------------- State ---------------- */
  var state = {
    activeTab:'announcements',
    who: localStorage.getItem('asp_share_who') || '',
    tasks: [], announcements: [], personal: [], meetings: [], ideas: [], comms: [], manuals: [], files: [], dday: [],
    taskFilterPerson: 'all',
    taskFilterStatus: 'all',
    taskCollapsed: {},
    taskSortField: null, // null이면 기본 정렬(진행도→최신순), 아니면 헤더 클릭으로 선택한 필드
    taskSortDir: 'asc',
    calMonth: (function(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1); })(),
    calSelectedDate: null,
    calFilter: 'all' // all | shared | 지수 | 윤다경
  };

  document.getElementById('whoSelect').value = state.who;
  document.getElementById('whoSelect').addEventListener('change', function(e){
    state.who = e.target.value;
    localStorage.setItem('asp_share_who', state.who);
  });

  /* ---------------- Tabs ---------------- */
  document.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      state.activeTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  function renderActiveTab(){
    document.querySelectorAll('.tab-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.tab===state.activeTab);
    });
    var c = document.getElementById('tabContent');
    if(state.activeTab==='announcements') c.innerHTML = renderAnnouncementsTab();
    else if(state.activeTab==='calendar') c.innerHTML = renderCalendarTab();
    else if(state.activeTab==='tasks') c.innerHTML = renderTasksTab();
    else if(state.activeTab==='personal') c.innerHTML = renderPersonalTab();
    else if(state.activeTab==='meetings') c.innerHTML = renderMeetingsTab();
    else if(state.activeTab==='ideas') c.innerHTML = renderIdeasTab();
    else if(state.activeTab==='comms') c.innerHTML = renderCommsTab();
    else if(state.activeTab==='manuals') c.innerHTML = renderManualsTab();
    else if(state.activeTab==='files') c.innerHTML = renderFilesTab();
    autoGrowAll();
  }

  /* ================= 📢 공지사항 ================= */
  function renderAnnouncementsTab(){
    var items = state.announcements.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var listHtml = items.length ? items.map(renderAnnouncementCard).join('') : '<div class="empty-state">등록된 공지사항이 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>📢 공지사항</h3><button class="btn" data-action="add-announcement">+ 새 공지 추가</button></div>'+
      listHtml+
    '</div>';
  }
  function renderAnnouncementCard(a){
    return '<div class="doc-item" data-id="'+a.id+'">'+
      '<div class="doc-item-head">'+
        '<input type="text" class="doc-title-input" placeholder="공지 제목" data-collection="announcements" data-id="'+a.id+'" data-field="title" value="'+escapeHtml(a.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="announcements" data-id="'+a.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="note-meta">'+(a.date||fmtTs(a.clientTs))+' · '+escapeHtml(a.createdBy||'')+'</div>'+
      '<textarea class="doc-content-input" placeholder="공지 내용을 입력하세요" data-collection="announcements" data-id="'+a.id+'" data-field="content">'+escapeHtml(a.content||'')+'</textarea>'+
    '</div>';
  }
  function fmtTs(ts){
    if(!ts) return '';
    var d = new Date(ts);
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }

  /* ================= 📅 캘린더 (모든 게시판 날짜 통합) ================= */
  // 각 게시판 항목의 날짜를 모아 하나의 캘린더로 보여줍니다.
  // 담당자가 1명뿐인 업무/각자 업무리스트는 "개인 일정"으로, 그 외(담당자 없음/2명 이상, 공지·회의·아이디어·소통일지·업무내용일지·자료실)는 "공동 일정"으로 분류합니다.
  function classifyTask(t){
    var as = t.assignees || [];
    if(as.length===1) return { type:'개인', owner:as[0] };
    return { type:'공동', owner:null };
  }
  function buildCalendarItems(){
    var list = [];
    state.tasks.forEach(function(t){ if(t.date) list.push({ id:t.id, collection:'tasks', board:'업무 리스트', date:t.date, title:t.title||'(제목 없음)', cls:classifyTask(t) }); });
    state.personal.forEach(function(p){ if(p.deadline) list.push({ id:p.id, collection:'personal', board:'각자 업무리스트', date:p.deadline, title:p.title||'(제목 없음)', cls:{ type:'개인', owner:p.owner } }); });
    state.meetings.forEach(function(m){ if(m.date) list.push({ id:m.id, collection:'meetings', board:'회의', date:m.date, title:m.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.ideas.forEach(function(i){ if(i.date) list.push({ id:i.id, collection:'ideas', board:'아이디어', date:i.date, title:i.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.announcements.forEach(function(a){ if(a.date) list.push({ id:a.id, collection:'announcements', board:'공지사항', date:a.date, title:a.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.comms.forEach(function(c){ if(c.date) list.push({ id:c.id, collection:'comms', board:'소통일지', date:c.date, title:(c.target?c.target+' 소통':'소통 기록'), cls:{ type:'공동', owner:null } }); });
    state.files.forEach(function(f){ if(f.date) list.push({ id:f.id, collection:'files', board:'자료실', date:f.date, title:f.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.dday.forEach(function(d){ if(d.date) list.push({ id:d.id, collection:'dday', board:'중요 일정', date:d.date, title:d.title||'(제목 없음)', cls:{ type:'중요', owner:null } }); });
    return list;
  }
  function matchesCalFilter(item){
    if(item.cls.type==='중요') return true; // 중요 일정은 필터와 무관하게 항상 표시
    if(state.calFilter==='all') return true;
    if(state.calFilter==='shared') return item.cls.type==='공동';
    return item.cls.owner===state.calFilter; // 지수 | 윤다경
  }
  function calItemColor(item){
    if(item.cls.type==='중요') return DDAY_COLOR;
    if(item.cls.type==='개인') return PERSON_COLORS[item.cls.owner] || SHARED_COLOR;
    return SHARED_COLOR;
  }

  function renderCalendarTab(){
    var allItems = buildCalendarItems().filter(matchesCalFilter);
    var byDate = {};
    allItems.forEach(function(it){ (byDate[it.date] = byDate[it.date]||[]).push(it); });

    var ym = state.calMonth.split('-').map(Number);
    var year = ym[0], month = ym[1]-1;
    var wdNames = ['월','화','수','목','금','토','일'];
    var firstDay = new Date(year, month, 1);
    var startOffset = (firstDay.getDay()+6)%7;
    var daysInMonth = new Date(year, month+1, 0).getDate();
    var today = todayStr();

    var gridHtml = wdNames.map(function(w){ return '<div class="cal-wd">'+w+'</div>'; }).join('');
    for(var i=0;i<startOffset;i++){ gridHtml += '<div class="cal-day empty"></div>'; }
    for(var d=1; d<=daysInMonth; d++){
      var dateStr = year+'-'+pad2(month+1)+'-'+pad2(d);
      var items = byDate[dateStr] || [];
      var cls = 'cal-day';
      if(dateStr===today) cls += ' today';
      if(dateStr===state.calSelectedDate) cls += ' selected';
      var dots = items.slice(0,4).map(function(it){ var c=calItemColor(it); return '<span class="cal-dot" style="background:'+c.fg+'" title="'+escapeHtml(it.title)+'"></span>'; }).join('');
      var more = items.length>4 ? '<span class="cal-more">+'+(items.length-4)+'</span>' : '';
      gridHtml += '<div class="'+cls+'" data-action="select-cal-date" data-date="'+dateStr+'"><span class="cal-daynum">'+d+'</span><div class="cal-dots">'+dots+more+'</div></div>';
    }

    var filterOpts = [['all','전체'],['shared','공동 일정'],['지수','지수 개인'],['윤다경','윤다경 개인']].map(function(o){
      return '<option value="'+o[0]+'"'+(state.calFilter===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('');

    var selDate = state.calSelectedDate;
    var selItems = selDate ? (byDate[selDate]||[]) : [];
    var detailHtml = '';
    if(selDate){
      detailHtml = '<div class="cal-detail"><h4>'+selDate+'</h4>'+
        (selItems.length ? selItems.map(function(it){
          var c = calItemColor(it);
          var ownerBadge = it.cls.owner ? badge(it.cls.owner, PERSON_COLORS) : '';
          return '<div class="cal-item" data-action="goto-board" data-tab="'+BOARD_TO_TAB[it.board]+'">'+
            '<span class="cal-dot" style="background:'+c.fg+'"></span>'+
            '<span class="cal-item-board" style="color:'+c.fg+';background:'+c.bg+'">'+escapeHtml(it.board)+'</span>'+
            '<span class="cal-item-title">'+escapeHtml(it.title)+'</span>'+ownerBadge+
          '</div>';
        }).join('') : '<div class="empty-state">이 날짜에 등록된 일정이 없습니다.</div>')+
      '</div>';
    }

    return '<div class="card">'+
        renderDdayWidget()+
      '</div>'+
      '<div class="card">'+
        '<div class="card-head"><h3>📅 '+year+'년 '+(month+1)+'월</h3>'+
          '<div class="toolbar">'+
            '<select id="calFilterSelect">'+filterOpts+'</select>'+
            '<button class="btn ghost" data-action="cal-prev">‹ 이전달</button>'+
            '<button class="btn ghost" data-action="cal-today">이번달</button>'+
            '<button class="btn ghost" data-action="cal-next">다음달 ›</button>'+
          '</div>'+
        '</div>'+
        '<div class="cal-grid">'+gridHtml+'</div>'+
        '<div class="cal-legend">'+
          '<span><span class="cal-dot" style="background:'+SHARED_COLOR.fg+'"></span> 공동 일정</span>'+
          PEOPLE.map(function(p){ return '<span><span class="cal-dot" style="background:'+PERSON_COLORS[p].fg+'"></span> '+p+' 개인</span>'; }).join('')+
          '<span><span class="cal-dot" style="background:'+DDAY_COLOR.fg+'"></span> 중요 일정</span>'+
        '</div>'+
        detailHtml+
      '</div>';
  }

  function renderDdayWidget(){
    var items = state.dday.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    var today = todayStr();
    var rows = items.map(function(dd){
      var diff = Math.round((new Date(dd.date+'T00:00:00') - new Date(today+'T00:00:00')) / 86400000);
      var badgeLabel = diff===0 ? 'D-DAY' : diff>0 ? 'D-'+diff : 'D+'+Math.abs(diff);
      var badgeStyle = diff<0 ? 'color:#9a9a9a;background:#f0f0f0;' : diff===0 ? 'color:#c65c5c;background:#fbeaea;' : 'color:'+DDAY_COLOR.fg+';background:'+DDAY_COLOR.bg+';';
      return '<div class="dday-row" data-id="'+dd.id+'">'+
        '<span class="badge" style="'+badgeStyle+'">'+badgeLabel+'</span>'+
        '<input type="text" class="dday-title-input" placeholder="중요 일정명" data-collection="dday" data-id="'+dd.id+'" data-field="title" value="'+escapeHtml(dd.title||'')+'">'+
        '<input type="date" data-collection="dday" data-id="'+dd.id+'" data-field="date" value="'+escapeHtml(dd.date||'')+'">'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="dday" data-id="'+dd.id+'" title="삭제">✕</button>'+
      '</div>';
    }).join('');
    return '<div class="card-head"><h3>📌 중요 일정 D-day</h3><button class="btn" data-action="add-dday">+ 중요 일정 추가</button></div>'+
      (rows || '<div class="empty-state">등록된 중요 일정이 없습니다.</div>');
  }

  /* ================= 📋 업무 리스트 (공동, Notion 포맷) ================= */
  var TASK_SORT_LABELS = { minor:'소분류', date:'날짜', status:'진행도', assignees:'담당자' };
  function taskSortValue(t, field){
    if(field==='minor') return MINOR_CATS.indexOf(t.minor); // -1(없음)이 먼저 오도록
    if(field==='date') return t.date || '';
    if(field==='status') return STATUS_ORDER[t.status]===undefined ? 9 : STATUS_ORDER[t.status];
    if(field==='assignees') return (t.assignees||[]).slice().sort().join(',');
    return '';
  }
  function sortTasks(items){
    var field = state.taskSortField;
    if(!field){
      return items.slice().sort(function(a,b){
        var so = (STATUS_ORDER[a.status]||9) - (STATUS_ORDER[b.status]||9);
        if(so!==0) return so;
        return (b.clientTs||0)-(a.clientTs||0);
      });
    }
    var dir = state.taskSortDir==='desc' ? -1 : 1;
    return items.slice().sort(function(a,b){
      var av = taskSortValue(a, field), bv = taskSortValue(b, field);
      if(av<bv) return -1*dir;
      if(av>bv) return 1*dir;
      return 0;
    });
  }
  function sortArrow(field){
    if(state.taskSortField!==field) return '';
    return state.taskSortDir==='asc' ? ' ▲' : ' ▼';
  }

  function renderTasksTab(){
    var filtered = state.tasks.filter(function(t){
      if(state.taskFilterPerson!=='all' && (t.assignees||[]).indexOf(state.taskFilterPerson)===-1) return false;
      if(state.taskFilterStatus!=='all' && t.status!==state.taskFilterStatus) return false;
      return true;
    });
    var sorted = sortTasks(filtered);

    var headRow = '<tr>'+
      '<th style="width:24%">업무</th>'+
      '<th style="width:16%">내용</th>'+
      '<th data-action="sort-tasks" data-field="minor" class="sortable-th">소분류'+sortArrow('minor')+'</th>'+
      '<th data-action="sort-tasks" data-field="date" class="sortable-th">날짜'+sortArrow('date')+'</th>'+
      '<th data-action="sort-tasks" data-field="assignees" class="sortable-th">담당자'+sortArrow('assignees')+'</th>'+
      '<th data-action="sort-tasks" data-field="status" class="sortable-th">진행도'+sortArrow('status')+'</th>'+
      '<th>URL</th><th></th>'+
    '</tr>';

    function groupBlock(cat, items){
      var collapsed = !!state.taskCollapsed[cat];
      var head = '<div class="group-head clickable" data-action="toggle-group" data-cat="'+cat+'">'+
          '<span class="group-arrow">'+(collapsed?'▶':'▼')+'</span>'+
          badge(cat, CAT_COLORS)+'<span class="group-count">'+items.length+'건</span>'+
        '</div>';
      if(collapsed || !items.length) return '<div class="group">'+head+(items.length?'':'<div class="empty-state">등록된 업무가 없습니다.</div>')+'</div>';
      return '<div class="group">'+head+
        '<table><thead>'+headRow+'</thead><tbody>'+items.map(renderTaskRow).join('')+'</tbody></table>'+
      '</div>';
    }

    var groupsHtml = MAJOR_CATS.map(function(cat){
      var items = sorted.filter(function(t){ return t.major===cat; });
      return items.length ? groupBlock(cat, items) : '';
    }).join('');

    var uncategorized = sorted.filter(function(t){ return MAJOR_CATS.indexOf(t.major)===-1; });
    if(uncategorized.length) groupsHtml += groupBlock('미분류', uncategorized);

    if(!filtered.length) groupsHtml = '<div class="empty-state">등록된 업무가 없습니다. "+ 업무 추가"를 눌러 바로 입력해보세요.</div>';

    var personOpts = '<option value="all">담당자 전체</option>'+PEOPLE.map(function(p){ return '<option value="'+p+'"'+(state.taskFilterPerson===p?' selected':'')+'>'+p+'</option>'; }).join('');
    var statusOpts = '<option value="all">진행도 전체</option>'+STATUSES.map(function(s){ return '<option value="'+s+'"'+(state.taskFilterStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');

    return '<div class="card">'+
      '<div class="card-head">'+
        '<h3>📋 업무 리스트 (대분류별)</h3>'+
        '<div class="toolbar">'+
          '<select id="filterPerson">'+personOpts+'</select>'+
          '<select id="filterStatus">'+statusOpts+'</select>'+
          '<button class="btn" data-action="add-task">+ 업무 추가</button>'+
        '</div>'+
      '</div>'+
      '<div class="table-hint">열 제목을 클릭하면 정렬, 그룹 제목을 클릭하면 접고 펼 수 있어요.</div>'+
      groupsHtml+
    '</div>';
  }

  function renderTaskRow(t){
    var majorOpts = MAJOR_CATS.map(function(c){ return '<option value="'+c+'"'+(t.major===c?' selected':'')+'>'+c+'</option>'; }).join('');
    var minorOpts = '<option value="">-</option>'+MINOR_CATS.map(function(c){ return '<option value="'+c+'"'+(t.minor===c?' selected':'')+'>'+c+'</option>'; }).join('');
    var curStatus = t.status||'시작 전';
    var sc = STATUS_COLORS[curStatus] || {fg:'#888',bg:'#eee'};
    var statusOpts = STATUSES.map(function(s){ return '<option value="'+s+'"'+(curStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');
    var peopleChecks = PEOPLE.map(function(p){
      var checked = (t.assignees||[]).indexOf(p)>-1;
      return '<label><input type="checkbox" data-action="toggle-person" data-collection="tasks" data-array-field="assignees" data-id="'+t.id+'" data-person="'+p+'"'+(checked?' checked':'')+'>'+p+'</label>';
    }).join('');
    var dateRangeHtml = '<input type="date" data-collection="tasks" data-id="'+t.id+'" data-field="date" value="'+escapeHtml(t.date||'')+'">'+
      '<span class="date-arrow">→</span>'+
      '<input type="date" data-collection="tasks" data-id="'+t.id+'" data-field="endDate" value="'+escapeHtml(t.endDate||'')+'" title="종료일 (선택)">';
    return '<tr data-id="'+t.id+'">'+
      '<td>'+
        '<select class="cell-select-inline" data-collection="tasks" data-id="'+t.id+'" data-field="major">'+majorOpts+'</select>'+
        '<input type="text" class="cell-title-input" placeholder="업무명" data-collection="tasks" data-id="'+t.id+'" data-field="title" value="'+escapeHtml(t.title||'')+'">'+
      '</td>'+
      '<td><textarea class="cell-textarea" placeholder="내용/메모" data-collection="tasks" data-id="'+t.id+'" data-field="content">'+escapeHtml(t.content||'')+'</textarea></td>'+
      '<td><select data-collection="tasks" data-id="'+t.id+'" data-field="minor">'+minorOpts+'</select></td>'+
      '<td><div class="date-range">'+dateRangeHtml+'</div></td>'+
      '<td><div class="cell-check-group">'+peopleChecks+'</div></td>'+
      '<td><select class="status-select" data-collection="tasks" data-id="'+t.id+'" data-field="status" style="background:'+sc.bg+';color:'+sc.fg+';">'+statusOpts+'</select></td>'+
      '<td><input type="text" class="cell-url-input" placeholder="URL" data-collection="tasks" data-id="'+t.id+'" data-field="url" value="'+escapeHtml(t.url||'')+'"></td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="tasks" data-id="'+t.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ================= 🙋 각자 업무리스트 (개인별) ================= */
  function renderPersonalTab(){
    var cols = PEOPLE.map(function(person){
      var items = state.personal.filter(function(p){ return p.owner===person; })
        .sort(function(a,b){
          var so = (a.status==='완료'?1:0) - (b.status==='완료'?1:0);
          if(so!==0) return so;
          return (b.clientTs||0)-(a.clientTs||0);
        });
      var listHtml = items.length ? items.map(renderPersonalItem).join('') : '<div class="empty-state">등록된 업무가 없습니다.</div>';
      return '<div class="card" style="flex:1;min-width:280px;">'+
        '<div class="card-head"><h3>'+badge(person, PERSON_COLORS)+' 업무리스트</h3>'+
          '<button class="btn ghost" data-action="add-personal" data-owner="'+person+'">+ 추가</button></div>'+
        listHtml+
      '</div>';
    }).join('');
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;">'+cols+'</div>';
  }
  function renderPersonalItem(p){
    var statusOpts = PERSONAL_STATUSES.map(function(s){ return '<option value="'+s+'"'+((p.status||'대기')===s?' selected':'')+'>'+s+'</option>'; }).join('');
    return '<div class="check-item status-'+(p.status||'대기')+'" data-id="'+p.id+'">'+
      '<div class="check-item-row">'+
        '<input type="text" class="check-title-input" placeholder="업무 title" data-collection="personal" data-id="'+p.id+'" data-field="title" value="'+escapeHtml(p.title||'')+'">'+
        '<select class="status-select-sm" data-collection="personal" data-id="'+p.id+'" data-field="status">'+statusOpts+'</select>'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="personal" data-id="'+p.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="check-item-row2">'+
        '<label class="deadline-label">마감일 <input type="date" data-collection="personal" data-id="'+p.id+'" data-field="deadline" value="'+escapeHtml(p.deadline||'')+'"></label>'+
        deadlineBadge(p.deadline, p.status)+
      '</div>'+
    '</div>';
  }

  /* ================= 🗓 회의 ================= */
  function renderMeetingsTab(){
    var items = state.meetings.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var listHtml = items.length ? items.map(renderMeetingCard).join('') : '<div class="empty-state">등록된 회의록이 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>🗓 회의</h3><button class="btn" data-action="add-meeting">+ 새 회의 기록</button></div>'+
      listHtml+
    '</div>';
  }
  function renderMeetingCard(m){
    var peopleChecks = PEOPLE.map(function(p){
      var checked = (m.attendees||[]).indexOf(p)>-1;
      return '<label><input type="checkbox" data-action="toggle-person" data-collection="meetings" data-array-field="attendees" data-id="'+m.id+'" data-person="'+p+'"'+(checked?' checked':'')+'>'+p+'</label>';
    }).join('');
    return '<div class="doc-item" data-id="'+m.id+'">'+
      '<div class="doc-item-head">'+
        '<input type="text" class="doc-title-input" placeholder="회의 제목" data-collection="meetings" data-id="'+m.id+'" data-field="title" value="'+escapeHtml(m.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="meetings" data-id="'+m.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="doc-meta-row">'+
        '<input type="date" data-collection="meetings" data-id="'+m.id+'" data-field="date" value="'+escapeHtml(m.date||todayStr())+'">'+
        '<div class="cell-check-group">참석자: '+peopleChecks+'</div>'+
      '</div>'+
      '<textarea class="doc-content-input" placeholder="회의 내용, 결정사항 등을 입력하세요" data-collection="meetings" data-id="'+m.id+'" data-field="content">'+escapeHtml(m.content||'')+'</textarea>'+
    '</div>';
  }

  /* ================= 💡 아이디어 ================= */
  function renderIdeasTab(){
    var items = state.ideas.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var listHtml = items.length ? items.map(renderIdeaCard).join('') : '<div class="empty-state">등록된 아이디어가 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>💡 아이디어</h3><button class="btn" data-action="add-idea">+ 새 아이디어</button></div>'+
      listHtml+
    '</div>';
  }
  function renderIdeaCard(i){
    var statusOpts = IDEA_STATUSES.map(function(s){ return '<option value="'+s+'"'+((i.status||'검토중')===s?' selected':'')+'>'+s+'</option>'; }).join('');
    return '<div class="doc-item" data-id="'+i.id+'">'+
      '<div class="doc-item-head">'+
        '<input type="text" class="doc-title-input" placeholder="아이디어 제목" data-collection="ideas" data-id="'+i.id+'" data-field="title" value="'+escapeHtml(i.title||'')+'">'+
        '<select class="status-select-sm" data-collection="ideas" data-id="'+i.id+'" data-field="status">'+statusOpts+'</select>'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="ideas" data-id="'+i.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="note-meta">'+(i.date||fmtTs(i.clientTs))+' · '+escapeHtml(i.createdBy||'')+'</div>'+
      '<textarea class="doc-content-input" placeholder="아이디어 내용을 입력하세요" data-collection="ideas" data-id="'+i.id+'" data-field="content">'+escapeHtml(i.content||'')+'</textarea>'+
    '</div>';
  }

  /* ================= 💬 소통일지 ================= */
  function renderCommsTab(){
    var items = state.comms.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var rows = items.map(renderCommRow).join('');
    return '<div class="card">'+
      '<div class="card-head"><h3>💬 소통일지</h3><button class="btn" data-action="add-comm">+ 새 소통 기록</button></div>'+
      '<table><thead><tr><th>날짜</th><th>분류</th><th>업무</th><th>대상</th><th>소통내역</th><th>수신/발신</th><th>전화번호</th><th>사람</th><th>비고</th><th>첨부</th><th></th></tr></thead>'+
      '<tbody>'+(rows||'')+'</tbody></table>'+
      (rows ? '' : '<div class="empty-state">등록된 소통 기록이 없습니다.</div>')+
    '</div>';
  }
  function renderCommRow(c){
    var workOpts = COMM_WORK_CATS.map(function(m){ return '<option value="'+m+'"'+(c.workCategory===m?' selected':'')+'>'+m+'</option>'; }).join('');
    var dirOpts = COMM_DIRECTIONS.map(function(m){ return '<option value="'+m+'"'+(c.direction===m?' selected':'')+'>'+m+'</option>'; }).join('');
    var dc = hashColor(c.dept||'');
    var dirColor = DIRECTION_COLORS[c.direction] || {fg:'#888',bg:'#eee'};
    var peopleChecks = PEOPLE.map(function(p){
      var checked = (c.participants||[]).indexOf(p)>-1;
      return '<label><input type="checkbox" data-action="toggle-person" data-collection="comms" data-array-field="participants" data-id="'+c.id+'" data-person="'+p+'"'+(checked?' checked':'')+'>'+p+'</label>';
    }).join('');
    var fileCount = (c.files||[]).length;
    return '<tr data-id="'+c.id+'">'+
      '<td><input type="date" data-collection="comms" data-id="'+c.id+'" data-field="date" value="'+escapeHtml(c.date||todayStr())+'"></td>'+
      '<td><input type="text" class="tag-input" placeholder="예: 간호팀" data-collection="comms" data-id="'+c.id+'" data-field="dept" value="'+escapeHtml(c.dept||'')+'" style="background:'+dc.bg+';color:'+dc.fg+';"></td>'+
      '<td><select data-collection="comms" data-id="'+c.id+'" data-field="workCategory">'+workOpts+'</select></td>'+
      '<td><input type="text" placeholder="상대방/부서" data-collection="comms" data-id="'+c.id+'" data-field="target" value="'+escapeHtml(c.target||'')+'"></td>'+
      '<td><textarea data-collection="comms" data-id="'+c.id+'" data-field="content" rows="1" placeholder="소통 내용 / 협의사항">'+escapeHtml(c.content||'')+'</textarea></td>'+
      '<td><select data-collection="comms" data-id="'+c.id+'" data-field="direction" style="background:'+dirColor.bg+';color:'+dirColor.fg+';">'+dirOpts+'</select></td>'+
      '<td><input type="text" placeholder="내선/전화" data-collection="comms" data-id="'+c.id+'" data-field="ext" value="'+escapeHtml(c.ext||'')+'"></td>'+
      '<td><div class="cell-check-group">'+peopleChecks+'</div></td>'+
      '<td><textarea data-collection="comms" data-id="'+c.id+'" data-field="note" rows="1" placeholder="비고">'+escapeHtml(c.note||'')+'</textarea></td>'+
      '<td><details class="filelink-details"><summary>📎 '+(fileCount?fileCount+'개':'첨부')+'</summary>'+renderFileLinks('comms', c)+'</details></td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="comms" data-id="'+c.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ================= 📔 업무매뉴얼 ================= */
  function renderManualsTab(){
    var items = state.manuals.slice().sort(function(a,b){
      var ao = MANUAL_CATS.indexOf(a.category), bo = MANUAL_CATS.indexOf(b.category);
      if(ao!==bo) return ao-bo;
      return (a.clientTs||0)-(b.clientTs||0);
    });
    var listHtml = items.length ? items.map(renderManualItem).join('') : '<div class="empty-state">등록된 업무매뉴얼이 없습니다. 중재·TDM·행정 등 업무별 매뉴얼이나 공부 자료를 정리해보세요.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>📔 업무매뉴얼</h3><button class="btn" data-action="add-manual">+ 새 매뉴얼 작성</button></div>'+
      listHtml+
    '</div>';
  }
  function renderManualItem(m){
    var cat = m.category || MANUAL_CATS[0];
    var mc = MANUAL_CAT_COLORS[cat] || {fg:'#888',bg:'#eee'};
    var catOpts = MANUAL_CATS.map(function(c){ return '<option value="'+c+'"'+(cat===c?' selected':'')+'>'+c+'</option>'; }).join('');
    return '<div class="doc-item manual-item" data-id="'+m.id+'">'+
      '<div class="doc-item-head">'+
        '<select class="status-select-sm" data-collection="manuals" data-id="'+m.id+'" data-field="category" style="background:'+mc.bg+';color:'+mc.fg+';">'+catOpts+'</select>'+
        '<input type="text" class="doc-title-input" placeholder="매뉴얼 제목 (예: 중재 업무 매뉴얼)" data-collection="manuals" data-id="'+m.id+'" data-field="title" value="'+escapeHtml(m.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="manuals" data-id="'+m.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="note-meta">'+escapeHtml(m.createdBy||'')+'</div>'+
      '<textarea class="doc-content-input manual-content" placeholder="업무 절차, 참고사항 등을 자유롭게 정리하세요" data-collection="manuals" data-id="'+m.id+'" data-field="content">'+escapeHtml(m.content||'')+'</textarea>'+
      renderFileLinks('manuals', m)+
    '</div>';
  }

  /* ================= 🗂 자료실 ================= */
  function renderFilesTab(){
    var items = state.files.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var rows = items.map(renderFileRow).join('');
    return '<div class="card">'+
      '<div class="card-head"><h3>🗂 자료실 (링크 모음)</h3><button class="btn" data-action="add-file">+ 자료 링크 추가</button></div>'+
      '<table><thead><tr><th>제목</th><th>링크 URL</th><th>분류</th><th>날짜</th><th>등록자</th><th></th></tr></thead>'+
      '<tbody>'+(rows||'')+'</tbody></table>'+
      (rows ? '' : '<div class="empty-state">등록된 자료가 없습니다. 구글드라이브/원드라이브 등 링크를 등록해보세요.</div>')+
    '</div>';
  }
  function renderFileRow(f){
    var linkHtml = f.url ? '<a href="'+escapeHtml(f.url)+'" target="_blank" rel="noopener" style="font-size:11px;color:var(--primary);">열기 ↗</a>' : '';
    return '<tr data-id="'+f.id+'">'+
      '<td><input type="text" placeholder="자료명" data-collection="files" data-id="'+f.id+'" data-field="title" value="'+escapeHtml(f.title||'')+'"></td>'+
      '<td><input type="text" placeholder="https://..." data-collection="files" data-id="'+f.id+'" data-field="url" value="'+escapeHtml(f.url||'')+'"> '+linkHtml+'</td>'+
      '<td><input type="text" placeholder="분류" data-collection="files" data-id="'+f.id+'" data-field="category" value="'+escapeHtml(f.category||'')+'"></td>'+
      '<td><input type="date" data-collection="files" data-id="'+f.id+'" data-field="date" value="'+escapeHtml(f.date||todayStr())+'"></td>'+
      '<td class="task-content-preview">'+escapeHtml(f.createdBy||'')+'</td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="files" data-id="'+f.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ---------------- Event Delegation ---------------- */
  var mainEl = document.querySelector('main');

  mainEl.addEventListener('click', function(e){
    var el = e.target.closest('[data-action]');
    if(!el) return;
    var action = el.dataset.action;
    var col = el.dataset.collection, id = el.dataset.id;

    if(action==='add-announcement') addRow('announcements', { title:'', content:'', date:todayStr() });
    else if(action==='add-task') addRow('tasks', { major:MAJOR_CATS[0], minor:'', title:'', date:todayStr(), endDate:'', status:'시작 전', content:'', url:'', assignees:[] });
    else if(action==='add-personal') addRow('personal', { owner:el.dataset.owner, title:'', status:'대기', deadline:'' });
    else if(action==='add-meeting') addRow('meetings', { title:'', date:todayStr(), attendees:[], content:'' });
    else if(action==='add-idea') addRow('ideas', { title:'', content:'', status:'검토중', date:todayStr() });
    else if(action==='add-comm') addRow('comms', { date:todayStr(), dept:'', workCategory:COMM_WORK_CATS[0], target:'', content:'', direction:COMM_DIRECTIONS[0], ext:'', participants:[], note:'', files:[] });
    else if(action==='add-manual') addRow('manuals', { category:MANUAL_CATS[0], title:'', content:'', files:[] });
    else if(action==='add-file') addRow('files', { title:'', url:'', category:'', date:todayStr() });
    else if(action==='add-dday') addRow('dday', { title:'', date:todayStr() });
    else if(action==='del-row') delRow(col, id);
    else if(action==='add-filelink') addFileLink(col, id);
    else if(action==='del-filelink') delFileLink(col, id, el.dataset.item);
    else if(action==='toggle-group'){
      var cat = el.dataset.cat;
      state.taskCollapsed[cat] = !state.taskCollapsed[cat];
      renderActiveTab();
    }
    else if(action==='sort-tasks'){
      var f = el.dataset.field;
      if(state.taskSortField===f){ state.taskSortDir = state.taskSortDir==='asc' ? 'desc' : 'asc'; }
      else { state.taskSortField = f; state.taskSortDir = 'asc'; }
      renderActiveTab();
    }
    else if(action==='toggle-person'){
      if(!requireFirebase()) return;
      var arrField = el.dataset.arrayField;
      var doc = (state[col]||[]).find(function(x){ return x.id===id; });
      if(!doc) return;
      var arr = (doc[arrField]||[]).slice();
      var person = el.dataset.person;
      var idx = arr.indexOf(person);
      if(idx>-1) arr.splice(idx,1); else arr.push(person);
      var payload = {}; payload[arrField] = arr; payload.updatedAt = Date.now();
      db.collection(col).doc(id).update(payload).catch(function(err){ showToast('저장 실패: '+err.message); });
    }
    else if(action==='select-cal-date'){
      state.calSelectedDate = (state.calSelectedDate===el.dataset.date) ? null : el.dataset.date;
      renderActiveTab();
    }
    else if(action==='goto-board'){
      state.activeTab = el.dataset.tab;
      renderActiveTab();
    }
    else if(action==='cal-prev'){
      var d1 = new Date(state.calMonth+'-01'); d1.setMonth(d1.getMonth()-1);
      state.calMonth = d1.getFullYear()+'-'+pad2(d1.getMonth()+1);
      renderActiveTab();
    }
    else if(action==='cal-next'){
      var d2 = new Date(state.calMonth+'-01'); d2.setMonth(d2.getMonth()+1);
      state.calMonth = d2.getFullYear()+'-'+pad2(d2.getMonth()+1);
      renderActiveTab();
    }
    else if(action==='cal-today'){
      var d3 = new Date();
      state.calMonth = d3.getFullYear()+'-'+pad2(d3.getMonth()+1);
      state.calSelectedDate = todayStr();
      renderActiveTab();
    }
  });

  // 텍스트 입력: 타이핑 중엔 디바운스 저장 (+ textarea 자동 높이 + 태그 색상 미리보기)
  mainEl.addEventListener('input', function(e){
    var t = e.target;
    if(!t.dataset.field || !t.dataset.collection) return;
    if(t.tagName==='TEXTAREA') autoGrow(t);
    if(t.tagName==='INPUT' && t.type==='checkbox') return; // change 이벤트에서 처리
    if(t.classList.contains('tag-input')){
      var c = hashColor(t.value);
      t.style.background = c.bg; t.style.color = c.fg;
    }
    if(t.dataset.nested==='files'){
      scheduleSaveNested(t.dataset.collection, t.dataset.id, 'files', t.dataset.item, t.dataset.field, t.value);
      return;
    }
    scheduleSave(t.dataset.collection, t.dataset.id, t.dataset.field, t.value);
  });

  // 포커스가 빠져나가면 즉시 저장 확정 + 밀린 재렌더링 반영
  mainEl.addEventListener('focusout', function(e){
    var t = e.target;
    if(t.dataset.field && t.dataset.collection && t.tagName!=='SELECT'){
      if(t.dataset.nested==='files'){
        flushSaveNestedNow(t.dataset.collection, t.dataset.id, 'files', t.dataset.item, t.dataset.field, t.value);
      } else {
        flushSaveNow(t.dataset.collection, t.dataset.id, t.dataset.field, t.value);
      }
    }
    if(pendingRerender){ pendingRerender=false; renderActiveTab(); }
  });

  // select / date / checkbox 등 값이 바뀌는 즉시 저장
  mainEl.addEventListener('change', function(e){
    var t = e.target;
    if(t.id==='filterPerson'){ state.taskFilterPerson = t.value; renderActiveTab(); return; }
    if(t.id==='filterStatus'){ state.taskFilterStatus = t.value; renderActiveTab(); return; }
    if(t.id==='calFilterSelect'){ state.calFilter = t.value; renderActiveTab(); return; }
    if(!t.dataset.field || !t.dataset.collection) return;
    var val = t.type==='checkbox' ? t.checked : t.value;
    flushSaveNow(t.dataset.collection, t.dataset.id, t.dataset.field, val);
    if(t.dataset.field==='status' && STATUS_COLORS[val]){
      t.style.background = STATUS_COLORS[val].bg; t.style.color = STATUS_COLORS[val].fg;
    }
    if(t.dataset.field==='direction' && DIRECTION_COLORS[val]){
      t.style.background = DIRECTION_COLORS[val].bg; t.style.color = DIRECTION_COLORS[val].fg;
    }
    if(t.dataset.field==='category' && MANUAL_CAT_COLORS[val]){
      t.style.background = MANUAL_CAT_COLORS[val].bg; t.style.color = MANUAL_CAT_COLORS[val].fg;
    }
  });

  /* ---------------- Init ---------------- */
  renderActiveTab();
  initFirebase();
})();
