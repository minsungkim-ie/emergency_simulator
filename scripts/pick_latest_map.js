// Vercel 빌드 단계: 저장소 루트와 html/ 폴더에서 번호가 가장 큰 seoul_er_dispatch_map_<숫자>.html 을 골라
// public/index.html 로 복사한다. 새 판(_11, _12 …)을 올리기만 하면 그 판이 배포된다.
//
// 규칙
//   - 이름이 정확히 seoul_er_dispatch_map_<숫자>.html 인 파일만 (_11_test.html 처럼 뒤에 글자가 붙으면 제외)
//   - 번호는 숫자로 비교한다 (10 > 9)
//
// 사용법 (Node 18 이상, 추가 설치 없음):  node scripts/pick_latest_map.js
// 로컬 서버(seoul_er_simulation/scripts/8_live_server.js)도 같은 규칙을 쓰려고 findLatestMap 을 가져다 쓴다.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const MAP_RE = /^seoul_er_dispatch_map_(\d+)\.html$/;

// 가장 큰 번호 파일의 절대 경로를 돌려준다. 없으면 null.
// dir 을 주면 그 폴더만, 안 주면 저장소 루트와 html/ 를 함께 본다(번호가 같으면 html/ 쪽 우선).
function findLatestMap(dir) {
  const dirs = dir ? [dir] : [REPO_ROOT, path.join(REPO_ROOT, 'html')];
  let best = null;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const name of fs.readdirSync(d)) {
      const m = name.match(MAP_RE);
      if (!m) continue;
      const n = Number(m[1]);
      if (!best || n >= best.n) best = { n, file: path.join(d, name) };
    }
  }
  return best ? best.file : null;
}

module.exports = { findLatestMap };

if (require.main === module) {
  const src = findLatestMap();
  if (!src) {
    console.error(`오류: ${REPO_ROOT} 또는 html/ 에 seoul_er_dispatch_map_<숫자>.html 파일이 없습니다.`);
    process.exit(1);
  }
  const outDir = path.join(REPO_ROOT, 'public');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(src, path.join(outDir, 'index.html'));
  console.log(`배포할 시뮬레이터: ${path.basename(src)} → public/index.html`);
}
