const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const adbPath = path.join(__dirname, '..', 'tools', 'platform-tools', 'adb.exe');
const apkPath = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

console.log('📱 Checking ADB & Connected Galaxy S24 Ultra...');

if (!fs.existsSync(adbPath)) {
  console.error('❌ ADB executable not found at:', adbPath);
  process.exit(1);
}

try {
  const devicesOutput = execSync(`"${adbPath}" devices`, { encoding: 'utf8' });
  console.log(devicesOutput);

  const lines = devicesOutput.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('List of devices'));

  if (lines.length === 0) {
    console.log('⚠️ 연결된 안드로이드 기기를 찾을 수 없습니다.');
    console.log('\n[갤럭시 S24 Ultra USB 디버깅 설정 방법]');
    console.log('1. 스마트폰 [설정] -> [휴대전화 정보] -> [소프트웨어 정보]');
    console.log('2. [빌드 번호] 항목을 연속 7번 터치하여 개발자 옵션 활성화');
    console.log('3. 스마트폰 [설정] 맨 아래 [개발자 옵션] 진입');
    console.log('4. [USB 디버깅] 옵션 켜기');
    console.log('5. USB 케이블 연결 후 팝업창에서 "이 컴퓨터에서 항상 허용" 및 "허용" 선택');
    console.log('\n설정 완료 후 다시 `npm run install-android` 명령어를 실행해주세요.');
    process.exit(0);
  }

  const device = lines[0].split('\t')[0];
  console.log(`✅ 기기 감지됨 (${device}). APK 설치를 진행합니다...`);

  if (!fs.existsSync(apkPath)) {
    console.error('❌ APK 파일을 찾을 수 없습니다:', apkPath);
    process.exit(1);
  }

  console.log(`📦 Installing ${apkPath} to device...`);
  const installResult = execSync(`"${adbPath}" -s ${device} install -r "${apkPath}"`, { encoding: 'utf8' });
  console.log(installResult);
  console.log('🎉 갤럭시 S24 Ultra에 NEO Planner 어플이 성공적으로 설치되었습니다!');

} catch (err) {
  console.error('❌ 설치 중 오류 발생:', err.message);
}
