// 8단계 (12차): 시뮬레이션 HTML을 내 컴퓨터에서 띄우고, 화면의 "지금 병상 불러오기" 버튼이
// E-Gen 실시간 가용병상을 바로 가져올 수 있게 해 주는 작은 로컬 서버.
//
// 왜 서버가 필요한가
//   - 브라우저가 apis.data.go.kr 을 직접 부르면 CORS 때문에 막히는 경우가 많고,
//   - 인증키를 HTML에 넣으면 파일을 공유할 때 키가 같이 퍼진다.
//   이 서버가 키를 환경변수로만 들고 대신 API를 부른다. 키는 브라우저로 보내지 않는다.
//
// 사용법 (seoul_er_simulation 폴더에서, Node 18 이상, 추가 설치 없음):
//   .env.local 에 키가 있으면:  node scripts/8_live_server.js
//   환경변수로 줄 때 — Windows PowerShell:  $env:EGEN_SERVICE_KEY="<일반 인증키(Encoding)>"; node scripts/8_live_server.js
//   macOS/Linux:         EGEN_SERVICE_KEY="<일반 인증키(Encoding)>" node scripts/8_live_server.js
//   → 브라우저에서 http://localhost:8787 을 연다 (열면 자동으로 한 번 불러옴).
//
//   다른 HTML을 띄우려면:  node scripts/8_live_server.js ../seoul_er_dispatch_map_9.html
//   포트 바꾸기:            $env:PORT="9000"
//
// 동작
//   GET /                 → 지정한 HTML 한 개만 내려준다(폴더 전체를 공개하지 않음).
//   GET /api/egen-live    → getEmrrmRltmUsefulSckbdInfoInqire(STAGE1=서울특별시) 조회 결과를 JSON으로.
//                           7b와 같은 형식으로 data/bed_snapshots/raw/egen_YYYYMMDD_HHMM.json 에도 저장하므로
//                           나중에 7c를 돌리면 이 조회분이 고정 스냅샷 목록에도 들어간다.
//                           60초 안에 다시 부르면 저장해 둔 결과를 돌려준다(일일 호출 한도 보호).
//   127.0.0.1 에만 열린다(같은 컴퓨터에서만 접속 가능).
//   HTML을 폴더에서 직접 열어도(file://) 이 서버가 켜져 있으면 /api/egen-live 를 부를 수 있다(CORS 허용).
//   가장 쉬운 실행: 저장소 루트의 "시뮬레이션_실행.bat" 더블클릭 → 서버 시작 + 브라우저 열기.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.resolve(ROOT, process.argv[2] || path.join('..', 'seoul_er_dispatch_map_9.html'));
const PORT = Number(process.env.PORT) || 8787;
const OUT_DIR = path.join(ROOT, 'data', 'bed_snapshots', 'raw');
const BASE = process.env.EGEN_BASE_URL || 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire';
const CACHE_MS = 60 * 1000;

// 키는 ① 환경변수 EGEN_SERVICE_KEY, 없으면 ② seoul_er_simulation/.env.local 의
// EGEN_SERVICE_KEY=... 줄에서 읽는다. .env.local 은 .gitignore 에 들어 있어 커밋되지 않는다.
function readEnvLocal() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const m = txt.match(/^\s*EGEN_SERVICE_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}

function getKey() {
  const k = (process.env.EGEN_SERVICE_KEY || readEnvLocal()).trim();
  if (!k) return null;
  return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k);
}

// 7b_fetch_egen_realtime.js 와 같은 파서
function parseItems(xml) {
  const code = (xml.match(/<resultCode>([^<]*)<\/resultCode>/) || [])[1];
  const msg = (xml.match(/<resultMsg>([^<]*)<\/resultMsg>/) || [])[1];
  if (code !== '00') {
    throw new Error(`API 오류 resultCode=${code} resultMsg=${msg} · 응답 앞부분: ${xml.slice(0, 200)}`);
  }
  const total = Number((xml.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || 0);
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = {};
    const tre = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
    let t;
    while ((t = tre.exec(m[1]))) it[t[1]] = t[2].trim();
    items.push(it);
  }
  return { total, items };
}

function kstStamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return {
    iso: k.toISOString().replace('Z', '+09:00'),
    file: `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}_${pad(k.getUTCHours())}${pad(k.getUTCMinutes())}`,
  };
}

let cache = null; // {at, body}

async function fetchEgen() {
  if (cache && Date.now() - cache.at < CACHE_MS) return Object.assign({}, cache.body, { cached: true });
  const key = getKey();
  if (!key) throw new Error('인증키가 없습니다. seoul_er_simulation/.env.local 에 EGEN_SERVICE_KEY=... 를 넣거나 환경변수로 주고 서버를 다시 실행하세요.');
  const all = [];
  let page = 1, total = Infinity;
  while (all.length < total && page <= 5) {
    const url = `${BASE}?serviceKey=${key}&STAGE1=${encodeURIComponent('서울특별시')}&pageNo=${page}&numOfRows=100`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let res, xml;
    try {
      res = await fetch(url, { signal: ctrl.signal });
      xml = await res.text();
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${xml.slice(0, 200)}`);
    const r = parseItems(xml);
    total = r.total;
    all.push(...r.items);
    if (r.items.length === 0) break;
    page++;
  }
  const st = kstStamp(new Date());
  const body = {
    source: 'egen_realtime',
    operation: 'getEmrrmRltmUsefulSckbdInfoInqire',
    fetchedAtKST: st.iso,
    totalCount: total,
    items: all,
  };
  let savedAs = null;
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, `egen_${st.file}.json`);
    fs.writeFileSync(out, JSON.stringify(body, null, 1), 'utf8');
    savedAs = path.relative(ROOT, out);
  } catch (e) {
    console.warn('원본 저장 실패(조회 결과는 그대로 사용):', e.message);
  }
  cache = { at: Date.now(), body: Object.assign({ savedAs }, body) };
  return cache.body;
}

// 파일로 직접 연 HTML(file://, Origin: null)과 이 서버 자신만 API 응답을 읽을 수 있게 한다.
function allowOrigin(req) {
  const o = req.headers.origin;
  return o === 'null' || o === `http://localhost:${PORT}` || o === `http://127.0.0.1:${PORT}` ? o : null;
}

function send(res, code, type, body, origin) {
  const h = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (origin) { h['Access-Control-Allow-Origin'] = origin; h['Vary'] = 'Origin'; }
  res.writeHead(code, h);
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(HTML));
    }
    if (url.pathname === '/api/egen-live') {
      const t0 = Date.now();
      const body = await fetchEgen();
      console.log(`[${new Date().toLocaleTimeString()}] 실시간 병상 ${body.items.length}건${body.cached ? ' (60초 캐시)' : ''} · ${Date.now() - t0}ms${body.savedAs && !body.cached ? ' · 저장 ' + body.savedAs : ''}`);
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(body), allowOrigin(req));
    }
    if (url.pathname === '/api/health') {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, hasKey: !!getKey() }), allowOrigin(req));
    }
    send(res, 404, 'text/plain; charset=utf-8', 'not found');
  } catch (e) {
    console.error('오류:', e.message);
    send(res, 502, 'application/json; charset=utf-8', JSON.stringify({ error: String(e.message || e) }), allowOrigin(req));
  }
});

if (!fs.existsSync(HTML)) {
  console.error(`HTML 파일이 없습니다: ${HTML}\n  node scripts/8_live_server.js <HTML 경로> 로 지정하세요.`);
  process.exit(1);
}
server.listen(PORT, '127.0.0.1', () => {
  console.log(`시뮬레이션: http://localhost:${PORT}  (${path.relative(process.cwd(), HTML)})`);
  console.log(getKey() ? '인증키 확인됨 — 화면을 열면 실시간 병상을 불러옵니다.' : '주의: 인증키(.env.local 또는 EGEN_SERVICE_KEY)가 없어 실시간 조회는 실패합니다(고정 스냅샷은 그대로 사용 가능).');
  console.log('끝내려면 Ctrl+C');
});
