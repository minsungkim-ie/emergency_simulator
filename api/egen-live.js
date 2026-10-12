// Vercel 함수: GET /api/egen-live → 서울 응급실 실시간 가용병상(JSON).
// 로컬 서버(seoul_er_simulation/scripts/8_live_server.js)의 /api/egen-live 와 같은 응답 형식이라
// seoul_er_dispatch_map_9.html 을 고치지 않고 그대로 쓴다.
//
// 인증키는 Vercel 프로젝트 설정 → Environment Variables 의 EGEN_SERVICE_KEY 에만 둔다(코드·저장소에 넣지 않음).
// 공개 링크라 누가 열 때마다 호출되지 않도록 Vercel CDN이 결과를 CACHE_SEC 동안 재사용한다
// (data.go.kr 일일 호출 한도 보호). 7b/8과 달리 원본 JSON 파일 저장은 하지 않는다(서버리스라 남지 않음).

const { normalizeKey, fetchEgenSeoul } = require('./_lib/egen');

const CACHE_SEC = Number(process.env.EGEN_CACHE_SEC) || 180;

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const key = normalizeKey(process.env.EGEN_SERVICE_KEY);
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: '서버에 인증키가 설정되지 않았습니다(Vercel 환경변수 EGEN_SERVICE_KEY).' }));
  }
  try {
    const { body } = await fetchEgenSeoul(key);
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${CACHE_SEC}, stale-while-revalidate=60`);
    res.statusCode = 200;
    res.end(JSON.stringify(body));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
};
