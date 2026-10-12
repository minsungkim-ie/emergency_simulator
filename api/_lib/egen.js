// E-Gen "응급실 실시간 가용병상정보 조회"(getEmrrmRltmUsefulSckbdInfoInqire, STAGE1=서울특별시) 공통 조회 코드.
// 로컬 서버(seoul_er_simulation/scripts/8_live_server.js)와 Vercel 함수(api/egen-live.js)가 같이 쓴다.
// api/ 아래 _ 로 시작하는 폴더는 Vercel이 주소(라우트)로 만들지 않는다.

const BASE = process.env.EGEN_BASE_URL || 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire';

// 일반 인증키(Encoding)는 그대로, Decoding 키면 URL 인코딩해서 쓴다.
function normalizeKey(k) {
  k = (k || '').trim();
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

// key 는 normalizeKey 를 거친 값. 반환: { body, stamp } (body 는 7b와 같은 형식)
async function fetchEgenSeoul(key) {
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
  const stamp = kstStamp(new Date());
  return {
    stamp,
    body: {
      source: 'egen_realtime',
      operation: 'getEmrrmRltmUsefulSckbdInfoInqire',
      fetchedAtKST: stamp.iso,
      totalCount: total,
      items: all,
    },
  };
}

module.exports = { normalizeKey, parseItems, kstStamp, fetchEgenSeoul };
