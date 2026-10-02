// 정적 export → GitHub Pages / Vercel 둘 다 가능
// GitHub Pages(아이디.github.io/저장소명)면 NEXT_PUBLIC_BASE_PATH=/저장소명 으로 빌드
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default {
  reactStrictMode: true, output: 'export', trailingSlash: true, basePath,
  // dev 전용: 같은 Wi-Fi 폰에서 http://<PC IP>:3000 접속 허용 (Next 16은 기본 차단)
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
};
