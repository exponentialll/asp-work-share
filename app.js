/* ========================================================================
   💊 ASP 업무 공유 — 지수 · 다경 공동 업무 공간
   Firestore로 실시간 동기화됩니다. 모든 입력은 Notion처럼 즉시 저장됩니다
   (별도의 "추가" 팝업 없이, 새 줄을 만들고 바로 타이핑하면 자동 저장).
   ======================================================================== */
(function(){
  'use strict';

  var MAJOR_CATS = ['행정','교육','중재'];
  var MINOR_CATS = ['일간','주간','격주','월별','분기','반기','연간','필수','비정기'];
  // 행정 업무는 대부분 정기 보고 성격이라, 소분류 선택지를 주기 흐름 순서(월별→분기→반기→연간→비정기)로 좁혀서 보여줘요.
  var ADMIN_MINOR_CATS = ['월별','분기','반기','연간','비정기'];
  // 드롭다운에서 위에서부터 보이는 순서예요. 실제 정렬 우선순위는 STATUS_ORDER를 따로 씁니다.
  var STATUSES = ['진행 중','시작 전','완료'];
  // 예전에는 "진행중"(공백 없이)으로 저장된 데이터도 있어서, 정렬 시 그 값도 똑같이 0으로 인식하게 별칭을 같이 넣었어요.
  var STATUS_ORDER = { '진행 중':0, '진행중':0, '시작 전':1, '완료':2 };
  var PEOPLE = ['지수','다경'];
  var COMM_WORK_CATS = ['처방검토','중재','TDM','상담/교육','회의','데이터/통계','서류/행정','인사','기타'];
  var COMM_DIRECTIONS = ['발신','수신','양방향'];
  var COMM_DEPTS = ['간호팀','전산팀','질병청','ASP사무국','인재경영팀','약제팀','기타'];
  var IDEA_STATUSES = ['검토중','채택','보류'];
  var MANUAL_CATS = ['중재','TDM','행정','교육','시스템','기타'];
  var MANUAL_CADENCES = ['월별','분기별','반기별','연간'];
  var FILE_CATS = ['프로그램','양식','매뉴얼','공부자료','가이드라인','기타'];
  var CADENCES = ['매일','주간','매달','분기별','반기별','연간'];
  var PERSONAL_BASE_CATS = ['회의','교육','TDM','기타'];
  var MEETING_TYPES = ['주간회의','월간회의','ASP 팀회의'];

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
    '지수': { fg:'#d6608a', bg:'#fbe9ef' },
    '다경': { fg:'#4aa3a2', bg:'#e6f4f3' }
  };
  var SHARED_COLOR = { fg:'#5b8def', bg:'#e8eefd' };
  var DDAY_COLOR = { fg:'#c98a2f', bg:'#fdf1e0' };
  var DIRECTION_COLORS = {
    '발신': { fg:'#3b7dd8', bg:'#e8f0fd' },
    '수신': { fg:'#3fa15e', bg:'#e9f7ee' },
    '양방향':{ fg:'#8f5fd6', bg:'#f2ecfb' }
  };
  var COMM_DEPT_COLORS = {
    '간호팀':     { fg:'#3b7dd8', bg:'#e8f0fd' },
    '전산팀':     { fg:'#8f5fd6', bg:'#f2ecfb' },
    '질병청':     { fg:'#c65c5c', bg:'#fbeaea' },
    'ASP사무국':  { fg:'#d98a3d', bg:'#fdf1e4' },
    '인재경영팀': { fg:'#4aa3a2', bg:'#e6f4f3' },
    '약제팀':     { fg:'#d6608a', bg:'#fbe9ef' },
    '기타':       { fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  var MEETING_TYPE_COLORS = {
    '주간회의':    { fg:'#3b7dd8', bg:'#e8f0fd' },
    '월간회의':    { fg:'#8f5fd6', bg:'#f2ecfb' },
    'ASP 팀회의':  { fg:'#d98a3d', bg:'#fdf1e4' }
  };
  var MANUAL_CAT_COLORS = {
    '중재':   { fg:'#8f5fd6', bg:'#f2ecfb' },
    'TDM':    { fg:'#3fa15e', bg:'#e9f7ee' },
    '행정':   { fg:'#3b7dd8', bg:'#e8f0fd' },
    '교육':   { fg:'#7d7d7d', bg:'#efefef' },
    '시스템': { fg:'#d98a3d', bg:'#fdf1e4' },
    '기타':   { fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  // 업무매뉴얼 중 "행정" 분류는 문서가 많아지기 쉬워서, 월별/분기별/반기별/연간 주기로 한 번 더 나눠 볼 수 있어요.
  var MANUAL_CADENCE_COLORS = {
    '월별':   { fg:'#8f5fd6', bg:'#f2ecfb' },
    '분기별': { fg:'#d98a3d', bg:'#fdf1e4' },
    '반기별': { fg:'#c9527a', bg:'#fbe4ed' },
    '연간':   { fg:'#c65c5c', bg:'#fbeaea' }
  };
  var FILE_CAT_COLORS = {
    '프로그램': { fg:'#3b7dd8', bg:'#e8f0fd' },
    '양식':     { fg:'#4aa3a2', bg:'#e6f4f3' },
    '매뉴얼':   { fg:'#8f5fd6', bg:'#f2ecfb' },
    '공부자료': { fg:'#d6608a', bg:'#fbe9ef' },
    '가이드라인': { fg:'#d98a3d', bg:'#fdf1e4' },
    '기타':     { fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  // 소분류(일간/주간/.../반기/연간 등)를 한눈에 구분할 수 있도록 색을 지정합니다. 반기·연간처럼
  // 자주 놓치기 쉬운 주기는 진한 색으로 눈에 띄게 했어요.
  var MINOR_CAT_COLORS = {
    '일간':  { fg:'#8a8d98', bg:'#eef0f4' },
    '주간':  { fg:'#3b7dd8', bg:'#e8f0fd' },
    '격주':  { fg:'#4aa3a2', bg:'#e6f4f3' },
    '월별':  { fg:'#8f5fd6', bg:'#f2ecfb' },
    '분기':  { fg:'#d98a3d', bg:'#fdf1e4' },
    '반기':  { fg:'#c9527a', bg:'#fbe4ed' },
    '연간':  { fg:'#c65c5c', bg:'#fbeaea' },
    '필수':  { fg:'#b8860b', bg:'#fdf3d6' },
    '비정기':{ fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  // 개별 업무리스트 분류는 자동 해시 색상(hashColor)을 쓰면 서로 비슷한 색이 우연히 겹칠 수 있어서,
  // 다른 분류들처럼 눈에 띄게 구분되는 고정 색상을 지정했어요. 목록에 없는 분류(직접 추가한 것)만 hashColor로 보완합니다.
  var PERSONAL_CAT_COLORS = {
    '회의':   { fg:'#3b7dd8', bg:'#e8f0fd' },
    '교육':   { fg:'#7d7d7d', bg:'#efefef' },
    'TDM':    { fg:'#3fa15e', bg:'#e9f7ee' },
    '개인공부': { fg:'#c9527a', bg:'#fbe4ed' },
    '기타':   { fg:'#9a9a9a', bg:'#f0f0f0' }
  };
  var CADENCE_COLORS = {
    '매일':   MINOR_CAT_COLORS['일간'],
    '주간':   MINOR_CAT_COLORS['주간'],
    '매달':   MINOR_CAT_COLORS['월별'],
    '분기별': MINOR_CAT_COLORS['분기'],
    '반기별': MINOR_CAT_COLORS['반기'],
    '연간':   MINOR_CAT_COLORS['연간']
  };
  var BOARD_TO_TAB = {
    '공지사항':'announcements', '업무 리스트':'tasks', '개별 업무리스트':'personal',
    '회의':'meetings', '아이디어':'ideas', '소통일지':'comms', '자료실':'files'
  };
  // 자유 입력 텍스트에 고정 색상 팔레트가 없을 때, 글자 기반으로 일관된 파스텔 색을 만들어줍니다.
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
  // 표 안 날짜 칸이 너무 넓어 보여서, 화면엔 "26-09-14"처럼 연도 앞 두 자리를 뺀 짧은 표기로 보여줘요.
  // 실제 저장되는 값은 그대로 "2026-09-14" 전체 형식이라 정렬/계산에는 영향이 없어요.
  function shortDate(d){
    return (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d.slice(2) : (d||'');
  }
  // 네이티브 <input type="date">는 폭을 줄여도 브라우저가 연도까지 표시할 자리를 그대로 차지해서
  // 표 칸을 좁히는 데 한계가 있어요. 그래서 화면엔 짧은 날짜 글자가 적힌 작은 버튼만 보여주고,
  // 버튼을 누르면 화면 밖에 숨겨둔 진짜 날짜 입력칸의 달력을 열어서(showPicker) 고르게 했어요.
  // 저장은 그 숨은 input이 기존과 똑같은 data-collection/data-id/data-field를 그대로 갖고 있어서
  // 자동으로 처리됩니다.
  function renderCompactDateField(col, id, field, value, placeholder){
    var domId = 'datefield-'+col+'-'+id+'-'+field;
    var label = value ? shortDate(value) : (placeholder || '+ 날짜');
    return '<span class="date-compact-wrap">'+
      '<button type="button" class="date-compact-btn'+(value?'':' empty')+'" data-action="open-date-picker" data-target="'+domId+'" title="'+escapeHtml(value||'')+'">'+escapeHtml(label)+'</button>'+
      '<input type="date" id="'+domId+'" class="date-hidden-input" data-collection="'+col+'" data-id="'+id+'" data-field="'+field+'" value="'+escapeHtml(value||'')+'">'+
    '</span>';
  }
  function badge(label, colorMap, extraStyle){
    var c = (colorMap && colorMap[label]) || { fg:'#888', bg:'#eee' };
    return '<span class="badge" style="color:'+c.fg+';background:'+c.bg+(extraStyle||'')+'">'+escapeHtml(label)+'</span>';
  }
  function uniqNonEmpty(arr){
    var out = [], seen = {};
    (arr||[]).forEach(function(v){
      v = (v||'').trim();
      if(v && !seen[v]){ seen[v]=true; out.push(v); }
    });
    return out;
  }
  var toastTimer=null;
  function showToast(msg){
    var t=document.getElementById('toast');
    t.textContent=msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }
  // 문서형 내용칸(doc-content-input, 공지사항/회의/아이디어/업무매뉴얼 상세)만 내용에 맞춰 늘어나고,
  // CSS max-height에 닿으면 그 이상은 늘어나지 않고 안에서 스크롤됩니다.
  // 표 안의 칸(cell-textarea 등)은 늘어나지 않도록 별도로 두어(고정 높이) 행 높이가 서로 비슷하게 유지돼요.
  function autoGrow(el){
    el.style.height='auto';
    var max = parseFloat(window.getComputedStyle(el).maxHeight);
    var sh = el.scrollHeight;
    el.style.height = (max && sh>max ? max : sh)+'px';
  }
  function autoGrowAll(){ document.querySelectorAll('textarea.doc-content-input').forEach(autoGrow); }
  // 표 안 칸(cell-textarea 등)은 평소엔 고정된 낮은 높이를 유지해 행 높이가 서로 비슷하지만,
  // 포커스를 받거나 타이핑 중일 때만 최대 180px까지 늘어나고, 포커스를 벗어나면 다시 원래 높이로 접힙니다.
  function autoGrowCell(el){
    el.style.height='auto';
    var sh = el.scrollHeight;
    var max = 180;
    el.style.height = (sh>max ? max : Math.max(sh,56))+'px';
  }
  var WEEKDAY_KOR = ['일','월','화','수','목','금','토'];

  // ASP 정기업무의 "현재 기간"을 계산합니다. 기간이 바뀌면(예: 다음날/다음주) key가 자동으로
  // 바뀌기 때문에, 완료 표시(lastDonePeriod)가 이전 key와 다르면 자연스럽게 "대기"로 리셋됩니다.
  function periodInfo(cadence){
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();
    if(cadence==='매일'){
      return { key: todayStr(), label: y+'년 '+m+'월 '+d+'일 ('+WEEKDAY_KOR[now.getDay()]+')' };
    }
    if(cadence==='주간'){
      var dow = (now.getDay()+6)%7; // 월요일=0
      var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate()-dow);
      var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+6);
      var jan1 = new Date(mon.getFullYear(),0,1);
      var week = Math.ceil((((mon-jan1)/86400000) + jan1.getDay()+1)/7);
      var key = mon.getFullYear()+'-W'+pad2(week);
      var label = pad2(mon.getMonth()+1)+'-'+pad2(mon.getDate())+' ~ '+pad2(sun.getMonth()+1)+'-'+pad2(sun.getDate())+' ('+key+')';
      return { key:key, label:label };
    }
    if(cadence==='매달'){
      return { key: y+'-'+pad2(m), label: y+'년 '+m+'월' };
    }
    if(cadence==='분기별'){
      var q = Math.ceil(m/3);
      var qMonths = [[1,3],[4,6],[7,9],[10,12]][q-1];
      return { key: y+'-Q'+q, label: y+'년 '+q+'분기 ('+qMonths[0]+'~'+qMonths[1]+'월)' };
    }
    if(cadence==='반기별'){
      var h = m<=6 ? 1 : 2;
      var hMonths = h===1 ? [1,6] : [7,12];
      return { key: y+'-H'+h, label: y+'년 '+(h===1?'상반기':'하반기')+' ('+hMonths[0]+'~'+hMonths[1]+'월)' };
    }
    return { key: ''+y, label: y+'년' }; // 연간
  }

  /* ---------------- Firebase ---------------- */
  var db=null, auth=null, storage=null, firebaseReady=false, listenersAttached=false, weeklyMeetingChecked=false, notionImportChecked=false, notionCommsImportChecked=false, notionPersonalImportChecked=false;
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
      try{ if(firebase.storage) storage = firebase.storage(); }catch(e){ storage = null; }
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

  var COLLECTIONS = ['tasks','announcements','personal','meetings','ideas','comms','manuals','files','dday','pins','recurring'];
  var STATE_KEY = { tasks:'tasks', announcements:'announcements', personal:'personal', meetings:'meetings', ideas:'ideas', comms:'comms', manuals:'manuals', files:'files', dday:'dday', pins:'pins', recurring:'recurring' };
  // 캘린더 탭은 모든 컬렉션의 날짜를 모아 보여주므로, dday를 포함한 모든 컬렉션 변경이 캘린더도 함께 갱신시켜야 합니다.
  // pins는 사이드바 전용, recurring은 업무 리스트 탭 안의 패널에서 쓰이므로 tasks에 매핑합니다.
  var TAB_FOR_COLLECTION = { tasks:'tasks', announcements:'announcements', personal:'personal', meetings:'meetings', ideas:'ideas', comms:'comms', manuals:'manuals', files:'files', dday:'calendar', pins:null, recurring:'tasks' };

  function attachListeners(){
    COLLECTIONS.forEach(function(col){
      db.collection(col).onSnapshot(function(snap){
        state[STATE_KEY[col]] = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        onDataChanged(TAB_FOR_COLLECTION[col]);
        if(col==='meetings') ensureWeeklyMeeting();
        if(col==='tasks'){ ensureNotionImport(); migrateLegacyStatusLabel('tasks', state.tasks); }
        if(col==='comms'){ ensureNotionCommsImport(); migrateCommsWorkCategoryLabel(); }
        if(col==='personal'){ ensureNotionPersonalImport(); migrateLegacyStatusLabel('personal', state.personal); }
        if(col==='manuals') migrateRemovedManualCategory();
      }, handleSnapError);
    });
  }

  // "개인 공부" 분류를 없앴는데 예전에 그 분류로 저장된 매뉴얼이 있으면 분류 탭 어디에도 안 걸려서
  // 화면에서 안 보이게 될 수 있어요. 그런 문서가 있으면 "기타"로 자동 이동시켜 계속 보이게 합니다.
  function migrateRemovedManualCategory(){
    if(!db) return;
    state.manuals.forEach(function(m){
      if(m.category === '개인 공부'){
        db.collection('manuals').doc(m.id).update({ category:'기타' }).catch(function(err){ console.error(err); });
      }
    });
  }
  // 예전에 "진행중"(공백 없이)으로 저장된 업무/개별업무 기록은 뱃지 색은 맞게 보였지만 정렬 기준(STATUS_ORDER)에서는
  // 매칭이 안 돼서 맨 뒤로 밀리는 문제가 있었어요. 발견되면 공백이 들어간 "진행 중"으로 자동 정리합니다.
  function migrateLegacyStatusLabel(col, list){
    if(!db) return;
    list.forEach(function(item){
      if(item.status === '진행중'){
        db.collection(col).doc(item.id).update({ status:'진행 중' }).catch(function(err){ console.error(err); });
      }
    });
  }
  // "중재(Intervention)" 업무분류 이름을 "중재"로 짧게 바꿨는데, 이미 그 이름으로 저장된 소통일지 기록이
  // 있으면 목록 어디에도 안 걸려서 드롭다운이 이상하게 보일 수 있어요. 자동으로 새 이름으로 옮겨줍니다.
  function migrateCommsWorkCategoryLabel(){
    if(!db) return;
    state.comms.forEach(function(c){
      if(c.workCategory === '중재(Intervention)'){
        db.collection('comms').doc(c.id).update({ workCategory:'중재' }).catch(function(err){ console.error(err); });
      }
    });
  }

  // 매주 금요일 오후 4시 "주간회의"가 없으면 자동으로 만들어줍니다. 문서 ID를 날짜 기반으로 고정해서
  // 두 사람이 동시에 접속해도 중복 생성되지 않아요.
  function ensureWeeklyMeeting(){
    if(!db || weeklyMeetingChecked) return;
    weeklyMeetingChecked = true;
    var now = new Date();
    var dow = now.getDay();
    var daysUntilFri = (5 - dow + 7) % 7;
    var fri = new Date(now.getFullYear(), now.getMonth(), now.getDate()+daysUntilFri);
    var friStr = fri.getFullYear()+'-'+pad2(fri.getMonth()+1)+'-'+pad2(fri.getDate());
    var id = 'auto-weekly-'+friStr;
    db.collection('meetings').doc(id).get().then(function(snap){
      if(!snap.exists){
        db.collection('meetings').doc(id).set({
          meetingType:'주간회의', title:'주간회의', date:friStr, time:'16:00',
          attendees:PEOPLE.slice(), content:'', files:[], clientTs:Date.now(), createdAt:Date.now(), createdBy:'자동 생성'
        });
      }
    }).catch(function(err){ console.error(err); });
  }

  // 지수님이 보내주신 노션 "ASP 업무 리스트" 캡처 화면에서 항목을 추출해 한 번만 업무 리스트에 옮겨 담습니다.
  // meta/notion-import-2026-09 마커 문서로 이미 가져왔는지 확인하기 때문에, 앱을 여러 번 열거나
  // 지수·다경 두 분이 동시에 접속해도 중복 생성되지 않아요.
  function ensureNotionImport(){
    if(!db || notionImportChecked) return;
    notionImportChecked = true;
    var markerId = 'notion-import-2026-09';
    db.collection('meta').doc(markerId).get().then(function(snap){
      if(snap.exists) return;
      var items = [
        { slug:'edu-infection-symposium', major:'교육', minor:'필수', title:'감염약료 심포지엄 참가(실시간zoom)', date:'2026-09-23', status:'진행 중', content:'신청기간:09/01~09/18 (완)', assignees:['지수'] },
        { slug:'edu-fall-academic-seminar', major:'교육', minor:'', title:'추계학술세미나 참가', date:'2026-10-21', status:'시작 전', content:'신청기간: 08/19~09/18', assignees:[] },
        { slug:'admin-kdca-performance-report', major:'행정', minor:'비정기', title:'질병청 성과 제출', date:'2026-09-09', status:'완료', content:'이경환 대리님 제출 완료(0828)', assignees:[] },
        { slug:'admin-restricted-antibiotic-usage', major:'행정', minor:'월별', title:'제한항균제 사용 현황', date:'2026-09-14', endDate:'2026-09-18', status:'진행 중', content:'8월(→)/김은비주임께도 제출...', assignees:[] },
        { slug:'admin-konas-carbapenem-q3', major:'행정', minor:'분기', title:'3분기 KONAS carbaphenem 사용량 업로드', date:'2026-10-31', status:'시작 전', content:'2026.07-2026.09 범위\n🔗 원본 노션 URL이 캡처에서 잘려서 정확한 주소는 노션에서 다시 확인해주세요 (notion.so/3c3...로 시작)', assignees:[] },
        { slug:'admin-konas-h2-2025-report', major:'행정', minor:'반기', title:'2025 하반기 KONAS 환류 자료 제작', date:'', status:'시작 전', content:'', assignees:[] },
        { slug:'admin-kdca-asp-annual-report', major:'행정', minor:'연간', title:'질병청 ASP 연간보고서 작성', date:'', status:'시작 전', content:'', assignees:[] },
        { slug:'intervention-accept', major:'중재', minor:'주간', title:'중재수용', date:'2026-08-29', status:'진행 중', content:'', assignees:['지수'] },
        { slug:'intervention-13', major:'중재', minor:'격주', title:'13', date:'2026-08-24', endDate:'2026-09-04', status:'진행 중', content:'', assignees:[] },
        { slug:'intervention-278', major:'중재', minor:'격주', title:'278', date:'2026-08-24', endDate:'2026-09-04', status:'진행 중', content:'', assignees:['지수'] }
      ];
      var batch = db.batch();
      items.forEach(function(it){
        var ref = db.collection('tasks').doc('notion-import-'+it.slug);
        batch.set(ref, {
          major:it.major, minor:it.minor||'', title:it.title, date:it.date||'', endDate:it.endDate||'',
          status:it.status, content:it.content||'', assignees:it.assignees||[], comments:[], files:[],
          clientTs:Date.now(), createdAt:Date.now(), createdBy:'노션 가져오기'
        });
      });
      batch.set(db.collection('meta').doc(markerId), { done:true, importedAt:Date.now() });
      batch.commit().then(function(){ showToast('노션 업무 리스트 '+items.length+'건을 가져왔어요'); }).catch(function(err){ console.error(err); });
    }).catch(function(err){ console.error(err); });
  }

  // 지수님이 보내주신 노션 "소통일지" 캡처 화면에서 항목을 추출해 한 번만 소통일지에 옮겨 담습니다.
  function ensureNotionCommsImport(){
    if(!db || notionCommsImportChecked) return;
    notionCommsImportChecked = true;
    var markerId = 'notion-comms-import-2026-09';
    db.collection('meta').doc(markerId).get().then(function(snap){
      if(snap.exists) return;
      var items = [
        { slug:'2026-08-11-jeonsan-1', date:'2026-08-11', dept:'전산팀', workCategory:'중재', target:'고석길 대리', content:'2번 중재에서 IERPE 외래 처방이 잡히는거 해결됨 (08/14 이후로)', direction:'양방향', ext:'', participants:['지수'] },
        { slug:'2026-08-18-nurse-micu', date:'2026-08-18', dept:'간호팀', workCategory:'TDM', target:'MICU 간호사', content:'김정숙(06001138)환자 12:00 투약인데, 11:37 약물농도 검사 접수됨', direction:'발신', ext:'2453', participants:['지수'] },
        { slug:'2026-08-19-nurse-12', date:'2026-08-19', dept:'간호팀', workCategory:'TDM', target:'12병동 간호사', content:'이강진 환자 체중 미기재로 체중 물어봄 → bed-ridden 상태로 체중 측정 어려움 확인', direction:'발신', ext:'2424', participants:['지수'] },
        { slug:'2026-08-24-jeonsan-2', date:'2026-08-24', dept:'전산팀', workCategory:'서류/행정', target:'고석길 대리', content:'질병청 항생제별 DOT 자료매매 연락함', direction:'발신', ext:'', participants:['지수'] },
        { slug:'2026-08-24-kdca', date:'2026-08-24', dept:'질병청', workCategory:'서류/행정', target:'', content:'질병청 가입승인 언제되는지 물어봄 → 09/15 일괄 처리 예정', direction:'발신', ext:'', participants:['지수'] },
        { slug:'2026-08-24-asp-office', date:'2026-08-24', dept:'ASP사무국', workCategory:'서류/행정', target:'사무국', content:'질병청 가입 했다고 메일 보냄 (윤다경/김지수)', direction:'발신', ext:'', participants:['지수','다경'] },
        { slug:'2026-08-25-pharm', date:'2026-08-25', dept:'약제팀', workCategory:'서류/행정', target:'김은비 주임', content:'6,7월 제한항생제 사용량 파일 달라고해서 줌(항생제 소위원회)', direction:'수신', ext:'', participants:['지수'] },
        { slug:'2026-08-25-nurse-12-vanco', date:'2026-08-25', dept:'간호팀', workCategory:'TDM', target:'12병동 간호사', content:'88087385 환자 VANCO TDM 빨리 해달라고 요청받음.', direction:'수신', ext:'', participants:['지수','다경'], note:'이후 완료됨을 노티함.' },
        { slug:'2026-08-27-nurse-14-vanco', date:'2026-08-27', dept:'간호팀', workCategory:'TDM', target:'14병동 간호사', content:'24169957 환자 VANCO TDM 빨리 해달라고 요청받음.', direction:'수신', ext:'', participants:['지수'], note:'노티보다는 메신저를 더 잘... (노션 원본이 잘려서 이어지는 내용은 노션에서 확인해주세요)' },
        { slug:'2026-08-31-jeonsan-3', date:'2026-08-31', dept:'전산팀', workCategory:'중재', target:'고석길 대리', content:'고석길 대리님 안녕하세요! [ASP 대상관리] 탭 관련 문의드립니다. 최근... (노션 원본이 잘려서 이어지는 내용은 노션에서 확인해주세요)', direction:'발신', ext:'', participants:['지수'], note:'답변 : 그냥 중복해서 중재걸... (노션 원본이 잘려서 이어지는 내용은 노션에서 확인해주세요)' },
        { slug:'2026-08-31-hr', date:'2026-08-31', dept:'인재경영팀', workCategory:'인사', target:'이경환 대리', content:'1. 전담팀에 신규 인원(우리) 등록/결재 올라간 소식 2. 비품: 청구하는... (노션 원본이 잘려서 이어지는 내용은 노션에서 확인해주세요)', direction:'수신', ext:'', participants:['지수','다경'] },
        { slug:'2026-09-02-pharm-2', date:'2026-09-02', dept:'약제팀', workCategory:'서류/행정', target:'김은비 약사', content:'7월 EDW 자료 약품 출고금액/ 항생제 출고금액 관련해서 올려오시기... (노션 원본이 잘려서 이어지는 내용은 노션에서 확인해주세요)', direction:'수신', ext:'', participants:['지수'] },
        { slug:'2026-09-02-nurse-13-teico', date:'2026-09-02', dept:'간호팀', workCategory:'TDM', target:'13병동 간호사', content:'05020447 환자 TEICO trough 40 이상으로 독성 우려되어 추가 연락', direction:'발신', ext:'메신저', participants:['지수'] },
        { slug:'2026-09-02-jeonsan-tdm', date:'2026-09-02', dept:'전산팀', workCategory:'TDM', target:'고석길 대리', content:'05020447 환자 TDM 최종 보고가 안되고 [무결성 제약에 위배]라는 오류', direction:'양방향', ext:'', participants:['지수'], note:'원격으로 해결해 주심.' }
      ];
      var batch = db.batch();
      items.forEach(function(it){
        var ref = db.collection('comms').doc('notion-import-'+it.slug);
        batch.set(ref, {
          date:it.date||'', dept:it.dept||COMM_DEPTS[0], workCategory:it.workCategory||COMM_WORK_CATS[0],
          target:it.target||'', content:it.content||'', direction:it.direction||COMM_DIRECTIONS[0], ext:it.ext||'',
          participants:it.participants||[], note:it.note||'', files:[],
          clientTs:Date.now(), createdAt:Date.now(), createdBy:'노션 가져오기'
        });
      });
      batch.set(db.collection('meta').doc(markerId), { done:true, importedAt:Date.now() });
      batch.commit().then(function(){ showToast('노션 소통일지 '+items.length+'건을 가져왔어요 (첨부파일은 화면 캡처만으로는 복원할 수 없어 제외했어요)'); }).catch(function(err){ console.error(err); });
    }).catch(function(err){ console.error(err); });
  }

  // 지수님이 보내주신 노션 "지수 개별 업무리스트" 캡처 화면에서 항목을 추출해 한 번만 개별 업무리스트에 옮겨 담습니다.
  function ensureNotionPersonalImport(){
    if(!db || notionPersonalImportChecked) return;
    notionPersonalImportChecked = true;
    var markerId = 'notion-personal-import-2026-09';
    db.collection('meta').doc(markerId).get().then(function(snap){
      if(snap.exists) return;
      var items = [
        { slug:'google-drive', category:'기타', title:'구글드라이브', content:'만들어야됨', status:'시작 전' },
        { slug:'ox-quiz', category:'기타', title:'O/X 퀴즈', content:'형식 만들기', status:'완료', note:'URL: miricanvas.com/... (노션 원본이 잘려서 정확한 주소는 노션에서 확인해주세요)' },
        { slug:'meeting-minutes-form', category:'회의', title:'회의록', content:'양식 만들기', status:'완료', startDate:'2026-08-25', deadline:'2026-08-25' },
        { slug:'pharm-assoc-lecture', category:'교육', title:'병원약사회 강의', content:'서울/강원/제주 온라인 학술세미나', status:'완료', deadline:'2026-08-31' },
        { slug:'idsa-guideline', category:'개인공부', title:'IDSA 가이드라인', content:'c-UTI(1회독0831) MDR CAP CDI(0921회독) (노션 원본 일부가 잘려서 정확한 내용은 노션에서 확인해주세요)', status:'진행 중' },
        { slug:'daily-study', category:'개인공부', title:'Daily study', content:'', status:'진행 중', startDate:'2026-07-01' },
        { slug:'tdm-form-unify', category:'TDM', title:'TDM 양식 통일', content:'TDM 양식 통일, 여태까지 했던 회신문 합쳐서 개선안', status:'진행 중', startDate:'2026-08-26' }
      ];
      var batch = db.batch();
      items.forEach(function(it){
        var ref = db.collection('personal').doc('notion-import-'+it.slug);
        batch.set(ref, {
          owner:'지수', category:it.category||'', title:it.title||'', content:it.content||'', status:it.status||'시작 전',
          startDate:it.startDate||'', deadline:it.deadline||'', followUp:false, note:it.note||'', files:[],
          clientTs:Date.now(), createdAt:Date.now(), createdBy:'노션 가져오기'
        });
      });
      batch.set(db.collection('meta').doc(markerId), { done:true, importedAt:Date.now() });
      batch.commit().then(function(){ showToast('노션 개별 업무리스트 '+items.length+'건을 가져왔어요'); }).catch(function(err){ console.error(err); });
    }).catch(function(err){ console.error(err); });
  }

  // 사용자가 지금 어떤 입력칸에 타이핑 중이면, 서버에서 새 데이터가 와도 화면을 다시 그리지 않고
  // (커서 위치가 날아가는 것을 방지) 입력을 끝내면(focusout) 그때 반영합니다.
  // 사이드바도 appShell 안에 있으므로 같은 기준으로 편집 여부를 판단합니다.
  var pendingRerender = false;
  function isCurrentlyEditing(){
    var active = document.activeElement;
    var container = document.getElementById('appShell');
    return !!(active && container && container.contains(active) && (active.tagName==='INPUT' || active.tagName==='TEXTAREA'));
  }
  function onDataChanged(tab){
    if(isCurrentlyEditing()){ pendingRerender = true; return; }
    var affectsActive = (tab === state.activeTab) || state.activeTab==='calendar';
    if(affectsActive){ renderActiveTab(); } else { renderSidebar(); }
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
  function addRow(col, data, cb){
    if(!requireFirebase() || !requireWho()) return;
    data.clientTs = Date.now();
    data.createdAt = Date.now();
    data.createdBy = state.who;
    db.collection(col).add(data).then(function(ref){ if(cb) cb(ref.id); }).catch(function(err){ showToast('추가 실패: '+err.message); });
  }
  function delRow(col, id, label){
    if(!requireFirebase()) return;
    if(!confirm((label||'이 항목을')+' 삭제할까요?')) return;
    db.collection(col).doc(id).delete().catch(function(err){ showToast('삭제 실패: '+err.message); });
  }

  /* ---------------- 중첩 배열 필드 (파일 링크 목록) 저장 헬퍼 ---------------- */
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
  function delFileLink(col, docId, itemId){
    if(!requireFirebase()) return;
    var arr = getNestedArray(col, docId, 'files').filter(function(x){ return x.id!==itemId; });
    saveNestedArray(col, docId, 'files', arr);
  }
  // 실제 파일을 Firebase Storage에 업로드합니다 (Blaze 요금제 + Storage 활성화가 되어 있어야 동작해요).
  function uploadFile(col, docId, file){
    if(!requireFirebase()) return;
    if(!storage){ showToast('파일 업로드를 쓰려면 Firebase Storage 설정이 필요해요 (README 6단계 참고)'); return; }
    var path = col+'/'+docId+'/'+Date.now()+'_'+file.name;
    var ref = storage.ref().child(path);
    showToast('업로드 중...');
    ref.put(file).then(function(snap){ return snap.ref.getDownloadURL(); }).then(function(url){
      var arr = getNestedArray(col, docId, 'files');
      arr.push({ id:uid(), name:file.name, url:url });
      saveNestedArray(col, docId, 'files', arr);
      showToast('업로드 완료');
    }).catch(function(err){
      console.error(err);
      showToast('업로드 실패: '+(err && err.message ? err.message : 'Storage 설정을 확인하세요'));
    });
  }
  // 자료실처럼 문서 하나에 파일이 1개만 붙는 경우 (url 필드에 바로 저장)
  function uploadSingleField(col, docId, file){
    if(!requireFirebase()) return;
    if(!storage){ showToast('파일 업로드를 쓰려면 Firebase Storage 설정이 필요해요 (README 6단계 참고)'); return; }
    var path = col+'/'+docId+'/'+Date.now()+'_'+file.name;
    var ref = storage.ref().child(path);
    showToast('업로드 중...');
    ref.put(file).then(function(snap){ return snap.ref.getDownloadURL(); }).then(function(url){
      var payload = { url:url, updatedAt:Date.now() };
      var doc = (state[col]||[]).find(function(x){ return x.id===docId; });
      if(doc && !doc.title) payload.title = file.name;
      db.collection(col).doc(docId).update(payload).catch(function(err){ showToast('저장 실패: '+err.message); });
      showToast('업로드 완료');
    }).catch(function(err){
      console.error(err);
      showToast('업로드 실패: '+(err && err.message ? err.message : 'Storage 설정을 확인하세요'));
    });
  }
  // PDF/이미지 파일은 새 탭을 열지 않아도 그 자리에서 바로 미리 볼 수 있게 확장자를 확인합니다.
  function previewKind(name){
    var m = /\.([a-z0-9]+)$/i.exec(name||'');
    var ext = m ? m[1].toLowerCase() : '';
    if(ext==='pdf') return 'pdf';
    if(['png','jpg','jpeg','gif','webp'].indexOf(ext)>-1) return 'image';
    return null;
  }
  function renderFileLinks(col, doc){
    var files = doc.files || [];
    var rows = files.map(function(f){
      var label = f.name || f.url || '(이름 없음)';
      // 이름 부분 전체를 클릭 가능한 링크로 만들어서, 굳이 별도의 "열기" 글자를 누르지 않아도
      // 파일명을 클릭하면 바로 새 탭에서 파일이 열리도록(다운로드/미리보기) 했어요.
      var nameEl = f.url ?
        '<a class="filelink-chip-name" href="'+escapeHtml(f.url)+'" target="_blank" rel="noopener">'+escapeHtml(label)+'</a>' :
        '<span class="filelink-chip-name">'+escapeHtml(label)+'</span>';
      var kind = f.url ? previewKind(label) : null;
      var isOpen = !!state.filePreviewOpen[f.id];
      // PDF는 브라우저 내장 뷰어를 그대로 끼워넣으면 위아래/양옆으로 까만 여백이 생겨서 보기 안 좋았어요.
      // 그래서 PDF는 임베드 대신 작은 "PDF" 표시만 붙이고, 파일명을 누르면 새 탭에서 잘리지 않고 온전히 보여요.
      // 이미지는 그 자리에서 바로 볼 수 있게 미리보기를 그대로 유지합니다.
      var typeBadge = kind==='pdf' ? '<span class="filelink-type-badge">PDF</span>' : '';
      var previewBtn = kind==='image' ? '<button class="icon-btn" data-action="toggle-file-preview" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+f.id+'" data-url="'+escapeHtml(f.url)+'" data-kind="'+kind+'" title="바로 보기">'+(isOpen?'🔽':'👁')+'</button>' : '';
      var previewPanel = (kind==='image' && isOpen) ?
        '<img class="filelink-preview-img" src="'+escapeHtml(f.url)+'" loading="lazy" alt="'+escapeHtml(label)+'">' : '';
      return '<div class="filelink-chip-wrap">'+
        '<div class="filelink-chip" title="'+escapeHtml(label)+'">'+
          '<span class="filelink-icon">📄</span>'+
          nameEl+
          typeBadge+
          previewBtn+
          '<button class="icon-btn danger" data-action="del-filelink" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+f.id+'" title="삭제">✕</button>'+
        '</div>'+
        previewPanel+
      '</div>';
    }).join('');
    var uploadId = 'upload-'+col+'-'+doc.id;
    return '<div class="filelinks">'+
      (rows ? '<div class="filelinks-list">'+rows+'</div>' : '<div class="comments-empty">첨부된 파일이 없습니다.</div>')+
      '<input type="file" class="filelink-upload-input hidden" id="'+uploadId+'" data-collection="'+col+'" data-id="'+doc.id+'">'+
      '<button class="btn ghost sm" type="button" data-action="trigger-upload" data-target="'+uploadId+'">📤 파일 업로드</button>'+
    '</div>';
  }

  /* ---------------- 비고 / 진행 상황 기록 (수정·삭제 가능) ---------------- */
  function addComment(col, docId, text){
    if(!requireFirebase() || !requireWho()) return;
    text = (text||'').trim();
    if(!text) return;
    var arr = getNestedArray(col, docId, 'comments');
    arr.push({ id:uid(), author:state.who, text:text, ts:Date.now() });
    saveNestedArray(col, docId, 'comments', arr);
  }
  function editComment(col, docId, itemId){
    var arr = getNestedArray(col, docId, 'comments');
    var item = arr.find(function(x){ return x.id===itemId; });
    if(!item) return;
    var newText = prompt('내용 수정', item.text||'');
    if(newText===null) return;
    newText = newText.trim();
    if(!newText) return;
    item.text = newText;
    saveNestedArray(col, docId, 'comments', arr);
  }
  function delComment(col, docId, itemId){
    if(!confirm('이 기록을 삭제할까요?')) return;
    var arr = getNestedArray(col, docId, 'comments').filter(function(x){ return x.id!==itemId; });
    saveNestedArray(col, docId, 'comments', arr);
  }
  function renderComments(col, doc){
    var comments = (doc.comments || []).slice().sort(function(a,b){ return (a.ts||0)-(b.ts||0); });
    var rows = comments.map(function(cm){
      return '<div class="comment-row">'+
        '<div class="comment-meta">'+
          '<span><span class="comment-author">'+escapeHtml(cm.author||'')+'</span> · <span class="comment-date">'+fmtTs(cm.ts)+'</span></span>'+
          '<span class="comment-row-actions">'+
            '<button class="icon-btn" data-action="edit-comment" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+cm.id+'" title="수정">✎</button>'+
            '<button class="icon-btn danger" data-action="del-comment" data-collection="'+col+'" data-id="'+doc.id+'" data-item="'+cm.id+'" title="삭제">✕</button>'+
          '</span>'+
        '</div>'+
        '<div class="comment-text">'+escapeHtml(cm.text||'')+'</div>'+
      '</div>';
    }).join('');
    return '<div class="comments-box">'+
      (rows || '<div class="comments-empty">아직 기록이 없습니다.</div>')+
      '<div class="comment-add-row">'+
        '<input type="text" class="comment-input" placeholder="예: 8/25 자료 취합 완료" data-collection="'+col+'" data-id="'+doc.id+'">'+
        '<button class="btn ghost sm" data-action="add-comment" data-collection="'+col+'" data-id="'+doc.id+'">등록</button>'+
      '</div>'+
    '</div>';
  }

  /* ---------------- 각자 업무리스트: 분류 옵션 (기본 + 직접 추가한 것들) ---------------- */
  function personalCategoryOptions(current){
    var used = uniqNonEmpty(state.personal.map(function(p){ return p.category; }));
    var all = PERSONAL_BASE_CATS.slice();
    used.forEach(function(c){ if(all.indexOf(c)===-1) all.push(c); });
    if(current && all.indexOf(current)===-1) all.push(current);
    return all;
  }

  /* ---------------- State ---------------- */
  var state = {
    activeTab:'announcements',
    who: localStorage.getItem('asp_share_who') || '',
    tasks: [], announcements: [], personal: [], meetings: [], ideas: [], comms: [], manuals: [], files: [], dday: [], pins: [], recurring: [],
    taskFilterPerson: 'all',
    taskFilterStatus: 'all',
    taskActiveMajor: '전체',
    taskSortField: null,
    taskSortDir: 'asc',
    taskEndDateOpen: {},
    taskShowRecurringPanel: false,
    personalActiveOwner: PEOPLE[0],
    personalDeadlineOpen: {},
    personalSortField: null,
    personalSortDir: 'asc',
    personalHideCompleted: false,
    manualActiveCat: MANUAL_CATS[0],
    manualActiveId: null,
    manualActiveCadence: 'all',
    fileActiveCat: FILE_CATS[0],
    fileActiveId: null,
    taskHideCompleted: false,
    filePreviewOpen: {},
    meetingActiveType: MEETING_TYPES[0],
    meetingActiveId: null,
    announcementActiveId: null,
    commSortField: null,
    commSortDir: 'asc',
    calMonth: (function(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1); })(),
    calSelectedDate: null,
    calFilter: 'all'
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
    renderSidebar();
  }

  /* ================= 사이드바 (미니 캘린더 · D-day · 메모) ================= */
  function renderSidebar(){
    var el = document.getElementById('sidebarPanel');
    if(!el) return;
    el.innerHTML = renderMiniCalendarWidget() + renderSidebarDdayWidget() + renderPinsWidget();
  }
  function renderMiniCalendarWidget(){
    var allItems = buildCalendarItems();
    var byDate = {};
    allItems.forEach(function(it){ (byDate[it.date] = byDate[it.date]||[]).push(it); });
    var ym = state.calMonth.split('-').map(Number);
    var year = ym[0], month = ym[1]-1;
    var wdNames = ['월','화','수','목','금','토','일'];
    var firstDay = new Date(year, month, 1);
    var startOffset = (firstDay.getDay()+6)%7;
    var daysInMonth = new Date(year, month+1, 0).getDate();
    var today = todayStr();
    var gridHtml = wdNames.map(function(w){ return '<div class="mini-cal-wd">'+w+'</div>'; }).join('');
    for(var i=0;i<startOffset;i++){ gridHtml += '<div class="mini-cal-day empty"></div>'; }
    for(var d=1; d<=daysInMonth; d++){
      var dateStr = year+'-'+pad2(month+1)+'-'+pad2(d);
      var items = byDate[dateStr] || [];
      var cls = 'mini-cal-day';
      if(dateStr===today) cls += ' today';
      if(dateStr===state.calSelectedDate) cls += ' selected';
      gridHtml += '<div class="'+cls+'" data-action="sidebar-goto-date" data-date="'+dateStr+'">'+d+(items.length?'<span class="mini-cal-dot"></span>':'')+'</div>';
    }
    return '<div class="sidebar-card">'+
      '<div class="sidebar-card-head"><button class="icon-btn" data-action="cal-prev" title="이전달">‹</button>'+
        '<span>'+year+'.'+pad2(month+1)+'</span>'+
        '<button class="icon-btn" data-action="cal-next" title="다음달">›</button></div>'+
      '<div class="mini-cal-grid">'+gridHtml+'</div>'+
      '<button class="btn ghost sm sidebar-cal-more" data-action="goto-board" data-tab="calendar">캘린더 전체 보기</button>'+
    '</div>';
  }
  function renderSidebarDdayWidget(){
    var items = state.dday.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    var today = todayStr();
    var rows = items.map(function(dd){
      var diff = Math.round((new Date(dd.date+'T00:00:00') - new Date(today+'T00:00:00')) / 86400000);
      var badgeLabel = diff===0 ? 'D-DAY' : diff>0 ? 'D-'+diff : 'D+'+Math.abs(diff);
      var badgeStyle = diff<0 ? 'color:#9a9a9a;background:#f0f0f0;' : diff===0 ? 'color:#c65c5c;background:#fbeaea;' : 'color:'+DDAY_COLOR.fg+';background:'+DDAY_COLOR.bg+';';
      return '<div class="dday-row sidebar-dday-row" data-id="'+dd.id+'">'+
        '<span class="badge" style="'+badgeStyle+'">'+badgeLabel+'</span>'+
        '<input type="text" class="dday-title-input" placeholder="중요 일정명" data-collection="dday" data-id="'+dd.id+'" data-field="title" value="'+escapeHtml(dd.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="dday" data-id="'+dd.id+'" title="삭제">✕</button>'+
      '</div>';
    }).join('');
    return '<div class="sidebar-card">'+
      '<div class="sidebar-card-head"><span>📌 중요 일정 D-day</span></div>'+
      (rows || '<div class="sidebar-empty">등록된 일정이 없습니다.</div>')+
      '<button class="btn ghost sm" data-action="add-dday">+ 일정 추가</button>'+
    '</div>';
  }
  function renderPinsWidget(){
    var items = state.pins.slice().sort(function(a,b){
      var da = (a.done?1:0)-(b.done?1:0);
      if(da!==0) return da;
      return (b.clientTs||0)-(a.clientTs||0);
    });
    var rows = items.map(function(p){
      return '<div class="pin-row'+(p.done?' done':'')+'" data-id="'+p.id+'">'+
        '<input type="checkbox" data-collection="pins" data-id="'+p.id+'" data-field="done"'+(p.done?' checked':'')+'>'+
        '<span class="pin-text">'+escapeHtml(p.text||'')+'</span>'+
        '<button class="icon-btn danger" data-action="del-row" data-collection="pins" data-id="'+p.id+'" title="삭제">✕</button>'+
      '</div>';
    }).join('');
    return '<div class="sidebar-card">'+
      '<div class="sidebar-card-head"><span>📝 메모</span></div>'+
      (rows || '<div class="sidebar-empty">메모가 없습니다.</div>')+
      '<div class="pin-add-row">'+
        '<input type="text" id="pinQuickInput" placeholder="메모 입력 후 Enter">'+
        '<button class="btn ghost sm" data-action="add-pin">추가</button>'+
      '</div>'+
    '</div>';
  }

  /* ================= 📢 공지사항 (게시판: 목록 → 클릭 → 상세) ================= */
  function renderAnnouncementsTab(){
    if(state.announcementActiveId){
      var a = state.announcements.find(function(x){ return x.id===state.announcementActiveId; });
      if(a) return renderAnnouncementDetail(a);
      state.announcementActiveId = null;
    }
    var items = state.announcements.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var rows = items.map(function(a){
      return '<tr class="board-row" data-action="open-announcement" data-id="'+a.id+'">'+
        '<td style="white-space:nowrap;width:120px;">'+escapeHtml(a.date||fmtTs(a.clientTs))+'</td>'+
        '<td class="board-title-cell">'+escapeHtml(a.title||'(제목 없음)')+'</td>'+
        '<td class="task-content-preview" style="width:90px;">'+escapeHtml(a.createdBy||'')+'</td>'+
      '</tr>';
    }).join('');
    var listHtml = items.length ?
      '<table class="board-table"><thead><tr><th style="width:120px">날짜</th><th>제목</th><th style="width:90px">작성자</th></tr></thead><tbody>'+rows+'</tbody></table>'
      : '<div class="empty-state">등록된 공지사항이 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>📢 공지사항</h3><button class="btn" data-action="add-announcement">+ 새 공지 추가</button></div>'+
      listHtml+
    '</div>';
  }
  function renderAnnouncementDetail(a){
    return '<div class="card">'+
      '<button class="btn ghost sm" data-action="close-announcement">← 목록으로</button>'+
      '<div class="doc-item-head" style="margin-top:12px;">'+
        '<input type="text" class="doc-title-input" placeholder="공지 제목" data-collection="announcements" data-id="'+a.id+'" data-field="title" value="'+escapeHtml(a.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-announcement-and-close" data-id="'+a.id+'" title="삭제">✕</button>'+
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
  function classifyTask(t){
    var as = t.assignees || [];
    if(as.length===1) return { type:'개인', owner:as[0] };
    return { type:'공동', owner:null };
  }
  function buildCalendarItems(){
    var list = [];
    state.tasks.forEach(function(t){ if(t.date) list.push({ id:t.id, collection:'tasks', board:'업무 리스트', date:t.date, title:t.title||'(제목 없음)', cls:classifyTask(t) }); });
    state.personal.forEach(function(p){ if(p.deadline) list.push({ id:p.id, collection:'personal', board:'개별 업무리스트', date:p.deadline, title:p.title||'(제목 없음)', cls:{ type:'개인', owner:p.owner } }); });
    state.meetings.forEach(function(m){ if(m.date) list.push({ id:m.id, collection:'meetings', board:'회의', date:m.date, title:m.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.ideas.forEach(function(i){ if(i.date) list.push({ id:i.id, collection:'ideas', board:'아이디어', date:i.date, title:i.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.announcements.forEach(function(a){ if(a.date) list.push({ id:a.id, collection:'announcements', board:'공지사항', date:a.date, title:a.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.comms.forEach(function(c){ if(c.date) list.push({ id:c.id, collection:'comms', board:'소통일지', date:c.date, title:(c.target?c.target+' 소통':'소통 기록'), cls:{ type:'공동', owner:null } }); });
    state.files.forEach(function(f){ if(f.date) list.push({ id:f.id, collection:'files', board:'자료실', date:f.date, title:f.title||'(제목 없음)', cls:{ type:'공동', owner:null } }); });
    state.dday.forEach(function(d){ if(d.date) list.push({ id:d.id, collection:'dday', board:'중요 일정', date:d.date, title:d.title||'(제목 없음)', cls:{ type:'중요', owner:null } }); });
    return list;
  }
  function matchesCalFilter(item){
    if(item.cls.type==='중요') return true;
    if(state.calFilter==='all') return true;
    if(state.calFilter==='shared') return item.cls.type==='공동';
    return item.cls.owner===state.calFilter;
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

    var filterOpts = [['all','전체'],['shared','공동 일정'],['지수','지수 개인'],['다경','다경 개인']].map(function(o){
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
        '<div class="card-head"><h3>📌 중요 일정 D-day</h3><button class="btn" data-action="add-dday">+ 중요 일정 추가</button></div>'+
        renderDdayRows()+
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

  function renderDdayRows(){
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
    return rows || '<div class="empty-state">등록된 중요 일정이 없습니다.</div>';
  }

  /* ================= ✅ ASP 정기업무 현황 (업무 리스트 탭 안의 패널) ================= */
  function renderRecurringContent(){
    var doneCount = 0;
    var groups = CADENCES.map(function(cad){
      var pi = periodInfo(cad);
      var items = state.recurring.filter(function(r){ return r.cadence===cad; })
        .sort(function(a,b){ return (a.clientTs||0)-(b.clientTs||0); });
      var cc = CADENCE_COLORS[cad] || {fg:'#888',bg:'#eee'};
      var rows = items.map(function(r){
        // 예전 데이터(lastDonePeriod만 있고 status가 없는 경우)도 자연스럽게 "완료"로 보이도록 이어받아요.
        var legacyDone = r.lastDonePeriod===pi.key;
        var hasCurStatus = r.statusPeriod===pi.key;
        var curStatus = hasCurStatus ? (r.status||'시작 전') : (legacyDone ? '완료' : '시작 전');
        var done = curStatus==='완료';
        if(done) doneCount++;
        var rsc = STATUS_COLORS[curStatus] || {fg:'#888',bg:'#eee'};
        var statusOpts = STATUSES.map(function(s){ return '<option value="'+s+'"'+(curStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');
        return '<div class="recur-row'+(done?' done':'')+'" data-id="'+r.id+'">'+
          '<input type="text" class="recur-title-input" placeholder="업무명" data-collection="recurring" data-id="'+r.id+'" data-field="label" value="'+escapeHtml(r.label||'')+'">'+
          '<select class="status-select-sm" data-collection="recurring" data-id="'+r.id+'" data-field="recurStatus" data-period="'+pi.key+'" style="background:'+rsc.bg+';color:'+rsc.fg+';">'+statusOpts+'</select>'+
          '<button class="icon-btn danger" data-action="del-row" data-collection="recurring" data-id="'+r.id+'" title="삭제">✕</button>'+
        '</div>';
      }).join('');
      return '<div class="recur-group">'+
        '<div class="recur-group-head">'+
          '<span class="badge" style="background:'+cc.bg+';color:'+cc.fg+';">'+cad+'</span>'+
          '<span class="recur-period-label">'+pi.label+'</span>'+
          '<button class="btn ghost sm" data-action="add-recur" data-cadence="'+cad+'">+ 항목 추가</button>'+
        '</div>'+
        (rows || '<div class="empty-state">등록된 정기업무가 없습니다.</div>')+
      '</div>';
    }).join('');
    var total = state.recurring.length;
    return '<div class="recur-panel-head"><span class="recur-progress">'+doneCount+' / '+total+' 완료</span></div>'+
      groups;
  }

  /* ================= 📋 업무 리스트 (대분류별 탭 + 전체 보기) ================= */
  // 소분류 정렬 순서: 행정 업무는 월별→분기→반기→연간→비정기 순으로, 그 외는 일반 소분류 순서로 비교해요.
  function minorSortIndex(t){
    var order = (t.major||MAJOR_CATS[0])==='행정' ? ADMIN_MINOR_CATS : MINOR_CATS;
    var idx = order.indexOf(t.minor||'');
    return idx===-1 ? order.length : idx;
  }
  function taskSortValue(t, field){
    if(field==='date') return t.date || '';
    if(field==='status') return STATUS_ORDER[t.status]===undefined ? 9 : STATUS_ORDER[t.status];
    if(field==='assignees') return (t.assignees||[]).slice().sort().join(',');
    if(field==='minor') return minorSortIndex(t);
    return '';
  }
  function sortTasks(items){
    var field = state.taskSortField;
    var sorted;
    if(!field){
      // 기본 정렬은 진행도(진행 중 → 시작 전 → 완료)가 최우선이에요.
      // "행정" 탭에서는 같은 진행도 안에서 월별→분기→반기→연간→비정기 순으로 한 번 더 나눠 보여줘요.
      var isAdminTab = state.taskActiveMajor==='행정';
      sorted = items.slice().sort(function(a,b){
        var so = (STATUS_ORDER[a.status]||9) - (STATUS_ORDER[b.status]||9);
        if(so!==0) return so;
        if(isAdminTab){
          var mo = minorSortIndex(a) - minorSortIndex(b);
          if(mo!==0) return mo;
        }
        return (b.clientTs||0)-(a.clientTs||0);
      });
    } else {
      var dir = state.taskSortDir==='desc' ? -1 : 1;
      sorted = items.slice().sort(function(a,b){
        var av = taskSortValue(a, field), bv = taskSortValue(b, field);
        if(av<bv) return -1*dir;
        if(av>bv) return 1*dir;
        return 0;
      });
    }
    // 별표(중요) 표시한 업무는 정렬 기준과 상관없이 항상 맨 위로 올라와요.
    // Array.sort는 안정 정렬이라 이 두 번째 정렬로도 위에서 정한 순서는 그대로 유지됩니다.
    return sorted.sort(function(a,b){ return (b.important?1:0) - (a.important?1:0); });
  }
  function sortArrow(field){
    if(state.taskSortField!==field) return '';
    return state.taskSortDir==='asc' ? ' ▲' : ' ▼';
  }

  function renderTasksTab(){
    var activeMajor = state.taskActiveMajor || '전체';
    var filtered = state.tasks.filter(function(t){
      if(activeMajor!=='전체' && (t.major||MAJOR_CATS[0])!==activeMajor) return false;
      if(state.taskFilterPerson!=='all' && (t.assignees||[]).indexOf(state.taskFilterPerson)===-1) return false;
      if(state.taskFilterStatus!=='all' && t.status!==state.taskFilterStatus) return false;
      if(state.taskHideCompleted && t.status==='완료') return false;
      return true;
    });
    var sorted = sortTasks(filtered);
    var showMajorCol = activeMajor==='전체';

    var allTabs = ['전체'].concat(MAJOR_CATS);
    var tabsHtml = allTabs.map(function(cat){
      var cnt = cat==='전체' ? state.tasks.length : state.tasks.filter(function(t){ return (t.major||MAJOR_CATS[0])===cat; }).length;
      var cc = cat==='전체' ? SHARED_COLOR : CAT_COLORS[cat];
      var isActive = cat===activeMajor;
      var style = isActive ? 'background:'+cc.bg+';color:'+cc.fg+';border-color:'+cc.bg+';' : '';
      return '<button class="subtab-btn" data-action="task-set-major" data-major="'+cat+'" style="'+style+'">'+cat+' <span class="subtab-count">'+cnt+'</span></button>';
    }).join('');

var headRow = '<tr>'+
      (showMajorCol ? '<th style="min-width:56px">분류</th>' : '')+
      '<th data-action="sort-tasks" data-field="minor" class="sortable-th" style="min-width:280px">업무 (소분류 · 업무명)'+sortArrow('minor')+'</th>'+
      '<th style="min-width:260px">내용</th>'+
      '<th style="min-width:70px">비고</th>'+ /* 비고 열을 내용 오른쪽으로 이동 */
      '<th data-action="sort-tasks" data-field="date" class="sortable-th" style="min-width:180px">날짜'+sortArrow('date')+'</th>'+
      '<th data-action="sort-tasks" data-field="assignees" class="sortable-th" style="min-width:110px">담당자'+sortArrow('assignees')+'</th>'+
      '<th data-action="sort-tasks" data-field="status" class="sortable-th" style="min-width:118px">진행도'+sortArrow('status')+'</th>'+
      '<th style="min-width:70px">첨부</th><th></th>'+
    '</tr>';

    var tableHtml = sorted.length ?
      '<div class="table-scroll"><table><thead>'+headRow+'</thead><tbody>'+sorted.map(function(t){ return renderTaskRow(t, showMajorCol); }).join('')+'</tbody></table></div>'
      : '<div class="empty-state">"'+activeMajor+'" 분류에 등록된 업무가 없습니다. "+ 업무 추가"를 눌러보세요.</div>';

    var personOpts = '<option value="all">담당자 전체</option>'+PEOPLE.map(function(p){ return '<option value="'+p+'"'+(state.taskFilterPerson===p?' selected':'')+'>'+p+'</option>'; }).join('');
    var statusOpts = '<option value="all">진행도 전체</option>'+STATUSES.map(function(s){ return '<option value="'+s+'"'+(state.taskFilterStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');

    var recurringPanel = state.taskShowRecurringPanel ? '<div class="recur-panel">'+renderRecurringContent()+'</div>' : '';

    return '<div class="card">'+
      '<div class="card-head">'+
        '<h3>📋 업무 리스트</h3>'+
        '<div class="toolbar">'+
          '<select id="filterPerson">'+personOpts+'</select>'+
          '<select id="filterStatus">'+statusOpts+'</select>'+
          '<label class="hide-done-toggle"><input type="checkbox" id="hideCompletedToggle"'+(state.taskHideCompleted?' checked':'')+'> 완료 항목 숨기기</label>'+
          (state.taskSortField ? '<button class="btn ghost sm" data-action="reset-task-sort">↺ 정렬 초기화</button>' : '')+
          '<button class="btn ghost" data-action="toggle-recurring-panel">'+(state.taskShowRecurringPanel?'✅ 정기업무 닫기':'✅ 정기업무 현황')+'</button>'+
          '<button class="btn" data-action="add-task">+ 업무 추가</button>'+
        '</div>'+
      '</div>'+
      recurringPanel+
      '<div class="subtab-bar">'+tabsHtml+'</div>'+
      tableHtml+
    '</div>';
  }

function renderTaskRow(t, showMajorCol){
    var curMinor = t.minor || '';
    var minorSource = (t.major||MAJOR_CATS[0])==='행정' ? ADMIN_MINOR_CATS : MINOR_CATS;
    var minorOptionsList = minorSource.slice();
    if(curMinor && minorOptionsList.indexOf(curMinor)===-1) minorOptionsList.push(curMinor);
    var minorOpts = '<option value="">-</option>'+
      minorOptionsList.map(function(c){ return '<option value="'+c+'"'+(curMinor===c?' selected':'')+'>'+escapeHtml(c)+'</option>'; }).join('')+
      '<option value="__new__">+ 직접 추가...</option>';
    var mnc = MINOR_CAT_COLORS[curMinor] || (curMinor ? hashColor(curMinor) : {fg:'#888',bg:'#f0f0f0'});
    var curStatus = t.status||'시작 전';
    var sc = STATUS_COLORS[curStatus] || {fg:'#888',bg:'#eee'};
    var statusOpts = STATUSES.map(function(s){ return '<option value="'+s+'"'+(curStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');
    var curAssignees = t.assignees || [];
    var assigneeVal = curAssignees.length===1 ? curAssignees[0] : 'both';
    var assigneeOpts =
      PEOPLE.map(function(p){ return '<option value="'+p+'"'+(assigneeVal===p?' selected':'')+'>'+p+'</option>'; }).join('')+
      '<option value="both"'+(assigneeVal==='both'?' selected':'')+'>지수·다경</option>';
    var showEnd = !!t.endDate || !!state.taskEndDateOpen[t.id];
    var dateHtml = renderCompactDateField('tasks', t.id, 'date', t.date, '+ 날짜')+
      (showEnd ?
        '<span class="date-arrow">→</span>'+renderCompactDateField('tasks', t.id, 'endDate', t.endDate, '마감일')
        : '<button type="button" class="btn ghost sm" data-action="show-task-enddate" data-id="'+t.id+'">+ 마감일</button>');
    var fileCount = (t.files||[]).length;
    var starBtn = '<button type="button" class="icon-btn star-btn'+(t.important?' active':'')+'" data-action="toggle-task-important" data-id="'+t.id+'" title="'+(t.important?'중요 표시 해제':'중요 표시(항상 위로)')+'">'+(t.important?'★':'☆')+'</button>';

    return '<tr data-id="'+t.id+'">'+
      (showMajorCol ? '<td>'+badge(t.major||'미분류', CAT_COLORS)+'</td>' : '')+
      '<td><div class="task-title-cell">'+
        '<select class="status-select minor-select" data-collection="tasks" data-id="'+t.id+'" data-field="minor" style="background:'+mnc.bg+';color:'+mnc.fg+';">'+minorOpts+'</select>'+
        '<input type="text" class="cell-title-input" placeholder="업무명" data-collection="tasks" data-id="'+t.id+'" data-field="title" value="'+escapeHtml(t.title||'')+'">'+
      '</div></td>'+
      '<td><textarea class="cell-textarea" placeholder="내용/메모" data-collection="tasks" data-id="'+t.id+'" data-field="content">'+escapeHtml(t.content||'')+'</textarea></td>'+
      '<td><details class="filelink-details"><summary>📝'+((t.comments||[]).length?' '+t.comments.length:'')+'</summary>'+renderComments('tasks', t)+'</details></td>'+ /* 비고 위치 변경 */
      '<td><div class="date-range">'+dateHtml+'</div></td>'+
      '<td><select class="status-select-sm assignee-select-sm" data-collection="tasks" data-id="'+t.id+'" data-field="assigneesSelect">'+assigneeOpts+'</select></td>'+
      '<td><div class="status-cell"><select class="status-select" data-collection="tasks" data-id="'+t.id+'" data-field="status" style="background:'+sc.bg+';color:'+sc.fg+';">'+statusOpts+'</select>'+starBtn+'</div></td>'+ /* 진행도 오른쪽으로 별 버튼 이동 */
      '<td><details class="filelink-details"><summary>📎'+(fileCount?' '+fileCount:'')+'</summary>'+renderFileLinks('tasks', t)+'</details></td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="tasks" data-id="'+t.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ================= 🙋 각자 업무리스트 (엑셀 시트 방식) ================= */
  function renderPersonalTab(){
    var owner = state.personalActiveOwner || PEOPLE[0];
    var catOrder = personalCategoryOptions(null);
    var items = state.personal.filter(function(p){ return p.owner===owner; })
      .filter(function(p){ return !state.personalHideCompleted || p.status!=='완료'; })
      .sort(function(a,b){
        if(state.personalSortField){
          var av, bv;
          if(state.personalSortField==='category'){
            av = catOrder.indexOf(a.category||''); bv = catOrder.indexOf(b.category||'');
            if(av===-1) av = catOrder.length;
            if(bv===-1) bv = catOrder.length;
          } else if(state.personalSortField==='status'){
            av = STATUS_ORDER[a.status]===undefined ? 9 : STATUS_ORDER[a.status];
            bv = STATUS_ORDER[b.status]===undefined ? 9 : STATUS_ORDER[b.status];
          }
          var dir = state.personalSortDir==='desc' ? -1 : 1;
          if(av!==bv) return (av<bv ? -1 : 1)*dir;
        }
        var so = (STATUS_ORDER[a.status]||9) - (STATUS_ORDER[b.status]||9);
        if(so!==0) return so;
        return (b.clientTs||0)-(a.clientTs||0);
      });
    var rows = items.map(renderPersonalRow).join('');
    var tabsHtml = PEOPLE.map(function(p){
      var pc = PERSON_COLORS[p];
      var isActive = p===owner;
      var style = isActive ? 'background:'+pc.bg+';color:'+pc.fg+';border-color:'+pc.bg+';' : '';
      var cnt = state.personal.filter(function(x){ return x.owner===p; }).length;
      return '<button class="subtab-btn sheet-tab" data-action="personal-set-owner" data-owner="'+p+'" style="'+style+'">'+p+' <span class="subtab-count">'+cnt+'</span></button>';
    }).join('');
    // 분류 색깔만으로는 비슷한 색이 나올 수 있어 구분이 잘 안 될 때가 있어서, "분류"나 "진행도" 열
    // 제목을 누르면 그 기준으로 모아서/순서대로 볼 수 있게 정렬 토글을 붙였어요.
    function personalSortArrow(field){
      if(state.personalSortField!==field) return '';
      return state.personalSortDir==='asc' ? ' ▲' : ' ▼';
    }
    return '<div class="card">'+
      '<div class="card-head"><h3>🙋 개별 업무리스트</h3>'+
        '<div class="toolbar">'+
          '<label class="hide-done-toggle"><input type="checkbox" id="personalHideCompletedToggle"'+(state.personalHideCompleted?' checked':'')+'> 완료 항목 숨기기</label>'+
          (state.personalSortField ? '<button class="btn ghost sm" data-action="reset-personal-sort">↺ 정렬 초기화</button>' : '')+
          '<button class="btn" data-action="add-personal" data-owner="'+owner+'">+ 추가</button>'+
        '</div>'+
      '</div>'+
      '<div class="sheet-tab-bar">'+tabsHtml+'</div>'+
      (items.length ?
        '<div class="table-scroll"><table><thead><tr>'+
        '<th data-action="sort-personal" data-field="category" class="sortable-th" style="min-width:92px">분류'+personalSortArrow('category')+'</th>'+
        '<th style="min-width:130px">이름</th><th style="min-width:260px">업무</th>'+
        '<th data-action="sort-personal" data-field="status" class="sortable-th" style="min-width:110px">진행도'+personalSortArrow('status')+'</th>'+
        '<th style="min-width:150px">기간</th><th style="min-width:50px">F/U</th><th style="min-width:140px">비고</th><th style="min-width:100px">첨부</th><th></th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table></div>'
        : '<div class="empty-state">등록된 업무가 없습니다. "+ 추가"를 눌러 지금 하고 있는 공부/업무를 기록해보세요.</div>')+
    '</div>';
  }
  function renderPersonalRow(p){
    var catOptions = personalCategoryOptions(p.category);
    var catOpts = catOptions.map(function(c){ return '<option value="'+c+'"'+(p.category===c?' selected':'')+'>'+c+'</option>'; }).join('') + '<option value="__new__">+ 직접 추가...</option>';
    var tc = PERSONAL_CAT_COLORS[p.category] || (p.category ? hashColor(p.category) : {fg:'#888',bg:'#f0f0f0'});
    var curStatus = p.status || '시작 전';
    var sc = STATUS_COLORS[curStatus] || {fg:'#888',bg:'#eee'};
    var statusOpts = STATUSES.map(function(s){ return '<option value="'+s+'"'+(curStatus===s?' selected':'')+'>'+s+'</option>'; }).join('');
    var showDeadline = !!p.deadline || !!state.personalDeadlineOpen[p.id];
    // 업무리스트 날짜 칸과 똑같이 시작일 → 마감일을 화살표 하나로 이어서 한 칸에 컴팩트하게 보여줘요.
    var dateHtml = renderCompactDateField('personal', p.id, 'startDate', p.startDate, '+ 날짜')+
      (showDeadline ?
        '<span class="date-arrow">→</span>'+renderCompactDateField('personal', p.id, 'deadline', p.deadline, '마감일')
        : '<button type="button" class="btn ghost sm" data-action="show-personal-deadline" data-id="'+p.id+'">+ 마감일</button>');
    var fileCount = (p.files||[]).length;
    return '<tr data-id="'+p.id+'">'+
      '<td><select class="tag-select" data-collection="personal" data-id="'+p.id+'" data-field="category" style="background:'+tc.bg+';color:'+tc.fg+';">'+catOpts+'</select></td>'+
      '<td><input type="text" class="cell-title-input" placeholder="이름" data-collection="personal" data-id="'+p.id+'" data-field="title" value="'+escapeHtml(p.title||'')+'"></td>'+
      '<td><textarea class="cell-textarea" placeholder="업무 내용" data-collection="personal" data-id="'+p.id+'" data-field="content">'+escapeHtml(p.content||'')+'</textarea></td>'+
      '<td><select class="status-select" data-collection="personal" data-id="'+p.id+'" data-field="status" style="background:'+sc.bg+';color:'+sc.fg+';">'+statusOpts+'</select></td>'+
      '<td><div class="date-range">'+dateHtml+'</div></td>'+
      '<td style="text-align:center;"><input type="checkbox" data-collection="personal" data-id="'+p.id+'" data-field="followUp"'+(p.followUp?' checked':'')+'></td>'+
      '<td><textarea class="cell-textarea" placeholder="비고" data-collection="personal" data-id="'+p.id+'" data-field="note">'+escapeHtml(p.note||'')+'</textarea></td>'+
      '<td><details class="filelink-details"><summary>📎 '+(fileCount?fileCount+'개':'첨부')+'</summary>'+renderFileLinks('personal', p)+'</details></td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="personal" data-id="'+p.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ================= 🗓 회의 (유형 탭 + 게시판) ================= */
  function renderMeetingsTab(){
    if(state.meetingActiveId){
      var m = state.meetings.find(function(x){ return x.id===state.meetingActiveId; });
      if(m) return renderMeetingDetail(m);
      state.meetingActiveId = null;
    }
    var activeType = state.meetingActiveType || MEETING_TYPES[0];
    var items = state.meetings.filter(function(m){ return (m.meetingType||MEETING_TYPES[0])===activeType; })
      .sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    var tabsHtml = MEETING_TYPES.map(function(mt){
      var cnt = state.meetings.filter(function(x){ return (x.meetingType||MEETING_TYPES[0])===mt; }).length;
      var cc = MEETING_TYPE_COLORS[mt];
      var isActive = mt===activeType;
      var style = isActive ? 'background:'+cc.bg+';color:'+cc.fg+';border-color:'+cc.bg+';' : '';
      return '<button class="subtab-btn" data-action="meeting-set-type" data-type="'+mt+'" style="'+style+'">'+mt+' <span class="subtab-count">'+cnt+'</span></button>';
    }).join('');
    var rows = items.map(function(m){
      var peopleBadges = (m.attendees||[]).map(function(p){ return badge(p, PERSON_COLORS); }).join(' ');
      return '<tr class="board-row" data-action="open-meeting" data-id="'+m.id+'">'+
        '<td style="white-space:nowrap;width:140px;">'+escapeHtml(m.date||'')+(m.time?' '+escapeHtml(m.time):'')+'</td>'+
        '<td class="board-title-cell">'+escapeHtml(m.title||'(제목 없음)')+'</td>'+
        '<td style="width:150px;">'+peopleBadges+'</td>'+
      '</tr>';
    }).join('');
    var listHtml = items.length ?
      '<table class="board-table"><thead><tr><th style="width:140px">날짜</th><th>제목</th><th style="width:150px">참석자</th></tr></thead><tbody>'+rows+'</tbody></table>'
      : '<div class="empty-state">등록된 회의록이 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>🗓 회의</h3><button class="btn" data-action="add-meeting" data-type="'+activeType+'">+ 새 회의 기록</button></div>'+
      '<div class="subtab-bar">'+tabsHtml+'</div>'+
      listHtml+
    '</div>';
  }
  function renderMeetingDetail(m){
    var peopleBadges = PEOPLE.map(function(p){ return badge(p, PERSON_COLORS); }).join(' ');
    var typeOpts = MEETING_TYPES.map(function(mt){ return '<option value="'+mt+'"'+((m.meetingType||MEETING_TYPES[0])===mt?' selected':'')+'>'+mt+'</option>'; }).join('');
    return '<div class="card">'+
      '<button class="btn ghost sm" data-action="close-meeting">← 목록으로</button>'+
      '<div class="doc-item-head" style="margin-top:12px;">'+
        '<select class="status-select-sm" data-collection="meetings" data-id="'+m.id+'" data-field="meetingType">'+typeOpts+'</select>'+
        '<input type="text" class="doc-title-input" placeholder="회의 제목" data-collection="meetings" data-id="'+m.id+'" data-field="title" value="'+escapeHtml(m.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-meeting-and-close" data-id="'+m.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="doc-meta-row">'+
        '<input type="date" data-collection="meetings" data-id="'+m.id+'" data-field="date" value="'+escapeHtml(m.date||todayStr())+'">'+
        '<input type="time" class="meeting-time-input" data-collection="meetings" data-id="'+m.id+'" data-field="time" value="'+escapeHtml(m.time||'')+'">'+
        '<div class="cell-check-group">참석자: '+peopleBadges+'</div>'+
      '</div>'+
      '<textarea class="doc-content-input" placeholder="회의 내용, 결정사항 등을 입력하세요" data-collection="meetings" data-id="'+m.id+'" data-field="content">'+escapeHtml(m.content||'')+'</textarea>'+
      renderFileLinks('meetings', m)+
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
      renderFileLinks('ideas', i)+
    '</div>';
  }

  /* ================= 💬 소통일지 (분류 드롭다운 + 정렬) ================= */
  function commSortValue(c, field){
    if(field==='dept') return c.dept || '';
    if(field==='workCategory') return COMM_WORK_CATS.indexOf(c.workCategory);
    return '';
  }
  function sortComms(items){
    if(!state.commSortField){
      return items.slice().sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    }
    var dir = state.commSortDir==='desc' ? -1 : 1;
    return items.slice().sort(function(a,b){
      var av = commSortValue(a, state.commSortField), bv = commSortValue(b, state.commSortField);
      if(av<bv) return -1*dir;
      if(av>bv) return 1*dir;
      return 0;
    });
  }
  function commSortArrow(field){
    if(state.commSortField!==field) return '';
    return state.commSortDir==='asc' ? ' ▲' : ' ▼';
  }
  function renderCommsTab(){
    var items = sortComms(state.comms);
    var rows = items.map(renderCommRow).join('');
    return '<div class="card">'+
      '<div class="card-head"><h3>💬 소통일지</h3>'+
        '<div class="toolbar">'+
          (state.commSortField ? '<button class="btn ghost sm" data-action="reset-comm-sort">↺ 정렬 초기화</button>' : '')+
          '<button class="btn" data-action="add-comm">+ 새 소통 기록</button>'+
        '</div>'+
      '</div>'+
      '<div class="table-scroll"><table><thead><tr>'+
      '<th style="min-width:130px">날짜</th>'+
      '<th data-action="sort-comms" data-field="dept" class="sortable-th" style="min-width:120px">분류'+commSortArrow('dept')+'</th>'+
      '<th data-action="sort-comms" data-field="workCategory" class="sortable-th" style="min-width:140px">업무'+commSortArrow('workCategory')+'</th>'+
      '<th style="min-width:60px">대상</th><th style="min-width:300px">소통내역</th><th style="min-width:80px">수신/발신</th>'+
      '<th style="min-width:56px">전화번호</th><th style="min-width:100px">사람</th><th style="min-width:150px">비고</th><th>첨부</th><th></th></tr></thead>'+
      '<tbody>'+(rows||'')+'</tbody></table></div>'+
      (rows ? '' : '<div class="empty-state">등록된 소통 기록이 없습니다.</div>')+
    '</div>';
  }
  function renderCommRow(c){
    var deptOpts = COMM_DEPTS.map(function(d){ return '<option value="'+d+'"'+(c.dept===d?' selected':'')+'>'+d+'</option>'; }).join('');
    var dc = COMM_DEPT_COLORS[c.dept] || {fg:'#888',bg:'#eee'};
    var workOpts = COMM_WORK_CATS.map(function(m){ return '<option value="'+m+'"'+(c.workCategory===m?' selected':'')+'>'+m+'</option>'; }).join('');
    var dirOpts = COMM_DIRECTIONS.map(function(m){ return '<option value="'+m+'"'+(c.direction===m?' selected':'')+'>'+m+'</option>'; }).join('');
    var dirColor = DIRECTION_COLORS[c.direction] || {fg:'#888',bg:'#eee'};
    var peopleChecks = PEOPLE.map(function(p){
      var checked = (c.participants||[]).indexOf(p)>-1;
      return '<label><input type="checkbox" data-action="toggle-person" data-collection="comms" data-array-field="participants" data-id="'+c.id+'" data-person="'+p+'"'+(checked?' checked':'')+'>'+p+'</label>';
    }).join('');
    var fileCount = (c.files||[]).length;
    return '<tr data-id="'+c.id+'">'+
      '<td><input type="date" data-collection="comms" data-id="'+c.id+'" data-field="date" value="'+escapeHtml(c.date||todayStr())+'"></td>'+
      '<td><select data-collection="comms" data-id="'+c.id+'" data-field="dept" style="background:'+dc.bg+';color:'+dc.fg+';">'+deptOpts+'</select></td>'+
      '<td><select data-collection="comms" data-id="'+c.id+'" data-field="workCategory">'+workOpts+'</select></td>'+
      '<td><input type="text" class="comm-narrow-input" placeholder="상대방" data-collection="comms" data-id="'+c.id+'" data-field="target" value="'+escapeHtml(c.target||'')+'"></td>'+
      '<td><textarea class="cell-textarea" data-collection="comms" data-id="'+c.id+'" data-field="content" rows="1" placeholder="소통 내용 / 협의사항">'+escapeHtml(c.content||'')+'</textarea></td>'+
      '<td><select data-collection="comms" data-id="'+c.id+'" data-field="direction" style="background:'+dirColor.bg+';color:'+dirColor.fg+';">'+dirOpts+'</select></td>'+
      '<td><input type="text" class="comm-narrow-input" placeholder="내선" data-collection="comms" data-id="'+c.id+'" data-field="ext" value="'+escapeHtml(c.ext||'')+'"></td>'+
      '<td><div class="cell-check-group">'+peopleChecks+'</div></td>'+
      '<td><textarea class="cell-textarea" data-collection="comms" data-id="'+c.id+'" data-field="note" rows="1" placeholder="비고">'+escapeHtml(c.note||'')+'</textarea></td>'+
      '<td><details class="filelink-details"><summary>📎 '+(fileCount?fileCount+'개':'첨부')+'</summary>'+renderFileLinks('comms', c)+'</details></td>'+
      '<td><button class="icon-btn danger" data-action="del-row" data-collection="comms" data-id="'+c.id+'" title="삭제">✕</button></td>'+
    '</tr>';
  }

  /* ================= 📔 업무매뉴얼 (분류 탭 + 게시판) ================= */
  function renderManualsTab(){
    if(state.manualActiveId){
      var m = state.manuals.find(function(x){ return x.id===state.manualActiveId; });
      if(m) return renderManualDetail(m);
      state.manualActiveId = null;
    }
    var activeCat = state.manualActiveCat || MANUAL_CATS[0];
    var isAdmin = activeCat==='행정';
    var activeCadence = state.manualActiveCadence || 'all';
    var items = state.manuals.filter(function(m){ return (m.category||MANUAL_CATS[0])===activeCat; })
      .filter(function(m){ return !isAdmin || activeCadence==='all' || (m.cadence||'')===activeCadence; })
      .sort(function(a,b){ return (a.clientTs||0)-(b.clientTs||0); });
    var tabsHtml = MANUAL_CATS.map(function(cat){
      var cnt = state.manuals.filter(function(m){ return (m.category||MANUAL_CATS[0])===cat; }).length;
      var cc = MANUAL_CAT_COLORS[cat];
      var isActive = cat===activeCat;
      var style = isActive ? 'background:'+cc.bg+';color:'+cc.fg+';border-color:'+cc.bg+';' : '';
      return '<button class="subtab-btn" data-action="manual-set-cat" data-cat="'+cat+'" style="'+style+'">'+cat+' <span class="subtab-count">'+cnt+'</span></button>';
    }).join('');
    var cadenceBarHtml = '';
    if(isAdmin){
      var cadenceTabs = ['all'].concat(MANUAL_CADENCES).map(function(cad){
        var label = cad==='all' ? '전체' : cad;
        var cnt = cad==='all' ? state.manuals.filter(function(m){ return (m.category||MANUAL_CATS[0])==='행정'; }).length
          : state.manuals.filter(function(m){ return (m.category||MANUAL_CATS[0])==='행정' && (m.cadence||'')===cad; }).length;
        var cc = cad==='all' ? SHARED_COLOR : MANUAL_CADENCE_COLORS[cad];
        var isActive = cad===activeCadence;
        var style = isActive ? 'background:'+cc.bg+';color:'+cc.fg+';border-color:'+cc.bg+';' : '';
        return '<button class="subtab-btn" data-action="manual-set-cadence" data-cadence="'+cad+'" style="'+style+'">'+label+' <span class="subtab-count">'+cnt+'</span></button>';
      }).join('');
      cadenceBarHtml = '<div class="subtab-bar" style="margin-top:6px;">'+cadenceTabs+'</div>';
    }
    var rows = items.map(function(m){
      var fileCount = (m.files||[]).length;
      var cadenceBadge = (isAdmin && m.cadence) ? badge(m.cadence, MANUAL_CADENCE_COLORS)+' ' : '';
      return '<tr class="board-row" data-action="open-manual" data-id="'+m.id+'">'+
        '<td class="board-title-cell">'+cadenceBadge+escapeHtml(m.title||'(제목 없음)')+(fileCount?' <span class="manual-file-count">📎 '+fileCount+'</span>':'')+'</td>'+
        '<td class="task-content-preview" style="width:100px;">'+escapeHtml(m.createdBy||'')+'</td>'+
        '<td class="task-content-preview" style="width:100px;">'+fmtTs(m.updatedAt||m.clientTs)+'</td>'+
      '</tr>';
    }).join('');
    var listHtml = items.length ?
      '<table class="board-table"><thead><tr><th>제목</th><th style="width:100px">작성자</th><th style="width:100px">수정일</th></tr></thead><tbody>'+rows+'</tbody></table>'
      : '<div class="empty-state">"'+activeCat+'" 분류에 등록된 매뉴얼이 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>📔 업무매뉴얼</h3><button class="btn" data-action="add-manual" data-cat="'+activeCat+'">+ 새 매뉴얼 작성</button></div>'+
      '<div class="subtab-bar">'+tabsHtml+'</div>'+
      cadenceBarHtml+
      listHtml+
    '</div>';
  }
  function renderManualDetail(m){
    var cat = m.category || MANUAL_CATS[0];
    var mc = MANUAL_CAT_COLORS[cat] || {fg:'#888',bg:'#eee'};
    var catOpts = MANUAL_CATS.map(function(c){ return '<option value="'+c+'"'+(cat===c?' selected':'')+'>'+c+'</option>'; }).join('');
    var cadenceSelect = '';
    if(cat==='행정'){
      var cad = m.cadence || '';
      var cadc = MANUAL_CADENCE_COLORS[cad] || {fg:'#888',bg:'#eee'};
      var cadOpts = '<option value="">주기 선택</option>'+MANUAL_CADENCES.map(function(c){ return '<option value="'+c+'"'+(cad===c?' selected':'')+'>'+c+'</option>'; }).join('');
      cadenceSelect = '<select class="status-select-sm" data-collection="manuals" data-id="'+m.id+'" data-field="cadence" style="background:'+cadc.bg+';color:'+cadc.fg+';">'+cadOpts+'</select>';
    }
    var metaParts = [];
    if(m.createdBy) metaParts.push(escapeHtml(m.createdBy));
    metaParts.push('작성일 '+fmtTs(m.clientTs||m.createdAt));
    if(m.updatedAt && m.updatedAt!==m.clientTs) metaParts.push('최근 수정 '+fmtTs(m.updatedAt));
    return '<div class="card">'+
      '<button class="btn ghost sm" data-action="close-manual">← 목록으로</button>'+
      '<div class="doc-item-head" style="margin-top:12px;">'+
        '<select class="status-select-sm" data-collection="manuals" data-id="'+m.id+'" data-field="category" style="background:'+mc.bg+';color:'+mc.fg+';">'+catOpts+'</select>'+
        cadenceSelect+
        '<input type="text" class="doc-title-input" placeholder="매뉴얼 제목 (예: 중재 업무 매뉴얼)" data-collection="manuals" data-id="'+m.id+'" data-field="title" value="'+escapeHtml(m.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-manual-and-close" data-id="'+m.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="note-meta">'+metaParts.join(' · ')+'</div>'+
      '<textarea class="doc-content-input manual-content" placeholder="업무 절차, 참고사항 등을 자유롭게 정리하세요" data-collection="manuals" data-id="'+m.id+'" data-field="content">'+escapeHtml(m.content||'')+'</textarea>'+
      renderFileLinks('manuals', m)+
    '</div>';
  }

  /* ================= 🗂 자료실 (분류 탭 + 게시판 형식, 실제 파일 업로드) ================= */
  function renderFilesTab(){
    if(state.fileActiveId){
      var f0 = state.files.find(function(x){ return x.id===state.fileActiveId; });
      if(f0) return renderFileDetail(f0);
      state.fileActiveId = null;
    }
    var activeCat = state.fileActiveCat || FILE_CATS[0];
    var items = state.files.filter(function(f){ return (f.category||FILE_CATS[0])===activeCat; })
      .sort(function(a,b){ return (b.clientTs||0)-(a.clientTs||0); });
    var tabsHtml = FILE_CATS.map(function(cat){
      var cnt = state.files.filter(function(f){ return (f.category||FILE_CATS[0])===cat; }).length;
      var cc = FILE_CAT_COLORS[cat];
      var isActive = cat===activeCat;
      var style = isActive ? 'background:'+cc.bg+';color:'+cc.fg+';border-color:'+cc.bg+';' : '';
      return '<button class="subtab-btn" data-action="file-set-cat" data-cat="'+cat+'" style="'+style+'">'+cat+' <span class="subtab-count">'+cnt+'</span></button>';
    }).join('');
    var rows = items.map(function(f){
      return '<tr class="board-row" data-action="open-file" data-id="'+f.id+'">'+
        '<td class="board-title-cell">'+escapeHtml(f.title||'(제목 없음)')+(f.url?' <span class="manual-file-count">📎</span>':'')+'</td>'+
        '<td class="task-content-preview" style="width:100px;">'+escapeHtml(f.date||'')+'</td>'+
        '<td class="task-content-preview" style="width:100px;">'+escapeHtml(f.createdBy||'')+'</td>'+
      '</tr>';
    }).join('');
    var listHtml = items.length ?
      '<table class="board-table"><thead><tr><th>자료명</th><th style="width:100px">날짜</th><th style="width:100px">등록자</th></tr></thead><tbody>'+rows+'</tbody></table>'
      : '<div class="empty-state">"'+activeCat+'" 분류에 등록된 자료가 없습니다.</div>';
    return '<div class="card">'+
      '<div class="card-head"><h3>🗂 자료실</h3><button class="btn" data-action="add-file" data-cat="'+activeCat+'">+ 자료 추가</button></div>'+
      '<div class="subtab-bar">'+tabsHtml+'</div>'+
      listHtml+
    '</div>';
  }
  function renderFileDetail(f){
    var cat = f.category || FILE_CATS[0];
    var fc = FILE_CAT_COLORS[cat] || {fg:'#888',bg:'#eee'};
    var catOpts = FILE_CATS.map(function(c){ return '<option value="'+c+'"'+(cat===c?' selected':'')+'>'+c+'</option>'; }).join('');
    var uploadId = 'fileupload-'+f.id;
    return '<div class="card">'+
      '<button class="btn ghost sm" data-action="close-file">← 목록으로</button>'+
      '<div class="doc-item-head" style="margin-top:12px;">'+
        '<select class="status-select-sm" data-collection="files" data-id="'+f.id+'" data-field="category" style="background:'+fc.bg+';color:'+fc.fg+';">'+catOpts+'</select>'+
        '<input type="text" class="doc-title-input" placeholder="자료명" data-collection="files" data-id="'+f.id+'" data-field="title" value="'+escapeHtml(f.title||'')+'">'+
        '<button class="icon-btn danger" data-action="del-file-and-close" data-id="'+f.id+'" title="삭제">✕</button>'+
      '</div>'+
      '<div class="doc-meta-row">'+
        '<input type="date" data-collection="files" data-id="'+f.id+'" data-field="date" value="'+escapeHtml(f.date||todayStr())+'">'+
        '<span class="note-meta">'+escapeHtml(f.createdBy||'')+'</span>'+
      '</div>'+
      '<div class="filelinks">'+
        (f.url ? '<div class="filelink-chip" title="'+escapeHtml(f.title||'')+'"><span class="filelink-icon">📄</span><a class="filelink-chip-name" href="'+escapeHtml(f.url)+'" target="_blank" rel="noopener">'+escapeHtml(f.title||'파일')+'</a>'+(previewKind(f.title)==='pdf'?'<span class="filelink-type-badge">PDF</span>':'')+'</div>' : '<div class="comments-empty">업로드된 파일이 없습니다.</div>')+
        (f.url && previewKind(f.title) === 'image' ? '<img class="filelink-preview-img" src="'+escapeHtml(f.url)+'" loading="lazy" alt="'+escapeHtml(f.title||'')+'">' : '')+
        '<input type="file" class="filelink-upload-input hidden" id="'+uploadId+'" data-collection="files" data-id="'+f.id+'" data-single="1">'+
        '<button class="btn ghost sm" type="button" data-action="trigger-upload" data-target="'+uploadId+'">📤 '+(f.url?'파일 교체':'파일 업로드')+'</button>'+
      '</div>'+
    '</div>';
  }

  /* ---------------- 표 안 첨부파일/비고 팝업 위치 계산 (뷰포트 기준 고정) ----------------
     .table-scroll처럼 overflow:auto인 조상 안에 있으면 position:absolute는 스크롤 영역에 잘려서
     이상하게 스크롤되는 문제가 있었어요. 그래서 position:fixed로 띄우고, 여기서 summary 버튼의
     실제 화면 좌표를 계산해 top/left를 직접 지정합니다(화면 밖으로 나가지 않도록 보정 포함). */
  function positionFloatingPanel(detailsEl){
    var panel = detailsEl.querySelector('.filelinks, .comments-box');
    var summary = detailsEl.querySelector('summary');
    if(!panel || !summary) return;
    var rect = summary.getBoundingClientRect();
    var panelWidth = panel.offsetWidth || 250;
    var panelHeight = panel.offsetHeight || 200;
    var left = rect.right - panelWidth;
    if(left < 8) left = 8;
    var maxLeft = window.innerWidth - panelWidth - 8;
    if(left > maxLeft) left = Math.max(8, maxLeft);
    var top = rect.bottom + 4;
    if(top + panelHeight > window.innerHeight - 8){
      // 아래쪽 공간이 부족하면 버튼 위쪽에 띄웁니다.
      top = rect.top - panelHeight - 4;
      if(top < 8) top = 8;
    }
    panel.style.top = top+'px';
    panel.style.left = left+'px';
  }
  function repositionAllOpenPanels(){
    document.querySelectorAll('.filelink-details[open]').forEach(positionFloatingPanel);
  }
  // <details>의 toggle 이벤트는 버블링되지 않지만, 캡처 단계에서는 조상 리스너까지 전달되므로
  // capture:true로 등록해서 어떤 첨부파일/비고 팝업이 열리든 한 곳에서 처리합니다.
  document.addEventListener('toggle', function(e){
    var d = e.target;
    if(!d || d.tagName!=='DETAILS' || !d.classList.contains('filelink-details')) return;
    if(d.open){ requestAnimationFrame(function(){ positionFloatingPanel(d); }); }
  }, true);
  window.addEventListener('scroll', repositionAllOpenPanels, true);
  window.addEventListener('resize', repositionAllOpenPanels);

  /* ---------------- Event Delegation (appShell 전체 — 사이드바 포함) ---------------- */
  var mainEl = document.getElementById('appShell');

  mainEl.addEventListener('click', function(e){
    var el = e.target.closest('[data-action]');
    if(!el) return;
    var action = el.dataset.action;
    var col = el.dataset.collection, id = el.dataset.id;

    if(action==='add-announcement'){
      addRow('announcements', { title:'', content:'', date:todayStr() }, function(newId){
        state.announcementActiveId = newId;
        renderActiveTab();
      });
    }
    else if(action==='add-task') addRow('tasks', { major:(state.taskActiveMajor==='전체'?MAJOR_CATS[0]:state.taskActiveMajor), minor:'', title:'', date:todayStr(), endDate:'', status:'시작 전', content:'', assignees:PEOPLE.slice(), comments:[], files:[], important:false });
    else if(action==='toggle-task-important'){
      if(!requireFirebase()) return;
      var curTask = state.tasks.find(function(x){ return x.id===el.dataset.id; });
      flushSaveNow('tasks', el.dataset.id, 'important', !(curTask && curTask.important));
    }
    else if(action==='add-personal') addRow('personal', { owner:el.dataset.owner, category:'', title:'', content:'', status:'시작 전', startDate:'', deadline:'', followUp:false, note:'', files:[] });
    else if(action==='add-meeting'){
      var mType = el.dataset.type || state.meetingActiveType || MEETING_TYPES[0];
      addRow('meetings', { meetingType:mType, title:'', date:todayStr(), time:'', attendees:PEOPLE.slice(), content:'', files:[] }, function(newId){
        state.meetingActiveId = newId;
        renderActiveTab();
      });
    }
    else if(action==='add-idea') addRow('ideas', { title:'', content:'', status:'검토중', date:todayStr(), files:[] });
    else if(action==='add-comm') addRow('comms', { date:todayStr(), dept:COMM_DEPTS[0], workCategory:COMM_WORK_CATS[0], target:'', content:'', direction:COMM_DIRECTIONS[0], ext:'', participants:[], note:'', files:[] });
    else if(action==='add-manual'){
      var mCat = el.dataset.cat || state.manualActiveCat || MANUAL_CATS[0];
      addRow('manuals', { category:mCat, cadence:'', title:'', content:'', files:[] }, function(newId){
        state.manualActiveId = newId;
        renderActiveTab();
      });
    }
    else if(action==='add-file'){
      var fCat = el.dataset.cat || state.fileActiveCat || FILE_CATS[0];
      addRow('files', { category:fCat, title:'', url:'', date:todayStr() }, function(newId){
        state.fileActiveId = newId;
        renderActiveTab();
      });
    }
    else if(action==='add-dday') addRow('dday', { title:'', date:todayStr() });
    else if(action==='add-recur') addRow('recurring', { label:'', cadence: el.dataset.cadence, lastDonePeriod:'', status:'시작 전', statusPeriod:'' });
    else if(action==='add-pin'){
      var pinInput = document.getElementById('pinQuickInput');
      if(pinInput && pinInput.value.trim()){ addRow('pins', { text: pinInput.value.trim(), done:false }); pinInput.value=''; }
    }
    else if(action==='del-row') delRow(col, id);
    else if(action==='del-filelink') delFileLink(col, id, el.dataset.item);
    else if(action==='toggle-file-preview'){
      // 전체 화면을 다시 그리면 열려 있던 첨부파일/비고 팝업(details)이 도로 닫혀버리기 때문에,
      // 여기서는 미리보기 요소만 가볍게 추가/삭제합니다.
      var pid = el.dataset.item;
      var willOpen = !state.filePreviewOpen[pid];
      state.filePreviewOpen[pid] = willOpen;
      var wrap = el.closest('.filelink-chip-wrap');
      if(wrap){
        var existing = wrap.querySelector('.filelink-preview, .filelink-preview-img');
        if(existing) existing.remove();
        if(willOpen){
          // 이 토글 버튼은 이제 이미지 파일에만 붙어요 (PDF는 새 탭에서 온전히 보는 쪽이 더 나아서 PDF 배지로 대체했어요).
          var panel = document.createElement('img');
          panel.className = 'filelink-preview-img';
          panel.alt = '';
          panel.src = el.dataset.url;
          panel.loading = 'lazy';
          wrap.appendChild(panel);
        }
      }
      el.textContent = willOpen ? '🔽' : '👁';
      var detailsAncestor = el.closest('.filelink-details');
      if(detailsAncestor && detailsAncestor.open) requestAnimationFrame(function(){ positionFloatingPanel(detailsAncestor); });
    }
    else if(action==='trigger-upload'){
      var fi = document.getElementById(el.dataset.target);
      if(fi) fi.click();
    }
    else if(action==='add-comment'){
      var inputEl = el.parentElement.querySelector('.comment-input');
      if(inputEl){ addComment(col, id, inputEl.value); inputEl.value=''; }
    }
    else if(action==='edit-comment') editComment(col, id, el.dataset.item);
    else if(action==='del-comment') delComment(col, id, el.dataset.item);
    else if(action==='task-set-major'){ state.taskActiveMajor = el.dataset.major; renderActiveTab(); }
    else if(action==='toggle-recurring-panel'){ state.taskShowRecurringPanel = !state.taskShowRecurringPanel; renderActiveTab(); }
    else if(action==='show-task-enddate'){ state.taskEndDateOpen[el.dataset.id] = true; renderActiveTab(); }
    else if(action==='show-personal-deadline'){ state.personalDeadlineOpen[el.dataset.id] = true; renderActiveTab(); }
    else if(action==='open-date-picker'){
      var dateInput = document.getElementById(el.dataset.target);
      if(dateInput){
        if(dateInput.showPicker){ try{ dateInput.showPicker(); }catch(err){ dateInput.focus(); } }
        else { dateInput.focus(); }
      }
    }
    else if(action==='personal-set-owner'){ state.personalActiveOwner = el.dataset.owner; renderActiveTab(); }
    else if(action==='manual-set-cat'){ state.manualActiveCat = el.dataset.cat; state.manualActiveCadence = 'all'; renderActiveTab(); }
    else if(action==='manual-set-cadence'){ state.manualActiveCadence = el.dataset.cadence; renderActiveTab(); }
    else if(action==='open-manual'){ state.manualActiveId = id; renderActiveTab(); }
    else if(action==='close-manual'){
      var mm = state.manuals.find(function(x){ return x.id===state.manualActiveId; });
      if(mm) state.manualActiveCat = mm.category || MANUAL_CATS[0];
      state.manualActiveId = null;
      renderActiveTab();
    }
    else if(action==='del-manual-and-close'){
      if(!requireFirebase()) return;
      if(!confirm('이 매뉴얼을 삭제할까요?')) return;
      db.collection('manuals').doc(id).delete().then(function(){ state.manualActiveId=null; renderActiveTab(); }).catch(function(err){ showToast('삭제 실패: '+err.message); });
    }
    else if(action==='file-set-cat'){ state.fileActiveCat = el.dataset.cat; renderActiveTab(); }
    else if(action==='open-file'){ state.fileActiveId = id; renderActiveTab(); }
    else if(action==='close-file'){
      var ff = state.files.find(function(x){ return x.id===state.fileActiveId; });
      if(ff) state.fileActiveCat = ff.category || FILE_CATS[0];
      state.fileActiveId = null;
      renderActiveTab();
    }
    else if(action==='del-file-and-close'){
      if(!requireFirebase()) return;
      if(!confirm('이 자료를 삭제할까요?')) return;
      db.collection('files').doc(id).delete().then(function(){ state.fileActiveId=null; renderActiveTab(); }).catch(function(err){ showToast('삭제 실패: '+err.message); });
    }
    else if(action==='open-announcement'){ state.announcementActiveId = id; renderActiveTab(); }
    else if(action==='close-announcement'){ state.announcementActiveId = null; renderActiveTab(); }
    else if(action==='del-announcement-and-close'){
      if(!requireFirebase()) return;
      if(!confirm('이 공지사항을 삭제할까요?')) return;
      db.collection('announcements').doc(id).delete().then(function(){ state.announcementActiveId=null; renderActiveTab(); }).catch(function(err){ showToast('삭제 실패: '+err.message); });
    }
    else if(action==='meeting-set-type'){ state.meetingActiveType = el.dataset.type; renderActiveTab(); }
    else if(action==='open-meeting'){ state.meetingActiveId = id; renderActiveTab(); }
    else if(action==='close-meeting'){
      var mtg = state.meetings.find(function(x){ return x.id===state.meetingActiveId; });
      if(mtg) state.meetingActiveType = mtg.meetingType || MEETING_TYPES[0];
      state.meetingActiveId = null;
      renderActiveTab();
    }
    else if(action==='del-meeting-and-close'){
      if(!requireFirebase()) return;
      if(!confirm('이 회의록을 삭제할까요?')) return;
      db.collection('meetings').doc(id).delete().then(function(){ state.meetingActiveId=null; renderActiveTab(); }).catch(function(err){ showToast('삭제 실패: '+err.message); });
    }
    else if(action==='sort-tasks'){
      var f = el.dataset.field;
      if(state.taskSortField===f){ state.taskSortDir = state.taskSortDir==='asc' ? 'desc' : 'asc'; }
      else { state.taskSortField = f; state.taskSortDir = 'asc'; }
      renderActiveTab();
    }
    else if(action==='sort-comms'){
      var cf = el.dataset.field;
      if(state.commSortField===cf){ state.commSortDir = state.commSortDir==='asc' ? 'desc' : 'asc'; }
      else { state.commSortField = cf; state.commSortDir = 'asc'; }
      renderActiveTab();
    }
    else if(action==='sort-personal'){
      var pf = el.dataset.field;
      if(state.personalSortField===pf){ state.personalSortDir = state.personalSortDir==='asc' ? 'desc' : 'asc'; }
      else { state.personalSortField = pf; state.personalSortDir = 'asc'; }
      renderActiveTab();
    }
    else if(action==='reset-task-sort'){ state.taskSortField = null; state.taskSortDir = 'asc'; renderActiveTab(); }
    else if(action==='reset-personal-sort'){ state.personalSortField = null; state.personalSortDir = 'asc'; renderActiveTab(); }
    else if(action==='reset-comm-sort'){ state.commSortField = null; state.commSortDir = 'asc'; renderActiveTab(); }
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
    else if(action==='sidebar-goto-date'){
      state.calSelectedDate = el.dataset.date;
      state.activeTab = 'calendar';
      renderActiveTab();
    }
    else if(action==='goto-board'){ state.activeTab = el.dataset.tab; renderActiveTab(); }
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
    if(t.tagName==='TEXTAREA' && t.classList.contains('doc-content-input')) autoGrow(t);
    else if(t.tagName==='TEXTAREA') autoGrowCell(t);
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

  // 표 안 칸(textarea)에 포커스가 들어오면 타이핑하기 편하도록 최대 180px까지 펼쳐줍니다.
  mainEl.addEventListener('focusin', function(e){
    var t = e.target;
    if(t.tagName==='TEXTAREA' && !t.classList.contains('doc-content-input')) autoGrowCell(t);
  });

  // 포커스가 빠져나가면 즉시 저장 확정 + 밀린 재렌더링 반영
  mainEl.addEventListener('focusout', function(e){
    var t = e.target;
    // 체크박스는 change 이벤트에서 이미 t.checked(불리언)로 저장했으므로 여기서는 건드리지 않아요.
    // (여기서 t.value를 쓰면 체크박스의 value는 항상 문자열 "on"이라 방금 저장한 "해제(false)"를 덮어써버리는 버그가 있었어요.)
    if(t.dataset.field && t.dataset.collection && t.tagName!=='SELECT' && !(t.tagName==='INPUT' && t.type==='checkbox')){
      if(t.dataset.nested==='files'){
        flushSaveNestedNow(t.dataset.collection, t.dataset.id, 'files', t.dataset.item, t.dataset.field, t.value);
      } else {
        flushSaveNow(t.dataset.collection, t.dataset.id, t.dataset.field, t.value);
      }
    }
    // 표 안 칸(textarea)은 포커스를 벗어나면 다시 고정된 낮은 높이로 접어 행 높이를 맞춥니다.
    if(t.tagName==='TEXTAREA' && !t.classList.contains('doc-content-input')) t.style.height='';
    if(pendingRerender){ pendingRerender=false; renderActiveTab(); }
  });

  // select / date / checkbox / 파일 업로드 등 값이 바뀌는 즉시 저장
  mainEl.addEventListener('change', function(e){
    var t = e.target;
    if(t.id==='filterPerson'){ state.taskFilterPerson = t.value; renderActiveTab(); return; }
    if(t.id==='filterStatus'){ state.taskFilterStatus = t.value; renderActiveTab(); return; }
    if(t.id==='hideCompletedToggle'){ state.taskHideCompleted = t.checked; renderActiveTab(); return; }
    if(t.id==='personalHideCompletedToggle'){ state.personalHideCompleted = t.checked; renderActiveTab(); return; }
    if(t.id==='calFilterSelect'){ state.calFilter = t.value; renderActiveTab(); return; }
    if(t.type==='file' && t.classList.contains('filelink-upload-input')){
      if(t.files && t.files[0]){
        if(t.dataset.single==='1') uploadSingleField(t.dataset.collection, t.dataset.id, t.files[0]);
        else uploadFile(t.dataset.collection, t.dataset.id, t.files[0]);
      }
      return;
    }
    if(t.dataset.field==='category' && t.dataset.collection==='personal' && t.value==='__new__'){
      var newCat = prompt('새 분류 이름을 입력하세요');
      if(newCat && newCat.trim()){ flushSaveNow('personal', t.dataset.id, 'category', newCat.trim()); }
      else { renderActiveTab(); }
      return;
    }
    if(t.dataset.field==='minor' && t.dataset.collection==='tasks' && t.value==='__new__'){
      var newMinor = prompt('새 소분류 이름을 입력하세요');
      if(newMinor && newMinor.trim()){ flushSaveNow('tasks', t.dataset.id, 'minor', newMinor.trim()); }
      else { renderActiveTab(); }
      return;
    }
    // 담당자 드롭다운(지수/다경/지수·다경)은 실제로는 tasks.assignees 배열 필드로 저장돼요.
    if(t.dataset.field==='assigneesSelect'){
      var arr = t.value==='both' ? PEOPLE.slice() : (t.value ? [t.value] : []);
      flushSaveNow(t.dataset.collection, t.dataset.id, 'assignees', arr);
      return;
    }
    // 정기업무 진행도: 어느 "기간"에 대한 상태인지(statusPeriod)도 같이 저장해서, 기간이 바뀌면
    // (다음달/다음분기 등) 예전 상태가 자동으로 "시작 전"으로 보이도록(=자동 리셋) 해요.
    if(t.dataset.field==='recurStatus'){
      if(!db) return;
      var period = t.dataset.period, newStatus = t.value;
      var payload = { status:newStatus, statusPeriod:period, lastDonePeriod:(newStatus==='완료'?period:''), updatedAt:Date.now() };
      db.collection('recurring').doc(t.dataset.id).update(payload).catch(function(err){ showToast('저장 실패: '+err.message); });
      return;
    }
    if(!t.dataset.field || !t.dataset.collection) return;
    var val = t.type==='checkbox' ? t.checked : t.value;
    flushSaveNow(t.dataset.collection, t.dataset.id, t.dataset.field, val);
    if(t.dataset.field==='status' && STATUS_COLORS[val]){
      t.style.background = STATUS_COLORS[val].bg; t.style.color = STATUS_COLORS[val].fg;
    }
    if(t.dataset.field==='minor'){
      var mc2 = MINOR_CAT_COLORS[val] || (val ? hashColor(val) : {fg:'#888',bg:'#f0f0f0'});
      t.style.background = mc2.bg; t.style.color = mc2.fg;
    }
    if(t.dataset.field==='direction' && DIRECTION_COLORS[val]){
      t.style.background = DIRECTION_COLORS[val].bg; t.style.color = DIRECTION_COLORS[val].fg;
    }
    if(t.dataset.field==='dept' && COMM_DEPT_COLORS[val]){
      t.style.background = COMM_DEPT_COLORS[val].bg; t.style.color = COMM_DEPT_COLORS[val].fg;
    }
    if(t.dataset.field==='category' && t.dataset.collection==='manuals' && MANUAL_CAT_COLORS[val]){
      t.style.background = MANUAL_CAT_COLORS[val].bg; t.style.color = MANUAL_CAT_COLORS[val].fg;
    }
    if(t.dataset.field==='cadence' && t.dataset.collection==='manuals'){
      var cadc2 = MANUAL_CADENCE_COLORS[val] || {fg:'#888',bg:'#eee'};
      t.style.background = cadc2.bg; t.style.color = cadc2.fg;
    }
    if(t.dataset.field==='category' && t.dataset.collection==='files' && FILE_CAT_COLORS[val]){
      t.style.background = FILE_CAT_COLORS[val].bg; t.style.color = FILE_CAT_COLORS[val].fg;
    }
    if(t.dataset.field==='category' && t.dataset.collection==='personal' && val!=='__new__'){
      var hc = PERSONAL_CAT_COLORS[val] || hashColor(val);
      t.style.background = hc.bg; t.style.color = hc.fg;
    }
  });

  // Enter로 바로 등록: 업무 리스트 비고, 사이드바 메모
  mainEl.addEventListener('keydown', function(e){
    if(e.key==='Enter' && e.target.classList.contains('comment-input')){
      e.preventDefault();
      addComment(e.target.dataset.collection, e.target.dataset.id, e.target.value);
      e.target.value='';
    }
    if(e.key==='Enter' && e.target.id==='pinQuickInput'){
      e.preventDefault();
      if(e.target.value.trim()){ addRow('pins', { text: e.target.value.trim(), done:false }); e.target.value=''; }
    }
  });

  /* ---------------- Init ---------------- */
  renderActiveTab();
  initFirebase();
})();
